import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) fail++; };

// ---- chrome stub so the modules import cleanly ----
const store = new Map();
globalThis.chrome = {
  storage: { local: {
    get: async (k) => (store.has(k) ? { [k]: store.get(k) } : {}),
    set: async (o) => { for (const [k, v] of Object.entries(o)) store.set(k, v); }
  } },
  runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} },
             onMessage: { addListener() {} }, getURL: (p) => 'chrome-extension://x/' + p },
  tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, create() {} },
  contextMenus: { removeAll(cb) { cb && cb(); }, create() {}, onClicked: { addListener() {} } },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
};

console.log('\n1. manifest.json');
const mf = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
ok(mf.manifest_version === 3, 'manifest_version is 3');
ok(!!mf.background.service_worker && mf.background.type === 'module', 'module service worker declared');
for (const f of [mf.background.service_worker, mf.action.default_popup, mf.options_page,
                 ...mf.content_scripts[0].js, ...Object.values(mf.icons)]) {
  ok(fs.existsSync(path.join(DIR, f)), `manifest file exists: ${f}`);
}

console.log('\n2. HTML asset references');
for (const html of ['popup.html', 'dashboard.html', 'options.html']) {
  const src = fs.readFileSync(path.join(DIR, html), 'utf8');
  const refs = [...src.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const r of refs) ok(fs.existsSync(path.join(DIR, r)), `${html} → ${r}`);
  // every id referenced by the paired script must exist in the markup
  const js = fs.readFileSync(path.join(DIR, html.replace('.html', '.js')), 'utf8');
  const ids = new Set([...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set([...js.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map((m) => m[1]));
  const missing = [...used].filter((u) => !ids.has(u));
  ok(missing.length === 0, `${html} defines every id its script uses${missing.length ? ' — missing: ' + missing : ''}`);
}

console.log('\n3. store.js');
const s = await import(path.join(DIR, 'lib/store.js'));
ok(s.normalizeDomain('https://WWW.Example.com/a/b?q=1') === 'example.com', 'normalizeDomain strips scheme/www/path');
ok(s.hostOf('https://blog.example.com/post') === 'blog.example.com', 'hostOf keeps subdomain');
ok(s.renderTemplate('Hi {{myName}}, see {{targetUrl}} {{nope}}', { myName: 'A', targetUrl: 'B' }) === 'Hi A, see B ',
   'renderTemplate substitutes and blanks unknowns');

const a = await s.upsertOpportunity({ url: 'https://x.com/p', domain: 'x.com', title: 'T' });
const b = await s.upsertOpportunity({ url: 'https://x.com/p', status: 'live' });
ok(a.id === b.id && (await s.getOpportunities()).length === 1, 'upsert dedupes by URL instead of adding a row');
ok(b.title === 'T' && b.status === 'live', 'upsert merges rather than replaces');
ok(typeof a.id === 'string' && a.id.startsWith('op_'), 'explicit id:undefined does not clobber the generated id');
const c = await s.upsertOpportunity({ id: a.id, notes: 'edited' });
ok(c.id === a.id && (await s.getOpportunities()).length === 1, 'editing by id alone updates in place, no duplicate row');
ok(c.createdAt === a.createdAt && c.updatedAt >= a.updatedAt, 'createdAt preserved, updatedAt advanced');

const csv = s.toCSV([{ domain: 'x.com', title: 'He said "hi", ok', notes: '=cmd()', linkFound: true, createdAt: 1700000000000 }]);
const body = csv.split('\n')[1];
ok(body.includes('"He said ""hi"", ok"'), 'CSV escapes quotes and commas');
ok(body.includes("'=cmd()"), 'CSV neutralises formula injection');
ok(body.includes('2023-11-14'), 'CSV renders timestamps as ISO dates');
ok(csv.split('\n')[0].split(',').length === body.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length, 'CSV column count matches header');

console.log('\n4. background.js link detection');
const bg = await import(path.join(DIR, 'background.js'));
const html = `
  <a href="/about">internal</a>
  <a href="https://www.example.com/page" rel="nofollow noopener">no follow me</a>
  <a href="https://blog.example.com/x">Sub <b>domain</b> link</a>
  <a href="https://notexample.com.evil.net/">lookalike</a>
  <a href='https://example.com/q' rel='sponsored'>paid</a>
  <a href="https://other.org">unrelated</a>`;
const hits = bg.findLinksInHtml(html, 'https://host.tld/page', ['example.com']);
ok(hits.length === 3, `finds 3 links to example.com (got ${hits.length})`);
ok(hits[0].nofollow && !hits[0].dofollow, 'rel="nofollow" flagged');
ok(hits[1].dofollow && hits[1].anchor === 'Sub domain link', 'subdomain link is dofollow, anchor text de-tagged');
ok(hits[2].sponsored && !hits[2].dofollow, "rel='sponsored' (single quotes) flagged");
ok(!hits.some((h) => h.href.includes('evil.net')), 'lookalike domain not matched');
ok(bg.findLinksInHtml(html, 'https://host.tld/', []).length === 0, 'no targets configured → no false hits');
ok(bg.findLinksInHtml('<a href="/relative">x</a>', 'https://example.com/dir/', ['example.com'])[0].href
   === 'https://example.com/relative', 'relative hrefs resolved against base');

console.log('\n5. content.js signal patterns');
const cs = fs.readFileSync(path.join(DIR, 'content.js'), 'utf8');
const sigSrc = cs.match(/const SIGNALS = \[([\s\S]*?)\n  \];/)[1];
const res = [...sigSrc.matchAll(/key: '([\w-]+)'.*?re: (\/.*?\/i)/g)];
ok(res.length === 5, 'all 5 signal patterns parsed');
const compiled = Object.fromEntries(res.map((m) => [m[1], eval(m[2])]));
ok(compiled['guest-post'].test('Write for us — submit an article'), 'guest-post pattern matches');
ok(compiled['directory'].test('Add your business listing today'), 'directory pattern matches');
ok(compiled['resource-page'].test('Helpful resources for parents'), 'resource-page pattern matches');
ok(compiled['sponsored'].test('Advertise with us / media kit'), 'sponsored pattern matches');
ok(!compiled['guest-post'].test('This is an ordinary blog post about cats'), 'guest-post does not match ordinary prose');

console.log(fail ? `\n${fail} check(s) failed\n` : '\nAll checks passed\n');
process.exit(fail ? 1 : 0);
