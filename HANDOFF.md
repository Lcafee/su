# L Cafe handoff

Mutable state is authoritative in `PROJECT_STATE.md`.

Liara/VPS is the active production runtime. ParsPack is retained unchanged as rollback only and is not an edit authority. The VPS architecture is documented in `docs/architecture/VPS_TARGET_ARCHITECTURE.md`; migration history remains in `deploy/vps/MIGRATION_EXECUTION.md`.

## Active architecture

```text
Nginx
  +-- /, /menu, /admin/*, hashed assets
  |      -> /srv/lcafe-site/current/dist
  +-- /managed-menu/* -> /var/lib/lcafe-site/managed-menu
  +-- /managed-media/* -> /var/lib/lcafe-site/managed-media
  `-- /api/* -> 127.0.0.1:3100
                   -> lcafe-site-api.service
                   -> SQLite + private persistent state
```

The public and admin UIs remain separate React + Vite entry points. Nginx serves
customer-facing pages, snapshots, and managed media directly. Only authenticated
Admin/API traffic reaches the isolated Node/Fastify control plane. The unified
Menu fetches `managed-menu/current.json`, then `previous.json` as recovery,
and never queries SQLite directly.

The retired generated frontend, pre-admin JSON/Excel/import/generator
implementation, and Summer Pause campaign are isolated under `legacy/` as
read-only history and are excluded from active build, release, provisioning,
deployment, and product-maintenance paths.

## Ownership

- `src/landing/`, `src/menu/`, `src/menu2/`, `src/admin/`, and `src/styles/` own
  UI behavior.
- `server-node/` owns the active Node/Fastify control plane, SQLite access,
  migration/import logic, and production API behavior. The legacy `server/`
  PHP/MySQL implementation is retained for ParsPack rollback/reference only.
- SQLite owns editable production menu content, revision state, and server-side sessions.
- `managed-menu/` and `managed-media/` are public persistent runtime output;
  private config, sessions, revision archives, and originals remain outside the
  document root.
- The tracked snapshot under `src/menu/fixtures/` supports local Vite and the
  isolated GitHub Pages preview; it is independent of production runtime state
  and archived menu inputs.
- Nginx/systemd configuration and `/var/lib/lcafe-site` are persistent host-owned
  production state outside immutable releases. The ParsPack `.htaccess` ownership
  boundary applies only to the retained rollback environment.

`MenuRuntime` owns shared snapshot loading, fallback, retry, and hardened
category-navigation state. One `MenuApp` owns both grid and list presentations
through a local versioned preference and `data-menu-view`; switching preserves
the mounted product tree and the active section anchor. Memoized category/product
boundaries and a shared `ResizeObserver` manage rendering.
Variants are informational rows, not selections. `metal-fx` is a
capability-gated decorative enhancement: ordinary React/CSS content remains
usable when WebGL is absent or initialization fails.

## Build and release

The production workflow is manual and explicit:

```text
source change
  -> commit + push
  -> npm ci / validation / npm run build
  -> package the intended exact release
  -> take a production backup
  -> deploy a new immutable VPS release
  -> switch /srv/lcafe-site/current
  -> verify /, /menu, /admin/, /api/session
```

No GitHub push deploys production automatically. Do not build on the VPS, do not
edit files inside the active release in place, and do not mix Main Site deployment
with L Cafe Operations. Persistent SQLite, menu/media, config, backups, and runtime
state remain outside release ownership. Keep ParsPack untouched unless rollback is
explicitly authorized.

GitHub Pages remains a frontend-only pre-production preview and is not production
approval. See `OPERATIONS.md` for the production runbook and
`PROJECT_STATE.md` for the current live release and rollback state.

## Content workflow

Production menu copy, order, prices, photos, Sepidz codes, variants, and add-ons
are edited only through the VPS `/admin/`, saved to SQLite, and published to the managed snapshot.
Owners have the full editor and publish-retry control. Cashiers can perform
normal category/item/media/order/archive/save-and-publish operations, while
advanced category fields and item metadata/options are hidden and rejected by
the API if changed. Accounts are created and passwords are rotated only with
interactive host CLIs; rotation preserves the role and invalidates prior
sessions through `admin_users.session_epoch`.
Do not edit JSX, archived inputs, or the local fixture to change the live menu.
Both roles and migrations `001_menu_admin` and `002_admin_roles` are active in
production; the exact mutable record remains in `PROJECT_STATE.md`.

For UI/code changes, edit source, validate/build locally, commit and push the intended
source, back up production, deploy the exact immutable VPS release, and run the required
health checks. For host or runtime work, follow `OPERATIONS.md` and preserve all
persistent paths.
