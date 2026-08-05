"""Upload the served set to the host over FTPS, changed files only.

package.py already answers "which files does the host serve" - this imports
that answer rather than keeping a second copy of it, so a file added there is
deployed here with no edit.

Credentials live in .deploy.ini, which this script reads and never prints, and
which .gitignore excludes. The guard below refuses to run if git is tracking it
anyway: the failure mode of a committed password is silent and permanent, so it
is worth a check on every run rather than a line in the README.

FTPS, not FTP. Plain FTP puts the account password on the wire in cleartext,
and a cPanel FTP account is usually the cPanel account - the same credential
that owns everything else on the host.

Only changed files are sent, compared by SHA-256 against .deploy-state.json.
The first run therefore uploads all 87; later ones usually upload one. Nothing
is ever deleted from the host: a sync that prunes is a sync that can empty
public_html on a bad day, and the served set only ever grows.

Setup:  copy .deploy.ini.example to .deploy.ini and fill it in
Run after py build.py:  py deploy.py [--all] [--dry-run]
"""

import argparse
import configparser
import ftplib
import hashlib
import io
import json
import os
import ssl
import subprocess
import sys

import package

HERE = os.path.dirname(os.path.abspath(__file__))
CONF = os.path.join(HERE, ".deploy.ini")
STATE = os.path.join(HERE, ".deploy-state.json")

# A published page older than the file it is generated from means build.py has
# not been run since the last edit, and the upload would ship the previous
# version of a page the user believes they just fixed.
GENERATED = {
    "index.html": ("Landing Hero Background.dc.html",),
    "menu.html": ("Menu.dc.html", "menu.json"),
}


def fail(message):
    raise SystemExit("deploy: " + message)


def load_config():
    if not os.path.isfile(CONF):
        fail(".deploy.ini not found. Copy .deploy.ini.example to .deploy.ini "
             "and fill it in - it stays out of git.")

    # interpolation=None: configparser reads %% as an escape by default, and a
    # generated password containing % would otherwise either crash the parse or,
    # worse, arrive silently mangled and look like a wrong password.
    parser = configparser.ConfigParser(interpolation=None)
    with io.open(CONF, encoding="utf-8") as fh:
        parser.read_file(fh)

    if not parser.has_section("host"):
        fail(".deploy.ini has no [host] section")

    conf = {
        "host": parser.get("host", "host", fallback="").strip(),
        "user": parser.get("host", "user", fallback="").strip(),
        "password": parser.get("host", "password", fallback=""),
        "directory": parser.get("host", "directory", fallback="public_html").strip(),
        "port": parser.getint("host", "port", fallback=21),
        "verify": parser.getboolean("host", "verify", fallback=True),
    }
    for key in ("host", "user", "password"):
        if not conf[key]:
            fail(".deploy.ini is missing %s" % key)
    return conf


def guard_untracked():
    """Refuse to run if the credentials file is in git."""
    try:
        tracked = subprocess.call(
            ["git", "ls-files", "--error-unmatch", ".deploy.ini"],
            cwd=HERE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ) == 0
    except OSError:
        return  # no git on PATH; nothing to protect against here
    if tracked:
        fail(".deploy.ini is tracked by git. Run:  git rm --cached .deploy.ini\n"
             "        Then treat the password in it as leaked and change it.")


def guard_build_fresh():
    stale = []
    for out, sources in GENERATED.items():
        target = os.path.join(HERE, out)
        if not os.path.isfile(target):
            continue
        built = os.path.getmtime(target)
        for src in sources:
            path = os.path.join(HERE, src)
            if os.path.isfile(path) and os.path.getmtime(path) > built:
                stale.append("%s is newer than %s" % (src, out))
    if stale:
        fail("build is stale, refusing to upload:\n  " + "\n  ".join(stale) +
             "\n        Run:  py build.py")


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_state():
    if not os.path.isfile(STATE):
        return {}
    try:
        with io.open(STATE, encoding="utf-8") as fh:
            return json.load(fh)
    except (ValueError, OSError):
        # A corrupt state file must not wedge deploys; the cost of forgetting
        # is one full upload, and correctness here beats saving 2.6 MB.
        return {}


def save_state(state):
    with io.open(STATE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(state, indent=1, sort_keys=True))


def connect(conf):
    if conf["verify"]:
        context = ssl.create_default_context()
    else:
        # Shared hosts routinely serve a certificate for the server's own
        # hostname rather than the customer's domain, so verification fails on
        # a connection that is still encrypted. Opting out keeps the password
        # off the wire in cleartext, which is the property that matters most,
        # but it does drop the guarantee that the far end is who it claims.
        print("deploy: certificate verification OFF (verify = no)")
        context = ssl._create_unverified_context()

    ftp = ftplib.FTP_TLS(context=context, timeout=30)
    ftp.connect(conf["host"], conf["port"])
    ftp.login(conf["user"], conf["password"])
    ftp.prot_p()  # encrypt the data channel too, not just the login
    ftp.set_pasv(True)
    return ftp


def ensure_dirs(ftp, names):
    """Create every parent directory of the upload set, shallowest first."""
    wanted = set()
    for name in names:
        parts = name.split("/")[:-1]
        for i in range(1, len(parts) + 1):
            wanted.add("/".join(parts[:i]))
    for path in sorted(wanted, key=lambda p: p.count("/")):
        try:
            ftp.mkd(path)
        except ftplib.error_perm:
            pass  # already there, which is the common case


def enter_target(ftp, directory):
    """Move to the directory the site is served from and prove it is the one.

    The document root is not guessable. cPanel serves the primary domain from
    public_html on some accounts and from ~/<domain> on others, and an FTP
    account scoped to a directory is chrooted into it, so its own path is "/"
    once logged in - the absolute path from the control panel is then exactly
    the wrong thing to send.

    So: go where the config says, ask the server where that actually is, and
    refuse unless the site is already there. Uploading into the wrong directory
    fails silently - every transfer succeeds, the deploy reports 87 files sent,
    and the live site is untouched.
    """
    if directory not in ("", ".", "/"):
        try:
            ftp.cwd(directory)
        except ftplib.error_perm as e:
            fail("cannot enter %s on the host: %s\n"
                 "        If the FTP account is already scoped to the site, set "
                 "directory = . in .deploy.ini" % (directory, e))
    here = ftp.pwd()

    try:
        listing = set(ftp.nlst())
    except ftplib.error_perm:
        listing = set()  # empty directory on some servers

    landmarks = {"index.html", "menu.html", "404.html"}
    if not (landmarks & listing):
        fail("%s does not look like the site: none of %s are in it.\n"
             "        Contents: %s\n"
             "        Fix directory in .deploy.ini, or pass --new if this really "
             "is a first upload into an empty directory."
             % (here, ", ".join(sorted(landmarks)),
                ", ".join(sorted(listing)[:8]) or "(empty)"))
    return here


def main():
    ap = argparse.ArgumentParser(description="Upload the site to the host.")
    ap.add_argument("--all", action="store_true",
                    help="upload every file, ignoring the change record")
    ap.add_argument("--dry-run", action="store_true",
                    help="show what would be uploaded and stop")
    ap.add_argument("--new", action="store_true",
                    help="allow uploading into a directory the site is not in yet")
    args = ap.parse_args()

    guard_untracked()
    guard_build_fresh()

    names = package.collect()
    missing = [n for n in names
               if not os.path.isfile(os.path.join(HERE, n.replace("/", os.sep)))]
    if missing:
        fail("missing locally, refusing to upload:\n  " + "\n  ".join(missing))

    state = {} if args.all else load_state()
    local = {n: digest(os.path.join(HERE, n.replace("/", os.sep))) for n in names}
    changed = [n for n in names if state.get(n) != local[n]]

    if not changed:
        print("deploy: nothing changed since the last upload")
        return

    print("deploy: %d of %d files to upload" % (len(changed), len(names)))
    for name in changed:
        print("  " + name)
    if args.dry_run:
        print("deploy: dry run, nothing sent")
        return

    # Read last, so --dry-run answers "what would go up" before any credentials
    # exist - which is the run you want available while still setting this up.
    conf = load_config()
    ftp = connect(conf)
    sent = 0
    try:
        directory = conf["directory"].rstrip("/") or "."
        if args.new:
            if directory not in ("", ".", "/"):
                ftp.cwd(directory)
            here = ftp.pwd()
        else:
            here = enter_target(ftp, directory)
        print("deploy: connected to %s, uploading into %s" % (conf["host"], here))

        # Paths are relative from here on: the working directory is already the
        # site root, and a chrooted FTP account cannot name its own absolute one.
        ensure_dirs(ftp, changed)
        for name in changed:
            path = os.path.join(HERE, name.replace("/", os.sep))
            remote = name
            with open(path, "rb") as fh:
                ftp.storbinary("STOR " + remote, fh)

            # A transfer that dies midway still leaves a file behind, and the
            # state record would then call it uploaded. Comparing sizes catches
            # the truncation while the connection is still open to retry.
            expected = os.path.getsize(path)
            try:
                actual = ftp.size(remote)
            except (ftplib.Error, OSError):
                actual = None  # server without SIZE; upload stands unverified
            if actual is not None and actual != expected:
                fail("%s uploaded short: %d of %d bytes" % (name, actual, expected))

            state[name] = local[name]
            sent += 1
            print("  [%d/%d] %s" % (sent, len(changed), name))
    finally:
        # Written even on failure, so an interrupted run resumes rather than
        # starting the 2.6 MB over.
        save_state(state)
        try:
            ftp.quit()
        except (ftplib.Error, OSError):
            pass

    print("deploy: %d files uploaded to %s" % (sent, conf["host"]))


if __name__ == "__main__":
    main()
