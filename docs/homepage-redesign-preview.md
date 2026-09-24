# Homepage redesign preview

The homepage on `preview/homepage-editorial-redesign` is designed for a phone
first. The generated photographs in `assets/home/` are temporary visual
placeholders. They depict a mood and composition, not the actual L Cafe room,
menu items, or guests. The hand-drawn L Cafe logo is the official repository
asset; the scarlet SVG changes only its fill color, never its geometry.

## Photography to replace before production

1. **Mobile hero:** A vertical 9:16 photograph of the real L Cafe interior at
   dusk or early evening, with guests naturally present in the lower half and
   calm, darker space on the right for the headline. Deliver at least
   1600 × 2840 px. Avoid signage or critical detail behind the text.
2. **Desktop hero:** A horizontal 16:9 photograph from the same session, with
   the activity on the left and darker room detail on the right. Deliver at
   least 2400 × 1350 px. A separate composition is better than a crop of the
   mobile image.
3. **Story moment:** A vertical 4:5 close scene of an actual L Cafe drink on
   a real table with a guest's hand or other human detail, in warm natural
   light. Deliver at least 1600 × 2000 px.
4. **Menu coffee:** A vertical 4:5 image of a drink that is genuinely on the
   current L Cafe menu, ideally in preparation or being served. Deliver at
   least 1400 × 1750 px.
5. **Menu food:** A matching vertical 4:5 image of a genuine current L Cafe
   pastry or plate. Deliver at least 1400 × 1750 px.

The existing photograph of the sculptural bird pendant is used in the middle
of the page as an authentic brand detail. A new photograph of that piece and
its surrounding room would improve the section, but is optional.

## Placeholder prompt set

The five WebP placeholders were generated with the built-in Image Gen tool and
then converted for the web. Each prompt specified photographic content only,
with no embedded text, logos, or UI:

- `hero-mobile.webp`: a vertical evening cafe interior, sculptural pendant on
  the upper left, guests below, and naturally dark room detail on the right for
  the headline.
- `hero-desktop.webp`: a wide evening cafe interior with conversation and
  lamplight on the left and warm espresso shadow on the right.
- `story-coffee.webp`: a vertical handmade coffee cup on walnut with a guest's
  hand, flowers, and afternoon light.
- `menu-espresso.webp`: a vertical close photograph of espresso extraction
  into a handmade ivory cup.
- `menu-pastry.webp`: a vertical small pistachio pastry on a ceramic plate at
  a walnut cafe table.

All images should be supplied without embedded text or artificial logo
rendering. Keep skin tones and interiors natural, with warm light and visible
texture rather than heavy grading. The code-native text and the official logo
stay separate from the photographs so the layout can adapt to different phone
sizes.

## Preview isolation

The branch-specific Pages workflow builds only the static public preview at
the `/su/` base. It does not invoke `deploy.py`, generate a production release,
or change the VPS. `main` and the production site are unchanged by this branch.
