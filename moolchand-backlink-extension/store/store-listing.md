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
Backlink Builder turns link building from a spreadsheet chore into something you do while you browse. Open any page and it tells you, instantly, whether that site links to you - and if it doesn't, what to do about it.

WHY INSTALL IT

Link building normally means a spreadsheet, twenty open tabs and a lot of guesswork: which directories are worth the effort, whether that link you were promised ever went live, whether the mention in last week's article was actually linked. This extension answers all three where the work happens - in the browser, on the page in front of you.

Everything runs locally. There is no account to create, no subscription, no data leaving your machine.

WHAT IT DOES

1. Tells you where you stand on any page
Open a page and see whether it links to your site, whether that link is dofollow or nofollow, and whether it sits in real editorial content or is buried in a footer. It also catches brand mentions that were never linked - normally the fastest links you will ever win - and reads the page for signals worth knowing: does this site accept guest posts, does it take listings, is there a visible editorial contact, and does it look like it sells links.

2. Suggests places worth pitching
64 curated link sources, chosen rather than scraped: local business citations, health and doctor-profile directories, medical tourism portals, accreditation and association listings, government and insurance empanelment records, the expert-quote platforms journalists actually use, industry trade press, college clinical-training pages, and community and CSR routes. Each one explains why it matters and what to do next, and you can filter by category, effort and cost so you start with the wins you can get this week.

3. Tracks every prospect to the day it goes live
Move each target through Prospect, Contacted, Submitted, Live or Rejected, with notes for the contact, the price and the follow-up date. Press Verify and the extension fetches the page and tells you whether your link is really there and whether it is dofollow - so a promised link that quietly never appeared does not sit in your pipeline for three months. Export the whole thing to CSV or JSON when it is time to report.

4. Writes the boring parts for you
Anchor snippets in HTML, Markdown and BBCode with optional UTM tracking. A name-address-phone citation block so every directory listing matches your Google Business Profile exactly. Structured data for your site. Eight outreach email templates covering directory submissions, guest post pitches, broken links, unlinked mentions, press enquiries, partner pages, colleges and community events. Plus a set of Google search operators for finding prospects nobody else has pitched.

Right-click any page or link to save it as a prospect without breaking your flow.

WHO IT IS FOR

In-house marketers, SEO and digital teams, and agencies managing the link profile of a site they own or work on. It ships configured for a multi-speciality hospital, but the brand name, website, target domain, address, phone, sender details and UTM tags are all editable in Settings - point it at any site and it works the same way.

PRIVACY

Your settings and your prospect list are stored in local browser storage and never transmitted. There is no server, no analytics and no tracking of any kind. Pages are read only when you ask for a scan, used to draw the result on screen, and then discarded. The extension never modifies a page and never posts anything anywhere.

HONEST LIMITS

The authority figures on each source are hand-estimated bands for prioritisation, not measured Moz or Ahrefs metrics - no paid SEO API is called. Verify reads the page as served, so it cannot see links that appear only after JavaScript rendering or behind a login. This tool helps you earn and record links; buying them is against search engine guidelines, which is why a link quality checklist ships with it.
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
