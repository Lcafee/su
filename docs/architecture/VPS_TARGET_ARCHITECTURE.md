# L Cafe Main Site — Optimized VPS Target Architecture

Status: active production architecture after the accepted Liara/VPS cutover. Mutable release, revision, DNS, TLS, and rollback facts remain authoritative in `PROJECT_STATE.md`.

## Goals

- Preserve Landing, Menu and Admin UI/UX exactly.
- Make the public customer path static and independent from the API/database.
- Keep Main Site fully isolated from L Cafe Operations on the shared Liara VPS.
- Minimize resident memory, moving parts and deployment risk.
- Preserve the existing API contract, snapshot publication semantics and managed-media URLs.

## Selected stack

- Edge/static server: Nginx already present on the VPS.
- Frontend: existing React/Vite build, served as static files. No frontend Node process.
- Admin control plane: one Node.js 24 process using Fastify 5.
- Database: SQLite via `better-sqlite3` 13.x.
- Image processing: Sharp; only used during authenticated media upload.
- Process manager: systemd. No PM2, no Docker, no cluster mode.
- TLS: Nginx, independent certificate/server block for `l-cafe.ir`.

`node:sqlite` is intentionally not the production database adapter while its Node 24 API remains below stable status. The application uses one SQLite writer process and preserves the existing cross-resource critical section around DB/filesystem mutations.

## Request paths

```text
Internet
  |
  v
Nginx
  |
  +-- /, /menu, /admin/*, hashed frontend assets
  |      -> /srv/lcafe-site/current/dist (static)
  |
  +-- /managed-menu/*
  |      -> /var/lib/lcafe-site/managed-menu (static alias)
  |
  +-- /managed-media/*
  |      -> /var/lib/lcafe-site/managed-media (static alias)
  |
  `-- /api/*
         -> 127.0.0.1:3100
             -> lcafe-site-api.service
                 -> SQLite + private persistent files
```

Normal customer menu traffic never reaches Node or SQLite.

## VPS isolation

Operations remains unchanged:

- service: `lcafe.service`
- bind: `127.0.0.1:3000`
- data: `/var/lib/lcafe`
- code: `/app`

Main Site uses:

- service: `lcafe-site-api.service`
- runtime user: `lcafe-site`
- bind: `127.0.0.1:3100`
- release root: `/srv/lcafe-site`
- persistent data: `/var/lib/lcafe-site`
- private config: `/etc/lcafe-site`

Cross-project write access is forbidden.

## Release layout

```text
/srv/lcafe-site/
  releases/
    <git-sha>/
      dist/
      server-node/
  current -> releases/<git-sha>

/var/lib/lcafe-site/
  site.sqlite
  site.sqlite-wal
  site.sqlite-shm
  managed-menu/
    current.json
    previous.json
  managed-media/
  menu-revisions/
  media-originals/
  backups/

/etc/lcafe-site/
  site.env
```

Deploys create a new immutable release and atomically switch `current`. Persistent state is never inside a release directory.

## SQLite operating mode

At startup the application enforces:

- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL`
- `PRAGMA busy_timeout = 5000`
- `PRAGMA synchronous = FULL`
- a single API process/writer

The workload is tiny and admin-heavy rather than read-heavy, so durability is preferred over shaving milliseconds from admin saves. Public requests are unaffected because they do not query SQLite.

## Publication boundary

The existing publication model remains:

1. validate and persist the complete menu document in SQLite;
2. create the immutable private revision archive;
3. prepare and SHA-256 the public snapshot;
4. rotate `current.json` to `previous.json`;
5. atomically rename the prepared file to `current.json` on the same filesystem;
6. finalize publish bookkeeping in SQLite.

If DB bookkeeping fails after filesystem promotion, the public `current.json` remains authoritative and retry/recovery semantics are preserved.

## Media boundary

- originals remain private under `/var/lib/lcafe-site/media-originals`;
- 300px and 600px WebP renditions remain under `/var/lib/lcafe-site/managed-media`;
- Nginx serves renditions directly;
- Node + Sharp only run during authenticated upload;
- rendition names and `/managed-media/...` URLs remain unchanged.

## Session design

Sessions are server-side and opaque. The SQLite database includes an `admin_sessions` table, but session rows are migration-exempt and may be discarded at cutover. Existing `admin_users.session_epoch` remains the credential-generation authority, so password rotation continues to invalidate old sessions.

## Performance choices

- no SSR;
- no application process for customer-facing pages;
- no MySQL/MariaDB daemon;
- no PHP-FPM;
- no Docker daemon;
- no PM2;
- one small Node process;
- Nginx immutable caching for hashed assets and managed media;
- revalidation for HTML and `managed-menu/current.json`;
- uploads/image transforms kept off the public request path.

## Migration gates

1. ParsPack snapshot verified (SQL, revisions, current/previous snapshot and public media).
2. SQLite schema/importer produces a deterministic target DB.
3. Imported DB matches production counts, revisions and snapshot hashes.
4. Node API contract tests pass against the existing frontend expectations.
5. Static build is visually identical to current production at fixed mobile/desktop viewports.
6. Staging runs on the VPS without modifying `lcafe.service` or `/var/lib/lcafe`.
7. Backup/restore drill passes.
8. DNS cutover only after all previous gates pass.
