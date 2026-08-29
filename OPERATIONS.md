# L Cafe production operations

This is the canonical hosting, release, deployment, and production-state
runbook for `Lcafee/su` and `https://l-cafe.ir`. `README.md` explains local
development, `HANDOFF.md` explains code ownership, and
`server/HOST-ACTIVATION.md` gives the one-time PHP/MySQL provisioning sequence.
When those documents overlap with production operations, this file is
authoritative.

## Current recorded state

Last observed on 2026-08-29 (Asia/Tehran):

- canonical repository: `https://github.com/Lcafee/su`, branch `main`;
- approved release: full commit
  `82adc77b2b75a74109d5a52150403dd5bf2bf734`, base path `/`, 58 served files;
- before the runtime recovery attempt, all 42 release files reachable over HTTP
  matched that approved release byte-for-byte; 16 access-control/server files
  require FTPS or the ParsPack file manager for a full comparison;
- the live `.htaccess` now has one documented host-only LSAPI block appended on
  2026-08-29; no served-code release was generated or deployed;
- the release ZIP and `release/current/` match the same 58-file manifest;
- the live approved release remains the pre-role build; owner/cashier support and
  migration `002_admin_roles` are source changes for the next exact-SHA approval
  and have not been generated or deployed;
- live persistent snapshot: `managed-menu/current.json`, revision 4, 12
  categories and 94 items; recovery snapshot is revision 3;
- all 96 managed-media URLs referenced by revision 4 responded successfully;
- the previously recorded `LCAFE_PRIVATE_CONFIG` web-runtime blocker was
  subsequently reported resolved without replacing the existing private
  config, database, snapshots, or media; this source-only release preparation
  did not re-inspect the provider setting;
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

The host-confirmed account home is `/home/h415280` and the production document
root is `/home/h415280/public_html`. This supersedes the earlier unverified
`~/l-cafe.ir` assumption. cPanel currently has no separately created FTP
accounts. Its built-in account is:

```text
server = ftp.l-cafe.ir
port = 21
username = h415280
account root = /home/h415280
directory = public_html
```

Copy `.deploy.ini.example` to the ignored `.deploy.ini`, use explicit FTPS, and
keep certificate verification enabled. The remaining credential required for
`deploy.py --check-remote` is the current password for `h415280`. The only old
credential recovered from a superseded checkout was rejected and must not be
retried or treated as current. The older hostname `ftp.lcafe-esf.ir` no longer
resolves. If an operator later creates a dedicated FTP account scoped directly
to `public_html`, use `directory = .` for that account instead.

The supported upload paths are:

- preferred: `py deploy.py`, which uses FTPS, fully stages and size-checks every
  changed file, then promotes dependencies before HTML using RNFR/RNTO;
- fallback: create `lcafe-site.zip` with `py package.py`, upload it through the
  ParsPack file manager, and extract it into `/home/h415280/public_html` without
  deleting or replacing persistent runtime directories.

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

The 2026-08-29 recovery attempt appended a marked host-only block to live
`.htaccess`. If that block remains, `--check-remote` will report the file as
different. Record and resolve or explicitly preserve that drift before a future
deployment; never let code deployment silently remove a working host setting.

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

Throttle media verification in small batches. If LiteSpeed starts resetting
connections, stop and retry after a cooldown rather than increasing concurrency.

Do not use an empty local `.deploy-state.json` as evidence of remote drift; it
only records what that workstation uploaded. Use `--check-remote` or ParsPack
file hashes.

## Admin runtime and role activation

Host inspection on 2026-08-29 confirmed the existing persistent runtime:

```text
/home/h415280/private/lcafe/config.php       mode 0600
/home/h415280/private/lcafe/web-bootstrap.php mode 0600
/home/h415280/private/lcafe/                 mode 0700
```

The bootstrap contains only the host pointer:

```php
putenv('LCAFE_PRIVATE_CONFIG=/home/h415280/private/lcafe/config.php');
```

`/home/h415280/public_html/.user.ini` already sets `auto_prepend_file` to that
bootstrap. LiteSpeed/LSPHP does not consume `.user.ini` by default unless the
provider enables `LSPHP_ENABLE_USER_INI`; cPanel/LiteSpeed normally applies PHP
per-directory directives through `.htaccess`. See the
[LiteSpeed cPanel guidance](https://docs.litespeedtech.com/lsws/cp/cpanel/php-user-ini/)
and [cPanel MultiPHP INI guidance](https://docs.cpanel.net/cpanel/software/multiphp-ini-editor-for-cpanel/).

At 2026-08-29 11:21 +03:30, after downloading a recovery copy, the operator
appended this host-only block to live `.htaccess`:

```apache
# LCAFE-HOST-RUNTIME-BEGIN
# Host-only: restore the private runtime pointer for LiteSpeed/LSAPI.
<IfModule lsapi_module>
    php_value auto_prepend_file "/home/h415280/private/lcafe/web-bootstrap.php"
</IfModule>
# LCAFE-HOST-RUNTIME-END
```

cPanel persisted the block, but the immediate request still returned HTTP 503.
A later operator status reports that the web-runtime pointer is now resolved;
the exact provider-layer change was not inspected during this source-only
release preparation. Preserve the working setting and the existing config and
runtime data. If the failure returns, interpret `/api/session` as follows:

- expected logged-out result: HTTP 200 and `{"authenticated":false,...}`;
- `configuration_unavailable`: pointer absent, unreadable, inside an inaccessible
  environment scope, or points to a missing file;
- `database_unavailable`: pointer/config loaded, but database connection failed;
- `schema_unavailable`: database loaded, but the L Cafe schema is unavailable.

The next role-aware release adds migration `002_admin_roles`. Before activating
its new API controller, privately stage the approved `api/_app/<sha>/` bundle
and rerun `bin/provision-admin.php` with the existing config/paths so the
additive migration is applied without replacing accounts or data. Then create
the cashier with `bin/create-admin-user.php --role=cashier`; enter its password
only through the hidden prompt. Existing accounts become owners. Do not run or
reconstruct the archived legacy importer.

The current FTPS password for `h415280` remains required for
`deploy.py --check-remote` and automated deployment. Release generation itself
does not require host credentials.

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
