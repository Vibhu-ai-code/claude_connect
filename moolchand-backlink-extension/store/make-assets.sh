#!/usr/bin/env bash
# Renders Chrome Web Store assets - four 1280x800 screenshots and the 440x280
# small promo tile - by loading the built extension in headless Chromium and
# framing the real popup. No mockups: this is the shipped UI.
#
#   ./build.sh && ./store/make-assets.sh
#
# Headless screenshots race the popup's async boot, so the popup copy under
# $SHOT posts a message when init() finishes; the harness paints a marker
# below the crop line and the render is retried until that marker is present.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | head -1 | cut -d'"' -f4)
SRC="dist/moolchand-backlink-builder-${VERSION}"
[[ -d "$SRC" ]] || { echo "run ./build.sh first" >&2; exit 1; }

CHROME="${CHROME_BIN:-/opt/pw-browsers/chromium}"
command -v "$CHROME" >/dev/null || { echo "set CHROME_BIN to a Chrome/Chromium binary" >&2; exit 1; }

SHOT=$(mktemp -d)/ext
cp -r "$SRC" "$SHOT"
OUT="store/screenshots"
mkdir -p "$OUT"

# Patch the throwaway copy: canned page analysis, ?tab= support, ready signal.
python3 - "$SHOT" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]) / 'popup.js'
s = p.read_text()

s = s.replace("let analysis = null;", """let analysis = null;
const DEMO_ANALYSIS = {
  url: 'https://www.thehealthsite.com/diseases-conditions/best-hospitals-delhi/',
  host: 'thehealthsite.com',
  title: 'Best multi-speciality hospitals in Delhi NCR - 2026 guide',
  wordCount: 2418,
  noindex: false,
  linkCounts: { total: 96, internal: 61, external: 35 },
  mentions: 4,
  unlinkedMention: true,
  targetLinks: [],
  signals: ['Accepts guest posts', 'Has comment form'],
  emails: ['editorial@thehealthsite.com'],
  social: ['linkedin.com', 'youtube.com'],
  topExternal: [['maxhealthcare.in', 6], ['apollohospitals.com', 5], ['fortishealthcare.com', 4]],
};""")

s = s.replace("""  const box = $('#pageResult');
  box.innerHTML = '<p class="muted">Scanning…</p>';""",
"""  const box = $('#pageResult');
  box.innerHTML = '<p class="muted">Scanning…</p>';
  if (new URLSearchParams(location.search).has('demo')) { analysis = DEMO_ANALYSIS; renderPage(DEMO_ANALYSIS); return; }""")

# Drive the view from the query string inside the popup's own boot, so there is
# no cross-frame timing to lose, then tell the harness we are done.
s = s.replace("""  buildIdeas();
  buildTracker();
  buildTools();
  scanPage();""",
"""  buildIdeas();
  buildTracker();
  buildTools();
  await scanPage();

  const shot = new URLSearchParams(location.search);
  if (shot.get('tab')) switchTab(shot.get('tab'));
  const details = (key, open) => (shot.get(key) || '').split(',').filter(Boolean)
    .forEach((i) => { const d = $$('#tab-tools details')[+i]; if (d) d.open = open; });
  details('open', true);
  details('close', false);
  requestAnimationFrame(() => parent.postMessage('popup-ready', '*'));""")
p.write_text(s)
PY

cat > "$SHOT/shot.html" <<'HTML'
<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1280px;height:920px;overflow:hidden;background:#08322b;
    font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eaf4f1}
  .wrap{position:absolute;left:0;top:0;width:1280px;height:800px;display:flex;align-items:center;
    gap:64px;padding:0 72px;box-sizing:border-box;
    background:linear-gradient(135deg,#0d6152,#0a3f36 60%,#08322b)}
  .copy{flex:1;max-width:520px}
  h1{font-size:44px;line-height:1.15;margin:0 0 18px;letter-spacing:-.02em}
  p.sub{font-size:19px;opacity:.85;margin:0 0 26px}
  ul{padding-left:20px;margin:0}
  li{font-size:16px;opacity:.9;margin-bottom:10px}
  .frame{background:#fff;border-radius:14px;box-shadow:0 30px 70px rgba(0,0,0,.45);overflow:hidden;flex:none}
  .bar{height:26px;background:#e7edec;display:flex;align-items:center;gap:6px;padding:0 10px}
  .dot{width:9px;height:9px;border-radius:50%;background:#c4cfcd}
  iframe{display:block;width:420px;height:620px;border:0}
  /* Sits below the 800px crop line - a render marker, never shipped. */
  #marker{position:absolute;left:0;top:804px;width:24px;height:16px;background:#000}
</style></head><body>
<div class="wrap">
  <div class="copy"><h1 id="t"></h1><p class="sub" id="s"></p><ul id="b"></ul></div>
  <div class="frame"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
  <iframe id="f"></iframe></div>
</div>
<div id="marker"></div>
<script src="shot.js"></script></body></html>
HTML

cat > "$SHOT/shot.js" <<'JS'
const q = new URLSearchParams(location.search);
document.getElementById('t').textContent = q.get('title') || '';
document.getElementById('s').textContent = q.get('sub') || '';
document.getElementById('b').innerHTML = (q.get('bullets') || '').split('|').filter(Boolean)
  .map((x) => '<li>' + x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</li>').join('');

const seed = {
  settings: { senderName: 'Ananya Sharma', senderRole: 'Digital Marketing', senderEmail: 'ananya@moolchandhealthcare.com' },
  prospects: [
    { id: 'p1', url: 'https://www.practo.com/providers', name: 'Practo - Hospital & Doctor Profiles', category: 'Health directory', status: 'Live', notes: 'Hospital page claimed; 14 consultants verified', source: 'idea-list', addedAt: '2026-07-02T09:00:00Z', checkedAt: '2026-08-18T09:00:00Z', liveCheck: '2 links found (nofollow)' },
    { id: 'p2', url: 'https://www.vaidam.com/', name: 'Vaidam Health', category: 'Medical tourism', status: 'Submitted', notes: 'Partner form sent 12 Aug - awaiting NABH proof', source: 'idea-list', addedAt: '2026-08-01T09:00:00Z', checkedAt: '', liveCheck: '' },
    { id: 'p3', url: 'https://www.thehealthsite.com/', name: 'TheHealthSite - unlinked mention', category: 'PR & news', status: 'Contacted', notes: 'Asked editorial to link the Moolchand mention', source: 'page-scan', addedAt: '2026-08-14T09:00:00Z', checkedAt: '2026-08-18T09:00:00Z', liveCheck: 'Brand mentioned but not linked' },
    { id: 'p4', url: 'https://www.medifee.com/', name: 'Medifee', category: 'Health directory', status: 'Live', notes: 'Health-check packages listed', source: 'idea-list', addedAt: '2026-06-20T09:00:00Z', checkedAt: '2026-08-18T09:00:00Z', liveCheck: '1 link found (dofollow)' },
    { id: 'p5', url: 'https://ahpi.in/', name: 'AHPI member directory', category: 'Accreditation & association', status: 'Prospect', notes: '', source: 'idea-list', addedAt: '2026-08-16T09:00:00Z', checkedAt: '', liveCheck: '' },
  ],
};

addEventListener('message', (e) => {
  if (e.data === 'popup-ready') document.getElementById('marker').style.background = '#ff00ff';
});

chrome.storage.local.set(seed, () => {
  const f = document.getElementById('f');
  if (q.get('h')) f.style.height = q.get('h') + 'px';
  const pass = ['tab', 'open', 'close'].filter((k) => q.get(k)).map((k) => `${k}=${encodeURIComponent(q.get(k))}`);
  f.src = 'popup.html?demo=1' + (pass.length ? '&' + pass.join('&') : '');
});
JS

ID=$(node -e 'const c=require("crypto");const h=c.createHash("sha256").update(Buffer.from(process.argv[1],"utf8")).digest("hex").slice(0,32);console.log([...h].map(x=>String.fromCharCode(97+parseInt(x,16))).join(""))' "$SHOT")

u() { python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$1"; }

shoot() { # 1=name 2=query
  local attempt=1
  while (( attempt <= 6 )); do
    timeout 90 "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
      --force-device-scale-factor=1 --window-size=1280,920 --virtual-time-budget=$(( 6000 * attempt )) \
      --user-data-dir="$(mktemp -d)" --load-extension="$SHOT" --disable-extensions-except="$SHOT" \
      --screenshot="$OUT/.raw-$1.png" "chrome-extension://$ID/shot.html?$2" >/dev/null 2>&1 || true
    if [[ -f "$OUT/.raw-$1.png" ]] && node store/check-shot.cjs "$OUT/.raw-$1.png" 2>/dev/null; then
      node store/crop.cjs "$OUT/.raw-$1.png" "$OUT/$1.png" 1280 800 >/dev/null
      rm -f "$OUT/.raw-$1.png"
      echo "  $OUT/$1.png"
      return 0
    fi
    rm -f "$OUT/.raw-$1.png"
    (( attempt++ ))
  done
  echo "  FAILED to render $1" >&2
  return 1
}

echo "rendering store screenshots…"
shoot 1-page-scan "tab=page&h=560&title=$(u 'See who links to you - and who forgot')&sub=$(u 'Scan any page for links to your hospital, and spot brand mentions that were never linked.')&bullets=$(u 'Dofollow vs nofollow, in-content vs footer|Unlinked mentions - the fastest wins in link building|Flags sites that accept guest posts or sell links|Pulls the editorial contact off the page')"
shoot 2-ideas "tab=ideas&title=$(u '64 link sources, chosen for a hospital')&sub=$(u 'Not a generic directory dump - Indian health portals, accreditation bodies, empanelment lists and local citations.')&bullets=$(u 'Filter by category, effort and cost|Every card says why it matters and what to do|Sorted by relevance to a Delhi multi-speciality hospital|One click to open or start tracking')"
shoot 3-tracker "tab=tracker&title=$(u 'Track every link to the day it goes live')&sub=$(u 'A real pipeline: prospect, contacted, submitted, live. Verify fetches the page and checks the link is really there.')&bullets=$(u 'Confirms dofollow or nofollow after it publishes|Notes for contact, price and follow-up date|Export to CSV or JSON for reporting|Right-click any page to add it as a prospect')"
shoot 4-tools "tab=tools&open=0,2&close=1,3,4&h=640&title=$(u 'Everything you need to place the link')&sub=$(u 'Anchor snippets with UTM tracking, a consistent NAP block, hospital schema and eight outreach templates.')&bullets=$(u 'HTML, Markdown and BBCode output|NAP citation block that matches your Google profile|Outreach mails for directories, guest posts and press|Google search operators for finding new prospects')"

# --- small promo tile ---------------------------------------------------------
cat > "$SHOT/tile.html" <<'HTML'
<!doctype html><html><head><meta charset="utf-8"><style>
 html,body{margin:0;width:440px;height:400px;overflow:hidden;background:#08322b;
   font:16px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
 .c{position:absolute;left:0;top:0;width:440px;height:280px;
   background:linear-gradient(135deg,#0d6152,#08322b);
   display:flex;flex-direction:column;justify-content:center;padding:0 34px;box-sizing:border-box}
 img{width:56px;height:56px;margin-bottom:16px}
 b{display:block;font-size:27px;line-height:1.2;letter-spacing:-.01em}
 span{display:block;margin-top:10px;font-size:14px;opacity:.82;line-height:1.45}
</style></head><body><div class="c"><img src="icons/icon128.png">
<b>Moolchand<br>Backlink Builder</b>
<span>Find, track and verify backlinks — built for a hospital.</span></div></body></html>
HTML
timeout 60 "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=440,400 --virtual-time-budget=4000 \
  --user-data-dir="$(mktemp -d)" --load-extension="$SHOT" --disable-extensions-except="$SHOT" \
  --screenshot="$OUT/.raw-tile.png" "chrome-extension://$ID/tile.html" >/dev/null 2>&1
node store/crop.cjs "$OUT/.raw-tile.png" "$OUT/promo-tile-440x280.png" 440 280 >/dev/null
rm -f "$OUT/.raw-tile.png"
echo "  $OUT/promo-tile-440x280.png"
