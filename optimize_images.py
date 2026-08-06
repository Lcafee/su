"""Generate the web-sized photos the pages actually serve.

The originals in assets/menu are 1300px square, which is roughly ten times the
pixels a menu tile ever shows. They stay where they are — this writes smaller
copies of each into assets/menu/opt and the pages point at those. Keeping both
means a re-crop or a bigger layout can be re-derived from the source instead of
from an already-downscaled file.

The landing's one photo is derived here too, by landing(). Same reason, one
extra problem: it is the only image on either page whose FRAME changes shape
between phone and desktop, so it needs a second crop and not just a second
width. See that function.

Run after adding or replacing a photo:  py optimize_images.py
"""

import io
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets", "menu")
OUT = os.path.join(SRC, "opt")

# Two widths, because the tile is not one size. Measured in the browser: the
# photo is 141 CSS px on a 375px phone and 285 CSS px on a desktop, so a phone
# at 2x needs 282 and a desktop at 2x needs 570. One 600px file served both,
# which meant the phone — the device this menu is actually read on — downloaded
# the desktop asset for a tile a fifth of its area.
#
# 600 stays the unsuffixed name so nothing that already points at these files
# has to change; 300 is the one the phone picks through srcset.
EDGES = (600, 300)
QUALITY = 78
SOURCES = (".jpeg", ".jpg", ".png", ".webp")


def variant(stem, edge):
    """Output filename for one width. The largest keeps the bare name."""
    return "%s.webp" % stem if edge == max(EDGES) else "%s-%d.webp" % (stem, edge)


# --- the landing photo ------------------------------------------------------

LANDING_SRC = os.path.join(HERE, "assets", "cafe-interior.webp")

# One picture, several widths. There used to be two shapes here — a 3:4 crop
# for the phone and the full landscape above 640 — because the frame took its
# height from the viewport and cropped whatever did not fit. The frame now
# takes the photograph's own 1920x1220 ratio, so nothing crops at any width and
# there is only one shape left to serve.
#
# The phone comes out ahead on bytes, not behind: a 760-wide full frame is
# 760x483, where the 3:4 crop at the same width was 760x1013. Same width, 52%
# fewer pixels to send and to decode — and now they are all of the room instead
# of the middle half of it.
#
# 760 covers a 375px phone at 2x (needs 750) and a 430px phone at ~1.8x. 480
# covers the 1x phones. 1280 is the desktop tier; without it every desktop took
# the 1920, which stays as the source of truth and the top of the set.
LANDING_EDGES = (1280, 760, 480)

# Derivatives of a crop that no longer exists. Removed on the next run so they
# stop shipping: 143KB of a picture the page does not reference.
LANDING_STALE = ("cafe-interior-portrait-480.webp", "cafe-interior-portrait-760.webp")


def landing():
    """Derive the landing photo's responsive set from the one full-size file.

    assets/cafe-interior.webp stays the source of truth and is never rewritten
    — it is what the desktop still serves and what a future re-crop comes from.
    """
    if not os.path.isfile(LANDING_SRC):
        print("landing: %s missing, skipped" % os.path.basename(LANDING_SRC))
        return 0

    stem = os.path.splitext(LANDING_SRC)[0]
    folder = os.path.dirname(LANDING_SRC)

    for name in LANDING_STALE:
        stale = os.path.join(folder, name)
        if os.path.exists(stale):
            os.remove(stale)
            print("  landing: removed %s (crop no longer used)" % name)

    written = 0
    for edge in LANDING_EDGES:
        dst = "%s-%d.webp" % (stem, edge)
        # Same idempotence rule as the menu loop above.
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(LANDING_SRC):
            continue

        with Image.open(LANDING_SRC) as im:
            im = im.convert("RGB")
            # thumbnail() constrains the longer side, which on a landscape
            # source is the width — and it never upscales, so a tier wider than
            # the file would simply re-encode it at its own size.
            im.thumbnail((edge, edge), Image.LANCZOS)
            size = im.size
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=QUALITY, method=6)

        with open(dst, "wb") as fh:
            fh.write(buf.getvalue())
        print("  landing: %s  %dx%d  %d KB"
              % (os.path.basename(dst), size[0], size[1], len(buf.getvalue()) // 1024))
        written += 1
    return written


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)

    names = sorted(
        n for n in os.listdir(SRC)
        if os.path.splitext(n)[1].lower() in SOURCES
        and os.path.isfile(os.path.join(SRC, n))
    )

    before = after = 0
    written = skipped = 0
    for name in names:
        src = os.path.join(SRC, name)
        stem = os.path.splitext(name)[0]
        before += os.path.getsize(src)

        for edge in EDGES:
            dst = os.path.join(OUT, variant(stem, edge))

            # Idempotent: an output newer than its source is already current, so
            # a rebuild after adding one photo doesn't re-encode the other fifty-
            # nine. Per width, so adding a width only encodes the missing one.
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                after += os.path.getsize(dst)
                skipped += 1
                continue

            with Image.open(src) as im:
                im = im.convert("RGB")
                # thumbnail() is a no-op on anything already at or under edge, so
                # a smaller source is re-encoded but never upscaled into blur.
                im.thumbnail((edge, edge), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=QUALITY, method=6)

            with open(dst, "wb") as fh:
                fh.write(buf.getvalue())
            after += len(buf.getvalue())
            written += 1

    written += landing()

    mb = lambda n: round(n / 1048576.0, 2)
    print("wrote %d, skipped %d (already current)" % (written, skipped))
    print("menu: %s MB -> %s MB" % (mb(before), mb(after)))


if __name__ == "__main__":
    main()
