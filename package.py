"""Build a manual-upload ZIP from the approved release artifact.

Run the explicitly approved release-generation command first. The archive
preserves forward-slash entry names so cPanel/Linux extracts the static site
with its asset directories intact.
"""

import hashlib
import io
import json
import os
import re
import subprocess
import zipfile


HERE = os.path.dirname(os.path.abspath(__file__))
RELEASE = os.path.join(HERE, "release", "current")
OUT = os.path.join(HERE, "lcafe-site.zip")
RELEASE_MANIFEST = os.path.join(RELEASE, ".lcafe-release.json")
INTERNAL_RELEASE_FILES = {".lcafe-build.json", ".lcafe-release.json"}


def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(65536), b""):
            value.update(chunk)
    return value.hexdigest()


def verify_release():
    """Return metadata after proving release/current is an intact Git artifact."""
    if not os.path.isfile(RELEASE_MANIFEST):
        raise SystemExit(
            "approved release is missing. Run: npm run release:generate -- "
            "--approve <full-commit-sha>"
        )

    try:
        with io.open(RELEASE_MANIFEST, encoding="utf-8") as source:
            manifest = json.load(source)
        commit = manifest["gitCommit"]
        recorded = manifest["files"]
        if manifest.get("version") != 1 or not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("unsupported manifest")
        if not isinstance(recorded, dict) or not recorded:
            raise ValueError("empty file record")
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise SystemExit("approved release manifest is invalid: %s" % error)

    commit_exists = subprocess.call(
        ["git", "cat-file", "-e", commit + "^{commit}"],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ) == 0
    if not commit_exists:
        raise SystemExit("approved release commit is not available locally: " + commit)

    try:
        build_manifest_path = os.path.join(RELEASE, ".lcafe-build.json")
        with io.open(build_manifest_path, encoding="utf-8") as source:
            build_manifest = json.load(source)
        if build_manifest.get("version") != 1:
            raise ValueError("unsupported build manifest")
        if build_manifest.get("gitCommit") != commit:
            raise ValueError("build and release commit records differ")
    except (TypeError, ValueError, OSError) as error:
        raise SystemExit("approved release build manifest is invalid: %s" % error)

    actual = set()
    for directory, dirnames, filenames in os.walk(RELEASE):
        dirnames.sort()
        for filename in sorted(filenames):
            path = os.path.join(directory, filename)
            relative = os.path.relpath(path, RELEASE).replace(os.sep, "/")
            if relative != ".lcafe-release.json":
                actual.add(relative)

    expected = set(recorded)
    if actual != expected:
        changed = sorted(actual ^ expected)
        raise SystemExit(
            "approved release file set was edited; regenerate it:\n  "
            + "\n  ".join(changed)
        )
    changed = [
        name
        for name in sorted(actual)
        if digest(os.path.join(RELEASE, name.replace("/", os.sep))) != recorded[name]
    ]
    if changed:
        raise SystemExit(
            "approved release files were edited; regenerate them:\n  "
            + "\n  ".join(changed)
        )
    return manifest


def collect():
    """Return every public file in the approved release."""
    if not os.path.isdir(RELEASE):
        raise SystemExit("approved release is missing; generate it first")

    names = []
    for directory, dirnames, filenames in os.walk(RELEASE):
        dirnames.sort()
        for filename in sorted(filenames):
            path = os.path.join(directory, filename)
            relative = os.path.relpath(path, RELEASE).replace(os.sep, "/")
            if relative in INTERNAL_RELEASE_FILES:
                continue
            names.append(relative)
    return names


def source_path(name):
    """Resolve one deployment-relative path inside release/current/."""
    return os.path.join(RELEASE, name.replace("/", os.sep))


def main():
    release = verify_release()
    names = collect()
    if not names:
        raise SystemExit("approved release is empty; regenerate it")

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
        "%s: release %.12s, %d files (%d menu photos), %.1f MB"
        % (os.path.basename(OUT), release["gitCommit"], len(entries), photos, size)
    )


if __name__ == "__main__":
    main()
