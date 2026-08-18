/**
 * Service worker: context menus, the toolbar badge, and live-link verification.
 */
import {
  getSettings,
  getOpportunities,
  upsertOpportunity,
  findByUrl,
  hostOf,
  normalizeDomain
} from './lib/store.js';

const MENU_SAVE_PAGE = 'blb-save-page';
const MENU_SAVE_LINK = 'blb-save-link';
const MENU_OPEN_DASHBOARD = 'blb-open-dashboard';

chrome.runtime.onInstalled.addListener(async (details) => {
  buildMenus();
  if (details.reason === 'install') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
  }
});

chrome.runtime.onStartup.addListener(buildMenus);

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SAVE_PAGE,
      title: 'Save this page as a backlink opportunity',
      contexts: ['page', 'selection']
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_LINK,
      title: 'Save linked page as a backlink opportunity',
      contexts: ['link']
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_DASHBOARD,
      title: 'Open backlink dashboard',
      contexts: ['action']
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_OPEN_DASHBOARD) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return;
  }

  const url = info.menuItemId === MENU_SAVE_LINK ? info.linkUrl : info.pageUrl || (tab && tab.url);
  if (!url || !/^https?:/i.test(url)) return;

  const existing = await findByUrl(url);
  const settings = await getSettings();
  const saved = await upsertOpportunity({
    id: existing ? existing.id : undefined,
    url,
    domain: hostOf(url),
    title: info.menuItemId === MENU_SAVE_LINK ? info.selectionText || hostOf(url) : (tab && tab.title) || hostOf(url),
    targetUrl: existing ? existing.targetUrl : settings.targetUrl,
    anchor: existing ? existing.anchor : settings.anchors[0] || '',
    notes: info.selectionText ? String(info.selectionText).slice(0, 500) : existing ? existing.notes : ''
  });

  await flashBadge(tab && tab.id, saved.status);
  refreshBadge(tab && tab.id, url);
});

async function flashBadge(tabId, status) {
  if (tabId == null) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#16a34a' });
  await chrome.action.setBadgeText({ tabId, text: 'SAVE' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: status ? '•' : '' }), 1500);
}

/* ------------------------------------------------------------------ badge */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) refreshBadge(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url) refreshBadge(tabId, tab.url);
  } catch {
    /* tab vanished */
  }
});

async function refreshBadge(tabId, url) {
  if (tabId == null || !/^https?:/i.test(url || '')) return;
  const settings = await getSettings();
  if (!settings.autoBadge) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  const saved = await findByUrl(url);
  let analysis = null;
  try {
    analysis = await chrome.tabs.sendMessage(tabId, { type: 'ANALYZE_PAGE', targets: settings.targets });
  } catch {
    /* no content script on this page (store pages, PDFs, pre-install tabs) */
  }

  let text = '';
  let color = '#64748b';

  if (analysis && analysis.ok && analysis.targetLinks.length) {
    text = String(analysis.targetLinks.length);
    color = analysis.targetLinks.some((l) => l.dofollow) ? '#16a34a' : '#d97706';
  } else if (saved) {
    text = '•';
    color = '#0ea5e9';
  } else if (analysis && analysis.ok && analysis.signals.length) {
    text = '?';
    color = '#7c3aed';
  }

  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
}

/* ----------------------------------------------------- link verification */

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/i;
const REL_RE = /rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/i;

function attrValue(match) {
  if (!match) return '';
  return (match[1] || match[2] || match[3] || '').trim();
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Regex scan rather than DOMParser — service workers have no DOM. */
export function findLinksInHtml(html, baseUrl, targets) {
  const clean = (targets || []).map(normalizeDomain).filter(Boolean);
  const hits = [];
  if (!clean.length) return hits;

  let m;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(html)) !== null) {
    const attrs = m[1] || '';
    const href = attrValue(HREF_RE.exec(attrs));
    if (!href) continue;

    let resolved;
    try {
      resolved = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    const host = hostOf(resolved);
    if (!clean.some((t) => host === t || host.endsWith('.' + t))) continue;

    const rel = attrValue(REL_RE.exec(attrs)).toLowerCase();
    const parts = rel.split(/\s+/).filter(Boolean);
    hits.push({
      href: resolved,
      anchor: stripTags(m[2] || '').slice(0, 120) || '[image or empty]',
      rel: parts.join(' '),
      nofollow: parts.includes('nofollow'),
      sponsored: parts.includes('sponsored'),
      ugc: parts.includes('ugc'),
      dofollow: !parts.includes('nofollow') && !parts.includes('ugc') && !parts.includes('sponsored')
    });
    if (hits.length >= 25) break;
  }
  return hits;
}

async function verifyUrl(url, targets) {
  try {
    const res = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml' }
    });
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const links = findLinksInHtml(html, res.url || url, targets);
    const noindex = /<meta[^>]+name\s*=\s*["']?robots["']?[^>]*content\s*=\s*["'][^"']*noindex/i.test(html);
    return {
      ok: true,
      httpStatus: res.status,
      finalUrl: res.url || url,
      noindex,
      links,
      found: links.length > 0,
      dofollow: links.some((l) => l.dofollow),
      // Label every link — an empty rel means dofollow, which is the result that matters most.
      rel: links.map((l) => (l.dofollow ? 'dofollow' : l.rel || 'nofollow')).join(', ')
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'VERIFY_URL') {
    (async () => {
      const settings = await getSettings();
      const targets = msg.targets && msg.targets.length ? msg.targets : settings.targets;
      sendResponse(await verifyUrl(msg.url, targets));
    })();
    return true;
  }

  if (msg.type === 'VERIFY_ALL') {
    (async () => {
      const settings = await getSettings();
      const list = await getOpportunities();
      const subset = list.filter((o) => (msg.ids ? msg.ids.includes(o.id) : true));
      const results = [];
      // Sequential on purpose: a burst of parallel fetches looks like scraping.
      for (const opp of subset) {
        const result = await verifyUrl(opp.url, settings.targets);
        await upsertOpportunity({
          id: opp.id,
          linkFound: !!result.found,
          linkRel: result.found ? result.rel : '',
          httpStatus: result.httpStatus || 0,
          lastCheckedAt: Date.now(),
          status: result.found ? 'live' : opp.status === 'live' ? 'rejected' : opp.status
        });
        results.push({ id: opp.id, ...result });
      }
      sendResponse({ ok: true, results });
    })();
    return true;
  }

  if (msg.type === 'REFRESH_BADGE') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await refreshBadge(tab.id, tab.url);
      sendResponse({ ok: true });
    })();
    return true;
  }
});
