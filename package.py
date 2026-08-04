"""Build the upload archive: exactly the files a browser asks for, nothing else.

The repository root holds the .dc.html sources, the Python scripts and the raw
1300px photos alongside the generated pages. None of that belongs on the host,
so this copies out the served set and zips it.

Written with zipfile rather than Compress-Archive on purpose. Windows
PowerShell 5.1 writes ZIP entry names with backslashes, which the format does
not allow (APPNOTE 4.4.17.1: "forward slashes"). Windows tolerates its own
output, so the archive looks fine locally - but cPanel extracts on Linux, where
"assets\\menu\\opt\\x.webp" is a single filename with no directories in it. The
pages then load (they sit at the root) while every photo, font and script 404s.
That failure already shipped once; the assertion below is what keeps it fixed.

Run after py build.py:  py package.py
"""

import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "lcafe-site.zip")

# Files at the root that the host serves. .htaccess carries the 404 page,
# compression and cache policy; .image-slots.state.json is fetched by
# image-slot.js on every page load, so its absence is a console error.
ROOT_FILES = (
    ".htaccess",
    ".image-slots.state.json",
    "404.html",
    "index.html",
    "menu.html",
    "robots.txt",
    "sitemap.xml",
    "image-slot.js",
    "support.js",
)

# Directories copied whole, by extension. assets/menu itself is excluded: the
# originals there are ten times the pixels a tile shows and only assets/menu/opt
# is ever requested.
TREES = (
    ("assets/fonts", (".css", ".woff2")),
    ("assets/vendor", (".js",)),
    ("assets/menu/opt", (".webp",)),
    ("uploads", (".svg",)),
)

# Loose files in assets/. cafe-interior.jpg is not in any src attribute - it is
# the og:image, fetched by Telegram and WhatsApp when the link is shared - so a
# reference scan alone misses it.
ASSET_FILES = (
    "assets/cafe-interior.jpg",
    "assets/cafe-interior.webp",
    "assets/favicon.svg",
    "assets/icon-180.png",
    "assets/icon-512.png",
    "assets/l-cafe-pattern-inverted-tight.svg",
)


def collect():
    names = []
    for name in ROOT_FILES:
        names.append(name)
    for name in ASSET_FILES:
        names.append(name)
    for tree, exts in TREES:
        directory = os.path.join(HERE, tree.replace("/", os.sep))
        for entry in sorted(os.listdir(directory)):
            if entry.lower().endswith(exts) and os.path.isfile(os.path.join(directory, entry)):
                names.append("%s/%s" % (tree, entry))
    return names


def main():
    names = collect()

    missing = [n for n in names if not os.path.isfile(os.path.join(HERE, n.replace("/", os.sep)))]
    if missing:
        raise SystemExit("missing, refusing to package:\n  " + "\n  ".join(missing))

    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in names:
            zf.write(os.path.join(HERE, name.replace("/", os.sep)), arcname=name)

    with zipfile.ZipFile(OUT) as zf:
        entries = zf.namelist()
        bad = [e for e in entries if "\\" in e]
        if bad:
            raise SystemExit("backslash in entry name, host would flatten these:\n  "
                             + "\n  ".join(bad))
        empty = [i.filename for i in zf.infolist() if i.file_size == 0]
        if empty:
            raise SystemExit("zero-byte entries:\n  " + "\n  ".join(empty))

    photos = sum(1 for e in entries if e.startswith("assets/menu/opt/"))
    size = os.path.getsize(OUT) / 1048576.0
    print("%s: %d files (%d menu photos), %.1f MB" % (os.path.basename(OUT), len(entries), photos, size))


if __name__ == "__main__":
    main()
