# Chrome Web Store submission - copy & answers

Everything the dashboard asks for, ready to paste. Fill the two `[...]`
placeholders before you submit.

---

## Store listing tab

**Extension name**
```
Moolchand Backlink Builder
```

**Short description** (132 char limit - this is 121)
```
Find, track and verify backlinks for moolchandhealthcare.com: page analysis, curated link sources, snippets and outreach.
```

**Detailed description**
```
Moolchand Backlink Builder is a working tool for the team that builds and maintains the hospital's backlink profile. It replaces a spreadsheet and a pile of browser tabs.

WHAT IT DOES

1. Scans the page you are on
Open any page and see instantly whether it links to your site, whether that link is dofollow or nofollow, and whether it sits in real content or in a footer. It also catches brand mentions that were never linked - usually the quickest links to win - and reads the page for signals like "accepts guest posts", "accepts listings" or a visible editorial contact.

2. Suggests link sources that actually fit a hospital
64 curated sources, not a generic directory dump: local citations, Indian health directories and doctor-profile platforms, medical tourism portals, accreditation and association listings, insurance and government empanelment records, expert-quote platforms used by journalists, healthcare trade press, clinical-training tie-ups with colleges, and community and CSR routes. Each one explains why it matters for a hospital and what to do next, and can be filtered by category, effort and cost.

3. Tracks the pipeline
Move each prospect from Prospect to Contacted, Submitted, Live or Rejected, with notes for the contact, price and follow-up date. The Verify button fetches the page and reports whether your link is really there and whether it is dofollow. Export the whole pipeline to CSV or JSON for reporting.

4. Gives you what you need to place the link
Anchor snippets in HTML, Markdown and BBCode with optional UTM tracking; a NAP citation block so every directory listing matches your Google Business Profile exactly; Hospital structured data; eight outreach email templates covering directory listings, guest posts, broken links, unlinked mentions, press enquiries, corporate partner pages, colleges and community camps; and a set of Google search operators for finding new prospects.

CONFIGURABLE
The brand name, website, target domain, address, phone, sender details and UTM tags are all editable in Settings, so the extension works for any site you point it at.

PRIVACY
Everything stays in your browser. Your prospect list and settings are held in local extension storage and are never sent anywhere. The extension has no account, no analytics and no server.

HONEST LIMITS
The authority figures shown on each source are hand-estimated bands for prioritisation, not measured Moz or Ahrefs metrics - no paid SEO API is called. Verify reads the page as served, so it cannot see links that appear only after JavaScript rendering or behind a login. This tool helps you earn and record links; it does not post anything automatically.
```

**Category** — `Workflow & Planning`
**Language** — `English (United Kingdom)` or `English (United States)`

**Graphic assets** (in `store/screenshots/`)
| Field | File |
| --- | --- |
| Screenshots (1280x800, up to 5) | `1-page-scan.png`, `2-ideas.png`, `3-tracker.png`, `4-tools.png` |
| Small promo tile (440x280) | `promo-tile-440x280.png` |
| Store icon (128x128) | taken from the package - `icons/icon128.png` |

---

## Privacy tab

**Single purpose**
```
The extension helps a website owner build and manage the backlink profile of their own site. It analyses the page the user opens to detect links and mentions of that site, suggests relevant places to earn a link, generates link snippets and outreach text, and tracks each prospect until the link is live.
```

**Permission justifications** — paste one per permission.

`storage`
```
Stores the user's own settings (brand name, website, address, phone, sender details, UTM tags) and their list of tracked backlink prospects locally in the browser. Nothing is transmitted.
```

`activeTab`
```
Used when the user opens the popup or clicks Re-scan, to read the current page's links so the extension can report whether that page links to the user's site.
```

`scripting`
```
Injects the page-analysis function into the tab the user is currently viewing, on that explicit user action, to count links, read anchor text and rel attributes, and detect brand mentions. Nothing is written to the page.
```

`tabs`
```
Reads the active tab's URL and title so the scan result and any saved prospect are labelled correctly, and opens link sources or Google searches in a new tab when the user clicks them.
```

`contextMenus`
```
Adds right-click items so the user can save the current page or a link as a backlink prospect without opening the popup.
```

**Host permission justification** (`http://*/*`, `https://*/*`)
```
Backlinks can appear on any website, so the user must be able to scan any page they open, and the Verify feature must be able to fetch any page the user has added to their own prospect list to confirm the link is live. The extension only reads pages the user explicitly acts on - it does not run in the background on other sites and does not modify any page.
```

**Are you using remote code?** — `No, I am not using remote code`
```
All code is included in the package. The extension loads no external scripts and evaluates no remote strings.
```

**Data usage** — tick nothing. The extension collects no personally identifiable information, health information, financial information, authentication information, personal communications, location, web history or user activity, and no website content is transmitted anywhere. Page content is read in memory to produce the on-screen result and is discarded.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** — required. Publish `store/privacy-policy.md` at a public URL and paste it here, e.g.
```
https://www.moolchandhealthcare.com/backlink-extension-privacy
```

---

## Distribution tab

- **Visibility** — `Unlisted` for an internal marketing tool (anyone with the link can install; it does not appear in search). Choose `Public` only if you want it discoverable, `Private` to restrict it to a Google Workspace domain or a trusted-tester list.
- **Regions** — all, or India only.
- **Pricing** — free.

---

## After you submit

Review usually lands within a few hours to a few working days; the broad host
permission can push it towards the slower end. If it is rejected, the rejection
email names the exact policy clause - the two that apply to an extension like
this one are single purpose and the host permission justification above.

Version updates: bump `version` in `manifest.json`, run `./build.sh`, and upload
the new zip to the same item. The store re-signs the package, so the extension
ID stays the same and installed copies update automatically - the local
`dist/key.pem` matters only for self-hosted `.crx` builds.
