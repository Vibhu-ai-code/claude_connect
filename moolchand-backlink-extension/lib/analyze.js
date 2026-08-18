/**
 * Runs inside the inspected page via chrome.scripting.executeScript({ func }).
 * Must stay self-contained: no imports, no closure over module scope.
 */
export function analysePage(targetDomain, brand) {
  const norm = (u) => String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
  const target = norm(targetDomain);
  const here = location.hostname.replace(/^www\./i, '');
  const anchors = [...document.querySelectorAll('a[href]')];

  const targetLinks = [];
  let internal = 0;
  const externalHosts = {};

  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let host = '';
    try { host = new URL(a.href, location.href).hostname.replace(/^www\./i, ''); } catch { continue; }
    if (host === here) { internal += 1; } else { externalHosts[host] = (externalHosts[host] || 0) + 1; }
    if (norm(a.href).includes(target)) {
      const rel = (a.getAttribute('rel') || '').toLowerCase();
      targetLinks.push({
        href: a.href,
        anchor: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120) || '[image or empty anchor]',
        rel: rel || 'none',
        nofollow: /nofollow|ugc|sponsored/.test(rel),
        inNav: !!a.closest('nav,header,footer,aside'),
      });
    }
  }

  const bodyText = document.body ? document.body.innerText : '';
  const lower = bodyText.toLowerCase();
  const brandLower = String(brand || '').toLowerCase();
  const brandWord = brandLower.split(/\s+/)[0] || '';
  const mentions = brandWord ? (lower.match(new RegExp(brandWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;

  const signalWords = {
    'Accepts guest posts': /write for us|guest post|guest article|contribute to|submit an article|become a contributor/i,
    'Accepts listings': /add your (business|listing|hospital|clinic)|submit your (site|business|listing)|list your (business|hospital|clinic)|free listing/i,
    'Resource / links page': /useful links|helpful resources|resources page|recommended (sites|reading)/i,
    'Paid link risk': /sponsored post (price|cost)|buy (a )?(link|backlink)|link insertion (price|rate)|paid guest post/i,
    'Has comment form': /leave a (comment|reply)|post a comment/i,
  };
  const signals = Object.entries(signalWords)
    .filter(([, re]) => re.test(bodyText))
    .map(([label]) => label);

  const emails = [...new Set((bodyText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((e) => e.toLowerCase()))].slice(0, 5);
  const social = [...new Set(anchors
    .map((a) => a.href)
    .filter((h) => /(linkedin|twitter|x\.com|facebook|instagram|youtube)\.com/i.test(h))
    .map((h) => { try { return new URL(h).hostname.replace(/^www\./, ''); } catch { return null; } })
    .filter(Boolean))];

  const topExternal = Object.entries(externalHosts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return {
    url: location.href,
    host: here,
    title: document.title || '',
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    h1: document.querySelector('h1')?.textContent?.trim().slice(0, 140) || '',
    lang: document.documentElement.lang || '',
    noindex: /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || ''),
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    wordCount: bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0,
    linkCounts: { total: anchors.length, internal, external: anchors.length - internal },
    targetLinks,
    mentions,
    unlinkedMention: mentions > 0 && targetLinks.length === 0,
    signals,
    emails,
    social,
    topExternal,
  };
}
