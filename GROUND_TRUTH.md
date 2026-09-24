# L Cafe SEO Ground Truth

Status: **Ground truth materially complete; measurement access unresolved.**
Business facts last verified: 2026-08-30 (Asia/Tehran). Production hosting and
public snapshot state were rechecked on 2026-09-24; mutable values are in
`PROJECT_STATE.md`.

## Canonical business facts

| Field | Value | Classification | Source | Confidence | Conflict / note |
| --- | --- | --- | --- | --- | --- |
| canonical_domain | `https://l-cafe.ir` | FACT | `OPERATIONS.md`, `index.html` | High | None |
| canonical_repository | `Lcafee/su` (`main`) | FACT | `OPERATIONS.md` | High | None |
| framework | React 19 + Vite 8 | FACT | `package.json`, `README.md` | High | None |
| hosting | Liara VPS: Nginx static delivery with an isolated Node 24/Fastify/SQLite control plane; ParsPack PHP/MySQL is retained for rollback only | FACT | `PROJECT_STATE.md`, `OPERATIONS.md` | High | Active release and rollback state are recorded in `PROJECT_STATE.md` |
| deployment_flow | source → commit/push → build/package the exact release → production backup → separately authorized manual VPS deployment → route verification | FACT | `README.md`, `OPERATIONS.md` | High | GitHub Pages is pre-production and does not deploy production |
| business_name | L Cafe | FACT | owner confirmation + first-party site | High | Public listing displays `LCafe - ال کافه` |
| business_name_fa | ال کافه | FACT | owner confirmation + first-party site | High | None |
| address | خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل، اصفهان | FACT | owner confirmation + first-party site | High | Public Maps result resolves to Metropol / Chahar Bagh e Bala; wording differs but entity is owner-confirmed |
| phone | `09130005767` / `+989130005767` | FACT | first-party site | High | None observed |
| opening_hours | daily `07:00–23:00` | FACT | first-party visible content + schema | High | Mutable; recapture before reporting if changed |
| menu_url | `https://l-cafe.ir/menu` | FACT | repository + canonical metadata | High | `/menu.html` and `/menu/` are redirected to `/menu` |
| instagram | `https://www.instagram.com/lcafe.esf/` | FACT | first-party site | High | None observed |
| maps_listing | Google place ID `ChIJHwiIQwA3vD8RouGWwXbq5GI` (`LCafe - ال کافه`) | FACT | owner confirmation + fresh public Maps capture | High | Similarly named Esfahanak listing explicitly rejected by owner |
| public_maps_rating | `5.0` | FACT (mutable observation) | fresh public Maps capture | High | Recapture before every baseline/report lock |
| public_maps_review_count | `3` | FACT (mutable observation) | fresh public Maps capture | High | Small sample; not a quality conclusion |
| coordinates | not independently verified | UNKNOWN | — | — | Source and schema must not publish `geo` or use coordinates as Maps identity |

## Production / search surface

- FACT — Current intended canonical public routes in repository: `/` and `/menu`.
- FACT — Required future architecture from SEO brief also includes `/location` and `/about`; these routes do not currently exist in the repository tree or sitemap.
- FACT — `robots.txt` allows crawling and declares `https://l-cafe.ir/sitemap.xml`.
- FACT — `sitemap.xml` currently contains only `/` and `/menu`.
- FACT — root and menu pages have self-referential canonical tags in source.
- FACT — Production Nginx handles HTTPS, canonical-host routing, and legacy menu redirects. `.htaccess` is retained only with the ParsPack rollback runtime.
- FACT — root page publishes `CafeOrCoffeeShop` JSON-LD with name, alternateName, URL, image, telephone, opening hours, address, map, menu and Instagram.
- FACT — current JSON-LD defines stable entity `https://l-cafe.ir/#business`,
  explicit daily hours, and the canonical Place-ID Maps target; it intentionally
  omits `geo`.
- FACT — `/menu` source HTML is a JavaScript shell; categories/items are fetched from `managed-menu/current.json` and inserted after client execution.
- FACT — production menu state is independent of deploy artifacts; mutable revisions and response hashes are tracked only in `PROJECT_STATE.md`.
- FACT — repository search found no common GA4/GTM/site-verification tokens. This does **not** prove analytics or Search Console are absent because verification/instrumentation may exist outside tracked source.

## Measurement access

| System | Status | Risk |
| --- | --- | --- |
| Google Search Console | UNKNOWN / no connected first-party data yet | Indexing and query baseline cannot be locked |
| First-party analytics | UNKNOWN / no connected property confirmed | Qualified organic session baseline cannot be locked |
| Semrush | Connected, but report execution blocked by insufficient API units | Keyword/traffic/backlink metrics from Semrush unavailable |

## Material conflicts

No unresolved material **business-fact conflict** remains. The Maps identity is
the owner-confirmed Metropol / Chahar Bagh-e Bala Place ID. Coordinates remain
unknown rather than conflicting and are not published as authoritative facts.

Measurement availability is an access dependency, not a business-fact conflict.
