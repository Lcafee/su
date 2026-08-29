# Menu-admin host activation

This is the one-time operator runbook for a POSIX PHP/MySQL shared host. It does
not change the application architecture or automate production deployment.
Release generation and deployment remain separately approved manual actions.
For an already provisioned host, current production facts, ParsPack access,
non-destructive recovery, and deployment verification are authoritative in
[`../OPERATIONS.md`](../OPERATIONS.md). Do not rerun provisioning merely because
the web-runtime config pointer is missing.

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

## 2. Provision persistent storage, schema, and the first owner

From the private activation bundle, run this single interactive command. Use
the host's real absolute paths; quote an option if its path contains spaces.

```text
php bin/provision-admin.php \
  --config=/home/account/private/lcafe/config.php \
  --private-root=/home/account/private/lcafe \
  --document-root=/home/account/public_html \
  --origin=https://l-cafe.ir
```

The command:

- creates private `sessions/`, `menu-revisions/`, and `media-originals/`;
- creates public persistent `managed-menu/` and `managed-media/`;
- creates the external config only if absent and never overwrites it;
- refuses a non-empty database that has no L Cafe migration history;
- applies the release-owned SQL migrations in order;
- prompts twice for the initial owner password and stores only
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

The value is a path, not a secret, but it is host-specific and should normally
be stored in the provider-managed domain/PHP layer rather than release-owned
files. The config it points to contains database credentials and remains
owner-readable outside the web root.

For cPanel on LiteSpeed/LSPHP, do not assume `.user.ini` is active. LiteSpeed
normally consumes cPanel PHP overrides from `.htaccess`; `.user.ini` requires
the provider to enable `LSPHP_ENABLE_USER_INI`. Prefer the provider-supported
MultiPHP/LSAPI configuration and recycle only the PHP handler if that mechanism
requires it. Confirm from the web runtime, not only a shell: logged-out
`GET /api/session` must return HTTP 200 with `authenticated: false`. A 503
`configuration_unavailable` means `getenv('LCAFE_PRIVATE_CONFIG')` remains
absent/unusable in web PHP. Restore the existing path; do not create a
replacement config or re-import the menu when persistent snapshots/database
already exist.

Current ParsPack details and the temporary marked host-only `.htaccess` recovery
block are recorded in `../OPERATIONS.md`. Because `.htaccess` is otherwise
release-owned, do not deploy over that block or normalize the difference until
the pointer is moved to a provider-managed layer or preservation is explicitly
approved.

## 4. Create additional role-assigned accounts

Migration `002_admin_roles` preserves every pre-role account as an owner. Create
the cashier, or another owner when required, from the same private activation
bundle:

```text
php bin/create-admin-user.php \
  --config=/home/account/private/lcafe/config.php \
  --username=account-name \
  --role=cashier
```

The command refuses duplicate usernames, accepts only `owner` or `cashier`, and
prompts twice for the password with terminal echo disabled. Do not put the
password on the command line. The pre-admin importer and its JSON/Excel tools
are archived under `legacy/` and are not part of host activation. On a blank
installation, the owner creates categories and items through `/admin/`.

## 5. Manually deploy the approved release

Only after provisioning/migrations and required accounts are ready, manually
deploy the same approved release through the existing deployment workflow:

```text
py deploy.py
```

Deployment owns application code only. It does not own or prune the database,
private config, sessions, revision archives, managed snapshots, originals, or
managed media. Future menu edits use the online admin and publish static data
without Git, release generation, or deployment.

The live host was already provisioned before 2026-08-29: published revisions 3
and 4 and their managed media were present. cPanel confirmed the existing
private config at `/home/h415280/private/lcafe/config.php` and document root at
`/home/h415280/public_html`. The later web-runtime pointer recovery is host
state, not release content; preserve it and all persistent paths when applying
the role migration and future code releases.
