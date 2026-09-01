# Menu-admin backend foundation

This directory contains the source-controlled control plane for menu editing,
schema provisioning, and secure admin-account creation. The separately built
React admin calls this API; the public menu reads only the static snapshot files
it publishes. Approved releases copy `server/app`, `server/bin`,
`server/migrations`, `server/config.example.php`, and
`server/public/api` into the release artifact. Database contents, configuration,
sessions, snapshots, originals, and managed renditions are runtime state and are
never copied.

## Host prerequisites

- PHP 8.1+ with PDO MySQL, GD with WebP support, Fileinfo, JSON, and session support.
- MySQL 8.0+ or a compatible MariaDB release with InnoDB, foreign keys, utf8mb4,
  and JSON columns.
- Apache or LiteSpeed with per-directory `.htaccess`, `mod_rewrite`, and headers.
- Private persistent directories for sessions, revision snapshots, and originals.
- Public persistent `managed-menu` and `managed-media` directories. Snapshot
  temp files and `current.json` must be on the same POSIX filesystem so `rename`
  atomically replaces an existing destination.
- A private config file based on `config.example.php`, exposed through the
  `LCAFE_PRIVATE_CONFIG` environment variable.

Use the interactive provisioner rather than applying SQL or inserting an admin
row manually. The complete operator sequence and host values are documented in
[`HOST-ACTIVATION.md`](HOST-ACTIVATION.md). It creates the external config and
persistent directories, applies release-owned migrations, and creates the first
active owner with `password_hash(..., PASSWORD_DEFAULT)`.

For an existing production host, use [`../OPERATIONS.md`](../OPERATIONS.md) for
durable access/upload procedure, non-destructive API recovery, and deployment
checks. Mutable production state is recorded only in `../PROJECT_STATE.md`.
Use [`../PROJECT_STATE.md`](../PROJECT_STATE.md) for the authoritative production
SHA, migration, role, phase, and blocker state.

The public snapshot publisher owns `managed-menu/current.json` and
`managed-menu/previous.json`. Immutable recovery copies live in the private
snapshot archive. Managed image URLs contain their source hash and are never
overwritten by the operator workflow.

## Managed-media lifecycle foundation

Migration `003_media_lifecycle` adds non-destructive orphan-candidate and
revision-retention bookkeeping. `MediaLifecycle.php` provides one
connection-scoped MySQL/MariaDB advisory lock shared by media upload, complete
menu save/publish, publish retry, and lifecycle maintenance. Lock acquisition
must succeed before any participating database/filesystem mutation begins.

Run the CLI from the release-owned `bin/` directory with the private config:

```text
php media-lifecycle.php --config=/absolute/private/lcafe/config.php --dry-run
php media-lifecycle.php --config=/absolute/private/lcafe/config.php --dry-run --json
php media-lifecycle.php --config=/absolute/private/lcafe/config.php --apply
```

Dry-run is the default. The inventory treats every current or archived
`menu_items.media_id`, public `current.json`/`previous.json`, and every private
revision archive as an authoritative reference source. Snapshot JSON is scanned
recursively for managed-media URLs. Unsafe paths, symlinks, malformed or
unreadable sources, unknown ownership, and contradictory hashes make the plan
unsafe; uncertain assets are retained.

`--apply` is limited to setting `orphan_candidate_at` after a complete safe scan
or clearing it when an asset is referenced again. It cannot delete originals,
renditions, snapshot archives, database media rows, or any other file. The CLI
reports a deterministic plan SHA-256 for a later separately authorized cleanup
phase.

The optional `media_lifecycle` config structure deliberately defaults
destructive cleanup to disabled and leaves the backup/retention values unset.
The documented `180 days / 50 published revisions` values are a
non-authoritative recommendation only. Destructive eligibility remains gated
until the owner confirms the production backup horizon and a coordinated
database, snapshot, original, and rendition restore contract.

## Roles and account creation

`admin_users.role` is either `owner` or `cashier`. Existing accounts receive
`owner` during migration. Owners have the full editor and publish-retry action.
Cashiers can perform normal category, item, media, ordering, archive, save, and
publish work; the API rejects changes to category layout/introduction and item
metadata/options even if the UI is bypassed.

Current migration and role state is authoritative only in
`../PROJECT_STATE.md`. Host-specific config and the direct `.htaccess` runtime
override remain persistent host state; their paths and contents do not belong
in source or release artifacts.

After provisioning or migration, create additional accounts only from an
interactive host terminal:

```text
php api/_app/<approved-commit>/bin/create-admin-user.php \
  --config=/absolute/private-config.php \
  --username=account-name \
  --role=cashier
```

The password is prompted twice with terminal echo disabled and is never accepted
on the command line. Use `--role=owner` only when another full-access account is
required. The legacy importer and its JSON/Excel/generator inputs are retained
only under `legacy/menu-import-history/`; they are not shipped or supported as
an operational path. A blank installation creates its menu through `/admin/`.

## API surface

- `GET /api/session`
- `POST /api/session/login`
- `DELETE /api/session`
- `GET /api/admin/menu`
- `PUT /api/admin/menu`
- `POST /api/admin/media`
- `GET /api/admin/publish-status`
- `POST /api/admin/publish-retry`

All responses are private/no-store. Login and every authenticated mutation
require the configured same-origin `Origin`; authenticated mutations also
require the session CSRF value in `X-CSRF-Token`. Role authorization is applied
in PHP; `POST /api/admin/publish-retry` is owner-only.
