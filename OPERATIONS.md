# L Cafe production operations

This is the canonical hosting and deployment runbook for `Lcafee/su` and
`https://l-cafe.ir`. Mutable state is authoritative in `PROJECT_STATE.md`.
`README.md` explains local
development, `HANDOFF.md` explains code ownership, and
`server/HOST-ACTIVATION.md` gives the one-time PHP/MySQL provisioning sequence.
When those documents overlap with production procedure, this file is
authoritative.

## Current recorded state

Current authoritative state is in `PROJECT_STATE.md`. As confirmed on
2026-08-30:

- production runs `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a`;
- migrations `001_menu_admin` and `002_admin_roles` are active;
- owner and cashier roles are active;
- the direct ParsPack `.htaccess` `php_value auto_prepend_file` override is
  required host-owned runtime state;
- live persistent snapshot: `managed-menu/current.json`, revision 4, 12
  categories and 94 items; recovery snapshot is revision 3;
- all 96 managed-media URLs referenced by revision 4 responded successfully;
- the private config, database, snapshots, media, and fenced runtime override
  remain outside release ownership;
- HTTP-to-HTTPS, `www`-to-apex, canonical `/menu`, custom 404, and source-file
  denial were working;
- the obsolete GitHub Pages preview was disabled on 2026-08-29 because it served
  a retired Aug 16 build after its workflow had been removed.

The verification client received connection resets after a repeated burst of
managed-media requests, after the route, snapshot, and full media checks had
already succeeded. Treat an isolated reset during an audit as inconclusive, not
as proof that a file is missing. Stop the burst, allow a cooldown, and repeat in
small sequential batches; do not create a retry storm against the shared host.

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
3. Root `.htaccess` is a composite ownership boundary. The approved release
   owns the code-managed portion; ParsPack owns exactly one final fenced block
   from `LCAFE-HOST-RUNTIME-BEGIN` through `LCAFE-HOST-RUNTIME-END`.

`deploy.py` preserves the fenced block byte-for-byte and fails before mutation
when markers are missing, duplicated, reversed, or followed by unexpected
content. The release source must never contain the block, its private path, or
its `php_value auto_prepend_file` directive. `package.py` excludes root
`.htaccess`, so file-manager extraction cannot overwrite host runtime state.

Never replace, clear, upload over, move, or prune runtime state during a code
deployment. In particular, do not include `managed-menu/` or `managed-media/`
in a release ZIP. Menu publishing is an admin/database operation and is never a
side effect of deploying code.

MySQL is the editable authority and the public site reads the published
persistent snapshot. `src/menu/fixtures/current.json` is a standalone local
development fixture. Pre-admin JSON/Excel/import/generator artifacts live only
under `legacy/` and have no runtime or operational role.

Admin authorization is database-backed. Owners have the complete editor and
publish recovery; cashiers retain normal category/item/media/order/archive/save
and publish work while PHP protects advanced category fields, item
metadata/options, and owner-only recovery actions. Accounts are created only by
the release-owned interactive CLI.

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

Hostnames, usernames, absolute roots, credentials, and private paths are kept
out of Git. Store them in the ignored `.deploy.ini` or the operator's approved
credential store. The production document root is the existing ParsPack site
root selected in that private configuration.

```text
port = 21
directory = public_html
```

Copy `.deploy.ini.example` to the ignored `.deploy.ini`, use explicit FTPS, and
keep certificate verification enabled. If an FTP account is scoped directly to
the site root, use `directory = .`.

The supported upload paths are:

- preferred: `py deploy.py`, which uses FTPS, fully stages and size-checks every
  changed file, then promotes dependencies before HTML using RNFR/RNTO;
- fallback: create `lcafe-site.zip` with `py package.py`, upload it through the
  ParsPack file manager, and extract it into the existing site root without
  deleting or replacing persistent runtime directories. The ZIP intentionally
  omits root `.htaccess`; never add it manually.

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

It enters the configured existing site root, reads the release-owned files,
checks their SHA-256 values, compares only the code-managed portion of root
`.htaccess`, verifies the staging-file deny rule, and requires one well-formed
host runtime block. It creates no directories or files, performs no rename
or cleanup, does not publish menu data, and does not update
`.deploy-state.json`. Any missing/different file produces a failing exit status.

Before any real upload, independently record the approved SHA, confirm the
remote working directory shown by the tool, take a host backup, and confirm the
runtime paths are outside the release-owned set. A host with an older
`.htaccess` will stop safely; after manually confirming the target, the
explicit one-time `py deploy.py --bootstrap-htaccess` installs only the
release-owned rules while preserving an already installed, valid host runtime
block. It will not create or reconstruct the host block. `--new` never bypasses
that boundary.

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

Throttle media verification in small batches. If LiteSpeed starts resetting
connections, stop and retry after a cooldown rather than increasing concurrency.

Do not use an empty local `.deploy-state.json` as evidence of remote drift; it
only records what that workstation uploaded. Use `--check-remote` or ParsPack
file hashes.

## Admin runtime and role activation

Production uses a private config and web bootstrap outside the document root.
Their absolute paths and contents are host-sensitive operator state and are not
recorded in Git. LiteSpeed/LSPHP applies the required direct ParsPack override
through the host-owned fenced block in root `.htaccess`. See the
[LiteSpeed cPanel guidance](https://docs.litespeedtech.com/lsws/cp/cpanel/php-user-ini/)
and [cPanel MultiPHP INI guidance](https://docs.cpanel.net/cpanel/software/multiphp-ini-editor-for-cpanel/).

The block begins and ends with the public marker names documented in the
ownership section, but its enclosed bytes are intentionally absent from source
and documentation. Preserve the working setting and existing runtime data. If
the failure returns, interpret `/api/session` as follows:

- expected logged-out result: HTTP 200 and `{"authenticated":false,...}`;
- `configuration_unavailable`: pointer absent, unreadable, inside an inaccessible
  environment scope, or points to a missing file;
- `database_unavailable`: pointer/config loaded, but database connection failed;
- `schema_unavailable`: database loaded, but the L Cafe schema is unavailable.

Migrations `001_menu_admin` and `002_admin_roles` and both production roles are
active. Future additive migrations run through the provisioner against the
existing private configuration. Do not run or reconstruct the archived legacy
importer. FTPS credentials are required only for remote comparison/deployment;
release generation does not use them.

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
