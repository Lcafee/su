# Menu-admin backend foundation

This directory contains the source-controlled control plane for menu editing. It
does not change the current public menu data source and does not include an admin
frontend. Approved releases copy only `server/app` and `server/public/api` into
the release artifact; database contents, configuration, sessions, snapshots,
original uploads, and managed renditions are runtime state and are never copied.

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
