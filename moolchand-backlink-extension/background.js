import { getSettings, addProspect, getProspects, hostOf, normaliseUrl } from './lib/store.js';

const MENU = {
  PAGE: 'mbb-save-page',
  LINK: 'mbb-save-link',
  SELECTION: 'mbb-save-selection',
};

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings(); // materialise defaults on first run
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU.PAGE, title: 'Save this page as a backlink prospect', contexts: ['page'] });
    chrome.contextMenus.create({ id: MENU.LINK, title: 'Save this link as a backlink prospect', contexts: ['link'] });
    chrome.contextMenus.create({ id: MENU.SELECTION, title: 'Save prospect with "%s" as a note', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === MENU.LINK ? info.linkUrl : info.pageUrl || tab?.url;
  if (!url) return;
  const { added } = await addProspect({
    url,
    name: tab?.title || hostOf(url),
    category: 'Uncategorised',
    notes: info.menuItemId === MENU.SELECTION ? info.selectionText || '' : '',
    source: 'context-menu',
  });
  flashBadge(added ? 'ADD' : 'DUP', added ? '#1a7f5a' : '#9a6b00', tab?.id);
});

/** Fetch a page and report whether it links to the target domain. */
export async function checkLink(url, targetDomain) {
  try {
    const res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
    if (!res.ok) return { ok: false, status: res.status, found: false, message: `HTTP ${res.status}` };
    const html = await res.text();
    const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0]);
    const target = normaliseUrl(targetDomain);
    const hits = anchors.filter((a) => {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(a);
      return href && normaliseUrl(href[1]).includes(target);
    });
    const rels = hits.map((a) => (/rel\s*=\s*["']([^"']*)["']/i.exec(a)?.[1] || '').toLowerCase());
    const nofollow = rels.length > 0 && rels.every((r) => r.includes('nofollow') || r.includes('ugc') || r.includes('sponsored'));
    const mentionOnly = !hits.length && html.toLowerCase().includes(target);
    return {
      ok: true,
      status: res.status,
      found: hits.length > 0,
      count: hits.length,
      nofollow,
      mentionOnly,
      message: hits.length
        ? `${hits.length} link${hits.length > 1 ? 's' : ''} found (${nofollow ? 'nofollow' : 'dofollow'})`
        : mentionOnly
          ? 'Brand mentioned but not linked'
          : 'No link found',
    };
  } catch (err) {
    return { ok: false, found: false, message: `Fetch failed: ${err.message}` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'checkLink') {
    checkLink(msg.url, msg.targetDomain).then(sendResponse);
    return true; // async
  }
  if (msg?.type === 'checkLinks') {
    (async () => {
      const out = {};
      for (const item of msg.items) out[item.id] = await checkLink(item.url, msg.targetDomain);
      sendResponse(out);
    })();
    return true;
  }
  return false;
});

function flashBadge(text, color, tabId) {
  const scope = tabId ? { tabId } : {};
  chrome.action.setBadgeBackgroundColor({ color, ...scope });
  chrome.action.setBadgeText({ text, ...scope });
  setTimeout(() => chrome.action.setBadgeText({ text: '', ...scope }), 2500);
}

/** Mark tabs that are already tracked as prospects. */
async function markTab(tabId, url) {
  if (!url || !/^https?:/i.test(url)) return;
  const tracked = (await getProspects()).some((p) => hostOf(p.url) === hostOf(url));
  chrome.action.setBadgeBackgroundColor({ color: '#1a7f5a', tabId });
  chrome.action.setBadgeText({ text: tracked ? '✓' : '', tabId });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete') markTab(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    markTab(tabId, tab.url);
  } catch { /* tab gone */ }
});
