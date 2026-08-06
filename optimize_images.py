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

# Measured in the browser, not guessed. The frame is not one shape:
#
#   375x812 phone   ->  375 x 503   (full-bleed, height:62vh)      ratio 0.75
#   1280x900        -> 1162 x 792   (inset 8vw, height:60vw+75px)  ratio 1.47
#
# The source is 1920x1220, landscape. Poured into the phone's PORTRAIT frame
# with object-fit:cover, 52.6% of its width is cropped away and never reaches
# the screen — so the phone was downloading ~146KB of the 277KB file to throw
# it out. A second width cannot fix that; only a second CROP can.
#
# 3:4 is the crop the phone frame actually wants (0.75 against its measured
# 0.745), centred, which is where this photo's content sits: the mural, the
# banquettes and the sconces all survive it.
PORTRAIT_RATIO = 0.75
# 760 covers a 375px phone at 2x (needs 750) and a 430px phone at ~1.8x. 480
# covers the 1x phones. A 1140 tier for 3x devices was measured at 142KB and
# dropped: on the mobile data this menu is read over, the extra sharpness is
# not worth 50KB over the 760 those screens downscale perfectly well.
PORTRAIT_EDGES = (760, 480)
# Wider than 640 the frame is landscape again and the existing 1920 file is
# already right for it (measured oversample 1.03 at 1280/1.5x). 1280 is the
# tier that was missing: without it every desktop took the 1920.
LANDSCAPE_EDGES = (1280,)


def landing():
    """Derive the landing photo's responsive set from the one full-size file.

    assets/cafe-interior.webp stays the source of truth and is never rewritten
    — it is what the desktop still serves and what a future re-crop comes from.
    """
    if not os.path.isfile(LANDING_SRC):
        print("landing: %s missing, skipped" % os.path.basename(LANDING_SRC))
        return 0

    stem = os.path.splitext(LANDING_SRC)[0]
    jobs = []
    for edge in PORTRAIT_EDGES:
        jobs.append(("%s-portrait-%d.webp" % (stem, edge), edge, True))
    for edge in LANDSCAPE_EDGES:
        jobs.append(("%s-%d.webp" % (stem, edge), edge, False))

    written = 0
    for dst, edge, portrait in jobs:
        # Same idempotence rule as the menu loop above.
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(LANDING_SRC):
            continue

        with Image.open(LANDING_SRC) as im:
            im = im.convert("RGB")
            if portrait:
                w, h = im.size
                keep = int(round(h * PORTRAIT_RATIO))
                left = (w - keep) // 2
                im = im.crop((left, 0, left + keep, h))
                im = im.resize((edge, int(round(edge / PORTRAIT_RATIO))), Image.LANCZOS)
            else:
                im.thumbnail((edge, edge), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=QUALITY, method=6)

        with open(dst, "wb") as fh:
            fh.write(buf.getvalue())
        print("  landing: %s  %d KB" % (os.path.basename(dst), len(buf.getvalue()) // 1024))
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
