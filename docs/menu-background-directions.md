# Public menu background studies

The background concepts explored for the public menu, kept for comparison.
The production menu ships one background: the painted mural ("The Art of
Pause"). The earlier studies are preview-only and are never loaded by the
production menu bundle. Existing menu data, item photography, layout,
typography, navigation and view preferences are unchanged by any of them.

## Preview

All concepts live on one page — the Design Studio — which renders the real
current menu and swaps only the background layer:

- locally: `npm run dev` then open `/design-studio.html`
- published preview: `/su/design-studio/`

| Direction | Material / palette |
| --- | --- |
| The Art of Pause (production) | Continuous gouache mural; ivory `#f3f1ec` reading field |
| Amber Atrium | Suspended light, handmade texture, architectural lines |
| Limestone Atelier | Sculptural limewash, afternoon light; ivory `#f3eee4`, walnut ink `#51372b` |
| Bronze Nocturne | Fashion editorial silk; espresso `#241d19`, cream ink `#f1dfc4` |
| Garden Folio | Cypress and pomegranate engraving; celadon `#e9ebe0`, botanical ink `#344735` |
| Original | Calligraphy pattern overlay, for comparison |

The Persian “طرح‌های پس‌زمینه” button opens the selector. Selection is encoded
in the URL as `?background=<id>`, not local storage, so a comparison is
shareable. Unknown values fall back to the production mural. Changing
direction retains the current category hash, scroll position and grid/list
view.

## Implementation

- `src/preview/DesignStudio.jsx`: validated URL selection, the native radio
  selector, popstate synchronization and document theme lifecycle. Preview
  only.
- `src/preview/design-studio.css`: the earlier studies' background layers,
  colour variables and selector chrome. Preview only; no changes to menu
  dimensions, fonts or content hierarchy.
- `src/menu/MenuJourney.jsx` and `src/styles/menu-journey.css`: the production
  mural, shared by the menu and the Design Studio so there is one
  implementation.
- `assets/menu-backgrounds/`: the mural plus eight optimized WebP concept
  assets. Mobile files are 960 × 640 and 12–52 KB; desktop files are
  1536 × 1024 and 41–160 KB. Only the selected background is requested by CSS.
- Small screens use a deliberate edge crop with a protective tonal wash;
  garden retains a cypress silhouette, limestone a sculptural curved edge,
  and nocturne a single silk fold. All artwork is decorative and static.
- Print and forced colors hide background imagery; controls are omitted
  from print. Text colors and controls adapt to the dark concept.

## Artwork provenance / generation brief

All three source artworks were generated with the built-in Image Gen tool,
then converted to WebP and resized for mobile delivery. No stock artwork,
new fonts or third-party runtime dependency was added.

Common prompt constraints: one 1536 × 1024 landscape background asset per
concept; warm, refined modern fine-dining hospitality for L Cafe; no text,
UI, logos, coffee objects, glitter, calligraphy or decorative frames.
Keep a quiet central reading area and make a vertical mobile crop viable.

Limestone Atelier: architectural editorial photograph of pale warm ivory
limewashed plaster, a monumental sculptural curved reveal at the far left,
a warm diagonal shaft of afternoon light at the upper-right margin, very
subtle mineral texture and soft architectural shadows. Central 65% nearly
uniform ivory; outer edges carry the sculptural detail. No dark stains.

Bronze Nocturne: fashion editorial macro photography of deep espresso-brown
silk, an oversized sculptural drape along the left edge and copper-bronze
reflected light at the right edge. Central 65% a quiet deep espresso field;
keep highlights muted and dark enough for overlaid cream Persian menu text.

Garden Folio: fine copperplate botanical engraving inspired by Isfahan's
cypress gardens, reinterpreted as a contemporary editorial folio. Pale warm
celadon cotton paper, muted olive-grey linework, slender cypress on the far
left and a pomegranate branch from the lower-right. Central 70% quiet,
asymmetrical and cultivated; no repeating wallpaper or ornamental frame.

Original PNGs remain in the session's Codex generated_images directory.
The project-bound deliverables are the WebP files in assets/menu-backgrounds.

## Validation

Public Vite build passes. Browser checks cover mobile grid/list switching,
unchanged menu geometry between concepts, URL selection and overflow.
Review screenshots are saved under `output/menu-backgrounds/`.
Conservative artwork-pixel contrast bounds for the dimmest text are at least
4.62:1 (limestone), 5.67:1 (nocturne), and 4.85:1 (garden), calculated from
asset channel extrema after compositing the protective wash and text alpha.
The design detector's new-palette advisories are intentional for these
explorations; they do not redefine the site's existing default brand palette.
