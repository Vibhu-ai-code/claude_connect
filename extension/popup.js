import {
  getSettings,
  getOpportunities,
  upsertOpportunity,
  deleteOpportunity,
  findByUrl,
  hostOf,
  toCSV,
  downloadText,
  renderTemplate,
  STATUSES,
  OPPORTUNITY_TYPES
} from './lib/store.js';

const $ = (id) => document.getElementById(id);

let settings = null;
let tab = null;
let analysis = null;
let existing = null;

init();

async function init() {
  settings = await getSettings();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  fillSelect($('fType'), OPPORTUNITY_TYPES.map((t) => ({ value: t, label: labelize(t) })));
  fillSelect($('fStatus'), STATUSES.map((s) => ({ value: s.key, label: s.label })));
  $('anchorList').innerHTML = settings.anchors.map((a) => `<option value="${escapeAttr(a)}">`).join('');

  if (!settings.targets.length) $('setupNotice').classList.remove('hidden');

  wireButtons();
  await renderCount();

  if (!tab || !/^https?:/i.test(tab.url || '')) {
    $('pageTitle').textContent = 'This page cannot be analysed';
    $('pageUrl').textContent = tab ? tab.url || '' : '';
    $('verdict').innerHTML = pill('muted', 'Open an http(s) page to scan it');
    disableForm();
    return;
  }

  $('pageDomain').textContent = hostOf(tab.url);
  $('pageTitle').textContent = tab.title || '';
  $('pageUrl').textContent = tab.url;

  existing = await findByUrl(tab.url);
  analysis = await analyzeTab(tab.id);
  render();
}

/* --------------------------------------------------------------- analysis */

async function analyzeTab(tabId) {
  const message = { type: 'ANALYZE_PAGE', targets: settings.targets };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Tabs opened before install have no content script — inject it now.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }
}

/* --------------------------------------------------------------- rendering */

function render() {
  if (!analysis || !analysis.ok) {
    $('verdict').innerHTML = pill('warn', 'Could not read this page') +
      pill('muted', 'Reload the tab and try again');
    prefillForm();
    return;
  }

  renderVerdict();
  renderTargetLinks();
  renderSignals();
  renderContacts();
  renderStats();
  prefillForm();
}

function renderVerdict() {
  const out = [];
  const links = analysis.targetLinks;

  if (!settings.targets.length) {
    out.push(pill('muted', 'No target domain set'));
  } else if (links.length) {
    const dofollow = links.filter((l) => l.dofollow).length;
    out.push(dofollow
      ? pill('good', `${dofollow} dofollow link${dofollow > 1 ? 's' : ''} to you`)
      : pill('warn', `${links.length} link${links.length > 1 ? 's' : ''}, all nofollow`));
  } else {
    out.push(pill('info', 'No link to you yet'));
  }

  if (analysis.robots.noindex) out.push(pill('bad', 'noindex — a link here passes nothing'));
  if (analysis.robots.nofollow) out.push(pill('bad', 'Page-level nofollow'));
  if (analysis.forms.comment) out.push(pill('muted', 'Comment form'));
  if (analysis.forms.acceptsUrl) out.push(pill('muted', 'Form accepts a URL'));
  if (existing) out.push(pill('info', `Saved · ${labelize(existing.status)}`));

  $('verdict').innerHTML = out.join('');
}

function renderTargetLinks() {
  const links = analysis.targetLinks;
  $('targetLinksBlock').hidden = !links.length;
  $('targetLinks').innerHTML = links
    .slice(0, 8)
    .map((l) => {
      const badge = l.dofollow
        ? pill('good', 'dofollow')
        : pill('warn', l.rel || 'nofollow');
      return `<li>
        <div class="row"><span class="link-anchor">${escapeHtml(l.anchor)}</span><span class="spacer"></span>${badge}</div>
        <div class="link-href mono">${escapeHtml(l.href)}</div>
      </li>`;
    })
    .join('');
}

function renderSignals() {
  const sig = analysis.signals;
  $('signalsBlock').hidden = !sig.length;
  $('signals').innerHTML = sig
    .map((s) => `<span class="pill info" title="matched: ${escapeAttr(s.phrase)}">${escapeHtml(s.label)}</span>`)
    .join('');
}

function renderContacts() {
  const emails = analysis.emails;
  $('contactsBlock').hidden = !emails.length;
  $('contacts').innerHTML = emails
    .slice(0, 6)
    .map((e) => `<li><span class="mono">${escapeHtml(e)}</span>
      <button class="ghost tiny copy-email" data-email="${escapeAttr(e)}">Copy</button></li>`)
    .join('');

  document.querySelectorAll('.copy-email').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.email);
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy'), 1200);
    });
  });
}

function renderStats() {
  const s = analysis;
  const items = [
    ['Words', s.words.toLocaleString()],
    ['Links', s.links.total],
    ['External', s.links.external],
    ['Emails', s.emails.length]
  ];
  $('stats').innerHTML = items
    .map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`)
    .join('');
}

function prefillForm() {
  const guessed = guessType();
  $('fType').value = existing ? existing.type : guessed;
  $('fStatus').value = existing ? existing.status : 'prospect';
  $('fAnchor').value = existing ? existing.anchor || '' : settings.anchors[0] || '';
  $('fTargetUrl').value = existing ? existing.targetUrl || '' : settings.targetUrl || '';
  $('fNotes').value = existing ? existing.notes || '' : (analysis && analysis.selection) || '';
  $('saveBtn').textContent = existing ? 'Update opportunity' : 'Save opportunity';
  $('deleteBtn').classList.toggle('hidden', !existing);
}

function guessType() {
  if (!analysis || !analysis.ok) return 'other';
  const keys = analysis.signals.map((s) => s.key);
  if (analysis.targetLinks.length) return 'mention';
  for (const k of ['guest-post', 'resource-page', 'directory', 'sponsored']) {
    if (keys.includes(k)) return k;
  }
  if (analysis.forms.comment) return 'comment';
  if (keys.includes('profile') || analysis.forms.acceptsUrl) return 'profile';
  return 'other';
}

/* ---------------------------------------------------------------- actions */

function wireButtons() {
  $('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('setupBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('saveBtn').addEventListener('click', save);
  $('deleteBtn').addEventListener('click', remove);
  $('copyOutreach').addEventListener('click', copyOutreach);
  $('mailBtn').addEventListener('click', openMail);
  $('exportBtn').addEventListener('click', exportCsv);
}

async function save() {
  const record = {
    id: existing ? existing.id : undefined,
    url: tab.url,
    domain: hostOf(tab.url),
    title: (analysis && analysis.title) || tab.title || hostOf(tab.url),
    type: $('fType').value,
    status: $('fStatus').value,
    anchor: $('fAnchor').value.trim(),
    targetUrl: $('fTargetUrl').value.trim(),
    notes: $('fNotes').value.trim(),
    contactEmail: (analysis && analysis.emails[0]) || (existing && existing.contactEmail) || '',
    linkFound: !!(analysis && analysis.targetLinks.length),
    linkRel: analysis && analysis.targetLinks.length
      ? analysis.targetLinks.map((l) => (l.dofollow ? 'dofollow' : l.rel || 'nofollow')).join(', ')
      : '',
    noindex: !!(analysis && analysis.robots.noindex),
    externalLinks: analysis ? analysis.links.external : 0,
    words: analysis ? analysis.words : 0,
    signals: analysis ? analysis.signals.map((s) => s.key) : []
  };

  existing = await upsertOpportunity(record);
  hint('Saved.', 'ok');
  await renderCount();
  renderVerdict();
  prefillForm();
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
}

async function remove() {
  if (!existing) return;
  await deleteOpportunity(existing.id);
  existing = null;
  hint('Deleted.', 'ok');
  await renderCount();
  renderVerdict();
  prefillForm();
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
}

function outreachVars() {
  return {
    pageTitle: (analysis && analysis.title) || (tab && tab.title) || '',
    pageUrl: (tab && tab.url) || '',
    domain: hostOf((tab && tab.url) || ''),
    anchor: $('fAnchor').value.trim() || (settings.anchors[0] || 'the topic'),
    targetUrl: $('fTargetUrl').value.trim() || settings.targetUrl,
    myName: settings.myName,
    myEmail: settings.myEmail,
    mySite: settings.mySite || settings.targets[0] || ''
  };
}

async function copyOutreach() {
  const vars = outreachVars();
  const text = `Subject: ${renderTemplate(settings.outreachSubject, vars)}\n\n${renderTemplate(settings.outreachBody, vars)}`;
  await navigator.clipboard.writeText(text);
  hint('Outreach email copied to clipboard.', 'ok');
}

function openMail() {
  const vars = outreachVars();
  const to = (analysis && analysis.emails[0]) || (existing && existing.contactEmail) || '';
  const url =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(renderTemplate(settings.outreachSubject, vars))}` +
    `&body=${encodeURIComponent(renderTemplate(settings.outreachBody, vars))}`;
  chrome.tabs.create({ url });
}

async function exportCsv() {
  const list = await getOpportunities();
  if (!list.length) return hint('Nothing to export yet.', 'err');
  downloadText(`backlinks-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(list), 'text/csv');
}

async function renderCount() {
  const list = await getOpportunities();
  const live = list.filter((o) => o.status === 'live').length;
  $('count').textContent = `${list.length} saved · ${live} live`;
}

/* ----------------------------------------------------------------- helpers */

function disableForm() {
  ['fType', 'fStatus', 'fAnchor', 'fTargetUrl', 'fNotes', 'saveBtn', 'copyOutreach', 'mailBtn'].forEach((id) => {
    $(id).disabled = true;
  });
}

function hint(text, kind) {
  const el = $('saveHint');
  el.textContent = text;
  el.className = 'hint ' + (kind || '');
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 2600);
}

function fillSelect(select, options) {
  select.innerHTML = options.map((o) => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`).join('');
}

function pill(kind, text) {
  return `<span class="pill ${kind}">${escapeHtml(text)}</span>`;
}

function labelize(value) {
  return String(value || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function escapeAttr(value) {
  return escapeHtml(value);
}
