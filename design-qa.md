# Mobile seasonal menu — verified 2026-11-04

## Approved implementation

- Actual pumpkin cake cutout, with transparent 350px/700px WebP assets.
- Mobile entry shows the cake over a burgundy backdrop. Name, description and
  price sit below on the continuous painted surface without a white card.
- The cake enters its own column, docks beside the copy and returns on reverse
  scroll. Names and prices come from the published menu; hidden, archived or
  absent products/categories are not promoted.
- Peyda headings, Doran item names/prices/controls, Vazirmatn descriptions.
  Existing bare Persian prices are preserved.
- Mobile names 16–17.5px, standard prices 15px, variant prices 14px.
  Seasonal name 22px and price 19px.

## Verification

- 320px and 390px: no horizontal overflow or overlapping text.
- Cake bounds at entry, intermediate scroll, docked, offscreen and return match
  the approved motion after both typography changes.
- Grid/list switching, category navigation and active-category tracking pass.
- Early navigation works while the hero is pending. Failed photos fall back.
- Reduced-motion emulation removes the flight layer and renders a static cake.
- No browser application errors. Chromium platform-font inspection confirms
  the actual custom fonts used for each role.
- Five seasonal behavior tests, public/Admin builds and dist validation pass.
- Real-device Safari and physical-device frame rate have not been measured.

## Loading

- The responsive hero preload starts with the document and is reused.
- Only nearby product photos receive URLs. The remaining catalog mounts after
  the entry scene paints, or immediately when navigation opens.
- Decorative shaders initialize on approach; the library pauses them offscreen.
- Cold-cache lab tests at 390×844, DPR 2, 4× CPU slowdown, 150ms latency and
  200,000 bytes/s: mean LCP 8,090ms to 5,136ms across two runs per version before
  the subsequent font changes. CLS was zero. These are local lab measurements.

## Release scope

- Fixture/media middleware serve development and Pages previews only.
  Production continues to read its persistent managed menu and media.
- No backend, database, account or production menu content changes.
- Public revision 97 contains pumpkin item item-cd02bda6aac3 (code 22001,
  price ۵۵۰), verified read-only during release preparation.
