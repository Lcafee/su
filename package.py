"""Build a manual-upload ZIP from the Vite production output.

Run `npm run build` first. The archive preserves forward-slash entry names so
cPanel/Linux extracts the static site with its asset directories intact.
"""

import os
import zipfile


HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
OUT = os.path.join(HERE, "lcafe-site.zip")


def collect():
    """Return every file Vite produced, relative to the deployment root."""
    if not os.path.isdir(DIST):
        raise SystemExit("dist/ is missing. Run: npm run build")

    names = []
    for directory, dirnames, filenames in os.walk(DIST):
        dirnames.sort()
        for filename in sorted(filenames):
            path = os.path.join(directory, filename)
            names.append(os.path.relpath(path, DIST).replace(os.sep, "/"))
    return names


def source_path(name):
    """Resolve one deployment-relative path inside dist/."""
    return os.path.join(DIST, name.replace("/", os.sep))


def main():
    names = collect()
    if not names:
        raise SystemExit("dist/ is empty. Run: npm run build")

    missing = [name for name in names if not os.path.isfile(source_path(name))]
    if missing:
        raise SystemExit("missing, refusing to package:\n  " + "\n  ".join(missing))

    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in names:
            archive.write(source_path(name), arcname=name)

    with zipfile.ZipFile(OUT) as archive:
        entries = archive.namelist()
        bad = [entry for entry in entries if "\\" in entry]
        if bad:
            raise SystemExit(
                "backslash in entry name, host would flatten these:\n  "
                + "\n  ".join(bad)
            )
        empty = [item.filename for item in archive.infolist() if item.file_size == 0]
        if empty:
            raise SystemExit("zero-byte entries:\n  " + "\n  ".join(empty))

    photos = sum(1 for entry in entries if entry.startswith("assets/menu/opt/"))
    size = os.path.getsize(OUT) / 1048576.0
    print(
        "%s: %d files (%d menu photos), %.1f MB"
        % (os.path.basename(OUT), len(entries), photos, size)
    )


if __name__ == "__main__":
    main()
