/** Shared settings + prospect storage helpers. */

export const DEFAULT_SETTINGS = {
  brand: 'Moolchand Healthcare',
  site: 'https://www.moolchandhealthcare.com',
  targetDomain: 'moolchandhealthcare.com',
  address: 'Moolchand Medcity, Lajpat Nagar III, New Delhi 110024, India',
  phone: '+91 11 4200 0000',
  senderName: '',
  senderRole: 'Digital Marketing',
  senderEmail: '',
  utmSource: 'backlink',
  utmMedium: 'referral',
  utmCampaign: 'link-building',
  useUtm: true,
};

export const STATUSES = ['Prospect', 'Contacted', 'Submitted', 'Live', 'Rejected'];

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getProspects() {
  const { prospects } = await chrome.storage.local.get('prospects');
  return Array.isArray(prospects) ? prospects : [];
}

export async function saveProspects(list) {
  await chrome.storage.local.set({ prospects: list });
  return list;
}

/** Adds a prospect unless the same URL is already tracked. Returns {added, list}. */
export async function addProspect(entry) {
  const list = await getProspects();
  const key = normaliseUrl(entry.url);
  if (list.some((p) => normaliseUrl(p.url) === key)) return { added: false, list };
  const next = [
    {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: entry.url,
      name: entry.name || hostOf(entry.url),
      category: entry.category || 'Uncategorised',
      status: entry.status || 'Prospect',
      notes: entry.notes || '',
      source: entry.source || 'manual',
      addedAt: new Date().toISOString(),
      checkedAt: '',
      liveCheck: '',
    },
    ...list,
  ];
  await saveProspects(next);
  return { added: true, list: next };
}

export function normaliseUrl(url = '') {
  return String(url).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
}

export function hostOf(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return String(url);
  }
}

/** Appends UTM parameters to a destination URL. */
export function withUtm(url, settings) {
  if (!settings.useUtm) return url;
  try {
    const u = new URL(url);
    if (settings.utmSource) u.searchParams.set('utm_source', settings.utmSource);
    if (settings.utmMedium) u.searchParams.set('utm_medium', settings.utmMedium);
    if (settings.utmCampaign) u.searchParams.set('utm_campaign', settings.utmCampaign);
    return u.toString();
  } catch {
    return url;
  }
}

export function fillTemplate(text, vars) {
  return String(text).replace(/{{(\w+)}}/g, (_, key) => (vars[key] != null && vars[key] !== '' ? vars[key] : `[${key}]`));
}

export function toCsv(rows, columns) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [columns.map(esc).join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n');
}
