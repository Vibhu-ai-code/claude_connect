# Moolchand Backlink Builder — Chrome Extension

A Manifest V3 Chrome extension for building and tracking backlinks to
**moolchandhealthcare.com**. It does four things:

1. **Analyses the page you are on** — does it already link to your site, is the link
   dofollow or nofollow, is the brand mentioned without a link, does the site accept
   guest posts or listings, and who do you contact.
2. **Suggests 64 curated link sources** relevant to a Delhi multi-speciality hospital —
   local citations, Indian health directories, medical-tourism portals, accreditation
   bodies, insurance/empanelment listings, PR routes, education and CSR tie-ups.
3. **Generates what you need to place the link** — anchor snippets (HTML / Markdown /
   BBCode) with UTM tracking, a NAP citation block, `Hospital` JSON-LD, and eight
   outreach email templates.
4. **Tracks every prospect** through Prospect → Contacted → Submitted → Live → Rejected,
   verifies whether the link actually went live, and exports to CSV/JSON.

## Install

### Option A — unpacked folder (recommended, works everywhere)

1. Unzip `release/moolchand-backlink-builder-1.0.1.zip`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

### Option B — the `.crx`

`release/moolchand-backlink-builder-1.0.1.crx` is a signed CRX3 package. Note that
Chrome deliberately blocks drag-and-drop installation of CRX files that did not come
from the Chrome Web Store. A `.crx` therefore installs only when it is:

* pushed by enterprise policy (`ExtensionInstallForcelist` / `ExtensionInstallAllowlist`
  with a self-hosted update URL) — the normal route for rolling it out to a marketing team, or
* uploaded to the Chrome Web Store (unlisted/private visibility works well for internal tools).

For a single machine, Option A is quicker and behaves identically.

## First run

Open the extension → **⚙ Settings** and fill in your name, role and email so the
outreach templates are signed correctly. Everything else is pre-filled for Moolchand
Healthcare and can be changed (brand, site, target domain, address, phone, UTM tags),
so the same extension works for any other site you point it at.

## The four tabs

| Tab | What it does |
| --- | --- |
| **Page** | Scans the active tab: existing links to your domain with their `rel` values and placement, unlinked brand mentions, page word count, indexability, contact emails found, outbound-link profile, and signals like "Accepts guest posts" or "Paid link risk". One click tracks the page or drafts an outreach mail for it. |
| **Ideas** | 64 curated sources, filterable by category, effort and cost, sorted by relevance. Each card explains *why* it matters for a hospital and *what to actually do*. |
| **Tracker** | Your pipeline. Change status, add notes, hit **Verify** to fetch the page and confirm the link is live (and whether it is nofollow), then export CSV/JSON for reporting. |
| **Tools** | Snippet builder, NAP citation block, JSON-LD schema, outreach templates, Google search-operator prospecting, and a 10-point link quality checklist. |

Right-click any page or link to save it as a prospect without opening the popup.

## Honest limits

* The `DA ~nn` figures are **hand-estimated authority bands for prioritisation only** —
  they are not measured Moz/Ahrefs metrics, and the extension does not call any paid SEO API.
  If you have an Ahrefs/Semrush subscription, use their numbers for final decisions.
* Directory submission pages change. Always confirm the live page before investing time.
* "Verify" fetches the page as the extension, so it cannot see links that only appear after
  JavaScript rendering or behind a login.
* This tool helps you *earn and record* links. It does not auto-post anything, and buying
  links from the "Paid link risk" sites it flags is against Google's spam policies — the
  checklist in the Tools tab exists for that reason.

## Chrome Web Store submission

`store/` holds everything the store dashboard asks for:

* `store-listing.md` - the listing copy, single-purpose statement, per-permission
  justifications, data-usage answers and distribution notes, ready to paste.
* `privacy-policy.md` - a privacy policy to publish at a public URL (the store
  requires one) and link from the Privacy tab.
* `screenshots/` - four 1280x800 screenshots and the 440x280 promo tile.

Regenerate the images after a UI change with `./build.sh && ./store/make-assets.sh`.
They are rendered from the real popup in headless Chromium, not mocked up.

## Build from source

```bash
./build.sh          # -> dist/moolchand-backlink-builder-<version>.zip
./build.sh --crx    # -> also dist/…​.crx  (needs Chrome/Chromium; set CHROME_BIN if needed)
```

The first `--crx` build writes `dist/key.pem`. Keep that file safe and out of git — it
fixes the extension ID for every future build. It is gitignored here, so a rebuild in a
fresh clone will generate a new key and therefore a new extension ID.

## Layout

```
manifest.json          MV3 manifest
popup.html/.css/.js    the four-tab UI
options.html/.js       settings (brand, NAP, sender, UTM)
background.js          context menus, badge state, live-link verification
lib/store.js           settings + prospect storage, CSV/UTM/template helpers
lib/analyze.js         the function injected into the page being scanned
data/opportunities.js  the 64 curated link sources + anchor library + search operators
data/templates.js      8 outreach templates + link quality checklist
```
