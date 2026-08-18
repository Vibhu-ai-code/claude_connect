import { DEFAULT_SETTINGS, getSettings, saveSettings } from './lib/store.js';

const FIELDS = Object.keys(DEFAULT_SETTINGS);
const el = (id) => document.getElementById(id);

async function load(values) {
  const s = values || (await getSettings());
  FIELDS.forEach((k) => {
    const node = el(k);
    if (!node) return;
    if (node.type === 'checkbox') node.checked = !!s[k];
    else node.value = s[k] ?? '';
  });
}

el('save').addEventListener('click', async () => {
  const patch = {};
  FIELDS.forEach((k) => {
    const node = el(k);
    if (!node) return;
    patch[k] = node.type === 'checkbox' ? node.checked : node.value.trim();
  });
  if (patch.site && !/^https?:\/\//i.test(patch.site)) patch.site = `https://${patch.site}`;
  patch.targetDomain = patch.targetDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  await saveSettings(patch);
  el('status').textContent = 'Saved.';
  setTimeout(() => { el('status').textContent = ''; }, 2000);
});

el('reset').addEventListener('click', async () => {
  await saveSettings(DEFAULT_SETTINGS);
  await load(DEFAULT_SETTINGS);
  el('status').textContent = 'Reset to defaults.';
});

load();
