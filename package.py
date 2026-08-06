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

import io
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "lcafe-site.zip")

# Files at the root that the host serves. .htaccess carries the redirects, the
# 404 page, compression and cache policy.
#
# support.js is NOT here. It is the design-canvas runtime loader, and build.py
# strips its <script> from both published pages - so shipping it put 69 KB on
# the host that no page has ever requested. It is still needed locally, where
# the canvas tool opens the .dc.html sources directly.
ROOT_FILES = (
    ".htaccess",
    "404.html",
    "index.html",
    "menu.html",
    "robots.txt",
    "sitemap.xml",
)

# Root files that ship only when a published page still asks for them, and the
# token that proves it does.
#
# image-slot.js and photo-tryout.js drive <image-slot>, and .image-slots.state.json
# is the sidecar the first of those fetches on every page load. build.py now
# rewrites the last <image-slot> on either page into plain <img>/<picture>, so
# all three have no caller left - 77 KB of authoring machinery and one round
# trip per visit, for pages that no longer contain the element it authors.
#
# Derived from the built pages rather than listed, because `py build.py
# --keep-image-slot` puts the elements back for the phone photo-tryout loop.
# A hard-coded list is wrong in one direction or the other after that flag, and
# the direction it was wrong in before was shipping dead weight silently.
CONDITIONAL_ROOT = {
    "image-slot.js": "image-slot.js",
    "photo-tryout.js": "photo-tryout.js",
    ".image-slots.state.json": "image-slot.js",
}

# The pages whose markup decides the above.
PUBLISHED = ("index.html", "menu.html")

# Directories copied whole, by extension. assets/menu itself is excluded: the
# originals there are ten times the pixels a tile shows and only assets/menu/opt
# is ever requested.
#
# assets/vendor is excluded for the same reason as support.js: it is React,
# ReactDOM and Babel for the canvas runtime, reached only through the
# window.__resources override that build.py strips. 3.2 MB - 3 of it Babel -
# that no published page has ever asked for. It stays in the repo, where the
# tool opening a .dc.html still needs it.
TREES = (
    ("assets/fonts", (".css", ".woff2")),
    ("assets/menu/opt", (".webp",)),
    ("uploads", (".svg",)),
)

# Loose files in assets/. cafe-interior.jpg is not in any src attribute - it is
# the og:image, fetched by Telegram and WhatsApp when the link is shared - so a
# reference scan alone misses it.
#
# The three derived cafe-interior files are the landing photo's responsive set,
# written by optimize_images.py: a portrait crop at two widths for the phone,
# where the frame is portrait and the 1920 landscape lost half its width to the
# crop, and a 1280 tier so a desktop stops taking the 1920. The 1920 stays - it
# is both the widest tier and the source the other three are derived from.
ASSET_FILES = (
    "assets/cafe-interior.jpg",
    "assets/cafe-interior.webp",
    "assets/cafe-interior-1280.webp",
    "assets/cafe-interior-portrait-480.webp",
    "assets/cafe-interior-portrait-760.webp",
    "assets/favicon.svg",
    "assets/icon-180.png",
    "assets/icon-512.png",
    "assets/l-cafe-pattern-inverted-tight.svg",
)


def collect():
    names = []
    for name in ROOT_FILES:
        names.append(name)

    markup = ""
    for page in PUBLISHED:
        with io.open(os.path.join(HERE, page), encoding="utf-8") as fh:
            markup += fh.read()
    for name, token in sorted(CONDITIONAL_ROOT.items()):
        if 'src="./%s"' % token in markup or 'src="%s"' % token in markup:
            names.append(name)
        else:
            print("  not needed by either page, skipping: %s" % name)

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
