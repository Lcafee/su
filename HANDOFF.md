# L Cafe handoff

## Architecture

The production frontend is a React + Vite multi-page static build:

```text
index.html ──> src/landing/main.jsx ──> LandingApp
menu.html  ──> src/menu/main.jsx    ──> MenuApp ──> menu.json
                                      └──────────> metal-fx
```

The previous design-canvas HTML, Python HTML generator, runtime loader, custom
image-slot elements, and hand-ported Metal shader have been retired to
`legacy/retired-generated-frontend/` as read-only migration history. That
directory is excluded from the Vite build. There is one active frontend source
of truth now: the React component tree plus the preserved CSS in `src/styles/`.

## Menu ownership

`menu.json` remains authoritative for category order, item order, names,
descriptions, prices, photos, Sepidz codes, variants, and add-ons. Components do
not duplicate that content.

- `MenuApp` owns category navigation and the one category-tracking observer.
- `CategorySection` and `ProductGrid` are memoized stable boundaries.
- Every `ProductCard` owns its own disclosure and selected variant state.
- Description overflow is measured in-flow by one shared `ResizeObserver`.
- Summer image prefixes still route through the shared placeholder while
  `SUMMER_IMAGES_ENABLED` is false.

## Landing ownership

Landing copy is split into Hero, editorial, feature-photo, Menu-entry, and
closing components. One hook owns the scroll/resize listeners and writes only
transient opacity values through refs. The photo owns its own load/reveal state.

## Metal-FX prototype

The installed `metal-fx` package wraps only the `روتین` heading. The child keeps
a complete burgundy border while the package paints the animated reflective
ring above it. `normalizeHostStyles={false}` is intentional: it prevents the
package from removing that continuous underlying frame. Reduced-motion users
receive a paused visible frame. Expanding the prototype later only requires
changing `METAL_FX_CATEGORY_ID` or the prototype condition.

## Build and static assets

```sh
npm install
npm run dev
npm run build
```

`vite.config.js` builds `index.html` and `menu.html` and copies the existing
fonts, optimized Menu photos, Landing photos, logo, favicon, `.htaccess`, 404,
robots, and sitemap into `dist/` at their established public paths.

`menu_xlsx.py` remains useful as a Menu-data export. `optimize_images.py`
remains the image optimization utility. `package.py` and `deploy.py` now consume
`dist/` rather than generated root HTML.

## Content rule

Do not edit Menu copy in JSX. Update `menu.json`, then run `npm run build`.
