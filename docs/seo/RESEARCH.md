# L Cafe SEO Research

Status: **Initial non-tool-volume research complete; Semrush metrics pending API units.**
As of: 2026-08-29

## Evidence rules

- First-party and repository evidence controls business/technical facts.
- Public Maps facts are fresh observations and mutable.
- Third-party SERP/editorial pages are discovery evidence, not business truth.
- No search-volume, traffic, difficulty or ranking number is stated without a qualified data source.

## Query / intent clusters

RECOMMENDATION — prioritize these clusters for Search Console segmentation once data is available:

1. Brand/entity: `ال کافه`, `L Cafe`, `LCafe اصفهان`, brand + menu/location/hours.
2. Hyperlocal discovery: `کافه چهارباغ بالا`, `کافه متروپل اصفهان`, `کافه نزدیک سی و سه پل` where geographically truthful.
3. Category discovery: `کافه اصفهان`, `بهترین کافه اصفهان` and similar high-level discovery phrases.
4. Offering intent: coffee, cold/hot drinks, dessert, sandwich, breakfast **only where the live menu verifies the offering**.
5. Visit intent: menu, address, directions, phone, opening hours.

No volume estimates are attached yet.

## SERP / local competitor observations

### Actual discovery competitors

- FACT — broad `best cafe Isfahan` results are dominated by editorial/travel aggregators and established cafes with substantial review/editorial footprints, including Tripadvisor results where Rag Rug, Azadegan, Roozegar and others surface prominently.
- FACT — Persian local-guide results for Isfahan / Chahar Bagh repeatedly mention Cafe Book and Mobile Coffee, including a Mobile Coffee location associated with Metropol / Chahar Bagh-e Bala.
- FACT — current nearby Maps results include multiple coffee shops on Chahar Bagh-e Bala, so L Cafe competes with both geographically close businesses and stronger citywide entities.
- FACT — Rag Rug exposes a crawlable bilingual menu page with category counts, item headings and item descriptions directly in indexed page content. This is a replicable structural pattern, not a branding/content template to copy.

### L Cafe gaps visible from current evidence

- FACT — L Cafe's canonical Maps listing had 3 public reviews at fresh capture. This is a limited local trust/authority footprint relative to many established discovery competitors; no causal ranking claim is made.
- FACT — current repository lacks dedicated `/location` and `/about` routes.
- FACT — current `/menu` HTML shell does not contain menu categories/items before JavaScript execution.
- FACT — L Cafe is not visibly represented in the sampled editorial results collected for broad Isfahan cafe discovery queries.
- INFERENCE — improving first-party local facts, crawlable menu content, review velocity and selective authentic local citations has higher expected value than producing large quantities of generic SEO articles.

## Technical research findings

- FACT — crawl directives are permissive and sitemap discovery is declared correctly in `robots.txt`.
- FACT — sitemap contains only intended current public pages (`/`, `/menu`) and no utility/admin URL.
- FACT — canonical redirect rules are explicit in `.htaccess`.
- FACT — root metadata is already locally descriptive (`ال کافه — چهارباغ بالا، اصفهان`).
- FACT — LocalBusiness schema exists but lacks the requested stable `@id`, verified `geo`, and `openingHoursSpecification` structure.
- FACT — root visible content includes address, hours, phone, Maps and Instagram; structured data is broadly aligned with that visible content.
- FACT — menu React markup is semantically strong once rendered (`h1`, category `h2`, item `h3`, `article`, descriptions/prices/options), but content availability depends on client JavaScript + snapshot fetch.

## Authority / citation opportunity classes

RECOMMENDATION — research and pursue only selective, factual opportunities in this order:

1. Metropol / building / neighboring-partner pages where a legitimate business listing or collaboration can exist.
2. Isfahan food/cafe editorial sites with real editorial inclusion standards.
3. Tourism and local-guide sources that maintain actual venue pages.
4. Existing business directories where NAP can be represented accurately and maintained.
5. Event/partner pages arising from real collaborations.

DO_NOT_IMPLEMENT — mass directory submission, paid low-quality link packages, fake guest posts, unsupported location pages, review manipulation or fabricated FAQs.

## Research limitations

- Search Console query/page data unavailable: brand/non-brand split, current rankings and true impressions/clicks are not yet known.
- Analytics unavailable: qualified organic sessions/conversions are not yet known.
- Semrush report execution is currently blocked by insufficient API units, so no Semrush keyword/traffic/backlink estimates are included.
- Generic web-search observations must not be used as proof of Google indexing status.
