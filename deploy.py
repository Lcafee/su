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
The first run therefore uploads the full approved release; later ones usually upload one.
Changed files are fully staged and size-checked under temporary remote names
before any live path is replaced. Promotion is dependency-safe: assets and
configuration are switched first and HTML entry points last, so a new page
never references a bundle that has not arrived yet. Nothing is ever deleted
from the host except deploy-owned temporary files: a pruning sync can empty
public_html on a bad day, and the served set otherwise only grows.

Setup:  copy .deploy.ini.example to .deploy.ini and fill it in
Local release preview (no connection):           py deploy.py --dry-run
Read-only approved-release/live comparison:      py deploy.py --check-remote
Run after explicit deployment authorization:     py deploy.py [--all]
First deploy from an older .htaccess: confirm the target, then use
                              py deploy.py --bootstrap-htaccess
"""

import argparse
import configparser
import ftplib
import hashlib
import io
import json
import os
import posixpath
import socket
import ssl
import subprocess
import sys

import package
from htaccess_ownership import (
    STAGING_DENY_MARKER,
    HtaccessOwnershipError,
    compose_htaccess as compose_owned_htaccess,
    split_host_runtime_block as split_owned_host_runtime_block,
    validate_release_payload,
)

HERE = os.path.dirname(os.path.abspath(__file__))
CONF = os.path.join(HERE, ".deploy.ini")
STATE = os.path.join(HERE, ".deploy-state.json")


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


HTML_ENTRY_POINTS = {"index.html", "menu.html", "404.html"}
STAGING_SUFFIX = ".lcafe-uploading"


def deploy_order_key(name):
    """Promote access rules and dependencies before their public entry points."""
    if name in {".htaccess", "api/.htaccess"}:
        phase = 0
    elif name.startswith(("assets/", "uploads/", "admin/assets/", "api/_app/")):
        phase = 1
    elif name == "api/index.php":
        phase = 3
    elif name in HTML_ENTRY_POINTS or name.endswith(".html"):
        phase = 4
    else:
        phase = 2
    return (phase, name)


def staging_name(name):
    """Keep a deploy-owned temporary file beside its final destination."""
    directory, filename = posixpath.split(name)
    staged = ".%s%s" % (filename, STAGING_SUFFIX)
    return posixpath.join(directory, staged) if directory else staged


def remove_if_present(ftp, remote):
    try:
        ftp.delete(remote)
    except ftplib.error_perm:
        pass


def read_remote_file(ftp, remote):
    """Return remote bytes, or None when the path does not exist/is unreadable."""
    chunks = []
    try:
        ftp.retrbinary("RETR " + remote, chunks.append)
    except ftplib.error_perm:
        return None
    return b"".join(chunks)


def release_htaccess_payload():
    """Return the release-owned portion and reject host state in Git output."""
    with open(package.source_path(".htaccess"), "rb") as source:
        payload = source.read()
    try:
        return validate_release_payload(payload)
    except HtaccessOwnershipError as error:
        fail(str(error))


def split_host_runtime_block(payload):
    """Return (code-owned bytes, fenced host block), failing on unsafe syntax.

    The host block must be the final non-whitespace block. Its bytes from the
    begin marker through the end marker are opaque and are never interpreted,
    logged, hashed into release metadata, or sourced from Git.
    """
    try:
        return split_owned_host_runtime_block(payload)
    except HtaccessOwnershipError as error:
        message = str(error).replace("live .htaccess", "remote .htaccess")
        fail(message)


def compose_htaccess(code_owned, host_owned):
    """Compose a deterministic live file without changing host-owned bytes."""
    try:
        return compose_owned_htaccess(code_owned, host_owned)
    except HtaccessOwnershipError as error:
        fail(str(error))


def remote_htaccess_state(ftp):
    payload = read_remote_file(ftp, ".htaccess")
    code_owned, host_owned = split_host_runtime_block(payload)
    return payload, code_owned, host_owned


def remote_staging_protected(ftp):
    """Prove valid host ownership and denial of deploy temporary files."""
    _, code_owned, _ = remote_htaccess_state(ftp)
    return all(
        token in code_owned
        for token in (
            STAGING_DENY_MARKER,
            b'<FilesMatch "\\.lcafe-uploading$">',
            b"Require all denied",
        )
    )


def install_staging_protection(ftp):
    """Install release rules while preserving the required host block.

    This intentionally writes the final .htaccess path directly rather than
    creating a public temporary file before the deny rule exists. It is only
    used when the operator explicitly requests --bootstrap-htaccess (or --new).
    The previous file is kept in memory and restored on a verified failure while
    the control connection is still available.
    """
    previous = read_remote_file(ftp, ".htaccess")
    _, host_owned = split_host_runtime_block(previous)
    payload = compose_htaccess(release_htaccess_payload(), host_owned)
    try:
        ftp.storbinary("STOR .htaccess", io.BytesIO(payload))
        actual = ftp.size(".htaccess")
        if actual != len(payload):
            raise RuntimeError("remote .htaccess is %r bytes; expected %d" % (actual, len(payload)))
        installed = read_remote_file(ftp, ".htaccess")
        if installed is None:
            raise RuntimeError("remote .htaccess became unreadable")
        installed_code, installed_host = split_host_runtime_block(installed)
        if installed_code != release_htaccess_payload():
            raise RuntimeError("remote .htaccess code-managed portion did not verify")
        if installed_host != host_owned:
            raise RuntimeError("remote .htaccess host runtime block changed")
    except (ftplib.Error, OSError, RuntimeError, SystemExit) as e:
        try:
            if previous is None:
                remove_if_present(ftp, ".htaccess")
            else:
                ftp.storbinary("STOR .htaccess", io.BytesIO(previous))
        except (ftplib.Error, OSError):
            pass
        fail("could not bootstrap staging protection: %s" % e)


def ensure_staging_protection(ftp, allow_bootstrap):
    """Never create a .lcafe-uploading file until HTTP denial is live."""
    if remote_staging_protected(ftp):
        return False
    if not allow_bootstrap:
        fail(
            "remote .htaccess does not yet deny *.lcafe-uploading files.\n"
            "        After confirming the target and its fenced host runtime block, "
            "run once with --bootstrap-htaccess to install only the release-owned rules."
        )
    install_staging_protection(ftp)
    if not remote_staging_protected(ftp):
        fail("staging protection bootstrap did not verify on the remote host")
    return True


def cleanup_staging_files(ftp, names):
    """Best-effort removal of abandoned deploy-owned temporary files."""
    leftover = []
    for name in sorted(set(names)):
        remote = staging_name(name)
        try:
            ftp.delete(remote)
        except ftplib.error_perm:
            continue
        except (ftplib.Error, OSError):
            leftover.append(remote)
    return leftover


def stage_file(ftp, name, payload=None):
    """Upload one complete file without touching its live path."""
    path = package.source_path(name)
    staged = staging_name(name)
    remove_if_present(ftp, staged)

    if payload is None:
        with open(path, "rb") as fh:
            ftp.storbinary("STOR " + staged, fh)
        expected = os.path.getsize(path)
    else:
        ftp.storbinary("STOR " + staged, io.BytesIO(payload))
        expected = len(payload)

    try:
        actual = ftp.size(staged)
    except (ftplib.Error, OSError) as e:
        remove_if_present(ftp, staged)
        fail(
            "%s staged, but the server could not verify its size (%s).\n"
            "        Safe deploys require FTP SIZE support so a short upload "
            "cannot be promoted live." % (name, e)
        )
    if actual != expected:
        remove_if_present(ftp, staged)
        fail("%s staged short: %d of %d bytes" % (name, actual, expected))
    return staged


def promote_staged(ftp, name):
    """Atomically replace a live path with its fully uploaded staged file.

    RNFR/RNTO on the cPanel/POSIX FTP target is the atomic boundary. If the
    server refuses replacement, stop rather than deleting the live file and
    opening a broken-site window.
    """
    staged = staging_name(name)
    try:
        ftp.rename(staged, name)
    except ftplib.error_perm as e:
        remove_if_present(ftp, staged)
        fail(
            "cannot atomically replace %s on the host: %s\n"
            "        The live file was left untouched. The FTP server must "
            "support RNFR/RNTO replacement for safe deploys." % (name, e)
        )


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def bytes_digest(payload):
    """Return the SHA-256 of bytes already retrieved from the host."""
    return hashlib.sha256(payload).hexdigest()


def check_remote_release(ftp, names, local):
    """Compare the complete approved served set without changing remote state."""
    matched = []
    missing = []
    mismatched = []
    for index, name in enumerate(names, 1):
        payload = read_remote_file(ftp, name)
        if payload is None:
            missing.append(name)
            result = "missing/unreadable"
        elif name == ".htaccess":
            code_owned, _ = split_host_runtime_block(payload)
            if bytes_digest(code_owned) != local[name]:
                mismatched.append(name)
                result = "CODE PORTION DIFFERS"
            else:
                matched.append(name)
                result = "matches; host runtime block preserved"
        elif bytes_digest(payload) != local[name]:
            mismatched.append(name)
            result = "DIFFERS"
        else:
            matched.append(name)
            result = "matches"
        print("  checked [%d/%d] %s: %s" % (index, len(names), name, result))
    return matched, missing, mismatched


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

    # Every failure below is one a correct setup still hits on the way in, and
    # each has a different fix. Left to propagate they arrive as a Python
    # traceback whose last line names an SSL internal - which says nothing about
    # what to change, in a script whose whole job is to be run by someone who
    # should not have to read ftplib to use it.
    ftp = ftplib.FTP_TLS(context=context, timeout=30)
    try:
        ftp.connect(conf["host"], conf["port"])
    except socket.gaierror:
        fail("cannot find the server %s\n"
             "        Check the host line in .deploy.ini. cPanel shows the right "
             "value under FTP Accounts -> Configure FTP Client." % conf["host"])
    except (socket.timeout, TimeoutError):
        fail("%s did not answer on port %d within 30s.\n"
             "        The host may block FTP from outside its network, or a "
             "firewall here may be closing it." % (conf["host"], conf["port"]))
    except OSError as e:
        fail("cannot reach %s on port %d: %s" % (conf["host"], conf["port"], e))

    try:
        ftp.login(conf["user"], conf["password"])
    except ssl.SSLCertVerificationError as e:
        # Shared hosting usually presents the server's own certificate, or a
        # self-signed one, rather than one issued for the customer's domain.
        # The connection is encrypted either way; verification is what fails.
        fail("the host's TLS certificate did not verify: %s\n"
             "        Prefer the hosting provider's FTPS hostname whose certificate "
             "matches. Only use verify = no as an explicit last-resort exception."
             % e.verify_message)
    except ftplib.error_perm as e:
        fail("the host rejected the login: %s\n"
             "        The username usually has to include the domain, as in "
             "name@l-cafe.ir, not just name." % e)
    except OSError as e:
        fail("the connection dropped during login: %s" % e)

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


def run_remote_check(ftp, conf, names, local):
    """Audit the approved served set and close the read-only FTPS session."""
    try:
        directory = conf["directory"].rstrip("/") or "."
        here = enter_target(ftp, directory)
        print("deploy: connected read-only to %s at %s" % (conf["host"], here))
        protected = remote_staging_protected(ftp)
        print(
            "deploy: staging protection %s"
            % ("verified" if protected else "MISSING OR UNREADABLE")
        )
        matched, missing, mismatched = check_remote_release(ftp, names, local)
    finally:
        try:
            ftp.quit()
        except (ftplib.Error, OSError):
            pass

    print(
        "deploy: remote comparison: %d match, %d missing/unreadable, %d differ"
        % (len(matched), len(missing), len(mismatched))
    )
    if not protected or missing or mismatched:
        fail(
            "remote state does not exactly match the approved release; "
            "nothing was changed"
        )
    print("deploy: remote served set exactly matches the approved release")


def main():
    ap = argparse.ArgumentParser(description="Upload the site to the host.")
    ap.add_argument("--all", action="store_true",
                    help="upload every file, ignoring the change record")
    ap.add_argument("--dry-run", action="store_true",
                    help="locally show what would be uploaded; never connect")
    ap.add_argument(
        "--check-remote",
        action="store_true",
        help="connect read-only and compare every approved release file with the host",
    )
    ap.add_argument("--new", action="store_true",
                    help="allow uploading into a directory the site is not in yet")
    ap.add_argument(
        "--bootstrap-htaccess",
        action="store_true",
        help=(
            "one-time install of release-owned .htaccess rules while preserving "
            "an existing fenced host runtime block"
        ),
    )
    args = ap.parse_args()

    if args.check_remote and any(
        (args.all, args.dry_run, args.new, args.bootstrap_htaccess)
    ):
        fail("--check-remote cannot be combined with upload options")

    guard_untracked()
    try:
        release = package.verify_release()
    except SystemExit as error:
        fail(str(error))
    print("deploy: approved release %s" % release["gitCommit"])

    names = package.collect(include_host_owned=True)
    missing = [n for n in names if not os.path.isfile(package.source_path(n))]
    if missing:
        fail("missing locally, refusing to upload:\n  " + "\n  ".join(missing))

    state = {} if args.all else load_state()
    local = {n: digest(package.source_path(n)) for n in names}
    changed = sorted(
        (n for n in names if state.get(n) != local[n]),
        key=deploy_order_key,
    )

    if not changed and not args.check_remote:
        print("deploy: nothing changed since the last upload")
        return

    if not args.check_remote:
        print("deploy: %d of %d files to upload" % (len(changed), len(names)))
        for name in changed:
            print("  " + name)
        if args.dry_run:
            print("deploy: local dry run, no host connection attempted")
            return

    # Read last, so --dry-run answers "what would go up" before any credentials
    # exist - which is the run you want available while still setting this up.
    conf = load_config()
    if not conf["verify"]:
        print(
            "deploy: WARNING: TLS certificate verification is disabled; "
            "the transfer is encrypted but the server identity is not verified."
        )
    ftp = connect(conf)
    if args.check_remote:
        run_remote_check(ftp, conf, names, local)
        return

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

        # Security boundary: no deploy-owned temporary file may exist until the
        # live .htaccess is proven to deny direct HTTP requests for the suffix.
        # A first/new deployment can bootstrap the rule explicitly; otherwise an
        # unprotected remote configuration is a hard stop before staging begins.
        bootstrapped = ensure_staging_protection(ftp, args.bootstrap_htaccess)
        if bootstrapped:
            state[".htaccess"] = local[".htaccess"]
            if ".htaccess" in changed:
                changed.remove(".htaccess")
                sent += 1
            print("  installed and verified staging protection (.htaccess)")

        # Remove leftovers from interrupted earlier attempts before creating any
        # new staging file. State keys cover files that may have since left the release.
        leftovers = cleanup_staging_files(ftp, set(names) | set(state))
        if leftovers:
            fail("could not clean abandoned staging files:\n  " + "\n  ".join(leftovers))

        # Phase 1: transfer and verify every changed byte under a temporary name.
        # A dropped data connection cannot corrupt a live file in this phase.
        pending_staged = set()
        for index, name in enumerate(changed, 1):
            payload = None
            if name == ".htaccess":
                _, _, host_owned = remote_htaccess_state(ftp)
                payload = compose_htaccess(release_htaccess_payload(), host_owned)
            staged = stage_file(ftp, name, payload=payload)
            pending_staged.add(name)
            print("  staged [%d/%d] %s" % (index, len(changed), name))

        # Phase 2: short RNFR/RNTO promotions only. Dependencies are already on
        # the server and are promoted before HTML, preserving referential safety
        # even if the control connection fails partway through promotion.
        for name in changed:
            promote_staged(ftp, name)
            pending_staged.discard(name)
            state[name] = local[name]
            sent += 1
            print("  promoted [%d/%d] %s" % (sent, len(changed), name))
    finally:
        # Remove verified-but-unpromoted files after failures. If the control
        # connection itself died, the next run performs the same cleanup before
        # it stages anything new.
        if "pending_staged" in locals() and pending_staged:
            leftovers = cleanup_staging_files(ftp, pending_staged)
            if leftovers:
                print(
                    "deploy: WARNING: could not remove staging files; the next run "
                    "will retry cleanup:\n  " + "\n  ".join(leftovers),
                    file=sys.stderr,
                )

        # Written even on failure, so an interrupted run resumes rather than
        # restarting the complete upload.
        save_state(state)
        try:
            ftp.quit()
        except (ftplib.Error, OSError):
            pass

    print("deploy: %d files uploaded to %s" % (sent, conf["host"]))


if __name__ == "__main__":
    main()
