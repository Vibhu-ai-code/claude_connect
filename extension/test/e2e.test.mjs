import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Playwright may be a project dependency or installed globally on this machine.
async function loadPlaywright() {
  for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try {
      const mod = await import(spec);
      return mod.default ?? mod;
    } catch {}
  }
  throw new Error('Playwright not found. Run: npm install -D playwright');
}
const { chromium } = await loadPlaywright();

// Extensions do not load in the headless shell, so use a full Chromium build.
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(root)) return undefined;
  const dir = fs.readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  return dir ? path.join(root, dir, 'chrome-linux', 'chrome') : undefined;
}

const EXT = DIR;
const USER_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blb-profile-'));
const PORT = 8731;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// A fake prospect page: guest-post signals, a nofollow link to us, a contact email.
const PAGE = `<!doctype html><html lang="en"><head>
<title>Best Paediatric Clinics in Delhi</title>
<meta name="description" content="A roundup of clinics."></head><body>
<h1>Best Paediatric Clinics in Delhi</h1>
<p>${'word '.repeat(300)}</p>
<p>Want to <strong>write for us</strong>? We accept guest posts from practitioners.</p>
<p>Email the editor at editor@delhihealthblog.test or info@delhihealthblog.test.</p>
<h2>Useful resources</h2>
<ul>
  <li><a href="https://www.moolchandhealthcare.com/paediatrics" rel="nofollow">Moolchand paediatrics</a></li>
  <li><a href="https://blog.moolchandhealthcare.com/vaccines">Vaccination <b>schedule</b></a></li>
  <li><a href="https://who.int/">WHO</a></li>
  <li><a href="/internal">Our other guide</a></li>
</ul>
<form id="respond"><textarea name="comment"></textarea>
  <input type="url" name="website" placeholder="Your website"><button>Post comment</button></form>
</body></html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let failures = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) failures++; };

const ctx = await chromium.launchPersistentContext(USER_DIR, {
  headless: true,
  executablePath: findChromium(),
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
});

const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
const extId = new URL(sw.url()).host;
console.log('\n1. Extension load');
ok(!!extId, `MV3 service worker booted (id ${extId})`);

// Playwright can't touch extension APIs from the worker, so drive them from an extension page.
const api = await ctx.newPage();
const apiErrors = [];
api.on('pageerror', (e) => apiErrors.push(String(e)));
await api.goto(`chrome-extension://${extId}/options.html`);
ok(await api.evaluate(() => typeof chrome.storage === 'object'), 'extension pages have the chrome APIs');

await api.evaluate(async () => {
  await chrome.storage.local.set({ settings: {
    targets: ['moolchandhealthcare.com'],
    targetUrl: 'https://moolchandhealthcare.com/paediatrics',
    anchors: ['paediatric care in Delhi'],
    myName: 'Priya', myEmail: 'priya@moolchandhealthcare.com', mySite: 'Moolchand Healthcare',
    outreachSubject: 'Quick question about {{pageTitle}}',
    outreachBody: 'Hi, re {{domain}} — see {{targetUrl}} ({{anchor}}). — {{myName}}',
    autoBadge: true
  }});
});

const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(`${ORIGIN}/guide`, { waitUntil: 'load' });

console.log('\n2. Content script analysis');
// Ask the content script the same way the popup does: extension page -> tabs.sendMessage.
const a = await api.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1:8731/*' });
  return await chrome.tabs.sendMessage(t.id, { type: 'ANALYZE_PAGE', targets: ['moolchandhealthcare.com'] });
});
ok(a && a.ok, 'analyze() returned a result');
ok(a.targetLinks.length === 2, `found both links to us (got ${a.targetLinks.length})`);
ok(a.targetLinks[0].nofollow === true && a.targetLinks[0].dofollow === false, 'rel=nofollow link read correctly');
ok(a.targetLinks[1].dofollow === true, 'subdomain link read as dofollow');
ok(a.targetLinks[1].anchor === 'Vaccination schedule', 'anchor text extracted across inline tags');
ok(a.emails.includes('editor@delhihealthblog.test'), 'editor email scraped');
ok(a.emails[0].startsWith('editor'), 'role-based address sorted first for outreach');
ok(a.signals.some((s) => s.key === 'guest-post'), 'guest-post signal detected');
ok(a.forms.comment && a.forms.acceptsUrl, 'comment form + website URL field detected');
ok(a.links.external === 3 && a.links.internal === 1, `internal vs external counted (${a.links.internal}/${a.links.external})`);
ok(a.words > 300, `word count plausible (${a.words})`);

console.log('\n3. Toolbar badge');
await page.bringToFront();
await page.waitForTimeout(1500);
const badge = await api.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1:8731/*' });
  return { text: await chrome.action.getBadgeText({ tabId: t.id }) };
});
ok(badge.text === '2', `badge shows the live link count (got "${badge.text}")`);

console.log('\n4. Popup UI against that page');
const popup = await ctx.newPage();
const popupErrors = [];
popup.on('pageerror', (e) => popupErrors.push(String(e)));
// A real action popup is not a tab, so tabs.query({active}) returns the page underneath it.
// Opened as a tab it would return itself, so point it at the prospect tab.
await popup.addInitScript(() => {
  const orig = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = (q) => orig(q && q.active ? { url: 'http://127.0.0.1:8731/*' } : q);
});
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(1500);
const verdict = await popup.locator('#verdict').innerText();
ok(/dofollow/i.test(verdict), `verdict rendered: "${verdict.replace(/\n/g, ' | ')}"`);
ok((await popup.locator('#signals .pill').count()) > 0, 'signal pills rendered');
ok((await popup.locator('#contacts li').count()) === 2, 'contacts listed');
ok((await popup.locator('#fAnchor').inputValue()) === 'paediatric care in Delhi', 'anchor prefilled from settings');
await popup.locator('#saveBtn').click();
await popup.waitForTimeout(600);
ok((await popup.locator('#saveHint').innerText()).includes('Saved'), 'save confirmed in the popup');
ok(popupErrors.length === 0, `popup threw no JS errors${popupErrors.length ? ': ' + popupErrors[0] : ''}`);

console.log('\n5. Dashboard round trip');
const dash = await ctx.newPage();
const dashErrors = [];
dash.on('pageerror', (e) => dashErrors.push(String(e)));
await dash.goto(`chrome-extension://${extId}/dashboard.html`);
await dash.waitForTimeout(800);
ok((await dash.locator('#rows tr').count()) === 1, 'popup-saved opportunity appears as a dashboard row');
ok((await dash.locator('#rows tr select[data-field="type"]').inputValue()) === 'mention',
   'type auto-classified (page already links to us → mention)');
await dash.locator('#search').fill('paediatric');
await dash.waitForTimeout(250);
ok((await dash.locator('#rows tr').count()) === 1, 'search matches');
await dash.locator('#search').fill('zzz-no-match');
await dash.waitForTimeout(250);
ok((await dash.locator('#rows tr').count()) === 0, 'search filters out');
await dash.locator('#search').fill('');
await dash.waitForTimeout(250);
await dash.locator('#rows tr select[data-field="status"]').selectOption('contacted');
await dash.waitForTimeout(500);
const persisted = await api.evaluate(async () => (await chrome.storage.local.get('opportunities')).opportunities[0].status);
ok(persisted === 'contacted', 'inline status edit persisted to storage');
ok(dashErrors.length === 0, `dashboard threw no JS errors${dashErrors.length ? ': ' + dashErrors[0] : ''}`);

console.log('\n6. Live-link verification (real HTTP fetch from the service worker)');
const verified = await api.evaluate(() => new Promise((res) =>
  chrome.runtime.sendMessage({ type: 'VERIFY_ALL' }, res)));
ok(verified && verified.ok, 'VERIFY_ALL responded');
ok(verified.results.length === 1, `no duplicate rows accumulated (${verified.results.length} record)`);
const r = verified.results[0];
ok(r && r.found === true, 'verifier re-fetched the page and found our link');
ok(r && r.dofollow === true, 'verifier saw the dofollow subdomain link');
const afterVerify = await api.evaluate(async () => (await chrome.storage.local.get('opportunities')).opportunities[0]);
ok(afterVerify.status === 'live', 'confirmed link flipped the row to "live"');
ok(afterVerify.lastCheckedAt > 0, 'lastCheckedAt stamped');
ok(/nofollow/.test(afterVerify.linkRel) && /dofollow/.test(afterVerify.linkRel),
   `rel summary keeps both links (${afterVerify.linkRel})`);
await dash.reload();
await dash.waitForTimeout(600);
ok((await dash.locator('#rows tr .pill').innerText()).includes('dofollow'), 'dashboard shows the rel summary');
ok((await dash.locator('#rows tr .pill').getAttribute('class')).includes('good'),
   'mixed nofollow+dofollow row reads as a win, not a warning');
ok((await dash.locator('#stats').innerText()).match(/1\nDOFOLLOW/i) ||
   (await dash.locator('#stats').innerText()).includes('DOFOLLOW'), 'dofollow stat card present');

console.log('\n7. Options page');
await api.goto(`chrome-extension://${extId}/options.html`);
await api.waitForTimeout(500);
ok((await api.locator('#targets').inputValue()) === 'moolchandhealthcare.com', 'settings loaded into the form');
await api.locator('#targets').fill('https://WWW.Example.COM/path\nexample.com\n');
await api.locator('#save').click();
await api.waitForTimeout(500);
const savedTargets = await api.evaluate(async () => (await chrome.storage.local.get('settings')).settings.targets);
ok(JSON.stringify(savedTargets) === '["example.com"]', `domains normalised + de-duped (${JSON.stringify(savedTargets)})`);
ok(apiErrors.length === 0, `options threw no JS errors${apiErrors.length ? ': ' + apiErrors[0] : ''}`);
ok(pageErrors.length === 0, `content script threw nothing${pageErrors.length ? ': ' + pageErrors[0] : ''}`);

await dash.reload();
await dash.waitForTimeout(600);

await ctx.close();
server.close();
fs.rmSync(USER_DIR, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll end-to-end checks passed\n');
process.exit(failures ? 1 : 0);
