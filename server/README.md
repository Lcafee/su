# Menu-admin backend foundation

This directory contains the source-controlled control plane for menu editing and
the one-time legacy import command. The separately built React admin calls this
API; the public menu reads only the static snapshot files it publishes. Approved
releases copy `server/app`, `server/bin`, and `server/public/api` into the release
artifact. Database contents, configuration, sessions, snapshots, originals, and
managed renditions are runtime state and are never copied.

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

Apply `migrations/001_menu_admin.sql`, then create the first active
`admin_users` row with a PHP `password_hash(..., PASSWORD_DEFAULT)` result. No
plaintext password belongs in SQL, Git, or the release artifact.

The public snapshot publisher owns `managed-menu/current.json` and
`managed-menu/previous.json`. Immutable recovery copies live in the private
snapshot archive. Managed image URLs contain their source hash and are never
overwritten by the operator workflow.

## One-time legacy import

After the schema, private config, persistent directories, and PHP extensions are
ready, run the release-owned CLI command from a host terminal. The menu JSON and
legacy image directory are explicit inputs; neither is copied into managed
runtime storage by a code deployment.

```text
php api/_app/<approved-commit>/bin/import-legacy-menu.php \
  --config=/absolute/private-config.php \
  --menu=/absolute/menu.json \
  --images=/absolute/assets/menu/opt \
  --confirm-empty-import
```

The image path may instead point at the original `assets/menu` directory. The
command resolves all referenced images before writing, refuses a non-empty menu
database, imports immutable managed media, saves revision 1, and publishes
`managed-menu/current.json` through the normal atomic publisher. If the DB save
succeeds but file publication does not, use the existing admin publish-retry
action; do not run the import again.

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
require the session CSRF value in `X-CSRF-Token`.
