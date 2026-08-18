/**
 * Outreach templates. Placeholders are replaced at render time:
 *   {{brand}} {{site}} {{page}} {{pageTitle}} {{domain}} {{contactName}}
 *   {{senderName}} {{senderRole}} {{senderEmail}} {{phone}} {{address}}
 */

export const TEMPLATES = [
  {
    id: 'directory',
    name: 'Directory / listing request',
    subject: 'Listing request: {{brand}} ({{domain}} hospital directory)',
    body: `Hi {{contactName}},

I look after digital for {{brand}}, a multi-speciality hospital in New Delhi.

I noticed {{domain}} lists hospitals for patients searching in Delhi NCR, and we are not on it yet. Could you add us?

  Name:    {{brand}}
  Address: {{address}}
  Phone:   {{phone}}
  Website: {{site}}
  Specialities: cardiology, orthopaedics, maternity & fertility, paediatrics, ENT, urology, nephrology, diabetes and 24x7 emergency

Happy to send photos, department details, doctor profiles or price ranges in whatever format suits your template.

Thanks,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'guest-post',
    name: 'Guest post pitch (doctor byline)',
    subject: 'Article pitch for {{domain}}: expert piece from a Delhi consultant',
    body: `Hi {{contactName}},

I read "{{pageTitle}}" on {{domain}} - useful piece, and it lines up with something our consultants get asked constantly.

I work with {{brand}} in New Delhi and can arrange an original, clinically reviewed article written by one of our specialists. Three angles that would fit your readers:

  1. What Delhi's air quality actually does to asthma and COPD patients - and what helps
  2. Chest pain at 2am: how to tell cardiac from non-cardiac before you reach the ER
  3. Fertility after 35 - what the evidence really says about success rates

Around 1,000-1,200 words, exclusive to you, no AI filler, with the doctor's name and credentials for your byline. In exchange we would ask for one contextual link to the relevant patient-information page on {{site}}.

Want me to send a full outline for whichever angle you prefer?

Best,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'broken-link',
    name: 'Broken link replacement',
    subject: 'Broken link on {{domain}} ({{pageTitle}})',
    body: `Hi {{contactName}},

Small heads-up: on "{{pageTitle}}" ({{page}}) one of the outbound links is dead - it returns a 404.

We publish a clinically reviewed page covering the same ground on {{site}}, so if you need a replacement it may save you writing one:

  {{site}}

Either way, wanted to flag the broken link - no obligation at all.

Regards,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'unlinked-mention',
    name: 'Unlinked brand mention',
    subject: 'Thanks for mentioning {{brand}} - one small request',
    body: `Hi {{contactName}},

Thank you for mentioning {{brand}} in "{{pageTitle}}" ({{page}}) - much appreciated.

Would you mind linking the mention to our site so readers can find the department directly?

  {{site}}

That's the only ask. Happy to provide an updated photo, doctor quote or fact-check if it helps the piece.

Warm regards,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'expert-quote',
    name: 'Expert source / journalist offer',
    subject: 'Delhi consultants available for comment - {{brand}}',
    body: `Hi {{contactName}},

You cover health for {{domain}}, so a quick offer: our specialists at {{brand}} are available for comment on short notice.

Areas we can speak to with named, credentialed doctors:
  - Seasonal surges: dengue, viral fever, heatwave illness, air-quality related respiratory cases
  - Cardiac emergencies and the golden hour
  - Maternal health, IVF and high-risk pregnancy
  - Diabetes and metabolic care in urban India

We can also share anonymised admission-trend data from the hospital when it is newsworthy.

Turnaround is usually the same day. Shall I add you to the list we send seasonal data to?

Best,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}} | {{phone}}`,
  },
  {
    id: 'partner-page',
    name: 'Corporate / partner page link',
    subject: 'Adding {{brand}} to your employee health benefits page',
    body: `Hi {{contactName}},

Since your team already uses {{brand}} for health checks and cashless treatment, it would help your employees to see us listed on your benefits or HR page - most people only look for a hospital when they urgently need one.

If useful, here is a ready block you can paste:

  {{brand}} - multi-speciality hospital, New Delhi. Cashless treatment and priority health checks for our employees.
  {{site}} | {{phone}}

Happy to also run an on-site health camp or a doctor talk for your staff this quarter.

Thanks,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'college',
    name: 'College clinical-training partner listing',
    subject: 'Clinical training partnership - {{brand}}, New Delhi',
    body: `Hi {{contactName}},

{{brand}} hosts nursing and allied-health students for clinical rotations, and we would like to formalise the partnership with your institution.

We can offer supervised rotations across emergency, ICU, OT, maternity and diagnostics, with a named clinical coordinator for your students.

If you maintain a clinical-partners or affiliations page, could we be listed there?

  {{brand}}
  {{address}}
  {{site}}

Glad to sign an MoU or host your faculty for a campus visit.

Regards,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}}`,
  },
  {
    id: 'ngo-camp',
    name: 'NGO / RWA health camp collaboration',
    subject: 'Free health camp for your community - {{brand}}',
    body: `Hi {{contactName}},

{{brand}} runs free community health camps in Delhi NCR - BP, blood sugar, BMI, ECG and a doctor consultation, at no cost to the residents or your organisation.

We bring the team, equipment and reports; you provide the venue and inform the community.

If that works, we would ask only that the camp is listed on your events or partners page with a link to {{site}} so residents can follow up afterwards.

Which weekend would suit you?

Warm regards,
{{senderName}}
{{senderRole}}, {{brand}}
{{senderEmail}} | {{phone}}`,
  },
];

export const CHECKLIST = [
  'Link sits inside real editorial content, not a footer or sidebar link farm',
  'Referring page is topically related to healthcare, local Delhi NCR or the hospital brand',
  'Anchor text reads naturally - keep exact-match anchors under ~10% of the profile',
  'Destination URL is the canonical https://www. version and returns 200, not a redirect chain',
  'Site is indexed in Google (search site:domain) and has real organic traffic',
  'No "paid links", "buy backlinks", "sponsored post price list" pages on the domain',
  'Outbound link profile is not dominated by casino, loan, adult or crypto sites',
  'Publisher discloses sponsorship correctly (rel="sponsored") if money changed hands',
  'Medical claims on the page are accurate - a bad host page is a brand risk, not just an SEO one',
  'Listing NAP exactly matches Google Business Profile (name, address, phone)',
];
