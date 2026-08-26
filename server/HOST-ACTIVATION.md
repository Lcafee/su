# Menu-admin host activation

This is the one-time operator runbook for a POSIX PHP/MySQL shared host. It does
not change the application architecture or automate production deployment.
Release generation and deployment remain separately approved manual actions.

## Obtain these host values first

- SSH or control-panel terminal access with an interactive TTY and `stty`; PHP
  CLI must permit `exec()` so the tool can disable terminal echo for secrets.
- The host's PHP 8.1+ CLI command and confirmation that CLI and web PHP provide
  PDO MySQL, GD/WebP, Fileinfo, JSON, and sessions.
- An empty MySQL database plus its host, port, database name, username, and
  password. The database account needs DDL and DML rights on that database.
- The absolute public document-root path used by the domain.
- An absolute private persistent root outside the document root, such as
  `/home/account/private/lcafe`.
- The production HTTPS origin, normally `https://l-cafe.ir`.
- The hosting-provider mechanism for setting `LCAFE_PRIVATE_CONFIG` for web PHP
  outside release-owned files. Confirm that PHP-FPM/LiteSpeed passes that value
  to `getenv()`.

Do not put database details in shell commands, shell history, Git, release
artifacts, or public files. The provisioner asks for them interactively, hides
the database username/password and admin password, and writes the config with
owner-only permissions.

## 1. Generate and privately stage the approved code bundle

After the source commit is pushed and explicitly approved, generate the release
locally using the existing release command. This remains a code-release action:

```text
npm run release:generate -- --approve <full-approved-commit-sha>
```

Before the public deployment, privately transfer this directory from the
approved artifact into a temporary host directory outside the web root:

```text
release/current/api/_app/<full-approved-commit-sha>/
```

That private activation bundle contains the PHP application and non-secret
config template at its root, plus `bin/` and `migrations/`. It contains no live
config, credentials, menu data, or runtime files.

## 2. Provision persistent storage, schema, and the first admin

From the private activation bundle, run this single interactive command. Use
the host's real absolute paths; quote an option if its path contains spaces.

```text
php bin/provision-admin.php \
  --config=/home/account/private/lcafe/config.php \
  --private-root=/home/account/private/lcafe \
  --document-root=/home/account/l-cafe.ir \
  --origin=https://l-cafe.ir
```

The command:

- creates private `sessions/`, `menu-revisions/`, and `media-originals/`;
- creates public persistent `managed-menu/` and `managed-media/`;
- creates the external config only if absent and never overwrites it;
- refuses a non-empty database that has no L Cafe migration history;
- applies the release-owned SQL migrations in order;
- prompts twice for the initial admin password and stores only
  `password_hash(..., PASSWORD_DEFAULT)`; and
- is safe to rerun after a partial stop: existing migration markers and an
  existing active administrator are left unchanged.

The command accepts no password or credential options. It refuses piped input
and stops if terminal echo cannot be disabled. Keep the private config and its
parent directory out of the web root, Git checkout, and release directory.

## 3. Set the web-runtime config pointer

Using the host's provider-supported site environment configuration, set:

```text
LCAFE_PRIVATE_CONFIG=/home/account/private/lcafe/config.php
```

The value is a path, not a secret, but it is host-specific and must not be added
to Git or release-owned `.htaccess` files. The config it points to contains the
database credentials and remains owner-readable outside the web root.

## 4. Run the one-time legacy migration

Privately stage the current legacy `menu.json` and its referenced menu-image
directory without placing either under release ownership. Then run the existing
importer from the same private activation bundle:

```text
php bin/import-legacy-menu.php \
  --config=/home/account/private/lcafe/config.php \
  --menu=/absolute/private-staging/menu.json \
  --images=/absolute/private-staging/assets/menu/opt \
  --confirm-empty-import
```

The image path may point to the legacy `assets/menu` directory instead. The
importer refuses a non-empty menu, creates managed-media records/renditions,
saves revision 1, and atomically publishes `managed-menu/current.json`. If it
reports that the database import succeeded but publication is pending, do not
rerun it; use the admin publish-retry action after the code deployment.

## 5. Manually deploy the approved release

Only after provisioning and the importer complete, manually deploy the same
approved release through the existing deployment workflow:

```text
py deploy.py
```

Deployment owns application code only. It does not own or prune the database,
private config, sessions, revision archives, managed snapshots, originals, or
managed media. Future menu edits use the online admin and publish static data
without Git, release generation, or deployment.
