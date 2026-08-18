import {
  getSettings,
  saveSettings,
  getOpportunities,
  replaceAll,
  normalizeDomain,
  DEFAULT_SETTINGS
} from './lib/store.js';

const $ = (id) => document.getElementById(id);

const FIELDS = ['targetUrl', 'mySite', 'myName', 'myEmail', 'outreachSubject', 'outreachBody'];

init();

async function init() {
  if (new URLSearchParams(location.search).get('welcome')) {
    $('welcome').classList.remove('hidden');
  }

  const settings = await getSettings();
  FIELDS.forEach((id) => ($(id).value = settings[id] || ''));
  $('targets').value = settings.targets.join('\n');
  $('anchors').value = settings.anchors.join('\n');
  $('autoBadge').checked = settings.autoBadge !== false;

  $('save').addEventListener('click', save);
  $('resetTemplate').addEventListener('click', () => {
    $('outreachSubject').value = DEFAULT_SETTINGS.outreachSubject;
    $('outreachBody').value = DEFAULT_SETTINGS.outreachBody;
    status('Template reset — remember to save.');
  });
  $('clearData').addEventListener('click', clearData);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  await renderCount();
}

function lines(id) {
  return $(id)
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function save() {
  const targets = [...new Set(lines('targets').map(normalizeDomain).filter(Boolean))];
  const patch = { targets, anchors: [...new Set(lines('anchors'))], autoBadge: $('autoBadge').checked };
  FIELDS.forEach((id) => (patch[id] = $(id).value.trim()));

  await saveSettings(patch);
  $('targets').value = targets.join('\n');
  status(targets.length ? 'Settings saved.' : 'Saved — but add at least one domain so links can be detected.');
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
}

async function clearData() {
  const list = await getOpportunities();
  if (!list.length) return status('There is nothing saved yet.');
  if (!confirm(`Delete all ${list.length} saved opportunities? This cannot be undone.`)) return;
  await replaceAll([]);
  await renderCount();
  status('All opportunities deleted.');
}

async function renderCount() {
  const list = await getOpportunities();
  $('dataCount').textContent = `${list.length} opportunit${list.length === 1 ? 'y' : 'ies'} stored`;
}

function status(text) {
  const el = $('status');
  el.textContent = text;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 3000);
}
