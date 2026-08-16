---
name: L Cafe
description: Two continuous Persian RTL canvases for the QR-to-menu path.
colors:
  landing-maroon: "#471019"
  menu-scarlet: "#681F2D"
  ivory: "#F3F1EC"
  mark-fill: "#E6E5E1"
  ivory-strong: "rgba(243,241,236,.82)"
  ivory-soft: "rgba(243,241,236,.72)"
  menu-ink-strong: "rgba(104,31,45,.88)"
  menu-ink-soft: "rgba(104,31,45,.76)"
  menu-ink-dim: "rgba(104,31,45,.66)"
  menu-line: "rgba(104,31,45,.14)"
  menu-line-strong: "rgba(104,31,45,.24)"
typography:
  display:
    fontFamily: "Sahel, Vazirmatn, system-ui, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontWeight: 400
rounded:
  edge: "2px"
  tile-desktop: "12px"
  tile-mobile: "2px"
  category-desktop: "14px"
  pill: "999px"
spacing:
  landing-gutter: "clamp(20px, 6vw, 80px)"
  menu-gutter: "clamp(14px, 4vw, 48px)"
  landing-flow: "clamp(52px, 7vw, 80px)"
---

# Design System: L Cafe

## Product mode

Landing is a short brand reception; Menu is an operate surface for a customer
already seated at the café. Mobile is the primary use scene. The Landing may
pause for atmosphere, while the Menu prioritizes category access, item names,
descriptions, and prices.

The two pages share typography, RTL behavior, brand marks, restrained motion,
and the maroon/ivory relationship. They deliberately invert their canvases:

- Landing is ivory typography over a full-bleed `#471019` patterned field.
- Menu is scarlet typography over a full-bleed `#F3F1EC` field with a very faint
  scarlet brand pattern.

Neither page is a card inside the browser. The page color belongs to `html`,
`body`, and the viewport; React roots and content wrappers remain transparent.

## Full-page canvas and safe areas

Both HTML entries use `viewport-fit=cover`. `html`, `body`, each React root,
and the primary page wrapper own a minimum height of `100vh` with `100dvh` as
the modern override. The page colors therefore continue behind notches, home
indicators, and browser chrome instead of exposing a default white gutter.

Horizontal content padding remains intentional. Physical left and right
padding use the larger of the design gutter and the matching
`safe-area-inset-*`. Bottom actions and footers add
`safe-area-inset-bottom`; the Menu masthead adds `safe-area-inset-top`.
There are no device-specific dimensions or user-agent branches.

The Landing pattern is one fixed plane. The Menu watermark is also fixed at
the page level. Neither pattern restarts per section.

## Color

The palette remains the brand pair, with two calibrated maroons serving their
different surfaces:

- Landing maroon `#471019` is the dark room and browser theme color.
- Menu scarlet `#681F2D` is the readable foreground, active state, footer
  field, and faint watermark source on ivory.
- Ivory `#F3F1EC` is Landing foreground, Menu page background, and the Menu
  footer foreground.

Secondary values are alpha variants of the foreground already used on that
surface. Do not introduce a third accent hue. The Metal-FX shader is filtered
back into the Menu’s scarlet/ivory range rather than acting as a rainbow
accent.

## Typography

Sahel is used only at its shipped 700 weight for display moments and category
headings. Vazirmatn carries body copy, item names, prices, controls, and Latin
brand text. Both are self-hosted with swap behavior.

On Menu mobile:

- Category title: Sahel 700, `28px / 1.35`.
- Item name: Vazirmatn 600, `clamp(14px, 4.2vw, 15.5px) / 1.5`.
- Description: Vazirmatn 400, `12px / 1.75` at the narrow breakpoint.
- Disclosure: Vazirmatn 500, `11.75px / 1.45`.
- Table-of-contents link: Vazirmatn 500, `13px / 1.45`; active is 600.

Prices stay exactly as supplied: bare Persian numerals with no currency word,
unit, separator, or inferred value.

## Landing composition

The opening is a full small-viewport-height hero with the English phrase at
center and a quiet vertical scroll cue. The fixed brand field and mark handoff
are atmospheric but never gate readable content.

The editorial introduction becomes one column below 640px. The café image is
full-bleed on mobile and retains its intrinsic `1586 / 992` ratio; it is not
cropped into a portrait frame. The Menu CTA remains the only primary button.
The contact close is compact, right-aligned, and padded clear of the bottom
safe area.

## Menu composition

The Menu canvas is ivory from edge to edge. Content is width-constrained to
`900px`, but no central wrapper paints a separate background, border, radius,
or shadow.

The opening brand signature is deliberately small: a single baseline row with
“منوی ال کافه” and the Latin `L CAFE` mark, divided from the first category by
one hairline. It is an orientation mark, not a second hero.

Every category retains the existing two-column product grid. Mobile grid
columns never collapse or reflow; only spacing and tile radii tighten. Menu
data, item order, variants, images, and routes remain external to the visual
system and are rendered unchanged.

## Category header and Metal-FX rule

Every category uses the same reusable `CategoryMetalRule` treatment immediately
above its heading:

- A complete 2px scarlet-alpha base line is always present.
- Real `metal-fx` renders a low-strength silver reflection over the line.
- The shader canvas is filtered and multiplied into the L Cafe palette.
- Glow is disabled; the reflection is secondary to the heading.
- The rule has no frame, box, or animated category-container border.
- All instances share the package’s WebGL renderer. Package-level viewport
  observation suspends offscreen copying.
- `prefers-reduced-motion` pauses every rule while preserving its visible base
  line and a static reflection frame.

Do not wrap `.cat`, `.cat-head`, or any product-grid container in Metal-FX.
The only Metal-FX host is the thin rule track.

## Category table of contents

The fixed bottom trigger is a compact, almost-square editorial control. It
shows “فهرست” and the current category without changing document or grid
geometry.

The popover is a bordered ivory table of contents with one category per row on
mobile and two columns on wider screens. Each row keeps a 44px minimum target,
a fine divider, and a short scarlet rule marker. The current row uses a quiet
tonal fill, stronger text, the extended marker, and `aria-current="location"`.

Behavioral contract:

- IntersectionObserver keeps the trigger and list synchronized with the
  category in view.
- Selecting a row writes the category hash, closes the popover, focuses the
  category heading, and scrolls it to the top offset.
- The focused heading receives a restrained outline sized to its text rather
  than a full-width box.
- Opening focuses the current category link.
- Outside pointer-down and Escape both close the popover and return focus to
  the trigger.
- Short screens scroll the one-column list; the last category remains
  reachable.
- Reduced-motion users receive an immediate jump rather than smooth scrolling.

## Product disclosure

Descriptions default to a reliable two-line `max-height` clamp while the full
text remains in the DOM. A shared ResizeObserver plus a font-ready measurement
shows “بیشتر” only when the rendered paragraph actually overflows. Expanding
switches to “کمتر”, removes the clamp, preserves `aria-expanded` and
`aria-controls`, and does not affect other items.

The disclosure remains a plain underlined word with no filled control surface.
Its small visible form has an expanded pseudo-element hit area, so the control
does not steal a full 44px row from the product tile.

## Menu footer

The close is a full-bleed scarlet field, not a card. Inside the same `900px`
measure, the white brand mark sits beside phone and Instagram links; the return
link occupies a final hairline-separated row. Mobile bottom padding reserves
space for the fixed category trigger as well as the safe-area inset, so the
return link is unobscured at the true end of the document.

## Motion and performance

Landing reveal motion is armed only after JavaScript confirms a safe path;
content is readable by default. Menu image arrival uses opacity only and keeps
intrinsic dimensions to prevent layout shift.

`content-visibility: auto` is intentionally not used on categories. The long
Menu could benefit in isolation, but category anchors, IntersectionObserver
tracking, jump positions, and Metal-FX visibility all depend on stable section
geometry. No measured benefit currently outweighs those interaction risks.

## Accessibility contract

- Persian document language and RTL direction live on the HTML elements.
- Skip links remain available on both pages.
- Interactive controls retain visible focus and 44px effective targets.
- Category state is exposed with `aria-current`; the current label duplicated
  in the trigger is decorative to assistive technology.
- Disclosure state is exposed with `aria-expanded` and `aria-controls`.
- Motion respects `prefers-reduced-motion` without hiding content or rules.
- Page and content backgrounds extend through safe areas without removing
  intentional reading gutters.

## Guardrails

- Do not change `menu.json` to solve layout problems.
- Do not collapse or restructure the two-column product grid on mobile.
- Do not turn the Menu masthead into a hero.
- Do not place Metal-FX around a category, header, card, grid, or navigation
  control.
- Do not allow an animated reflection to replace the category rule’s complete
  static base line.
- Do not hide text pending animation or font loading.
- Do not add speculative `content-visibility` optimization.
- Do not introduce white outer gutters, a centered page-card background, or
  device-model-specific safe-area hacks.
