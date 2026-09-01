# L Cafe production operations

This is the canonical hosting and deployment runbook. Mutable state is
authoritative only in `PROJECT_STATE.md`. Real hostnames, account identifiers,
credentials, absolute roots, and private paths belong in the approved private
operator record. `README.md` explains local development, `HANDOFF.md` explains code ownership, and
`server/HOST-ACTIVATION.md` gives the one-time PHP/MySQL provisioning sequence.
When those documents overlap with production procedure, this file is
authoritative.

## State authority

`PROJECT_STATE.md` is the sole tracked ledger for source baseline, production
SHA, release state, migrations, roles, architecture, blockers, phase, and next
action. Do not copy changing hashes, runtime versions, network addresses,
snapshot counts, media counts, or dated verification observations into this
runbook. Store action-specific observations in the private operator record.

The durable production contract is that private config, database, sessions,
snapshots, media, and the fenced `.htaccess` runtime override remain outside
release ownership. The required direct `php_value auto_prepend_file` setting is
host-owned state; its enclosed bytes and private path are never tracked.

## Ownership model

Production has two deliberately separate layers:

1. Approved code is immutable output in `release/current/`. It contains the
   public React/Vite pages, admin bundle, API controller, and versioned PHP app
   under `api/_app/<approved-sha>/`.
2. Runtime state persists independently: MySQL, the private config, sessions,
   revision archives, original uploads, `managed-menu/`, and `managed-media/`.
3. Root `.htaccess` is a composite ownership boundary. The approved release
   owns the code-managed portion; the production host owns exactly one final fenced block
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

## Managed-media lifecycle maintenance

Source migration `003_media_lifecycle` and the release-owned
`bin/media-lifecycle.php` provide the non-destructive lifecycle foundation. Do
not run the CLI until that migration is confirmed active for the target
environment. The CLI uses the same connection-scoped advisory lock as media
upload, menu save/publish, and publish retry, and must hold it for the complete
reference scan and any bookkeeping transaction.

Default dry-run examples:

```text
php bin/media-lifecycle.php --config=/absolute/private/lcafe/config.php
php bin/media-lifecycle.php --config=/absolute/private/lcafe/config.php --dry-run --json
```

The report identifies database, current/previous snapshot, and retained private
revision references; lifecycle classifications; orphan candidates;
uncertainties; observed bytes; policy; proposed bookkeeping; and a deterministic
plan SHA-256. Any malformed/unreadable source, symlink, path escape, ownership
conflict, unknown managed-media reference, or archive mismatch fails closed.

The only mutating mode is explicit bookkeeping apply:

```text
php bin/media-lifecycle.php --config=/absolute/private/lcafe/config.php --apply
```

It may set or clear `orphan_candidate_at` in one database transaction. It does
not prune archives, delete originals or renditions, delete media rows, or modify
menu content. Never schedule it with cron and never run it concurrently with
out-of-band database, snapshot, or media restoration.

Destructive cleanup is disabled regardless of configured retention values. The
recommended 180-day archive horizon and 50-published-revision floor are not
production facts. Before any future destructive phase, the owner must confirm
the actual backup retention horizon and that database, snapshots, originals,
and renditions are captured and restored as one coordinated generation. Record
that decision and every lifecycle run in the private operator record.

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

## Host access and upload methods

Hostnames, usernames, absolute roots, credentials, and private paths are kept
out of Git. Store them in the ignored `.deploy.ini` or the operator's approved
credential store. The production document root and connection settings come
only from that private configuration.

Copy `.deploy.ini.example` to the ignored `.deploy.ini`, use explicit FTPS, and
keep certificate verification enabled. If an FTP account is scoped directly to
the site root, use `directory = .`.

The supported upload paths are:

- preferred: `py deploy.py`, which uses FTPS, fully stages and size-checks every
  changed file, then promotes dependencies before HTML using RNFR/RNTO;
- fallback: create `lcafe-site.zip` with `py package.py`, upload it through the
  hosting file manager, and extract it into the existing site root without
  deleting or replacing persistent runtime directories. The ZIP intentionally
  omits root `.htaccess`; never add it manually.

The method used for the existing production upload is not confirmed. Do not
turn the likely file-manager/ZIP history into a fact until private operator logs or an
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
only records what that workstation uploaded. Use `--check-remote` or host
file hashes.

## Admin runtime and role activation

Production uses a private config and web bootstrap outside the document root.
Their absolute paths and contents are host-sensitive operator state and are not
recorded in Git. LiteSpeed/LSPHP applies the required direct host override
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

Current migration and role state is recorded only in `PROJECT_STATE.md`. Future
additive migrations run through the provisioner against the existing private
configuration. Do not run or reconstruct the archived legacy importer. FTPS
credentials are required only for remote comparison/deployment; release
generation does not use them.

## Operator record and documentation protocol

For every production action, record the date/time, operator, approved SHA,
access method, remote target identifier, pre/post snapshot revision and hash,
files changed, verification results, and rollback taken in the private operator
record. Never place passwords, account details, private roots, or config
contents in tracked documentation.

After mutable source, release, or live-state changes, update `PROJECT_STATE.md`.
Update this runbook only when durable procedure or ownership changes. Keep
private operator observations labelled as source-defined, release-verified,
live-observed, or host-confirmed and include their observation date.
