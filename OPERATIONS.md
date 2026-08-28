# L Cafe production operations

This is the canonical hosting, release, deployment, and production-state
runbook for `Lcafee/su` and `https://l-cafe.ir`. `README.md` explains local
development, `HANDOFF.md` explains code ownership, and
`server/HOST-ACTIVATION.md` gives the one-time PHP/MySQL provisioning sequence.
When those documents overlap with production operations, this file is
authoritative.

## Current verified state

Last observed on 2026-08-29 (Asia/Tehran):

- canonical repository: `https://github.com/Lcafee/su`, branch `main`;
- approved release: full commit
  `82adc77b2b75a74109d5a52150403dd5bf2bf734`, base path `/`, 58 served files;
- live static code: all 42 release files reachable over HTTP match that approved
  release byte-for-byte; 16 access-control/server files cannot be downloaded
  over HTTP and require FTPS or the ParsPack file manager for a full comparison;
- the release ZIP and `release/current/` match the same 58-file manifest;
- live persistent snapshot: `managed-menu/current.json`, revision 4, 12
  categories and 94 items; recovery snapshot is revision 3;
- all 96 managed-media URLs referenced by revision 4 responded successfully;
- `/admin/` is deployed, but `GET /api/session` returns HTTP 503
  `configuration_unavailable` because web PHP does not currently receive
  `LCAFE_PRIVATE_CONFIG`;
- HTTP-to-HTTPS, `www`-to-apex, canonical `/menu`, custom 404, and source-file
  denial were working;
- the obsolete GitHub Pages preview was disabled on 2026-08-29 because it served
  a retired Aug 16 build after its workflow had been removed.

DNS addresses and response headers are observations, not configuration truth.
At the verification time the apex and `ftp.l-cafe.ir` resolved to
`45.139.11.60`, LiteSpeed served the site, and web PHP reported 8.1.34.

## Ownership model

Production has two deliberately separate layers:

1. Approved code is immutable output in `release/current/`. It contains the
   public React/Vite pages, admin bundle, API controller, and versioned PHP app
   under `api/_app/<approved-sha>/`.
2. Runtime state persists independently: MySQL, the private config, sessions,
   revision archives, original uploads, `managed-menu/`, and `managed-media/`.

Never replace, clear, upload over, move, or prune runtime state during a code
deployment. In particular, do not include `managed-menu/` or `managed-media/`
in a release ZIP. Menu publishing is an admin/database operation and is never a
side effect of deploying code.

`menu.json` and `src/menu/fixtures/current.json` are migration/local-preview
inputs. Neither is authoritative for the production menu. MySQL is the editable
authority and the public site reads the published persistent snapshot.

## Release boundary

The sequence is intentionally split:

1. Edit source and documentation; validate; commit and push.
2. Obtain explicit approval for one exact pushed full SHA.
3. Generate with `npm run release:generate -- --approve <full-sha>`.
4. Stop. Generation is not deployment approval.
5. In a separate explicitly authorized production-deployment task, verify the
   host target and upload that exact approved artifact.

Never build directly on the host and never deploy `dist/`, repository-root HTML,
or an unapproved commit. `package.py` and `deploy.py` validate the approved
manifest and reject dirty/unknown artifacts. Internal `.lcafe-build.json` and
`.lcafe-release.json` files are not public upload files.

## ParsPack access and upload methods

The confirmed domain document root is `~/l-cafe.ir`, not `~/public_html`.
Preferred access is a dedicated FTP account scoped to that directory. A scoped
account is chrooted, so `.deploy.ini` must use `directory = .`; a main account
that lands in the home directory would use `directory = l-cafe.ir`.

Copy `.deploy.ini.example` to the ignored `.deploy.ini` and obtain the current
FTP hostname, username, and password from ParsPack. Use FTPS on port 21 and keep
certificate verification enabled. `ftp.l-cafe.ir` resolves, but the only old
credential recovered from a superseded checkout was rejected and must not be
retried or treated as current. The older hostname `ftp.lcafe-esf.ir` no longer
resolves.

The supported upload paths are:

- preferred: `py deploy.py`, which uses FTPS, fully stages and size-checks every
  changed file, then promotes dependencies before HTML using RNFR/RNTO;
- fallback: create `lcafe-site.zip` with `py package.py`, upload it through the
  ParsPack file manager, and extract it into `~/l-cafe.ir` without deleting or
  replacing persistent runtime directories.

The method used for the existing production upload is not confirmed. Do not
turn the likely file-manager/ZIP history into a fact until ParsPack logs or an
operator confirms it.

## Read-only preflight

Run local validations first:

```text
npm ci
npm run validate:release
py package.py
py deploy.py --dry-run
```

`--dry-run` is deliberately local-only: it validates `release/current/` and
shows the upload candidate set without reading credentials or connecting.
It does not prove the remote directory.

With current FTPS credentials, use the non-mutating remote audit:

```text
py deploy.py --check-remote
```

It enters the configured existing site root, reads all 58 release-owned files,
checks their SHA-256 values, and verifies that the live `.htaccess` contains the
staging-file deny rule. It creates no directories or files, performs no rename
or cleanup, does not publish menu data, and does not update
`.deploy-state.json`. Any missing/different file produces a failing exit status.

Before any real upload, independently record the approved SHA, confirm the
remote working directory shown by the tool, take a host backup, and confirm the
runtime paths are outside the release-owned set. A host with an older
`.htaccess` will stop safely; after manually confirming the target, the
explicit one-time `py deploy.py --bootstrap-htaccess` installs the staging deny
rule before any temporary upload. `--new` is only for a genuinely empty target.

## Production deployment and verification

Only with separate deployment authorization:

```text
py deploy.py
```

The tool never prunes live files. Afterward, run `py deploy.py --check-remote`
and verify at minimum:

- `/`, `/menu`, and `/admin/` return 200 over HTTPS;
- `/menu/` and `/menu.html` redirect to `/menu`;
- a random missing URL uses the custom 404;
- `.htaccess`, PHP app source, and `*.lcafe-uploading` are not public;
- `managed-menu/current.json` has the same revision and hash as before the code
  deployment unless an independently authorized menu publish occurred;
- every managed-media URL referenced by that snapshot still returns 200;
- `GET /api/session` returns 200 with `authenticated: false` when logged out.

Do not use an empty local `.deploy-state.json` as evidence of remote drift; it
only records what that workstation uploaded. Use `--check-remote` or ParsPack
file hashes.

## Restoring the current admin/API control plane

The deployed API already identifies the present fault precisely: absence of the
web-runtime environment pointer. Preserve the existing database and private
directories. In ParsPack's PHP/LiteSpeed environment configuration, restore:

```text
LCAFE_PRIVATE_CONFIG=/absolute/existing/private/lcafe/config.php
```

Use the existing path from the host configuration or provisioning record; do
not guess it and do not create a replacement config while the existing database
and revision 4 snapshots exist. Reload/restart the relevant PHP handler if
ParsPack requires it. Then request `/api/session`:

- expected logged-out result: HTTP 200 and `{"authenticated":false,...}`;
- `configuration_unavailable`: pointer absent, unreadable, inside an inaccessible
  environment scope, or points to a missing file;
- `database_unavailable`: pointer/config loaded, but database connection failed;
- `schema_unavailable`: database loaded, but the L Cafe schema is unavailable.

Current blocker: this workspace has no working ParsPack control-panel/SSH/FTPS
credential and therefore cannot inspect the existing private config path or set
the LiteSpeed/PHP environment. HTTP confirms the fault but cannot safely repair
it. The minimal safe next action is for a ParsPack-authorized operator to restore
the existing `LCAFE_PRIVATE_CONFIG` pointer, then rerun the API and read-only
release checks. Re-provisioning or re-importing the menu is not a workaround.

## Operator record and documentation protocol

For every production action, record the date/time, operator, approved SHA,
access method, remote root, pre/post snapshot revision and hash, files changed,
verification results, and rollback taken. Never record passwords or config
contents.

After architecture, hosting, release, or live-state changes, update this file
and all affected canonical documents in the same source commit. Keep facts
labelled as source-defined, release-verified, live-observed, or host-confirmed;
include the observation date for mutable production facts. Re-index the
codebase knowledge graph after documentation changes so future agents do not
inherit an obsolete architecture.
