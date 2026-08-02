"""Generate the web-sized menu photos the pages actually serve.

The originals in assets/menu are 1300px square, which is roughly ten times the
pixels a menu tile ever shows. They stay where they are — this writes a second,
smaller copy of each into assets/menu/opt and the pages point at those. Keeping
both means a re-crop or a bigger layout can be re-derived from the source
instead of from an already-downscaled file.

Run after adding or replacing a photo:  py optimize_images.py
"""

import io
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets", "menu")
OUT = os.path.join(SRC, "opt")

# Menu tiles are two-up and cap out around 280 CSS px, so 600 covers a 2x
# display with room to spare. Past that the file grows and nothing looks better.
EDGE = 600
QUALITY = 78
SOURCES = (".jpeg", ".jpg", ".png", ".webp")


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
        dst = os.path.join(OUT, os.path.splitext(name)[0] + ".webp")
        before += os.path.getsize(src)

        # Idempotent: an output newer than its source is already current, so a
        # rebuild after adding one photo doesn't re-encode the other fifty-nine.
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            after += os.path.getsize(dst)
            skipped += 1
            continue

        with Image.open(src) as im:
            im = im.convert("RGB")
            # thumbnail() is a no-op on anything already at or under EDGE, so a
            # smaller source is re-encoded but never upscaled into blur.
            im.thumbnail((EDGE, EDGE), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=QUALITY, method=6)

        with open(dst, "wb") as fh:
            fh.write(buf.getvalue())
        after += len(buf.getvalue())
        written += 1

    mb = lambda n: round(n / 1048576.0, 2)
    print("wrote %d, skipped %d (already current)" % (written, skipped))
    print("%s MB -> %s MB" % (mb(before), mb(after)))


if __name__ == "__main__":
    main()
