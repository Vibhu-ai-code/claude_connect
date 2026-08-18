/**
 * Shared data layer: settings, saved opportunities, templating, CSV export.
 * Everything lives in chrome.storage.local — no network, no accounts.
 */

const SETTINGS_KEY = 'settings';
const OPPS_KEY = 'opportunities';

export const DEFAULT_SETTINGS = {
  targets: [],
  targetUrl: '',
  anchors: [],
  myName: '',
  myEmail: '',
  mySite: '',
  outreachSubject: 'Quick question about {{pageTitle}}',
  outreachBody: [
    'Hi there,',
    '',
    'I was reading "{{pageTitle}}" on {{domain}} and found it genuinely useful.',
    '',
    'I run {{mySite}}, where we published a piece that covers {{anchor}} in more depth. If you think it would be a good fit for your readers, here it is: {{targetUrl}}',
    '',
    'Either way, thanks for the work you put into that page.',
    '',
    'Best,',
    '{{myName}}',
    '{{myEmail}}'
  ].join('\n'),
  autoBadge: true
};

export const STATUSES = [
  { key: 'prospect', label: 'Prospect', color: '#64748b' },
  { key: 'contacted', label: 'Contacted', color: '#d97706' },
  { key: 'replied', label: 'Replied', color: '#7c3aed' },
  { key: 'submitted', label: 'Submitted', color: '#0ea5e9' },
  { key: 'live', label: 'Live', color: '#16a34a' },
  { key: 'rejected', label: 'Rejected', color: '#dc2626' }
];

export const OPPORTUNITY_TYPES = [
  'guest-post',
  'resource-page',
  'directory',
  'comment',
  'profile',
  'sponsored',
  'broken-link',
  'mention',
  'other'
];

export function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return normalizeDomain(url);
  }
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getOpportunities() {
  const stored = await chrome.storage.local.get(OPPS_KEY);
  const list = stored[OPPS_KEY] || [];
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function writeAll(list) {
  await chrome.storage.local.set({ [OPPS_KEY]: list });
}

export function makeId() {
  return 'op_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Insert or update by id; falls back to matching on URL so re-saving a page updates it. */
export async function upsertOpportunity(record) {
  const list = await getOpportunities();
  const now = Date.now();

  // Callers pass `id: undefined` for "new" — strip empties so they never overwrite real values.
  const patch = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (value !== undefined) patch[key] = value;
  }

  let index = patch.id ? list.findIndex((o) => o.id === patch.id) : -1;
  if (index === -1 && patch.url) index = list.findIndex((o) => o.url === patch.url);

  if (index === -1) {
    const created = {
      status: 'prospect',
      type: 'other',
      ...patch,
      id: makeId(),
      createdAt: now,
      updatedAt: now
    };
    list.unshift(created);
    await writeAll(list);
    return created;
  }

  const merged = {
    ...list[index],
    ...patch,
    id: list[index].id,
    createdAt: list[index].createdAt || now,
    updatedAt: now
  };
  list[index] = merged;
  await writeAll(list);
  return merged;
}

export async function deleteOpportunity(id) {
  const list = (await getOpportunities()).filter((o) => o.id !== id);
  await writeAll(list);
}

export async function deleteOpportunities(ids) {
  const drop = new Set(ids);
  const list = (await getOpportunities()).filter((o) => !drop.has(o.id));
  await writeAll(list);
}

export async function replaceAll(list) {
  await writeAll(Array.isArray(list) ? list : []);
}

export async function findByUrl(url) {
  if (!url) return null;
  const list = await getOpportunities();
  return list.find((o) => o.url === url) || null;
}

export function statusMeta(key) {
  return STATUSES.find((s) => s.key === key) || STATUSES[0];
}

/** Replaces {{placeholders}}; unknown keys collapse to an empty string. */
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key])
  );
}

const CSV_COLUMNS = [
  'domain',
  'url',
  'title',
  'type',
  'status',
  'anchor',
  'targetUrl',
  'contactEmail',
  'linkFound',
  'linkRel',
  'notes',
  'createdAt',
  'updatedAt',
  'lastCheckedAt'
];

function csvCell(value) {
  if (value == null) return '';
  let out = String(value);
  if (/^[=+\-@]/.test(out)) out = "'" + out; // don't let a cell execute in Excel/Sheets
  return /[",\n]/.test(out) ? '"' + out.replace(/"/g, '""') + '"' : out;
}

export function toCSV(list) {
  const rows = [CSV_COLUMNS.join(',')];
  for (const o of list) {
    rows.push(
      CSV_COLUMNS.map((col) => {
        const v = o[col];
        if (/At$/.test(col) && typeof v === 'number') return csvCell(new Date(v).toISOString());
        if (typeof v === 'boolean') return v ? 'yes' : 'no';
        return csvCell(v);
      }).join(',')
    );
  }
  return rows.join('\n');
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
