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
the current observed state, ParsPack document root and upload methods,
non-destructive API recovery, and pre/post-deployment checks.

The public snapshot publisher owns `managed-menu/current.json` and
`managed-menu/previous.json`. Immutable recovery copies live in the private
snapshot archive. Managed image URLs contain their source hash and are never
overwritten by the operator workflow.

## Roles and account creation

`admin_users.role` is either `owner` or `cashier`. Existing accounts receive
`owner` during migration. Owners have the full editor and publish-retry action.
Cashiers can perform normal category, item, media, ordering, archive, save, and
publish work; the API rejects changes to category layout/introduction and item
metadata/options even if the UI is bypassed.

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
