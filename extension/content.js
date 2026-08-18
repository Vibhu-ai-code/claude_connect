/**
 * Content script: analyses the current page as a backlink opportunity.
 * Passive — it only does work when the popup or the service worker asks.
 */
(() => {
  if (window.__backlinkBuilderReady) return;
  window.__backlinkBuilderReady = true;

  const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const ROLE_PREFIXES = ['editor', 'contact', 'hello', 'info', 'press', 'partner', 'marketing', 'content', 'outreach', 'admin', 'team', 'write'];
  const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;

  // Phrases that suggest the site actively accepts external links.
  const SIGNALS = [
    { key: 'guest-post', label: 'Guest post', re: /\b(write for us|guest post|guest posting|guest author|contribute (an? )?(article|post)|submit (an? )?(article|post|guest)|become a contributor|contributor guidelines|editorial guidelines)\b/i },
    { key: 'directory', label: 'Directory', re: /\b(submit (your )?(site|website|url|listing|link)|add (your )?(site|website|listing|business|link)|free listing|claim (your|this) listing|list your business)\b/i },
    { key: 'resource-page', label: 'Resource page', re: /\b(useful (links|resources)|helpful (links|resources)|recommended (links|resources|reading|sites)|resource (page|list|library)|link roundup)\b/i },
    { key: 'sponsored', label: 'Sponsored', re: /\b(sponsored post|paid (post|guest post|review)|advertise with us|advertising (options|opportunities)|media kit|partner with us)\b/i },
    { key: 'profile', label: 'Profile / forum', re: /\b(create (an? )?(account|profile)|sign up|register|forum|community|member profile|your website|add your url)\b/i }
  ];

  const text = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const attr = (sel, name) => {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute(name) || '').trim() : '';
  };

  function hostOf(url) {
    try {
      return new URL(url, location.href).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return '';
    }
  }

  function matchesTarget(host, targets) {
    return targets.some((t) => host === t || host.endsWith('.' + t));
  }

  function relFlags(a) {
    const rel = (a.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    return {
      rel: rel.join(' '),
      nofollow: rel.includes('nofollow'),
      ugc: rel.includes('ugc'),
      sponsored: rel.includes('sponsored'),
      dofollow: !rel.includes('nofollow') && !rel.includes('ugc') && !rel.includes('sponsored')
    };
  }

  function collectEmails() {
    const found = new Map();
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const addr = (a.getAttribute('href') || '').slice(7).split('?')[0].trim().toLowerCase();
      if (addr && !JUNK_EMAIL.test(addr)) found.set(addr, true);
    });
    const body = document.body ? document.body.innerText : '';
    (body.slice(0, 400000).match(EMAIL_RE) || []).forEach((m) => {
      const addr = m.toLowerCase();
      if (!JUNK_EMAIL.test(addr)) found.set(addr, true);
    });
    const list = [...found.keys()];
    // Role-based addresses are the useful ones for outreach — float them up.
    list.sort((a, b) => {
      const score = (e) => (ROLE_PREFIXES.some((p) => e.startsWith(p)) ? 0 : 1);
      return score(a) - score(b) || a.localeCompare(b);
    });
    return list.slice(0, 12);
  }

  function detectSignals() {
    const haystack = [
      document.title,
      text(document.querySelector('h1')),
      [...document.querySelectorAll('a')].slice(0, 500).map((a) => text(a)).join(' | '),
      (document.body ? document.body.innerText : '').slice(0, 30000)
    ].join('\n');

    const hits = [];
    for (const sig of SIGNALS) {
      const m = haystack.match(sig.re);
      if (m) hits.push({ key: sig.key, label: sig.label, phrase: m[0].slice(0, 60) });
    }
    return hits;
  }

  function detectForms() {
    const forms = [...document.querySelectorAll('form')];
    const hasComment = forms.some((f) => {
      const id = (f.id + ' ' + f.className + ' ' + (f.getAttribute('action') || '')).toLowerCase();
      return /comment|reply|respond|disqus/.test(id) || (!!f.querySelector('textarea') && /comment/i.test(f.innerHTML));
    }) || !!document.querySelector('#comments, .comments, #respond, #disqus_thread, .comment-form');

    const hasUrlField = forms.some((f) =>
      !!f.querySelector('input[type="url"], input[name*="url" i], input[name*="website" i], input[placeholder*="website" i], input[placeholder*="http" i]')
    );

    return {
      total: forms.length,
      comment: hasComment,
      // A public form asking for your website URL is the classic profile/directory link.
      acceptsUrl: hasUrlField
    };
  }

  function wordCount() {
    const body = document.body ? document.body.innerText : '';
    return (body.match(/\b[\w'-]+\b/g) || []).length;
  }

  function analyze(targets) {
    const pageHost = hostOf(location.href);
    const clean = (targets || [])
      .map((t) => String(t).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
      .filter(Boolean);

    const anchors = [...document.querySelectorAll('a[href]')];
    let internal = 0;
    let external = 0;
    const externalHosts = new Map();
    const targetLinks = [];

    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
      const host = hostOf(href);
      if (!host) continue;

      if (host === pageHost || host.endsWith('.' + pageHost) || pageHost.endsWith('.' + host)) {
        internal++;
      } else {
        external++;
        externalHosts.set(host, (externalHosts.get(host) || 0) + 1);
      }

      if (clean.length && matchesTarget(host, clean)) {
        const flags = relFlags(a);
        let resolved = href;
        try { resolved = new URL(href, location.href).href; } catch {}
        targetLinks.push({
          href: resolved,
          anchor: text(a).slice(0, 120) || (a.querySelector('img') ? '[image link]' : '[empty]'),
          ...flags
        });
      }
    }

    const robots = (attr('meta[name="robots"]', 'content') || '').toLowerCase();
    const topHosts = [...externalHosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([host, count]) => ({ host, count }));

    return {
      ok: true,
      url: location.href,
      host: pageHost,
      title: (document.title || '').trim(),
      description: attr('meta[name="description"]', 'content').slice(0, 300),
      canonical: attr('link[rel="canonical"]', 'href'),
      h1: text(document.querySelector('h1')).slice(0, 200),
      lang: document.documentElement.getAttribute('lang') || '',
      robots: {
        raw: robots,
        noindex: robots.includes('noindex'),
        nofollow: robots.includes('nofollow')
      },
      links: { total: anchors.length, internal, external, topHosts },
      targetLinks,
      emails: collectEmails(),
      signals: detectSignals(),
      forms: detectForms(),
      words: wordCount(),
      selection: String(window.getSelection() || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      scannedAt: Date.now()
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'ANALYZE_PAGE') return;
    try {
      sendResponse(analyze(msg.targets));
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    }
    return true;
  });
})();
