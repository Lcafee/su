---
name: L Cafe
description: Mobile-first Persian hospitality across atmospheric public pages and a practical menu control plane.
colors:
  landing-maroon: "#471019"
  menu-scarlet: "#681F2D"
  ivory: "#F3F1EC"
  ivory-deep: "#E6E5E1"
  admin-paper: "#FFFDF9"
  admin-surface: "#FFFFFF"
  admin-sunken: "#F6F2EF"
  admin-tint: "#F8EEEE"
  admin-tint-soft: "#FAF4F3"
  admin-ink: "#35141B"
  admin-label: "#59464A"
  admin-muted: "#76676A"
  admin-line: "#DED5D1"
  admin-line-strong: "#C9B7B4"
  success: "#246B4A"
  success-bg: "#E9F4EE"
  pending: "#8A5B12"
  pending-bg: "#FFF4DD"
  error: "#A22A38"
  error-bg: "#FBEAEC"
typography:
  display:
    fontFamily: "Sahel, Vazirmatn, system-ui, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Vazirmatn, system-ui, sans-serif"
    fontWeight: 400
  hero-latin:
    fontFamily: "Fahkwang, Vazirmatn, system-ui, sans-serif"
    fontWeight: 600
rounded:
  editorial-edge: "2px"
  public-surface: "12px"
  admin-control: "8px"
  admin-panel: "12px"
  pill: "999px"
spacing:
  landing-gutter: "clamp(20px, 6vw, 80px)"
  menu-gutter: "clamp(14px, 4vw, 48px)"
  landing-hero-intro: "clamp(120px, 14vw, 208px)"
  landing-intro-photo: "clamp(112px, 12vw, 176px)"
  landing-photo-menu: "clamp(160px, 16vw, 240px)"
  landing-menu-close: "clamp(36px, 4vw, 56px)"
  public-measure: "900px"
components:
  landing-primary:
    backgroundColor: "{colors.ivory}"
    textColor: "{colors.landing-maroon}"
    rounded: "{rounded.editorial-edge}"
    height: "44px"
    padding: "0 30px"
  menu-index:
    backgroundColor: "{colors.ivory}"
    textColor: "{colors.menu-scarlet}"
    rounded: "{rounded.editorial-edge}"
    height: "44px"
  admin-primary:
    backgroundColor: "{colors.menu-scarlet}"
    textColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-control}"
    height: "36px with a fine pointer, 44px on touch"
  admin-field:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    height: "36px with a fine pointer, 44px on touch"
---

# Design System: L Cafe

## Overview

**Creative North Star: "The Metropole Pause"**

L Cafe uses one restrained hospitality identity at three different working
speeds. Landing is an atmospheric reception, Menu is a fast customer lookup
surface, and Admin is a dense but calm operating workspace. The public pages
share maroon, ivory, RTL typography, brand marks, and restrained motion; Admin
extends those cues with paper surfaces and semantic status colors so operators
can work safely for longer sessions.

Landing and Menu are continuous viewport canvases rather than cards inside a
white browser. Admin is intentionally different: it uses bounded panels,
explicit controls, persistent save state, and recovery messaging because the
operator is editing production-backed content.

**Key Characteristics:**

- Mobile-first Persian RTL across every surface.
- Landing atmosphere, Menu scanability, and Admin operational clarity.
- Maroon and ivory remain the brand anchors; Admin status colors are semantic.
- Text and essential controls remain usable without decorative motion or WebGL.
- Current source implementation is the visual authority; menu data is not.

## Colors

Landing uses deep maroon as the room and ivory as light. Menu reverses that
relationship: ivory is the page and scarlet is ink, navigation, rules, and the
footer field. Admin uses ivory/paper with dark maroon ink and reserves green,
amber, and red for success, pending, and error state only.

**The Public Two-Hue Rule.** Landing and Menu do not introduce a third accent
hue. Secondary public values are alpha variants of their current foreground.

**The Semantic Admin Rule.** Admin status colors communicate system state; they
must not become decorative brand accents or substitute for text labels.

**The Host-State Rule.** Visual source never embeds production menu facts or
private runtime values to make a screen look complete.

## Typography

**Display Font:** Sahel Bold with Vazirmatn fallback.  
**Body Font:** Vazirmatn.  
**Hero Latin Font:** Fahkwang SemiBold, reserved for `YOUR DAILY PAUSE`.

Sahel is used at its shipped 700 weight for Persian display moments. Vazirmatn
carries item names, prices, controls, metadata, form fields, and operating copy.
Admin hierarchy relies more on weight and spacing than oversized headings.

- **Display:** Sahel 700 for Landing section and Menu category headings.
- **Title:** Vazirmatn 600 for menu items, admin panel headings, and key states.
- **Body:** Vazirmatn 400 with generous Persian line-height for descriptive copy.
- **Label:** Vazirmatn 500–600 for navigation, fields, filters, roles, and status.
- **Price:** bare Persian numerals, visually prominent, with no unit or separator.

**The Bare Numeral Rule.** Menu prices remain exactly as supplied; typography
must never add a currency word, unit, separator, or inferred value.

## Layout

Landing is one patterned maroon plane. Its centered small-viewport hero leads
to an editorial introduction, intrinsic-ratio feature image, single Menu CTA,
and compact contact close. The feature image has a branded fallback state rather
than an empty or permanently loading frame.

Menu is an edge-to-edge ivory canvas with a transparent content measure capped
at 900px. It opens with the compact back/mark masthead and keeps the category
index and compact two-option view switch together as its fixed discovery
controls. Canonical `/menu` owns both the historical two-column grid and the
row-list treatment in one stable component tree; grid is the first-use default.
Fallback-snapshot states remain in normal document flow.

Admin is an Operate surface built for density. The top bar identifies the
operator; owner-only controls are grouped separately; daily editing starts with
search, active/archived filters, quick creation, and category/item work areas.
Archive/restore, undo, conflict recovery, and a persistent save bar remain
visible where the operator needs them. Narrow layouts stack controls without
removing their labels or recovery actions.

**The Admin Density Rule.** Every label, description, field, option, and action
stays on screen; density comes from arrangement, never from hiding. All admin
styling lives in `src/admin/admin.css` and reads only the tokens declared in
its `:root`.

- **Control height follows the pointer.** `--control` is 36px and
  `--control-sm` 32px with a fine pointer; both become 44px under
  `(pointer: coarse)`, where form fields also use 16px text so iOS does not
  zoom on focus.
- **Cards size themselves.** `.category-card` and `.item-card` are inline-size
  containers. An item header is one row (handle, thumbnail, name, price,
  category, actions) from 44rem of card width, drops its actions to a second
  row from 34rem, and below that becomes a rail (handle above thumbnail) beside
  the fields. The item body is two columns from 40rem. Browsers without
  container queries keep the stacked layout.
- **Page breakpoints only move the chrome.** From 861px the category navigation
  is a sticky sidebar; below it is one sticky row, heading beside a scrolling
  strip. At 520px and below the top bar scrolls away and the strip owns the
  sticky edge.
- **The save bar is sticky, not fixed.** It sizes to its content and wraps the
  status above the two actions when they do not fit on one line, so no page
  padding has to guess its height.
- **Segmented controls share one style.** The Simple/Advanced switch and the
  visibility filter use the same tinted selected state; filled scarlet is
  reserved for primary actions and the current category.

Safe-area padding belongs to page-level gutters and fixed actions. No surface
uses device-model branches. Public anchors and category tracking depend on
stable document geometry.

## Elevation & Depth

Landing and Menu are flat by default. Depth comes from their continuous fields,
fine rules, tonal fills, image layers, and restrained blur—not general-purpose
card shadows. Metal-FX is decorative and appears only on the Menu category rule
and the mobile index trigger, always over a complete static fallback.

Admin uses a single soft maroon-tinted shadow for bounded operational panels and
the save bar. Status panels use tonal backgrounds plus borders and text labels.

**The Flat Public Rule.** Do not turn Landing or Menu into centered page cards.

**The Fallback-First Rule.** Animated reflections, image reveals, and loading
effects enhance an already visible static structure; they never replace it.

## Shapes

Landing’s primary action uses a sharp editorial 2px edge. Menu product imagery
and navigation surfaces use quiet 12–14px rounding; disclosure remains a
plain underlined word with an expanded hit area. Pills are reserved for compact
state, role, and option labels.

Admin controls use 8px rounding and work panels 12px; item blocks inside a
category use the control radius so nested surfaces step down instead of
repeating the panel. Destructive actions remain textually explicit and are not disguised as
neutral controls. Borders are thin and structural; nested boxes are avoided.

## Components

### Landing reception

- The hero has no logo/header/menu control; the English phrase and scroll cue
  are the opening signature.
- The feature photo preserves its intrinsic ratio and exposes a branded error
  fallback with an accessible description.
- The contact close presents canonical NAP, hours, phone, Place-ID Maps target,
  and Instagram. Menu CTA is the only primary action.

### Menu discovery and navigation

- Public Menu discovery is category navigation only; search, result feedback,
  and category counts are intentionally absent.
- Only categories containing public items participate in rendering, navigation,
  deep links, or current-category state.
- URL-selected and currently visible categories are distinct state. Explicit
  category selection adds one history entry; passive scrolling may replace the
  current hash.
- Missing or non-renderable category hashes resolve to the first renderable
  category. History and refresh reconciliation use the latest
  navigation intent and restore focus only to a control or destination that
  remains rendered.
- The fixed index trigger and popover track the current category. Selecting a
  category closes the popover, moves focus, and respects reduced motion.
- Fallback-snapshot, loading, error, empty, and retry states explain the
  available recovery action in plain Persian.

### Menu product content

- Canonical `/menu` switches between the historical two-column square-image
  grid and row-style list through `data-menu-view`, while preserving the same
  product nodes, name, description, informational option rows, add-ons, and
  bare price.
- Description disclosure appears only when rendered copy overflows and preserves
  `aria-expanded`, `aria-controls`, and independent item state.
- Category Metal-FX remains a thin rule; it never frames a card or section.

### Admin controls and recovery

- Primary buttons commit/create; secondary and quiet buttons navigate or reveal;
  danger actions explicitly say archive/remove/restore.
- Fields keep persistent labels. Search and visibility filters sit before the
  editor results; keyboard and button reordering remain available.
- Owner-only metadata/options and publish recovery are grouped under clear owner
  context. Cashier UI omits those controls, matching the backend boundary.
- Archive badges, upload progress, undo status, conflict draft download/reload,
  unsaved-change state, and the save bar use text plus semantic color.

## Do's and Don'ts

### Do:

- **Do** preserve RTL, visible focus, skip links, and 44px effective targets on
  touch. Admin may use 32–36px controls with a fine pointer only.
- **Do** keep the Admin focus ring a solid 2px scarlet outline; a translucent
  ring does not reach 3:1 against ivory.
- **Do** keep Landing copy and imagery readable when animation fails or is reduced.
- **Do** keep Menu category anchors and fallback states in stable flow.
- **Do** make Admin role, save, conflict, archive, and upload state explicit.
- **Do** use current source components and CSS as authority for future refreshes.

### Don't:

- **Don't** change managed menu data, fixtures, or archived inputs for layout work.
- **Don't** reintroduce an independently mounted `/menu2` presentation.
- **Don't** turn the Menu masthead into a hero or wrap categories in Metal-FX.
- **Don't** expose owner controls to cashiers or rely on UI hiding as authorization.
- **Don't** hide content pending JavaScript, fonts, WebGL, or animation.
- **Don't** reintroduce the retired maroon Menu card/rail system from the old sidecar.
