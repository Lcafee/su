# Assessment B: SeasonalFeature mobile evidence

Target: src/menu/SeasonalFeature.jsx; supporting src/styles/seasonal-feature.css. Live http://127.0.0.1:5197/menu. Isolated assessment; no Assessment A findings received. No application edits. Reviewed 390x844 and a supplementary 320x844 mobile viewport only.

## Deterministic scan

Ran exactly once from Git-Version:
`C:\Users\amris\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/menu/SeasonalFeature.jsx`

Exit 0. Complete JSON: `[]`.
Counts: 0 findings, 0 rule names, 0 finding file locations. Verified positives: none. False positives: none. This markup-scoped clean result does not certify CSS color contrast, runtime scroll geometry, or design quality.

Slug command succeeded: `src-menu-seasonalfeature-jsx`. `.impeccable/critique/ignore.md` absent; no ignore rules applied. CLI context was not rerun.

## Verified manual evidence

1. **P2: the flying cake obscures the item it is promoting during an ordinary slow scroll.** At 390x844, settled scrollY=124.667, flight bounds x69.62..337.51/y92.27..385.91 overlap badge x153.57..196.81/y359.39..380.98. Screenshot shows most of the seasonal badge covered by cake. At settled scrollY=208.667, flight x144.36..348.61/y161.19..385.06 crosses the badge (y275.39..296.98), title (y305.39..333.28), and description (y337.28..360.07); screenshot visibly conceals the right portion of title and description. This is visible image content, not merely transparent bounding-box intersection. Source: SeasonalFeature.jsx:38-48 interpolates across text area; seasonal-feature.css:10 puts fixed flight at z-index 8; landing has no protective content layer. Constrain path to image column, keep image below text, or stage docking before text enters its path. Priority should reflect brief occlusion rather than a permanently unreadable item.

2. **P2: seasonal badge text fails normal-text contrast.** seasonal-feature.css:5 uses #fff7ee text on opaque #b76349; line 21 reduces it to 11px, weight 500. Browser computed styles confirm 11px/17.6px Vazirmatn with those exact colors. Linearized sRGB contrast calculation is 4.0436:1, below 4.5:1 for small text. Because badge background is opaque this ratio is definitive despite decorative page texture. Darken terracotta or adjust label color; preserve warm palette. Detector did not flag this because invocation scanned JSX, not the external CSS.

3. **P2/P3: the initial composition reserves space for an absent second image.** seasonal-feature.css:4 reserves a 380px introduction (345px under 360); line 16 always gives landing an image column of 42% plus 18px gap; SeasonalFeature.jsx:85-86 renders that dock empty in full motion until cake arrives. At 390 viewport with desktop browser's 15px scrollbar, content width was 374.67; intro 380px, landing 221.33px, dock width144.26/height180; title/description column181.22px. Initial screenshot has a large cake followed by left-side text and conspicuously vacant right half of landing. Section occupies 601.33px plus bottom margin. Consider a coherent initial image/title composition and then compact docked row. This is layout evidence; whether the tall reveal is desirable depends on intended art direction, so do not treat height alone as accessibility failure.

4. **P3: supporting Persian text is small.** Computed heading18px/27.9 Sahel weight700, description12px/22.8 Vazirmatn, price17px/27.2 weight600, badge11px/17.6 weight500 (seasonal-feature.css:15,19-21). Description screenshot is noticeably fine/small over textured backdrop. On the nominal ivory solid background, description's alpha-blended color has 5.4571:1 and scarlet heading has 10.2081:1; therefore do not conflate type size concern with an invented general text-contrast failure. Actual texture contrast not pixel-sampled. At320 viewport, content305px and description column148.47px; current one-line fallback fits without horizontal clipping.

5. **Motion consideration, not a discovered broken reduced-motion mode.** seasonal-feature.css:11,23 animates cake 5.5s ease-in-out infinitely, translating7px and rotating -0.7deg..0.5deg until docked (line12). Browser confirmed animation active and prefers-reduced-motion false. A stationary reader sees ongoing decorative motion; consider short entrance or an available pause. Reduced-motion code correctly skips scroll effect (SeasonalFeature.jsx:21) and renders static source+dock images (:76,:86); CSS:26 also disables flight animation. Reduced-motion browser emulation was not available through documented viewport API, so that branch is source-verified only. Do not claim reduced-motion support is absent.

## Positive checks and limitations

- Product image loaded; img.complete true, naturalWidth304 reported for selected responsive asset; explicit700x766 dimensions and srcSet provided. No observed broken image.
- document scrollWidth equals clientWidth375 at390 viewport and305 at320; no horizontal document overflow observed. Browser scrollbar explains 15px difference, not a responsive-layout defect.
- Semantic section is labelled by heading; decorative full-motion image is aria-hidden, empty alt. Article names seasonal item, heading and price are real text. There are no component buttons to audit for touch-target sizing.
- RAF coalescing, passive scroll event, ResizeObserver and cleanup are present. Browser error/warning logs returned []. Performance was not profiled.
- Component title uses h2 and meaningful Persian copy; fallback description is emotional copy rather than ingredient information. Whether ingredients should appear depends on product goals.

## Browser/overlay provenance and cleanup

Created a fresh assessment-owned IAB tab id2, rather than reusing an existing tab; first create attempt timed out and reset kernel, second attempt with visible:false reported `IAB visibility is not supported in a subagent thread`, then creation without visibility option succeeded (assignment initially failed but returned newly created tab2 and it was bound explicitly). Native screenshots and read-only DOM measurements succeeded. No user-visible overlay is available: the documented Playwright evaluate surface is read-only, so title/script mutation and detector injection were deliberately skipped. No overlay live-server started; no browser presentation attempted after mutable injection was unavailable. Fallback signal is the complete CLI result, native screenshots, computed CSS, DOM bounds and source review. No impeccable console findings exist because injection did not run; normal browser warning/error log query was empty.

Existing Vite5197 server was used, not started or stopped by this assessment. Viewport override reset and assessment tab closed. No temporary server/process or injection files created. This task-owned report is the only written artifact.

Graph discovery attempted first per AGENTS: project Git-Version not indexed; suggested lcafe-main-assessment graph returned no SeasonalFeature nodes. Explicit known source paths were then read, and related runtime occurrences searched as fallback. No graph index modified.
