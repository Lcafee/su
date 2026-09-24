# L Cafe Main Site — Shared VPS Migration Map

Status: historical migration design and execution map. The Liara/VPS cutover was accepted on 2026-09-19; the active architecture and operating procedure are in `VPS_TARGET_ARCHITECTURE.md` and `../../OPERATIONS.md`. Current mutable release and content state are in `../../PROJECT_STATE.md`.

## Non-negotiable contracts

- UI/UX is frozen unless explicitly requested. Landing, Menu and Admin visuals must remain unchanged.
- GitHub (`Lcafee/su`) is the code source of truth.
- During migration, the current ParsPack production host is the content/runtime data source of truth for the Main Site.
- Local project content and repository fixtures must not overwrite newer ParsPack production values.
- L Cafe Operations Platform is a separate product. This migration must not modify its repository, service, database, data root, configuration root, domain, or port.
- The two products may share only the VPS operating system and shared infrastructure such as Nginx/TLS, under a separately scoped infrastructure change.

## Current Main Site architecture

- React + Vite builds Landing, Menu and Admin frontend assets.
- Production public pages are static; no Node server is required for the current frontend.
- PHP is the current admin/API control plane.
- MySQL is the current editable menu authority.
- Public menu delivery is snapshot-based through persistent `managed-menu/current.json`, with `previous.json` as recovery.
- Managed media is persistent and separate from release-owned code.
- Apache/LiteSpeed `.htaccess` currently owns canonical redirects, `/menu` routing, cache/security headers, persistent-state protections and API front-controller routing.

## Target architecture

```text
Liara VPS / Ubuntu 24.04
|
+-- Nginx (shared infrastructure)
|   +-- l-cafe.ir
|   |   +-- static Landing/Menu/Admin assets
|   |   +-- /managed-menu/*  -> direct static delivery
|   |   +-- /managed-media/* -> direct static delivery
|   |   `-- /api/*           -> 127.0.0.1:3100
|   `-- ops.lcafe-esf.ir      -> 127.0.0.1:3000 (unchanged Operations app)
|
+-- Main Site runtime (independent)
|   +-- user: lcafe-site
|   +-- code: /srv/lcafe-site
|   +-- config: /etc/lcafe-site
|   +-- data: /var/lib/lcafe-site
|   +-- service: lcafe-site-api
|   +-- Node 24 API on 127.0.0.1:3100
|   `-- SQLite: /var/lib/lcafe-site/site.sqlite
|
`-- Operations runtime (independent / unchanged)
    +-- code: /app
    +-- config: /etc/lcafe
    +-- data: /var/lib/lcafe
    +-- service: lcafe
    +-- Next.js on 127.0.0.1:3000
    `-- SQLite: /var/lib/lcafe/lcafe.sqlite
```

## Source-of-truth rules

| Concern | Authority during migration |
| --- | --- |
| Application/UI code | GitHub `Lcafee/su` |
| Current menu content | current ParsPack MySQL + published snapshot reconciliation |
| Managed media | current ParsPack managed-media/original storage |
| Admin account state | current ParsPack MySQL |
| Publish/revision state | current ParsPack MySQL + `managed-menu/current.json`/`previous.json` |
| Local project content | supporting reference only; not authoritative unless explicitly reconciled |
| Operations application/data | `Lcafee/l-cafe-operations-platform` and its existing VPS runtime; out of scope |

If a menu/content value differs between GitHub fixtures, a local project copy and the current ParsPack production state, ParsPack wins unless a separate explicit correction is approved before snapshot capture. GitHub remains authoritative for application code, not production content.

## Current API compatibility surface

The replacement service keeps the same public API contract so the existing Admin UI does not need a product or visual rewrite:

| Current route | Target handler responsibility |
| --- | --- |
| `GET /api/session` | return current authenticated session payload or `{authenticated:false}` |
| `POST /api/session/login` | same-origin login, lockout bookkeeping, session creation and CSRF token |
| `DELETE /api/session` | authenticated CSRF-protected logout |
| `GET /api/admin/menu` | load complete editable menu document |
| `PUT /api/admin/menu` | validate, authorize, save one complete document and publish snapshot |
| `POST /api/admin/media` | validate/import one image and return media payload |
| `GET /api/admin/publish-status` | report edit/published revision and latest publish state |
| `POST /api/admin/publish-retry` | owner-only retry of latest unpublished snapshot |

Response bodies remain JSON with private/no-store semantics. Request body limits, validation errors, conflict status, auth errors and owner/cashier enforcement are compatibility behavior, not cleanup opportunities.

## MySQL -> SQLite schema map

The replacement DB is site-only. It must not share tables or a file with Operations.

| Current table | SQLite target | Compatibility notes |
| --- | --- | --- |
| `schema_migrations` | same logical table | `TEXT` version + UTC timestamp |
| `admin_users` | same logical table | integer PK; unique username; role check; active/lockout fields; `session_epoch` preserved |
| `menu_state` | same singleton | `id=1`; edit and published revisions |
| `menu_categories` | same logical table | UUID text PK; unique public id; layout check; archived timestamp |
| `media_assets` | same logical table | UUID text PK; SHA-256 uniqueness; immutable rendition names; lifecycle fields |
| `menu_items` | same logical table | UUID text PK; category/media FKs; metadata stored as validated JSON text |
| `menu_item_options` | same logical table | UUID text PK; item FK with cascade |
| `menu_revisions` | same logical table | revision PK; pending/published/failed state; lifecycle-retention fields |

SQL-dialect translation requirements:

- replace `AUTO_INCREMENT` with SQLite integer primary-key behavior;
- replace `DATETIME(6)`/`UTC_TIMESTAMP(6)` with application-generated UTC timestamps stored consistently;
- replace MySQL `JSON` column semantics with validated JSON text;
- replace `SELECT ... FOR UPDATE` with a serialized write path using SQLite transaction semantics (`BEGIN IMMEDIATE` or equivalent);
- replace `GREATEST`/MySQL-specific conditional expressions with SQLite-safe equivalents;
- keep foreign keys enabled and preserve unique/check constraints;
- migrations remain explicit and versioned.

## Authentication/session compatibility map

Current behavior that must survive the rewrite:

- session identity contains user id and credential `session_epoch`;
- every authenticated request rechecks active user + matching epoch;
- idle timeout and absolute timeout are both enforced;
- login uses a dummy hash path for unknown usernames to avoid a trivial timing split;
- failed login attempts and temporary lockout are persisted;
- successful login resets lockout state and records last login;
- session id is regenerated at login;
- each authenticated session gets a random CSRF token;
- login requires the exact configured same-origin `Origin`;
- authenticated mutations require both allowed origin and `X-CSRF-Token`;
- cookie remains Secure, HttpOnly, SameSite=Strict, path `/`, session lifetime;
- password rotation must invalidate old sessions by incrementing `session_epoch`;
- owner/cashier authorization stays server-side.

The Node implementation may use its own private session store under `/var/lib/lcafe-site` or a dedicated SQLite session table, but browser-visible behavior and invalidation semantics must remain compatible. Existing live PHP session files are ephemeral and are not migration input.

## Menu save and publish compatibility map

The current editor saves one complete menu document. The rewrite preserves these invariants:

1. `baseRevision` must match the current edit revision or return revision conflict.
2. existing categories/items cannot disappear implicitly; they must be archived.
3. public identifiers of existing categories/items are immutable.
4. cashier may edit normal fields but cannot change advanced category fields, item metadata/options, or owner-only publish recovery.
5. every referenced media id must exist.
6. category/item order is document order and is persisted deterministically.
7. removed media references become retired; active references clear retirement/orphan-candidate state.
8. one successful save increments edit revision and creates a pending revision record.
9. public snapshot contains active categories/items only, schema version 1, revision, publication timestamp, metadata/options and managed image URLs.
10. snapshot bytes are prepared and hashed before promotion.
11. immutable private revision archive is preserved.
12. existing `current.json` rotates to `previous.json`.
13. publication boundary is atomic rename of the prepared file to `current.json` on the same filesystem.
14. database publish bookkeeping follows the filesystem promotion; if bookkeeping fails after promotion, public `current.json` remains authoritative and retry/recovery semantics are preserved.

This atomic snapshot behavior is a required property of the new backend.

## Media compatibility map

Current media behavior to preserve:

- accepts one JPEG, PNG or WebP image;
- enforces configured byte and pixel limits;
- hashes source bytes with SHA-256 and deduplicates by hash;
- JPEG EXIF orientation normalization is best-effort;
- center-crops to a square and produces 300x300 and 600x600 WebP renditions;
- rendition filename is content-addressed: `<sha>-300.webp` / `<sha>-600.webp`;
- original source is stored privately and renditions publicly;
- existing same-hash media is reactivated instead of duplicated;
- originals and renditions are immutable once promoted;
- lifecycle bookkeeping is non-destructive; automatic deletion remains disabled.

The Node replacement can use `sharp` instead of GD as long as these externally meaningful rules and resulting media URL contract are preserved.

## Cross-resource serialization requirement

Current PHP uses one MySQL advisory lock shared by media upload, menu save/publish, publish retry and media lifecycle maintenance. It protects coordinated DB/filesystem mutation, not only SQL writes.

The SQLite/Node design must retain one site-wide critical section for these operations. Because the target is one `lcafe-site-api` process, an application-level mutex plus SQLite write transactions is sufficient only while the deployment contract enforces a single API process. A second API writer must never be introduced without replacing this lock design with a cross-process mechanism.

## Nginx translation scope

The current Apache/LiteSpeed behavior must be translated, not discarded:

- canonical `https://l-cafe.ir` host/scheme;
- `/menu.html` and `/menu/` -> `/menu` redirects;
- retired `/menu2` spellings -> `/menu`;
- internal serving of canonical `/menu` without exposing `menu.html`;
- no directory listings;
- custom 404;
- deny hidden/executable content under `managed-menu` and `managed-media`;
- direct static serving for allowed managed snapshots/media;
- stable-file revalidation and hashed immutable asset caching;
- security headers;
- `/api/*` reverse proxy to `127.0.0.1:3100`;
- API private/no-store behavior;
- private application/config/data roots never exposed by Nginx.

Operations remains in its separate Nginx server block and is not edited by Main Site application work.

## Migration sequence

1. Establish project/repository boundaries and agent scope guards. **Done.**
2. Export and checksum the current ParsPack production database and persistent menu/media state.
3. Reconcile ParsPack MySQL, `current.json`, `previous.json`, managed media and revision archives into one immutable migration manifest.
4. Finalize any source-level edge cases discovered from production reconciliation.
5. Implement the Node/SQLite compatibility backend with unchanged API contracts.
6. Build deterministic ParsPack-production -> SQLite migration tooling.
7. Translate `.htaccess` behavior to an isolated Nginx site config.
8. Provision independent OS user, directories, service, secrets and backups on the VPS.
9. Deploy to a staging hostname without changing `l-cafe.ir` DNS.
10. Run functional, content and visual-regression verification against the ParsPack source snapshot.
11. Cut DNS to the VPS only after all gates pass.
12. Retain ParsPack as rollback-only during observation.
13. Retire PHP/MySQL/cPanel-specific active paths only after the new site is verified.

## Implementation compatibility target

The frontend is retained. The replacement backend must preserve:

- route paths and HTTP methods;
- request payload shapes and response JSON shapes;
- authentication/session/CSRF behavior;
- owner/cashier enforcement;
- validation and revision-conflict behavior;
- media URL behavior;
- menu snapshot shape and fallback behavior;
- publish/retry semantics;
- public routes and canonical URL behavior;
- current visual output.

## Historical production snapshot gate

Before content/data implementation, the migration required one immutable read-only export from the then-current ParsPack host. Preferred inputs were:

1. full Main Site MySQL dump;
2. `managed-menu/current.json` and `managed-menu/previous.json`;
3. complete `managed-media/` directory;
4. private original-media and revision/snapshot archive directories when available;
5. production `.htaccess` only for host-owned runtime behavior not represented in source.

Do not export live sessions, cPanel credentials, DB passwords, private configuration secrets, API keys or plaintext account passwords.

The export was inventoried and checksummed before transformation. GitHub fixtures and local copies were not allowed to overwrite ParsPack production content.

## Migration outcome

- project isolation design: merged;
- Main Site source audit: sufficient for backend design;
- UI freeze: defined;
- ParsPack production content authority: defined;
- ParsPack production snapshot: imported and verified; final no-later-edits reconciliation was owner-attested on 2026-09-18;
- Node/SQLite backend: implemented and accepted in Liara production;
- VPS provisioning, deployment, DNS, TLS, backup/restore, and Admin auth gates: completed and recorded in `PROJECT_STATE.md` and `PRODUCTION_CUTOVER.md`.
