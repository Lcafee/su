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

`vite.config.js` builds `index.html` and `menu.html` into disposable `dist/` and
copies the existing fonts, optimized Menu photos, Landing photos, logo,
favicon, `.htaccess`, 404, robots, and sitemap into `dist/` at their established
public paths. `404.html`
is base-path-expanded at build time so both the production apex (`/`) and the
GitHub Pages preview (`/su/`) resolve its assets and Menu link correctly.

The build also writes `dist/.lcafe-build.json`, containing SHA-256 hashes for
the active build inputs. A normal build is never deployable. After an exact
pushed commit is explicitly approved, `npm run release:generate -- --approve
<full-commit-sha>` builds that commit from a detached worktree and atomically
promotes it to ignored `release/current/`. `.lcafe-release.json` records the SHA
and generated-file hashes. `package.py` and `deploy.py` consume only that
approved artifact and do not publish either internal manifest.

Approved generation is a hard automation boundary: generate `release/current/`
and stop. Release approval never implies deployment approval. `deploy.py` is a
manual production tool and Codex may invoke it only from a separate task that
explicitly requests production deployment.

`menu_xlsx.py` regenerates `L_Cafe_Menu_Content.xlsx` from `menu.json`.
`optimize_images.py`
remains the image optimization utility. `package.py` and `deploy.py` consume
only `release/current/`, never disposable `dist/` or generated root HTML.

## Content rule

Do not edit Menu copy in JSX or directly treat the Excel view as authoritative.
Update `menu.json`, run `py menu_xlsx.py`, then run `npm run validate:release`
and `npm run build`.
