---
name: L Cafe
description: A dim maroon room in upper Chaharbagh, rendered as two Persian RTL pages.
colors:
  burnt-pomegranate: "#471019"
  cream: "#F3F1EC"
  cream-strong: "rgba(243,241,236,.82)"
  cream-soft: "rgba(243,241,236,.72)"
  cream-dim: "rgba(243,241,236,.62)"
  hairline: "rgba(243,241,236,.15)"
  underline: "rgba(243,241,236,.35)"
  fill: "rgba(243,241,236,.06)"
  fill-hi: "rgba(243,241,236,.1)"
  shadow-tint: "rgba(13,1,4,.14)"
  mark-fill: "#E6E5E1"
typography:
  display:
    fontFamily: "Sahel, Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(30px, 6.4vw, 52px)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.005em"
  headline:
    fontFamily: "Sahel, Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(20px, 5.4vw, 28px)"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(14px, 3.8vw, 17px)"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(15px, 4vw, 17px)"
    fontWeight: 400
    lineHeight: 2.1
  price:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(16px, 4.3vw, 19px)"
    fontWeight: 700
    lineHeight: 1.45
  caption:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontSize: "clamp(12px, 3.1vw, 13px)"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  edge: "2px"
  nav-pill: "10px"
  tile: "14px"
  card: "20px"
  pill: "999px"
spacing:
  gutter-page: "clamp(20px, 6vw, 80px)"
  gutter-menu: "clamp(16px, 5vw, 64px)"
  flow: "clamp(64px, 10vw, 104px)"
  air: "clamp(104px, 17vw, 180px)"
  grid-column: "clamp(12px, 3.5vw, 22px)"
  grid-row: "clamp(28px, 7vw, 44px)"
components:
  button-primary:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.burnt-pomegranate}"
    rounded: "{rounded.edge}"
    padding: "0 30px"
    height: "44px"
  card-category:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.card}"
    padding: "clamp(16px, 4vw, 24px)"
  chip-option:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.cream-soft}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
  chip-option-price:
    textColor: "{colors.cream}"
  tile-photo:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.tile}"
  tile-photo-empty:
    backgroundColor: "{colors.fill-hi}"
    rounded: "{rounded.tile}"
  disclosure:
    textColor: "{colors.cream-soft}"
    height: "44px"
  link-underlined:
    textColor: "{colors.cream}"
    height: "44px"
---

# Design System: L Cafe

## Overview

**Creative North Star: "سالن متروپل" — The Metropole Room**

The site is not a page about a room; it is the room. One continuous maroon
plane runs behind everything, the way a wall does, and every section is an
aperture cut into it rather than a card floating above it. Light is scarce and
deliberate: the cream is not a background, it is illumination, and it is spent
on text, on one photograph, and on the single button that leads to the menu.
Nothing else in the system is allowed to glow.

The density is unhurried on the landing and businesslike on the menu, and that
difference is intentional rather than a drift. A visitor in the landing is
being received; a visitor in the menu is choosing, on a phone, at a table, and
the system tightens its gutters, shrinks its rhythm and doubles its columns to
meet them there. The two pages share every token and disagree only about pace.

The identity carries in repetition, not ornament. The «ال» mark tiles across
the whole document as a fixed field, so a section edge slices the marks
mid-glyph instead of politely restarting the pattern — the seam is the point.
There is no second accent colour, no gradient that introduces a new hue, and
no illustration. When something must feel special, it gets space and silence,
not decoration.

**Key Characteristics:**

- Two hues only: burnt pomegranate and cream. Every other value is cream at a
  reduced opacity.
- One continuous fixed pattern field beneath the entire document.
- Flat by default; depth comes from tonal fills and blur, not from shadows.
- RTL-native, right-anchored text, with centre reserved for the one action.
- Motion never gates content: copy is readable before any script runs.

## Colors

A two-hue system where the only real colour decision was made once, and every
subsequent value is the same cream turned down.

### Primary

- **انار سوخته / Burnt Pomegranate** (`#471019`): the room itself. Page
  background on both pages, the `theme-color` of the browser chrome, and the
  base of the tiled pattern field. It is never used as a foreground except
  inside the primary button, where the relationship inverts. The menu also
  carries it as bare channels (`71,16,25`) so the translucent chrome — the
  sticky bar at `.95`, the rail at `.92` — can compose it through `rgba()`
  instead of spelling the number out again. Same colour, one definition.

### Neutral

- **Cream** (`#F3F1EC`): the light. Headings, item names, prices, the logo
  mark, focus rings, and the primary button's fill. Full-strength cream is a
  signal of importance, so it is spent sparingly.
- **Cream Strong** (`rgba(243,241,236,.82)`): landing body copy. Long-form
  reading at slightly lowered contrast so a paragraph does not vibrate against
  the maroon.
- **Cream Soft** (`rgba(243,241,236,.72)`): secondary labels, add-on prices,
  option chips.
- **Cream Dim** (`rgba(243,241,236,.62)`): menu item descriptions and category
  intros — present, subordinate, never competing with the item name.
- **Hairline** (`rgba(243,241,236,.15)`): borders on the menu — chips, list
  dividers, the sticky bar, the rail.
- **Underline** (`rgba(243,241,236,.35)`): text-decoration colour on links, so
  the underline reads as a texture rather than a second line of type.
- **Fill** (`rgba(243,241,236,.06)`) and **Fill Hi** (`rgba(243,241,236,.1)`):
  tonal surfaces. These do the work shadows do in other systems.
- **Shadow Tint** (`rgba(13,1,4,.14)`): the drop of the one shadow in the
  system. A darkened pomegranate, never neutral black — a grey shadow over
  this maroon reads as dirt.
- **Mark Fill** (`#E6E5E1`): the giant «ال» glyph on the landing, and only it.
  A hair cooler and darker than cream on purpose: at 13% opacity behind the
  copy, full cream lifted it just enough to compete.

### Named Rules

**The Two-Hue Rule.** There are exactly two colours in this system. Anything
that looks like a third — a border, a chip, a hover state, a gradient stop —
must resolve to cream at some opacity over burnt pomegranate. A new hue is a
change to the brand, not a styling choice.

**The One Light Rule.** Full-strength cream is illumination and is rationed.
On the landing it lands on the headings, the single photograph, and the one
button. If a screen has cream everywhere, the hierarchy has already failed.

**The Dimming Rule.** Text is dimmed by picking one of the four cream values
above, never by putting `opacity` on the element. The two are visually
identical and audit completely differently: with an opacity the `color`
property still reads as full cream, so every contrast check — automated or by
eye against the token list — passes while the pixels do not. The rail's
category labels were dimmed with a raw `opacity:.5` and composited to 4.33:1,
under the 4.5:1 floor, for as long as that rule went unwritten. Below `.62`
nothing in this system clears AA against burnt pomegranate; `.52` is the exact
threshold, and Cream Dim is the value to reach for.

The rail now dims with Cream Dim as a `color`, and the cost of the old form is
on record: a contrast probe run over that rule reported 13.72:1 while the
screen was showing 5.96:1. The dot beside each label keeps its `opacity`, and
should — a dot appearing is not text being dimmed.

## Typography

**Display Font:** Sahel (falling back to Vazirmatn, then system-ui)
**Body Font:** Vazirmatn (falling back to system-ui)

**Character:** Two Persian faces with a deliberate division of labour. Sahel
is heavy, closed and architectural, and appears only where the page needs a
voice; Vazirmatn is open and even-coloured, and carries everything a visitor
actually reads. Both are self-hosted with `font-display: swap`, so text is
never invisible while a face is in flight.

### Hierarchy

- **Display** (Sahel 700, `clamp(30px, 6.4vw, 52px)`, lh 1.3, ls -.005em):
  landing section headings — «درباره ما», «منو», «منتظرتونیم». One per section,
  never more.
- **Headline** (Sahel 700, `clamp(20px, 5.4vw, 28px)`, lh 1.4): menu category
  titles inside the category card.
- **Title** (Vazirmatn 600, `clamp(14px, 3.8vw, 17px)`, lh 1.5): menu item
  names. Deliberately *not* Sahel.
- **Price** (Vazirmatn 700, `clamp(16px, 4.3vw, 19px)`, lh 1.45): the bare
  numeral at the foot of a menu tile, and the largest thing in that tile. The
  option chip's number is the same role one step down
  (`clamp(13.5px, 3.6vw, 15px)`), because two of them share a 141px row.
- **Body** (Vazirmatn 400, `clamp(15px, 4vw, 17px)`, lh 2.1, max 52ch):
  landing paragraphs. The tall leading is a Persian reading concession, not a
  style flourish.
- **Caption** (Vazirmatn 400, `clamp(12px, 3.1vw, 13px)`, lh 1.62): item
  ingredient lists. Leading tightens as the measure narrows and this is the
  narrowest column on the site — 22 characters. Category intros are the same
  role at a slightly wider setting (`clamp(12px, 3.2vw, 14px)`, lh 1.9),
  because they run the full width of the card.
- **Label** (Vazirmatn 500, `11px` flat, lh 1.35): the category rail. Not a
  clamp: the old one hit its 11px ceiling by 423px wide and spent the entire
  phone range below it, bottoming out at 9.76px on a 375px screen. Persian
  carries more stroke detail per em than Latin does, and this is the one
  control on the page.

### Named Rules

**The Sahel-Bold-Only Rule.** Sahel ships a single weight (700). Never request
another — the browser will synthesise it and the shapes go soft against the
maroon. If a heading needs to be lighter, it needs to be Vazirmatn, not a
lighter Sahel.

**The Eighty-Names Rule.** Menu item names stay on Vazirmatn 600. Eighty item
names in Sahel Bold would flatten the hierarchy the category titles depend on,
and 600 has no Sahel face to resolve to anyway.

**The Bare Numeral Rule.** Prices are Persian numerals with no unit, no
thousands separator, and no currency word. `۶۱۰`, never `۶۱۰ تومان`. This is a
product decision recorded in PRODUCT.md; typography must not reintroduce the
unit as a superscript, a caption, or a legend.

**The Price Leads Rule.** Inside a menu tile the price outranks the item name —
a full step larger and a weight heavier. It was the other way round for a
while, and the measurement is the argument: 13.88px/600 for the price against
14.25px/600 for the name is a 0.37px difference at identical weight, which is
no difference at all. A tile has one job, and the reader's eye must land on the
number without being asked to search. Vazirmatn is a variable face, so the
extra weight costs no additional file.

**The One Number Shape Rule.** Every price on the page is set the same way,
whether it stands alone at the foot of a tile or sits inside an option chip.
Eighty items showing a bare numeral at one weight and nine showing it at
another meant the eye had to work out which pattern each tile was using before
it could read anything.

## Layout

Right-anchored throughout, with `dir="rtl"` at the wrapper and the reading
origin at the right edge. Centre alignment is reserved: on the landing only
the menu section is centred, because it holds the page's one action, and that
isolation is what makes it read as the action.

The landing runs a single 1180px column with a page gutter of
`clamp(20px, 6vw, 80px)` and a **two-value vertical rhythm**: `--flow`
(`clamp(64px, 10vw, 104px)`) separates blocks inside one thought, `--air`
(`clamp(104px, 17vw, 180px)`) separates the thoughts themselves. Above 640px
the one photo is inset from the start side by `clamp(0px, 8vw, 140px)` so a
strip of the pattern field survives at the reading origin.

On a phone that inset is deliberately dropped and the photo goes full-bleed.
The strip is worth having on a wide screen, where the photo is an object with
room around it; at 375px the same rule leaves a 30px margin that reads as a
mistake rather than as a decision, and the photo stops being the page's one
light moment. Full width is the decision on the device this site is actually
read on — the inset is the desktop's version of the idea, not the canonical
one. Anything that "restores consistency" here by re-applying the inset below
640px is undoing this on purpose.

The frame carries the photograph's own ratio (`aspect-ratio: 1920/1220`) and
takes no height from the viewport, which is what makes this the one image on
the site that is never cropped at any width — measured, 99.9% of the picture is
on screen at 375, 1280 and 1920 alike. The frame used to be sized from the
viewport instead, so its shape and the file's shape disagreed and `object-fit`
settled the argument by cutting: a sixth of the height on a wide desktop, and
on the phone a 3:4 crop that discarded half the room before the browser ever
saw it. The cost of showing all of it is height — 238px on a 375px phone rather
than 62vh — and the answer to a frame that feels too short is a taller
photograph, never a narrower crop of this one.

The menu narrows to a 720px column with a tighter gutter
(`clamp(16px, 5vw, 64px)`) and a fixed two-column grid — `repeat(2, minmax(0, 1fr))`
at every width, because the tiles are square and a single column would turn 80
items into an unscrollable ribbon. Column gap `clamp(12px, 3.5vw, 22px)`, row
gap `clamp(28px, 7vw, 44px)`. A fixed category rail occupies
`clamp(54px, 14vw, 80px)` at the right edge.

The rail's own column is budgeted, not assumed. Fourteen entries at the 44px
minimum plus 1px gaps and 4px of vertical padding come to 642px; a 375×667
phone offers 650. That is deliberate and it is tight — the gaps and the padding
are the adjustable part, the 44px is not. On anything shorter the rail scrolls,
and it says so rather than hiding it: whichever edge still has entries behind
it fades out.

In document order the rail comes **after** `<main>`, not before it. Its
position is fixed, so nothing moves on screen, but fourteen jump links no
longer stand between the keyboard and the first word of content.

Sole breakpoint: **640px**. Above it the category card becomes a two-column
grid and the landing photo takes back its start-side inset; below it the photo
is full-bleed. Its height is width-derived on both sides of the line — the
breakpoint changes where the photo starts, not what shape it is. Everything
else scales continuously through `clamp()`.

### Named Rules

**The Two-Value Rhythm Rule.** Vertical space comes from `--flow` or `--air`.
There is no third value and no ad-hoc margin. If a gap feels wrong, one of the
two variables is wrong — fix it there.

**The Continuous Field Rule.** The pattern is one `position: fixed` plane for
the whole document, never a per-section background. A panel edge must slice the
marks mid-glyph. Restarting the tile at a section boundary breaks the illusion
that the page is a single wall.

## Elevation & Depth

Flat by default. Depth is carried by tonal fills over the maroon and by
backdrop blur on floating chrome — not by shadows. The system contains exactly
one shadow, and it is on the menu's category card, where it exists to lift the
card off the pattern field enough that the tiling does not read through the
heading.

### Shadow Vocabulary

- **Card lift** (`box-shadow: 0 14px 30px rgba(13,1,4,.14), inset 0 1px 0 rgba(243,241,236,.1)`):
  the menu category card only. The inset highlight is the top edge catching
  light; the drop is deep-maroon-tinted, never neutral black.

### Named Rules

**The Blur-Not-Shadow Rule.** Floating chrome — the sticky bar
(`blur(8px)`) and the category rail (`blur(10px)`) — separates from content by
blurring what is behind it and carrying a hairline border. Do not add a drop
shadow to either; the blur plus the hairline is the whole vocabulary.

## Shapes

A deliberately inconsistent radius scale, where each value marks what kind of
thing an element is:

- **2px (edge)** — the primary button, the focus ring, and the skip link.
  Almost square. The button is meant to read as a printed block, not a pill,
  and micro-chrome shares the value rather than inventing 3px and 4px
  neighbours nobody can tell apart.
- **10px (nav-pill)** — the sliding indicator behind the active rail entry.
  Inset 4px from the rail's own edges, so it reads as a highlight travelling
  inside the rail rather than a second panel.
- **14px (tile)** — menu photo tiles, and the rail's outer corners (left side
  only: `14px 0 0 14px`, since it is flush to the right viewport edge).
- **20px (card)** — the menu category card, the largest and softest form.
- **999px (pill)** — option chips inside an item, and only those.

Borders are a single hairline weight (1px at `rgba(243,241,236,.15)`) wherever
they appear. Focus rings are a 2px cream outline at 3px offset, never a glow.

The pattern rule strip (`.rule`) — a full-bleed band of the tiled mark between
menu sections, hairline-bordered top and bottom — is the system's one purely
graphic device.

## Components

### Buttons

- **Shape:** almost square (2px radius), 44px minimum height.
- **Primary:** inverted — cream fill, burnt pomegranate text, `0 30px`
  horizontal padding, Vazirmatn 500. It is the only inverted surface in the
  system, which is precisely why it reads as the action.
- **Focus:** 2px cream outline, 3px offset.
- There is no secondary or ghost button. If a second action ever appears, it
  is an underlined link, not a weaker button.

### Chips

- **Style:** pill (999px), `fill` background, hairline border, `5px 9px`
  padding. The label is cream-soft Vazirmatn 400 at a flat 12px; the value is
  cream Vazirmatn 700 at `clamp(13.5px, 3.6vw, 15px)` — the price role, one
  step down to fit two of them in a 141px row.
- The label sits at 12px flat rather than on a clamp for the same reason the
  rail label does: the old `clamp(10.5px, 2.8vw, 11.5px)` bottomed out at
  10.51px on a 375px phone, which made the smallest type on the page the type
  carrying a price.
- Used only for per-item options (sizes, blends) inside a menu tile. Chips are
  informational here — never interactive, never a filter.
- **Markup:** the chip row is a description list, not a bullet list. Each row
  is a label and the price *of that label*, and only `dt`/`dd` carries that
  pairing; read aloud, the previous `span` beside a `b` was four loose numbers
  in a row with nothing saying which belonged to which. The add-on list uses
  the same row shape for the same reason.

### Disclosure

- **Character:** a plain underlined word, never a button-shaped thing. It is
  the only interactive control inside a tile and it must not compete with the
  price.
- **Style:** cream-soft, Vazirmatn 500 `clamp(11.5px, 3vw, 12.5px)`, underlined
  at the `underline` value with a 4px offset. No border, no background.
- **Target:** the visible box is one line tall (~16px); the 44px touch target
  comes from an absolutely positioned overlay inset `-14px -10px`. Giving it
  real height would have traded three lines of clamped description for a
  control the same size, which is not a saving.
- **Behavior:** present only where the description actually overflows its two
  lines — that is a rendered question, not a content one, so it is measured
  per element and re-measured on resize and once the real face has loaded. On a
  375px phone every description overflows; at 1280px only eleven of eighty-nine
  do, and the other seventy-eight lose both the control and their tab stop.

### Cards

- **Corner Style:** 20px.
- **Background:** `linear-gradient(135deg, fill-hi, fill)` — a tonal wash, not
  a hue shift.
- **Shadow:** the single card-lift shadow (see Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** `clamp(16px, 4vw, 24px)`.

### Navigation

- **Sticky bar:** full width, burnt pomegranate at `.95` over `blur(8px)`,
  hairline bottom border, back link at Vazirmatn 500 13px, 34px logo. Between
  them it carries the name of the category the reader is currently inside, at
  cream-soft Vazirmatn 500 13px, truncating with an ellipsis. That label is
  `aria-hidden`: the rail already announces the same state through
  `aria-current`, and repeating it on every scroll is noise, not orientation.
  The bar occupies its height on all twenty-two screens of this page, so it has
  to earn them.
- **Category rail:** fixed, vertically centred, right-flush. Each entry is a
  dot plus a label in Cream Dim; the active entry goes to full cream and a
  translucent pill tweens behind it over 250ms. Entries are 44px tall with 1px
  between them — the pill supplies the separation a larger gap used to.
- **Overflow:** on a screen too short for fourteen entries the rail scrolls
  with its scrollbar hidden, and marks the fact by fading whichever edge still
  has entries behind it. A hidden scrollbar with no fade is how an entire menu
  category stops existing for anyone on a small phone.
- **Mobile:** identical. The rail is designed for the phone first — it is
  narrower than a thumb and sits where a thumb already rests.

### Photo tiles

- **Shape:** square (`aspect-ratio: 1`), 14px radius, `fill` background,
  contents clipped.
- **Waiting:** the tile holds a tonal wash (`linear-gradient(135deg, fill-hi,
  fill)`) that pulses at 1s between full and `0.5` opacity. The photograph
  fades in over it, unblurring from 2px across 400ms on the system's
  exponential ease.
- **Arrival is an event, not a poll.** The reveal is driven by the image's own
  `load`, caught in the capture phase by one listener on the document. `error`
  is bound the same way on purpose: a tile whose photo 404s has to stop pulsing
  too, or the page keeps promising a picture that is never coming.
- **Empty:** an item with no photograph yet gets an opaque tonal panel with an
  inset hairline, and **no pulse**. A skeleton that never resolves is a lie
  about the network. It is not a placeholder photograph either — one identical
  stand-in repeated twenty-six times tells the reader the site is unfinished,
  where an empty surface tells them this item simply has no picture yet.
- **Delivery:** two widths (300 and 600), chosen by the browser through
  `srcset` against a `sizes` of `(min-width: 880px) 285px, 38vw` — measured
  against the real tile, which is 141 CSS px on a 375px phone and a fixed 285px
  once the column stops growing. Intrinsic `width`/`height` are always present
  so a waiting tile never shifts, and everything past the first row is
  natively lazy.

### Signature Component: the mark handoff

On the landing, the wordmark sits at dead centre of a full-viewport hero and
fades out on scroll while the giant «ال» glyph fades in behind the page at a
peak opacity of **0.13**, scaling from 0.94 to 1.0. Both sides ride the same
smoothstep curve so they cross exactly once and never share the screen. The
glyph's presence comes from scale, never from value — raising that 0.13 makes
it compete with the copy and destroys the effect.

## Do's and Don'ts

### Do:

- **Do** express every non-cream, non-maroon value as cream at an opacity.
- **Do** take vertical space from `--flow` or `--air` and nothing else.
- **Do** keep the pattern field fixed and continuous across the whole document.
- **Do** give every interactive target a 44px minimum height — this is a menu
  read one-handed at a table.
- **Do** default content to visible and let scripts *un-hide* it. Every
  animation in this project arms itself only after JS confirms it is running,
  and carries a timeout and a scroll-based fallback.
- **Do** keep prices as bare Persian numerals.
- **Do** let the price outrank the item name inside a tile, and set every price
  the same way whether it stands alone or sits in a chip.
- **Do** pair a label with its value using `dt`/`dd` whenever the two are only
  related by position on screen.
- **Do** clamp long copy visually and leave the full text in the document, so a
  screen reader reads all of it whether or not anyone opens the disclosure.
- **Do** buy space for a fixed control out of its gaps and padding before its
  touch target. 44px is the floor, not the variable.
- **Do** make a hidden scrollbar admit what it is hiding.

### Don't:

- **Don't** introduce a third hue, including through a gradient stop or a
  "subtle" tint.
- **Don't** ask for a Sahel weight other than 700.
- **Don't** set menu item names in the display face.
- **Don't** add drop shadows to floating chrome; blur plus hairline is the
  vocabulary.
- **Don't** raise the giant mark's peak opacity above 0.13.
- **Don't** let a transition be the reason text cannot be read — the reveal
  animations must never be the only path to visible copy.
- **Don't** restart the pattern tile at a section boundary.
- **Don't** ship a stand-in photograph. An item without a picture gets the
  empty tile; the gap stays a gap until there is a real one.
- **Don't** pulse a surface that has nothing arriving.
- **Don't** give a fixed jump control a place in tab order ahead of the
  content it jumps within.
- **Don't** park `will-change` on a resting rule. Set it while a thing is
  actually moving and take it off again.
- **Don't** use an overshoot or bounce curve. Motion here settles; it never
  springs.
