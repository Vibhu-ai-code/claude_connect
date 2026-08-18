import { OPPORTUNITIES, CATEGORIES, ANCHOR_LIBRARY, SEARCH_OPERATORS } from './data/opportunities.js';
import { TEMPLATES, CHECKLIST } from './data/templates.js';
import { analysePage } from './lib/analyze.js';
import {
  getSettings, getProspects, saveProspects, addProspect,
  STATUSES, hostOf, withUtm, fillTemplate, toCsv,
} from './lib/store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

let settings;
let prospects = [];
let analysis = null;

/* --------------------------------------------------------------- bootstrap */
init();

async function init() {
  settings = await getSettings();
  prospects = await getProspects();

  $('#brandName').textContent = settings.brand;
  $('#brandDomain').textContent = settings.targetDomain;
  $('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  buildIdeas();
  buildTracker();
  buildTools();
  scanPage();
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${name}`));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 1800);
}

async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    toast('Copy failed - select the text manually');
  }
}

/* -------------------------------------------------------------- page scan */
$('#rescan').addEventListener('click', scanPage);

async function scanPage() {
  const box = $('#pageResult');
  box.innerHTML = '<p class="muted">Scanning…</p>';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    box.innerHTML = '<div class="card"><p class="muted">Open a normal web page (http/https) to scan it. Browser pages and the Chrome Web Store are off limits to extensions.</p></div>';
    return;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analysePage,
      args: [settings.targetDomain, settings.brand],
    });
    analysis = result;
    renderPage(result);
  } catch (err) {
    box.innerHTML = `<div class="card"><p class="muted">Could not read this page: ${esc(err.message)}</p></div>`;
  }
}

function renderPage(a) {
  const linkState = a.targetLinks.length
    ? a.targetLinks.some((l) => !l.nofollow)
      ? { cls: 'b-ok', text: `Linked - ${a.targetLinks.length} link(s), at least one dofollow` }
      : { cls: 'b-warn', text: `Linked - ${a.targetLinks.length} link(s), all nofollow` }
    : a.unlinkedMention
      ? { cls: 'b-warn', text: 'Brand mentioned but NOT linked - outreach opportunity' }
      : { cls: 'b-danger', text: 'No link to your site on this page' };

  const rows = [
    ['Domain', a.host],
    ['Title', a.title || '-'],
    ['Words', a.wordCount.toLocaleString()],
    ['Links', `${a.linkCounts.total} total · ${a.linkCounts.internal} internal · ${a.linkCounts.external} external`],
    ['Brand mentions', String(a.mentions)],
    ['Indexable', a.noindex ? 'No - page is noindex' : 'Yes'],
  ];

  const linkList = a.targetLinks.map((l) => `
    <div class="linkrow">
      <b>${esc(l.anchor)}</b><br />
      <span class="muted">rel: ${esc(l.rel)} · ${l.nofollow ? 'nofollow' : 'dofollow'} · ${l.inNav ? 'nav/footer placement' : 'in-content'}</span><br />
      <span class="muted truncate">${esc(l.href)}</span>
    </div>`).join('');

  const signalBadges = a.signals.map((s) => {
    const cls = s === 'Paid link risk' ? 'b-danger' : s.startsWith('Accepts') ? 'b-ok' : '';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }).join('');

  const emailList = a.emails.length
    ? `<div class="kv"><span>Contacts found</span><span>${a.emails.map((e) => esc(e)).join('<br />')}</span></div>` : '';

  const externals = a.topExternal.length
    ? `<div class="kv"><span>Top outbound</span><span>${a.topExternal.map(([h, n]) => `${esc(h)} (${n})`).join('<br />')}</span></div>` : '';

  $('#pageResult').innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3 class="truncate">${esc(a.title || a.host)}</h3>
        <span class="badge ${linkState.cls}">${a.targetLinks.length ? 'Backlink' : a.unlinkedMention ? 'Mention' : 'None'}</span>
      </div>
      <p class="why">${esc(linkState.text)}</p>
      ${rows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
      ${emailList}
      ${externals}
      ${signalBadges ? `<div class="badges">${signalBadges}</div>` : ''}
      ${linkList}
      <div class="card-actions">
        <button id="savePage" class="btn btn-primary">Track this page</button>
        <button id="draftPage" class="btn">Draft outreach</button>
        <button id="copyPageUrl" class="btn">Copy URL</button>
      </div>
    </div>`;

  $('#savePage').addEventListener('click', async () => {
    const { added, list } = await addProspect({
      url: a.url,
      name: a.title || a.host,
      category: a.signals.includes('Accepts guest posts') ? 'Guest post & content' : 'Uncategorised',
      status: a.targetLinks.length ? 'Live' : 'Prospect',
      notes: a.unlinkedMention ? 'Unlinked brand mention - ask for a link' : '',
      source: 'page-scan',
    });
    prospects = list;
    buildTracker();
    toast(added ? 'Added to tracker' : 'Already tracked');
  });

  $('#draftPage').addEventListener('click', () => {
    $('#tplDomain').value = a.host;
    $('#tplSelect').value = a.unlinkedMention ? 'unlinked-mention' : a.signals.includes('Accepts guest posts') ? 'guest-post' : 'directory';
    renderTemplate();
    switchTab('tools');
    $$('#tab-tools details')[2].open = true;
  });

  $('#copyPageUrl').addEventListener('click', () => copyText(a.url, 'Page URL copied'));
}

/* ------------------------------------------------------------------ ideas */
function buildIdeas() {
  const sel = $('#ideaCategory');
  CATEGORIES.forEach((c) => sel.add(new Option(c, c)));
  ['#ideaSearch', '#ideaCategory', '#ideaDifficulty', '#ideaCost']
    .forEach((s) => $(s).addEventListener('input', renderIdeas));
  renderIdeas();
}

function renderIdeas() {
  const q = $('#ideaSearch').value.trim().toLowerCase();
  const cat = $('#ideaCategory').value;
  const diff = $('#ideaDifficulty').value;
  const cost = $('#ideaCost').value;

  const list = OPPORTUNITIES
    .filter((o) => (!cat || o.category === cat) && (!diff || o.difficulty === diff) && (!cost || o.cost === cost))
    .filter((o) => !q || `${o.name} ${o.category} ${o.why} ${o.action}`.toLowerCase().includes(q))
    .sort((a, b) => b.relevance - a.relevance || b.da - a.da);

  $('#ideaCount').textContent = `${list.length} of ${OPPORTUNITIES.length} sources · sorted by relevance to a Delhi multi-speciality hospital`;
  $('#ideaSearch').placeholder = `Search ${OPPORTUNITIES.length} link sources…`;

  $('#ideaList').innerHTML = list.map((o) => {
    const tracked = prospects.some((p) => hostOf(p.url) === hostOf(o.url));
    return `
    <div class="card" data-id="${esc(o.id)}">
      <div class="card-head">
        <h3>${esc(o.name)}</h3>
        <span class="stars" title="Relevance ${o.relevance}/5">${stars(o.relevance)}</span>
      </div>
      <div class="badges">
        <span class="badge b-brand">${esc(o.category)}</span>
        <span class="badge">DA ~${o.da}</span>
        <span class="badge ${o.difficulty === 'Easy' ? 'b-ok' : o.difficulty === 'Hard' ? 'b-warn' : ''}">${esc(o.difficulty)}</span>
        <span class="badge ${o.cost === 'Free' ? 'b-ok' : ''}">${esc(o.cost)}</span>
        <span class="badge ${o.link === 'Dofollow' ? 'b-ok' : ''}">${esc(o.link)}</span>
      </div>
      <p class="why">${esc(o.why)}</p>
      <p class="action">${esc(o.action)}</p>
      <div class="card-actions">
        <button class="btn btn-primary" data-open="${esc(o.url)}">Open</button>
        <button class="btn" data-track="${esc(o.id)}">${tracked ? 'Tracked ✓' : 'Track'}</button>
        <button class="btn" data-draft="${esc(o.url)}">Outreach</button>
      </div>
    </div>`;
  }).join('') || '<p class="muted">No sources match those filters.</p>';

  $$('#ideaList [data-open]').forEach((b) => b.addEventListener('click', () => chrome.tabs.create({ url: b.dataset.open })));
  $$('#ideaList [data-track]').forEach((b) => b.addEventListener('click', async () => {
    const o = OPPORTUNITIES.find((x) => x.id === b.dataset.track);
    const { added, list } = await addProspect({ url: o.url, name: o.name, category: o.category, source: 'idea-list' });
    prospects = list;
    b.textContent = 'Tracked ✓';
    buildTracker();
    toast(added ? `${o.name} added` : 'Already tracked');
  }));
  $$('#ideaList [data-draft]').forEach((b) => b.addEventListener('click', () => {
    $('#tplDomain').value = hostOf(b.dataset.draft);
    renderTemplate();
    switchTab('tools');
    $$('#tab-tools details')[2].open = true;
  }));
}

/* ---------------------------------------------------------------- tracker */
function buildTracker() {
  const sel = $('#trackerStatus');
  if (!sel.dataset.ready) {
    STATUSES.forEach((s) => sel.add(new Option(s, s)));
    sel.dataset.ready = '1';
    sel.addEventListener('change', renderTracker);
    $('#exportCsv').addEventListener('click', exportCsv);
    $('#exportJson').addEventListener('click', exportJson);
    $('#clearAll').addEventListener('click', clearAll);
    $('#verifyAll').addEventListener('click', verifyAll);
  }
  renderTracker();
}

function renderTracker() {
  const filter = $('#trackerStatus').value;
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: prospects.filter((p) => p.status === s).length }), {});

  $('#trackerStats').innerHTML = [
    ['Total', prospects.length],
    ['Submitted', counts.Submitted || 0],
    ['Live', counts.Live || 0],
    ['Prospect', counts.Prospect || 0],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');

  const list = prospects.filter((p) => !filter || p.status === filter);
  $('#trackerList').innerHTML = list.map((p) => `
    <div class="card" data-pid="${esc(p.id)}">
      <div class="card-head">
        <h3 class="truncate">${esc(p.name)}</h3>
        <span class="badge">${esc(p.category)}</span>
      </div>
      <p class="muted small truncate">${esc(p.url)}</p>
      ${p.liveCheck ? `<p class="small ${p.liveCheck.startsWith('No link') || p.liveCheck.startsWith('Fetch') ? 'muted' : ''}">Check: ${esc(p.liveCheck)}${p.checkedAt ? ` · ${esc(new Date(p.checkedAt).toLocaleDateString())}` : ''}</p>` : ''}
      <div class="filter-row">
        <select data-status="${esc(p.id)}">${STATUSES.map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button class="btn" data-visit="${esc(p.url)}">Open</button>
        <button class="btn" data-verify="${esc(p.id)}">Verify</button>
        <button class="btn btn-danger" data-del="${esc(p.id)}">✕</button>
      </div>
      <input type="text" data-note="${esc(p.id)}" value="${esc(p.notes)}" placeholder="Notes - contact, date, price…" />
    </div>`).join('') || '<p class="muted">Nothing tracked yet. Add sources from the Ideas tab, or right-click any page and choose “Save this page as a backlink prospect”.</p>';

  $$('#trackerList [data-status]').forEach((el) => el.addEventListener('change', () => updateProspect(el.dataset.status, { status: el.value })));
  $$('#trackerList [data-note]').forEach((el) => el.addEventListener('change', () => updateProspect(el.dataset.note, { notes: el.value })));
  $$('#trackerList [data-visit]').forEach((el) => el.addEventListener('click', () => chrome.tabs.create({ url: el.dataset.visit })));
  $$('#trackerList [data-del]').forEach((el) => el.addEventListener('click', () => removeProspect(el.dataset.del)));
  $$('#trackerList [data-verify]').forEach((el) => el.addEventListener('click', () => verifyOne(el.dataset.verify, el)));
}

async function updateProspect(id, patch) {
  prospects = prospects.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await saveProspects(prospects);
  if (patch.status) renderTracker();
}

async function removeProspect(id) {
  prospects = prospects.filter((p) => p.id !== id);
  await saveProspects(prospects);
  renderTracker();
  renderIdeas();
}

async function verifyOne(id, btn) {
  const p = prospects.find((x) => x.id === id);
  if (!p) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const res = await chrome.runtime.sendMessage({ type: 'checkLink', url: p.url, targetDomain: settings.targetDomain });
  await updateProspect(id, {
    liveCheck: res.message,
    checkedAt: new Date().toISOString(),
    status: res.found ? 'Live' : p.status,
  });
  renderTracker();
  toast(`${hostOf(p.url)}: ${res.message}`);
}

async function verifyAll() {
  if (!prospects.length) return toast('Nothing to verify');
  const btn = $('#verifyAll');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  const results = await chrome.runtime.sendMessage({
    type: 'checkLinks',
    targetDomain: settings.targetDomain,
    items: prospects.map((p) => ({ id: p.id, url: p.url })),
  });
  prospects = prospects.map((p) => {
    const r = results[p.id];
    if (!r) return p;
    return { ...p, liveCheck: r.message, checkedAt: new Date().toISOString(), status: r.found ? 'Live' : p.status };
  });
  await saveProspects(prospects);
  renderTracker();
  btn.disabled = false;
  btn.textContent = 'Verify live links';
  toast(`Checked ${Object.keys(results).length} URLs`);
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportCsv() {
  if (!prospects.length) return toast('Nothing to export');
  const cols = ['name', 'url', 'category', 'status', 'notes', 'liveCheck', 'addedAt', 'checkedAt', 'source'];
  download('moolchand-backlinks.csv', toCsv(prospects, cols), 'text/csv');
  toast('CSV exported');
}

function exportJson() {
  if (!prospects.length) return toast('Nothing to export');
  download('moolchand-backlinks.json', JSON.stringify(prospects, null, 2), 'application/json');
  toast('JSON exported');
}

async function clearAll() {
  if (!confirm('Delete all tracked prospects? This cannot be undone.')) return;
  prospects = [];
  await saveProspects(prospects);
  renderTracker();
  renderIdeas();
}

/* ------------------------------------------------------------------ tools */
function buildTools() {
  // Snippet builder
  const preset = $('#snipAnchorPreset');
  Object.entries(ANCHOR_LIBRARY).forEach(([group, items]) => {
    const og = document.createElement('optgroup');
    og.label = group;
    items.forEach((t) => og.appendChild(new Option(t, t)));
    preset.appendChild(og);
  });
  $('#snipUrl').value = settings.site;
  $('#snipAnchor').value = ANCHOR_LIBRARY.Branded[0];
  $('#snipUtm').checked = !!settings.useUtm;
  preset.addEventListener('change', () => { $('#snipAnchor').value = preset.value; renderSnippets(); });
  ['#snipUrl', '#snipAnchor', '#snipUtm', '#snipNofollow'].forEach((s) => $(s).addEventListener('input', renderSnippets));
  renderSnippets();

  // NAP + schema
  $('#outNap').textContent = [
    settings.brand,
    settings.address,
    `Phone: ${settings.phone}`,
    `Website: ${settings.site}`,
    'Category: Hospital / Multi-speciality hospital',
  ].join('\n');

  $('#outSchema').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Hospital',
    name: settings.brand,
    url: settings.site,
    telephone: settings.phone,
    address: { '@type': 'PostalAddress', streetAddress: settings.address, addressLocality: 'New Delhi', addressRegion: 'Delhi', addressCountry: 'IN' },
    medicalSpecialty: ['Cardiovascular', 'Orthopedic', 'Obstetric', 'Pediatric', 'Urologic', 'Otolaryngologic', 'Emergency'],
    availableService: { '@type': 'MedicalProcedure', name: 'Emergency care' },
    sameAs: ['https://www.linkedin.com/company/', 'https://www.facebook.com/', 'https://www.youtube.com/'],
  }, null, 2);

  // Templates
  const tpl = $('#tplSelect');
  TEMPLATES.forEach((t) => tpl.add(new Option(t.name, t.id)));
  ['#tplSelect', '#tplContact', '#tplDomain'].forEach((s) => $(s).addEventListener('input', renderTemplate));
  $('#tplMailto').addEventListener('click', () => {
    const url = `mailto:?subject=${encodeURIComponent($('#tplSubject').value)}&body=${encodeURIComponent($('#tplBody').value)}`;
    chrome.tabs.create({ url });
  });
  renderTemplate();

  // Search operators
  $('#operatorList').innerHTML = SEARCH_OPERATORS.map((o, i) => `
    <div class="snip"><span>${i + 1}</span><code>${esc(o.q)}</code>
    <button class="btn" data-search="${esc(o.q)}">Search</button></div>`).join('');
  $$('#operatorList [data-search]').forEach((b) => b.addEventListener('click', () => {
    chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(b.dataset.search)}&num=50` });
  }));

  $('#checklist').innerHTML = CHECKLIST.map((c) => `<li>${esc(c)}</li>`).join('');

  // Copy buttons (works for code, pre and form fields)
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const el = document.getElementById(b.dataset.copy);
    copyText('value' in el && el.value !== undefined ? el.value : el.textContent);
  }));
}

function renderSnippets() {
  const raw = $('#snipUrl').value.trim() || settings.site;
  const anchor = $('#snipAnchor').value.trim() || settings.brand;
  const url = withUtm(raw, { ...settings, useUtm: $('#snipUtm').checked });
  const rel = $('#snipNofollow').checked ? ' rel="sponsored nofollow"' : '';
  $('#outHtml').textContent = `<a href="${url}"${rel}>${anchor}</a>`;
  $('#outMd').textContent = `[${anchor}](${url})`;
  $('#outBb').textContent = `[url=${url}]${anchor}[/url]`;
  $('#outUrl').textContent = url;
}

function renderTemplate() {
  const t = TEMPLATES.find((x) => x.id === $('#tplSelect').value) || TEMPLATES[0];
  const domain = $('#tplDomain').value.trim() || (analysis ? analysis.host : 'example.com');
  const vars = {
    brand: settings.brand,
    site: settings.site,
    domain,
    page: analysis?.url && hostOf(analysis.url) === domain ? analysis.url : `https://${domain}`,
    pageTitle: analysis?.title && hostOf(analysis.url) === domain ? analysis.title : 'your article',
    contactName: $('#tplContact').value.trim() || 'there',
    senderName: settings.senderName || '[your name]',
    senderRole: settings.senderRole,
    senderEmail: settings.senderEmail || '[your email]',
    phone: settings.phone,
    address: settings.address,
  };
  $('#tplSubject').value = fillTemplate(t.subject, vars);
  $('#tplBody').value = fillTemplate(t.body, vars);
}
