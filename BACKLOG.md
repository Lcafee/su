# L Cafe SEO Backlog

Status: **Evidence-backed initial backlog; roadmap not yet locked.**
Scoring is relative: `Impact × Confidence / Effort`. No fake numeric precision is used.

## Priority backlog

### SEO-001 — Verify Search Console ownership/access

- Priority: **P1**
- Problem: indexing/query/page baseline cannot be locked without first-party Search Console data.
- Evidence: no connected Search Console data; owner does not currently know property status.
- Action: check for existing `l-cafe.ir` property; if absent, create Domain property and verify via DNS TXT.
- Expected Impact: High
- Confidence: High
- Effort: Low
- Dependency: Google account + DNS access if new verification required
- Acceptance Criteria: verified property available; sitemap status and Performance/Pages data can be inspected.
- Metric: Search Console data availability / indexing coverage

### SEO-002 — Verify or establish analytics

- Priority: **P1**
- Problem: qualified organic sessions and high-intent page behavior cannot currently be baselined.
- Evidence: no confirmed analytics property; repository contains no common GA4/GTM token.
- Action: identify existing first-party analytics; if none exists, establish approved instrumentation with explicit source/metric definitions.
- Expected Impact: High
- Confidence: High
- Effort: Low–Medium
- Dependency: account access; instrumentation choice
- Acceptance Criteria: pageviews/sessions/source-medium and `/menu` + future `/location` behavior measurable without duplicate firing.
- Metric: measurement coverage / qualified organic sessions

### SEO-003 — Make `/menu` content available in crawlable HTML

- Priority: **P1**
- Problem: current source HTML is an empty menu shell; categories/items require JavaScript and snapshot fetch.
- Evidence: `menu.html`, `src/menu/main.jsx`, `src/menu/MenuApp.jsx`.
- Action: preserve the current live snapshot architecture while generating or serving meaningful canonical menu HTML that contains real published categories/items before client enhancement.
- Expected Impact: High
- Confidence: High
- Effort: Medium
- Dependency: must preserve MySQL → published snapshot authority and admin/runtime boundaries
- Acceptance Criteria: `/menu` initial response contains current menu headings/items/descriptions/prices where published; React enhancements remain functional; no second editable menu source is introduced.
- Metric: server-readable menu coverage; indexed menu query coverage after release

### SEO-004 — Create factual `/location`

- Priority: **P1**
- Problem: visit-intent facts are embedded in homepage footer rather than exposed as a dedicated canonical location resource.
- Evidence: required architecture + current route tree/sitemap.
- Action: create a concise first-party location page using only verified name, address, phone, hours, Maps reference, arrival guidance and authentic imagery.
- Expected Impact: High
- Confidence: High
- Effort: Medium
- Dependency: verify any arrival/parking/facility claims before publication
- Acceptance Criteria: canonical/indexable semantic HTML, mobile-first, internally linked from core pages, sitemap included, truthful structured data relationship to canonical business entity.
- Metric: `/location` impressions/clicks; visit-intent query coverage

### SEO-005 — Create factual `/about`

- Priority: **P1**
- Problem: brand/entity explanation exists only as a short homepage section.
- Evidence: current route tree + required architecture.
- Action: publish concise real business/brand context; no generic filler or unsupported superlatives.
- Expected Impact: Medium
- Confidence: High
- Effort: Low–Medium
- Dependency: first-party copy/facts only
- Acceptance Criteria: canonical/indexable semantic HTML, internally linked, sitemap included, consistent entity naming.
- Metric: indexed target pages; brand/entity query coverage

### SEO-006 — Stabilize canonical entity schema

- Priority: **P1**
- Problem: LocalBusiness schema exists but has no stable `@id` and no verified geo coordinates.
- Evidence: `index.html` JSON-LD.
- Action: use `https://l-cafe.ir/#business`; retain only visible/verified facts; add `openingHoursSpecification`; add `geo` only after coordinates are authoritatively captured; reuse entity ID across relevant pages.
- Expected Impact: Medium–High
- Confidence: High
- Effort: Low
- Dependency: verified coordinates for `geo`
- Acceptance Criteria: truthful schema matches visible content and uses one stable entity identity.
- Metric: schema validity/errors; entity consistency

### SEO-007 — Implement honest review workflow

- Priority: **P1**
- Problem: fresh Maps listing has only 3 public reviews; review velocity is weak/unknown.
- Evidence: fresh public Maps observation.
- Action: deploy honest-feedback request touchpoints (table/receipt/post-visit/WhatsApp where operationally appropriate) that send all customers to the same review path without incentive or sentiment gating.
- Expected Impact: High
- Confidence: Medium–High
- Effort: Medium
- Dependency: approved operational touchpoint and canonical Maps review path
- Acceptance Criteria: workflow active; no incentive, five-star ask, positive-only filtering, fake/staff reviews.
- Metric: new reviews/week, review velocity, rating trend

### SEO-008 — Normalize first-party NAP/entity references

- Priority: **P1**
- Problem: public listing wording and first-party street wording differ, although owner confirms the same entity.
- Evidence: website vs public Maps address presentation.
- Action: define canonical NAP wording in `ENTITY_SPEC.md`; use it consistently across site, social updates and new citations while preserving platform-required address formats.
- Expected Impact: Medium
- Confidence: High
- Effort: Low
- Dependency: none
- Acceptance Criteria: one canonical NAP record and no contradictory first-party representations.
- Metric: citation/NAP consistency

### SEO-009 — Selective local citation / mention acquisition

- Priority: **P2**
- Problem: sampled local editorial results frequently feature competitors but not L Cafe.
- Evidence: current Persian SERP research.
- Action: pursue relevant authentic Isfahan cafe/tourism/Metropol/partner mentions; prioritize relevance × authority × authenticity.
- Expected Impact: Medium
- Confidence: Medium
- Effort: Medium
- Dependency: canonical NAP + core pages
- Acceptance Criteria: only maintained, factual listings/mentions; no mass submission.
- Metric: verified citations; relevant referring domains; new relevant mentions

### SEO-010 — Measure CWV before performance work

- Priority: **P2**
- Problem: no current field/lab Core Web Vitals baseline captured in this execution.
- Evidence: browser performance tooling/field data not currently connected.
- Action: capture LCP/INP/CLS and bottleneck evidence before code optimization.
- Expected Impact: Unknown until measured
- Confidence: High on need-to-measure; not on need-to-optimize
- Effort: Low
- Dependency: suitable performance/field data access
- Acceptance Criteria: production metrics and bottleneck evidence recorded; only material issues become implementation tasks.
- Metric: LCP, INP, CLS

## Explicit rejects

- P3 / DO_NOT_IMPLEMENT — mass AI content.
- P3 / DO_NOT_IMPLEMENT — keyword-permutation or doorway/location pages.
- P3 / DO_NOT_IMPLEMENT — mass directory submissions.
- P3 / DO_NOT_IMPLEMENT — low-quality backlink packages.
- P3 / DO_NOT_IMPLEMENT — fabricated FAQ/schema/business attributes.
- P3 / DO_NOT_IMPLEMENT — review incentives, review gating or coordinated rating manipulation.
