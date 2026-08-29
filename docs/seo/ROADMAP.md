# L Cafe SEO Roadmap

Status: **NOT LOCKED**

Roadmap lock requires first-party Search Console/analytics baseline or an explicitly documented new-measurement start with no usable history. Current research is sufficient to stage the execution order, not to set growth targets.

## Lock gate

Required before changing status to `LOCKED`:

- Ground Truth complete: **yes**
- Material business-fact conflicts resolved: **yes**
- Initial technical/entity/SERP research complete: **yes**
- Fresh Maps rating/review snapshot: **yes, 2026-08-29; recapture on lock date**
- Search Console property/access verified: **pending**
- Analytics property/instrumentation verified: **pending**
- KPI definitions validated: **yes; baselines pending**
- Semrush estimates: **optional for lock but currently unavailable due API units**

## Staged 90-day sequence

### Days 1–7 — Discovery + baseline

- verify Search Console and analytics;
- capture query/page/device baseline;
- confirm indexing and sitemap state through Search Console;
- complete technical/entity/SERP/local competitor audit;
- measure production CWV when suitable tooling/data is available;
- lock KPI definitions and baseline caveats;
- lock roadmap only after the gate above is satisfied.

### Days 8–14 — Technical + entity foundation

Expected P1 candidates, subject to roadmap lock:

- make `/menu` meaningful content available in initial crawlable HTML while preserving published-snapshot authority;
- add stable business `@id` and consistent entity references;
- create canonical `/location` and `/about` architecture;
- update sitemap/internal links/canonicals for approved pages;
- normalize first-party NAP;
- resolve any Search Console crawl/index issues discovered in baseline.

### Days 15–30 — Core pages + local foundation

- complete homepage/menu/location/about on-page information architecture;
- establish honest review-request workflow;
- align public facts through factual edits where possible without simulating GBP ownership;
- implement only measured high-value performance fixes;
- begin selective relevant citation outreach.

### Days 31–60 — Authority + approved content expansion

- acquire a small number of relevant local mentions/citations/referring domains;
- create intent pages only where real offering + demonstrated intent + unique useful content all exist;
- improve query clusters/pages supported by Search Console evidence;
- continue sustainable review flow.

### Days 61–90 — Measurement-driven iteration

- analyze Search Console by query/page/device and brand vs non-brand;
- diagnose weak impressions, CTR or non-brand growth using the defined diagnostic tree;
- improve weak approved pages rather than expanding page count by default;
- iterate authority work based on referral/search evidence;
- publish Day 60/90 reporting with failed hypotheses and stop-doing decisions.

## Implementation boundary

Repository implementation/release preparation may proceed after roadmap lock or earlier only for a verified P0 blocker. Production deployment requires a separate explicit approval under the repository release boundary.

Current finding that `/menu` is client-only for its real menu content is **P1**, not a proven P0 indexing failure; Google indexing status must be checked in Search Console before escalating it to P0.
