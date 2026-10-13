# Performance and admin density (2026-10-13)

Branch `codex/performance-admin-density-20261013`, based on `f6cbc83`. Not pushed,
merged, released or deployed. No migration, no API response change, no change to
any label, field, option, action or permission.

## What changed, by surface

### Public Landing (`/`)

- `assets/fonts/Fahkwang-SemiBold.woff2` replaces the TTF as the first `src` and
  as the preloaded font in `index.html` and `redesign.html`. It is a lossless
  repack: 775 glyphs with identical outlines and advances, identical `cmap`,
  vertical metrics, `GSUB` and `GPOS`. 80,520 → 31,100 bytes on the Landing's
  preloaded critical path. The TTF stays as source and fallback `src`.
- Side effect on caching: the production Nginx rule for content-hashed assets
  lists `woff2` but not `ttf`, so this font is now served `immutable` for a year
  instead of with no `Cache-Control` at all.

### Public Menu (`/menu`)

No change. See "Not done" below for what was measured and deliberately left.

### Admin (`/admin/`)

- **Code split.** The entry chunk is React, the session check and the sign-in
  screen. `src/admin/editorWorkspace.js` (editor, drag and drop, activity report)
  loads in parallel with the menu data once a session exists, and while the
  credentials are checked on sign-in. `src/admin/menuWorkbook.js` loads when the
  operator is idle or first uses Excel. A failed chunk load reuses the existing
  error screen / error notice and can be retried.
- **Render cost while typing.** Handlers read the draft through a ref so the
  callbacks given to memoized cards keep their identity; dnd-kit sensor options
  and sortable id arrays are stable, so its contexts no longer re-render every
  card on each keystroke; unchanged categories reuse their filtered item lists.
  The saved document is serialized once instead of on every keystroke.
- **Font preload.** `admin/index.html` preloads the Persian Vazirmatn subset.
- **Layout.** `src/admin/admin.css` was rewritten as a dense, tokenized,
  mobile-first sheet; rules and breakpoints are documented in `DESIGN.md` (The
  Admin Density Rule). Component markup is unchanged.
- **Accessibility.** Solid 2px focus ring (the old 25% alpha ring was about 1.4:1
  against ivory); keyboard focus ring on the image upload label; 44px controls
  and 16px field text on touch; `scroll-padding` keeps focused fields and
  category jumps clear of the sticky bars; no opacity-reduced status text.

### API (`server-node/`)

- `sessionContext` no longer rewrites `admin_sessions.last_seen` when the stored
  value is already the current second. The value written would be identical, so
  session expiry is unchanged; it removes one synchronous WAL commit from each
  extra request in the same second (the admin sends its menu and publish-status
  requests together).
- Two assertions in `test/api-contract.test.mjs` expected the save response
  without `lastEdit` and `categoryCodes`, which the API has returned since
  `25b2556` / `889a9ad`. They now assert the current contract, so both tests run
  to the end again.
- The read path was reviewed and left alone: the menu document is three indexed
  queries joined in memory, with no per-row queries.

## Measurements

Lab numbers from one machine, headless Chrome 155, development fixture (12
categories, 90 items), every `/api/` call mocked. Load runs: 390x844 mobile
emulation, 150 ms latency, 200 kB/s down, 4x CPU, cache off, median of 5. They
are not field data.

**Noise.** The Menu ships byte-identical scripts and styles in both builds, yet
its LCP read 13% slower in the second run. Treat load-time differences under
about 15% as noise; byte counts and layout numbers are exact.

### Bytes

| | Before | After | Change |
| --- | ---: | ---: | ---: |
| Admin entry script, all the sign-in screen needs (raw / gzip) | 310,246 / 98,403 | 229,022 / 73,922 | -26% / -25% |
| Admin scripts, every chunk (raw / gzip) | 310,246 / 98,403 | 312,915 / 100,870 | +0.9% / +2.5% |
| Admin stylesheet (raw / gzip) | 22,820 / 5,693 | 24,834 / 5,905 | +8.8% / +3.7% |
| Landing Latin font fetched | 80,520 | 31,100 | -61% |
| Landing transfer, first load | 299,909 | 250,510 | -16% |
| Menu transfer, first load | 662,719 | 662,719 | 0 |
| Public scripts and styles | | | unchanged apart from the font `src` line |

### Load (ms, median, range in brackets)

| Page | Metric | Before | After | Change |
| --- | --- | ---: | ---: | ---: |
| Landing | LCP (= FCP) | 4712 [4492-4844] | 4960 [4656-7020] | within noise |
| Menu | LCP | 9868 [9248-10928] | 11140 [9412-12464] | unchanged build, noise |
| Admin sign-in | FCP | 4812 [3504-5712] | 3776 [3492-4896] | -22% |
| Admin sign-in | LCP | 6080 [5368-6980] | 4992 [4892-6516] | -18% |
| Admin sign-in | Long tasks, total | 4023 | 3030 | -25% |
| Admin editor | LCP | 4696 [3808-6056] | 3920 [3732-3992] | -17% |
| Admin editor | First item editable | 6210 [5256-8153] | 5747 [5375-6158] | -7% |
| Admin editor | Long tasks, total | 5348 | 3776 | -29% |
| Admin editor | Requests | 15 | 17 | +2 chunks |

The smaller Landing font did not move Landing LCP measurably: the hero paints
only after React mounts, and the font is not what it waits for.

### Typing in one item name (13 items open, 4x CPU, ms per keystroke)

| Mode | Measure | Before | After | Change |
| --- | --- | ---: | ---: | ---: |
| Simple | React update, median / p95 | 186 / 421 | 60 / 141 | -68% |
| Simple | Input to next frame, median | 330 | 197 | -40% |
| Advanced | React update, median / p95 | 208 / 398 | 74 / 165 | -64% |
| Advanced | Input to next frame, median | 357 | 244 | -32% |

### Admin layout (px)

| Viewport | First item starts at | One item's height | Save bar | Top bar |
| --- | ---: | ---: | ---: | ---: |
| 1440, Simple | 556 -> 359 | 411 -> 264 | 82 -> 53 | 72 -> 49 |
| 1440, Advanced | 751 -> 424 | 771 -> 404 | 82 -> 53 | 72 -> 49 |
| 1024, Simple | 556 -> 359 | 511 -> 283 | 82 -> 53 | 72 -> 49 |
| 768, Simple | 944 -> 482 | 694 -> 283 | 94 -> 53 | 72 -> 49 |
| 768, Advanced | 1139 -> 548 | 1054 -> 423 | 94 -> 53 | 72 -> 49 |
| 390, Simple, mouse | 1058 -> 690 | 774 -> 479 | 149 -> 79 | 89 -> 49 |
| 390, Simple, touch (44px controls) | 1058 -> 794 | 774 -> 541 | 149 -> 87 | 89 -> 57 |
| 390, Advanced, touch | 1253 -> 941 | 1134 -> 835 | 149 -> 87 | 89 -> 57 |
| 320, Simple, touch | 1153 -> 794 | 774 -> 568 | 149 -> 87 | 89 -> 57 |

No horizontal overflow at any width, before or after.

## Validation

- **No wording or control changes.** Owner Simple, owner Advanced, cashier and
  the sign-in screen, at 1440 and 390: 2,180 visible strings plus every field
  (type, value, placeholder, max length, disabled), `aria-label` and `title`
  are identical between the two builds.
- **Editor flows, old build vs new, 110 observations.** Sign-in, wrong password,
  sign-out, edit and save (button and Ctrl+S, payload checked), price,
  description, Special Offer and price options, archive, undo, delete, discard,
  quick create, new category, category navigation, reorder by button and by
  pointer drag, search, filters, Excel export / template / import / broken
  file, image upload, save conflict with draft download and reload, session
  expiry, failed publish and retry. All identical, no page or console errors.
  The keyboard-drag check is intermittent in this harness on both builds; it
  passes and fails on each.
- **Public pages.** Menu script and stylesheet are byte-identical. Landing
  script is byte-identical; its stylesheet differs only in the Fahkwang `src`
  line. Document height, width and text are identical for both pages at 1440,
  768 and 390.
- **API tests** 6 of 6 pass (4 of 6 on the base commit, both failures being the
  stale assertions above). `npm run build` and `npm run validate:dist` pass.
  `node scripts/agent-scope-check.mjs` reports `AGENT_SCOPE_OK`.
- **Impeccable detector** on `src/admin`: 24 findings before, 0 after.
- **Not verified:** real devices, Safari and Firefox, a screen reader, and the
  production Nginx. Container queries, `:has()`, `color-mix()` and
  `field-sizing` degrade to the stacked layout, neutral borders and fixed
  textarea heights where unsupported.

## Not done (recommendations, in order of expected benefit)

1. **Prerender the Landing at build time.** Landing FCP equals LCP because
   nothing paints until React mounts. Rendering `OriginalLanding` to HTML during
   the build and hydrating would let the hero paint from HTML and CSS. It is an
   architectural change (`RevealBlock` reads `window` in a state initializer and
   the Pages build needs the same treatment), so it was not started here.
2. **Mark hashed `.webp` immutable in Nginx.** The rule
   `-[A-Za-z0-9_-]{8}\.(?:css|js|svg|png|woff2)$` in `deploy/vps/*.nginx.conf`
   omits `webp`, so the Menu's 260 KB hashed mural is revalidated on every
   visit. Adding `webp` to that one regex fixes it. Nginx configuration is
   host-owned and needs its own scoped infrastructure task.
3. **Menu main-thread time is mostly native paint, not script.** A profile of
   the baseline Menu load at 4x CPU showed 1.2 s script, 0.4 s style and 0.7 s
   layout against 2.5 s of native work, with CSS filter chains, backdrop blur
   and the mural as the likely sources. Reducing it means touching rendered
   effects, which the exact-appearance constraint rules out here. The profile
   ran in headless Chrome without a GPU, so confirm on a real phone first.
4. **Do not preload the Menu mural at high priority.** It would probably lower
   lab LCP but competes with the menu JSON, script and fonts on slow links; the
   mural is decorative. If tried, use `fetchpriority="low"` and measure text
   timing, not only LCP.
5. **Subset Fahkwang to Latin.** It is only used for Latin text; a Latin subset
   would be roughly 10 KB instead of 31 KB. Not done because a lossless repack
   is the stronger guarantee for "exact appearance".
6. **`npm run validate:release` is broken on the base commit**: it reads
   `src/landing/LandingApp.jsx`, which no longer exists.

## Re-running the checks

The harness is outside Git, beside the worktrees, in
`Main Site/Performance-Evidence/claude/` (it loads Playwright from the local
Codex runtime and drives system Chrome; every `/api/` call is answered from the
tracked development fixture). `Performance-Evidence/before-dist/` is the build
of the base commit.

```text
node bench.mjs --dist ../before-dist --label before     # throttled loads, layouts, typing
node bench.mjs --label after
node summarize.mjs before after
node functional.mjs --dist ../before-dist --label before # editor flows against a fake API
node functional.mjs --label after
node compare-functional.mjs before after
node sizes.mjs
```

Run nothing else while `bench.mjs` measures; its timings are sensitive to load.
