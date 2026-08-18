import {
  getSettings,
  getOpportunities,
  upsertOpportunity,
  deleteOpportunities,
  replaceAll,
  toCSV,
  downloadText,
  renderTemplate,
  formatDate,
  statusMeta,
  STATUSES,
  OPPORTUNITY_TYPES
} from './lib/store.js';

const $ = (id) => document.getElementById(id);

let all = [];
let settings = null;
const selected = new Set();

init();

async function init() {
  settings = await getSettings();

  fillFilter($('filterStatus'), STATUSES.map((s) => [s.key, s.label]));
  fillFilter($('filterType'), OPPORTUNITY_TYPES.map((t) => [t, labelize(t)]));

  ['search', 'filterStatus', 'filterType', 'sort'].forEach((id) =>
    $(id).addEventListener('input', render)
  );

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('checkAll').addEventListener('change', toggleAll);
  $('verifyBtn').addEventListener('click', verify);
  $('exportCsv').addEventListener('click', exportCsv);
  $('exportJson').addEventListener('click', exportJson);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', importJson);
  $('deleteBtn').addEventListener('click', removeSelected);

  await reload();
}

async function reload() {
  all = await getOpportunities();
  render();
}

function visible() {
  const q = $('search').value.trim().toLowerCase();
  const status = $('filterStatus').value;
  const type = $('filterType').value;
  const sort = $('sort').value;

  let list = all.filter((o) => {
    if (status && o.status !== status) return false;
    if (type && o.type !== type) return false;
    if (!q) return true;
    return [o.domain, o.title, o.anchor, o.notes, o.contactEmail, o.url]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  list = list.sort((a, b) => {
    if (sort === 'domain') return (a.domain || '').localeCompare(b.domain || '');
    if (sort === 'status') {
      const order = STATUSES.map((s) => s.key);
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    return (b[sort] || 0) - (a[sort] || 0);
  });

  return list;
}

function render() {
  renderStats();
  const list = visible();

  $('empty').classList.toggle('hidden', all.length > 0);
  $('table').classList.toggle('hidden', all.length === 0);

  $('rows').innerHTML = list.map(rowHtml).join('');
  wireRows();
  updateButtons();
}

function renderStats() {
  const counts = Object.fromEntries(STATUSES.map((s) => [s.key, 0]));
  let dofollow = 0;
  for (const o of all) {
    if (counts[o.status] != null) counts[o.status]++;
    if (hasDofollow(o)) dofollow++;
  }

  const cards = [
    ['Opportunities', all.length],
    ['Live links', counts.live],
    ['Dofollow', dofollow],
    ['Contacted', counts.contacted + counts.replied],
    ['Prospects', counts.prospect],
    ['Rejected', counts.rejected]
  ];
  $('stats').innerHTML = cards
    .map(([label, value]) => `<div class="stat-card"><b>${value}</b><span>${label}</span></div>`)
    .join('');
}

/** A row counts as dofollow if at least one link to us carries no equity-blocking rel. */
function hasDofollow(o) {
  if (!o.linkFound) return false;
  const rels = String(o.linkRel || '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!rels.length) return true;
  return rels.some((r) => !/nofollow|ugc|sponsored/.test(r));
}

function rowHtml(o) {
  const meta = statusMeta(o.status);
  const linkCell = o.linkFound
    ? `<span class="pill ${hasDofollow(o) ? 'good' : 'warn'}">${escapeHtml(o.linkRel || 'dofollow')}</span>`
    : o.lastCheckedAt
      ? '<span class="pill bad">not found</span>'
      : '<span class="pill muted">unchecked</span>';

  return `<tr data-id="${o.id}">
    <td class="checkcol"><input type="checkbox" class="rowcheck" data-id="${o.id}" ${selected.has(o.id) ? 'checked' : ''} /></td>
    <td>
      <div class="site-title truncate" title="${escapeAttr(o.title || '')}">${escapeHtml(o.title || o.domain || '')}</div>
      <a class="site-domain" href="${escapeAttr(o.url)}" target="_blank" rel="noreferrer">${escapeHtml(o.domain || o.url)}</a>
      ${o.notes ? `<div class="site-notes truncate" title="${escapeAttr(o.notes)}">${escapeHtml(o.notes)}</div>` : ''}
    </td>
    <td>${select('type', o.id, OPPORTUNITY_TYPES.map((t) => [t, labelize(t)]), o.type)}</td>
    <td style="color:${meta.color}">${select('status', o.id, STATUSES.map((s) => [s.key, s.label]), o.status)}</td>
    <td class="mono anchorcell">${escapeHtml(o.anchor || '—')}</td>
    <td>${linkCell}</td>
    <td class="mono">${o.contactEmail ? escapeHtml(o.contactEmail) : '—'}</td>
    <td class="muted">${formatDate(o.lastCheckedAt)}</td>
    <td>
      <div class="rowactions">
        <button class="tiny ghost act-verify" data-id="${o.id}">Verify</button>
        <button class="tiny ghost act-copy" data-id="${o.id}">Outreach</button>
        <button class="tiny ghost danger act-delete" data-id="${o.id}">✕</button>
      </div>
    </td>
  </tr>`;
}

function select(field, id, options, value) {
  return `<select class="cell-select" data-field="${field}" data-id="${id}">${options
    .map(([v, label]) => `<option value="${escapeAttr(v)}" ${v === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('')}</select>`;
}

function wireRows() {
  document.querySelectorAll('.cell-select').forEach((el) =>
    el.addEventListener('change', async () => {
      await upsertOpportunity({ id: el.dataset.id, [el.dataset.field]: el.value });
      all = await getOpportunities();
      renderStats();
    })
  );

  document.querySelectorAll('.rowcheck').forEach((el) =>
    el.addEventListener('change', () => {
      if (el.checked) selected.add(el.dataset.id);
      else selected.delete(el.dataset.id);
      updateButtons();
    })
  );

  document.querySelectorAll('.act-delete').forEach((el) =>
    el.addEventListener('click', async () => {
      await deleteOpportunities([el.dataset.id]);
      selected.delete(el.dataset.id);
      await reload();
    })
  );

  document.querySelectorAll('.act-copy').forEach((el) =>
    el.addEventListener('click', () => copyOutreach(el.dataset.id, el))
  );

  document.querySelectorAll('.act-verify').forEach((el) =>
    el.addEventListener('click', () => verifyIds([el.dataset.id]))
  );
}

function toggleAll(event) {
  selected.clear();
  if (event.target.checked) visible().forEach((o) => selected.add(o.id));
  render();
}

function updateButtons() {
  const n = selected.size;
  $('deleteBtn').disabled = n === 0;
  $('deleteBtn').textContent = n ? `Delete (${n})` : 'Delete';
  $('verifyBtn').textContent = n ? `Verify (${n})` : 'Verify all';
}

/* ------------------------------------------------------------ verification */

function verify() {
  const ids = selected.size ? [...selected] : visible().map((o) => o.id);
  verifyIds(ids);
}

async function verifyIds(ids) {
  if (!ids.length) return;
  if (!settings.targets.length) {
    return showProgress('Add your domain in Settings first — there is nothing to look for.', true);
  }

  $('verifyBtn').disabled = true;
  showProgress(`Checking ${ids.length} page${ids.length > 1 ? 's' : ''}…`);

  try {
    const response = await chrome.runtime.sendMessage({ type: 'VERIFY_ALL', ids });
    const results = (response && response.results) || [];
    const found = results.filter((r) => r.found).length;
    const failed = results.filter((r) => !r.ok).length;
    showProgress(
      `Checked ${results.length}: ${found} with your link live` +
        (failed ? `, ${failed} unreachable (blocked or offline)` : '') + '.'
    );
  } catch (err) {
    showProgress('Verification failed: ' + String((err && err.message) || err), true);
  }

  $('verifyBtn').disabled = false;
  await reload();
}

function showProgress(text, isError) {
  const el = $('progress');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.borderColor = isError ? 'var(--red)' : 'var(--accent)';
  if (!isError) setTimeout(() => el.classList.add('hidden'), 8000);
}

/* ----------------------------------------------------------------- actions */

async function copyOutreach(id, button) {
  const o = all.find((x) => x.id === id);
  if (!o) return;
  const vars = {
    pageTitle: o.title || o.domain,
    pageUrl: o.url,
    domain: o.domain,
    anchor: o.anchor || settings.anchors[0] || 'the topic',
    targetUrl: o.targetUrl || settings.targetUrl,
    myName: settings.myName,
    myEmail: settings.myEmail,
    mySite: settings.mySite || settings.targets[0] || ''
  };
  const text = `Subject: ${renderTemplate(settings.outreachSubject, vars)}\n\n${renderTemplate(settings.outreachBody, vars)}`;
  await navigator.clipboard.writeText(text);
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = 'Outreach'), 1200);
}

function exportCsv() {
  const list = visible();
  if (!list.length) return showProgress('Nothing to export.', true);
  downloadText(`backlinks-${stamp()}.csv`, toCSV(list), 'text/csv');
}

function exportJson() {
  downloadText(
    `backlink-builder-backup-${stamp()}.json`,
    JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings, opportunities: all }, null, 2),
    'application/json'
  );
}

async function importJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.opportunities;
    if (!Array.isArray(incoming)) throw new Error('No opportunities array in that file');

    // Merge by URL so restoring a backup never duplicates rows you already have.
    const byUrl = new Map(all.map((o) => [o.url, o]));
    for (const rec of incoming) {
      if (!rec || !rec.url) continue;
      byUrl.set(rec.url, { ...byUrl.get(rec.url), ...rec });
    }
    await replaceAll([...byUrl.values()]);
    await reload();
    showProgress(`Restored ${incoming.length} record(s).`);
  } catch (err) {
    showProgress('Could not read that file: ' + String((err && err.message) || err), true);
  }
  event.target.value = '';
}

async function removeSelected() {
  if (!selected.size) return;
  const n = selected.size;
  if (!confirm(`Delete ${n} opportunit${n > 1 ? 'ies' : 'y'}? This cannot be undone.`)) return;
  await deleteOpportunities([...selected]);
  selected.clear();
  await reload();
}

/* ----------------------------------------------------------------- helpers */

function fillFilter(select, pairs) {
  select.innerHTML =
    select.innerHTML + pairs.map(([v, label]) => `<option value="${escapeAttr(v)}">${escapeHtml(label)}</option>`).join('');
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function labelize(value) {
  return String(value || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const escapeAttr = escapeHtml;
