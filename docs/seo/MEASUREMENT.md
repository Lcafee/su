# L Cafe SEO Measurement

Status: **Definitions validated; baseline and targets NOT LOCKED.**
As of: 2026-08-29

## Data-quality assessment

Overall assessment: **Needs baseline access before performance claims or targets.**

- Search Console: unverified/unavailable in this execution.
- Analytics: unverified/unavailable in this execution.
- Public Maps: fresh rating/review snapshot available but mutable and small-sample.
- Semrush: connected, report execution unavailable due insufficient API units.
- Repository/production technical evidence: strong for implementation state, not for search performance.

No growth target will be set until first-party baseline windows are captured.

## Primary KPIs

### 1. Non-brand impressions

- Source: Google Search Console
- Definition: Search impressions excluding agreed brand/entity query patterns (`L Cafe`, `LCafe`, `ال کافه`, spelling variants).
- Grain: day × query × page × device; aggregate weekly for management.
- Purpose: measures discovery beyond existing brand demand.
- Baseline: pending Search Console access.

Drivers:
- target non-brand query coverage;
- indexed target pages;
- average position distribution by query cluster.

### 2. Non-brand clicks

- Source: Google Search Console
- Definition: Search clicks using the same brand exclusion rules as non-brand impressions.
- Baseline: pending Search Console access.

Drivers:
- non-brand impressions;
- target-page CTR conditional on query/position mix.

### 3. Qualified organic sessions to high-intent pages

- Source: first-party analytics
- Initial high-intent pages: `/menu`, `/location` after launch.
- Definition: organic sessions landing on or reaching a high-intent page; exact session/source attribution must follow the selected analytics platform's documented model.
- Baseline: pending analytics verification/setup.

Drivers:
- organic entrances;
- internal navigation from landing → menu/location;
- target-page engagement/conversion events only after explicit event definitions exist.

## Driver metrics

- indexed_target_pages — Search Console Page Indexing / URL inspection evidence.
- target_query_coverage — count/share of approved target queries producing impressions, defined from Search Console rather than arbitrary keyword lists.
- target_page_ctr — clicks / impressions for target pages with query/position mix shown alongside.
- review_velocity — new legitimate public reviews per week; source: fresh public Maps observations.
- citation_coverage — count of verified, relevant maintained citations matching canonical NAP.
- relevant_referring_domains — relevant unique domains linking to canonical pages; data source to be named when available.

## Technical guardrails

- indexing_errors
- schema_errors
- broken_internal_links
- LCP
- INP
- CLS

Core Web Vitals targets are quality guardrails, not arbitrary growth goals:

- LCP ≤ 2.5s
- INP ≤ 200ms
- CLS ≤ 0.1

Do not create optimization work solely from these thresholds without actual production measurement and bottleneck evidence.

## Policy guardrails

```text
fake_reviews = 0
incentivized_reviews = 0
fake_locations = 0
fabricated_schema = 0
doorway_pages = 0
mass_low_value_ai_pages = 0
```

Any violation is a release blocker regardless of traffic impact.

## Brand / non-brand classification

Initial brand seed patterns (case-insensitive, Persian/Latin variants) will include only verified brand identity terms. After Search Console export, review actual queries and maintain an auditable inclusion list. Do not classify generic `cafe Isfahan` terms as brand merely because they contain `cafe`.

## Baseline protocol

Before roadmap lock:

1. verify Search Console property/access;
2. confirm sitemap status and target-page indexing evidence;
3. export a stable baseline window with query/page/device dimensions;
4. verify analytics property/instrumentation and duplicate-tag risk;
5. define organic session/source rules and high-intent page events;
6. recapture Maps rating/review count on baseline-lock date;
7. record any partial periods, missing history, timezone differences or data latency.

If a property is newly created, historical availability may be limited. Record that limitation rather than inventing a baseline.

## Reporting cadence

- Weekly operational dashboard after first-party measurement is active.
- Day 30, Day 60 and Day 90 KPI reports.
- Search performance changes are not diagnosed from a single day.
- Causal language is prohibited unless evidence supports causation; otherwise report validated likely drivers and confidence.
