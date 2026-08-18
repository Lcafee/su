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
- Every `ProductCard` owns its own description disclosure state.
- Multi-price variants are informational rows (`<dl>`); there is no selected
  variant state or ordering interaction in the public Menu.
- Description overflow is measured in-flow by one shared `ResizeObserver`.
- Summer image assets are enabled (`SUMMER_IMAGES_ENABLED = true`). Missing or
  failed product images fall back to the shared placeholder.

## Landing ownership

Landing copy is split into Hero, editorial, feature-photo, Menu-entry, and
closing components. One hook owns the scroll/resize listeners and writes only
transient opacity values through refs. The photo owns its own load/reveal state.

## Metal-FX enhancement

The installed `metal-fx` package renders the thin decorative rule for every
category and the floating Menu-index trigger on mobile. `supportsMetalFx()`
checks WebGL first and `MetalFxBoundary` removes the enhancement if package
initialization throws. Reduced-motion users receive a paused effect. Menu text,
cards, navigation semantics, and layout do not depend on Metal-FX rendering.

## Build and static assets

```sh
npm install
npm run dev
npm run build
```

`vite.config.js` builds `index.html` and `menu.html` and copies the existing
fonts, optimized Menu photos, Landing photos, logo, favicon, `.htaccess`, 404,
robots, and sitemap into `dist/` at their established public paths. `404.html`
is base-path-expanded at build time so both the production apex (`/`) and the
GitHub Pages preview (`/su/`) resolve its assets and Menu link correctly.

The build also writes `dist/.lcafe-build.json`, containing SHA-256 hashes for
the active build inputs. `deploy.py` uses it instead of file mtimes to reject a
stale build. `package.py` does not publish that internal manifest.

`menu_xlsx.py` regenerates `L_Cafe_Menu_Content.xlsx` from `menu.json`.
`optimize_images.py`
remains the image optimization utility. `package.py` and `deploy.py` now consume
`dist/` rather than generated root HTML.

## Content rule

Do not edit Menu copy in JSX or directly treat the Excel view as authoritative.
Update `menu.json`, run `py menu_xlsx.py`, then run `npm run validate:release`
and `npm run build`.
