---
name: L Cafe
description: Mobile-first Persian hospitality across atmospheric public pages and a practical menu control plane.
colors:
  landing-maroon: "#471019"
  menu-scarlet: "#681F2D"
  ivory: "#F3F1EC"
  ivory-deep: "#E6E5E1"
  admin-paper: "#FFFDF9"
  admin-ink: "#35141B"
  admin-muted: "#76676A"
  success: "#246B4A"
  pending: "#8A5B12"
  error: "#A22A38"
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
  admin-control: "10px"
  admin-panel: "16px"
  pill: "999px"
spacing:
  landing-gutter: "clamp(20px, 6vw, 80px)"
  menu-gutter: "clamp(14px, 4vw, 48px)"
  landing-hero-intro: "clamp(96px, 12vw, 160px)"
  landing-intro-photo: "clamp(88px, 10vw, 144px)"
  landing-photo-menu: "clamp(96px, 11vw, 156px)"
  landing-menu-close: "clamp(40px, 5vw, 64px)"
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
    textColor: "{colors.ivory}"
    rounded: "{rounded.admin-control}"
    height: "44px"
  admin-field:
    backgroundColor: "{colors.admin-paper}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
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
index as its only fixed discovery control. The canonical `/menu` uses the
single-column row treatment on small phones; `/menu2` preserves the historical
two-column card presentation as a noncanonical, noindex comparison route.
Fallback-snapshot states remain in normal document flow on both presentations.

Admin is an Operate surface. The top bar identifies the operator; owner-only
controls are grouped separately; daily editing starts with search, active/
archived filters, quick creation, and category/item work areas. Archive/restore,
undo, conflict recovery, and a persistent save bar remain visible where the
operator needs them. Narrow layouts stack controls without removing their
labels or recovery actions.

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

Admin controls use consistent medium rounding, while work panels use a larger
radius. Destructive actions remain textually explicit and are not disguised as
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

- Canonical `/menu` retains row-style single-column cards on small phones;
  `/menu2` retains the historical two-column square-image cards. Both preserve
  name, description, informational option rows, add-ons, and bare price.
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

- **Do** preserve RTL, visible focus, skip links, and 44px effective targets.
- **Do** keep Landing copy and imagery readable when animation fails or is reduced.
- **Do** keep Menu category anchors and fallback states in stable flow.
- **Do** make Admin role, save, conflict, archive, and upload state explicit.
- **Do** use current source components and CSS as authority for future refreshes.

### Don't:

- **Don't** change managed menu data, fixtures, or archived inputs for layout work.
- **Don't** merge `/menu2` presentation rules into canonical `/menu`.
- **Don't** turn the Menu masthead into a hero or wrap categories in Metal-FX.
- **Don't** expose owner controls to cashiers or rely on UI hiding as authorization.
- **Don't** hide content pending JavaScript, fonts, WebGL, or animation.
- **Don't** reintroduce the retired maroon Menu card/rail system from the old sidecar.
