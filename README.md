# L Cafe

React + Vite frontend with static public delivery through Nginx and an isolated
Node/Fastify/SQLite menu-admin control plane.

Current mutable source, release, production, migration, phase, and blocker state
is authoritative in [`PROJECT_STATE.md`](PROJECT_STATE.md).

Liara/VPS is the active production environment. ParsPack is retained unchanged as rollback only. The production architecture is documented in [`docs/architecture/VPS_TARGET_ARCHITECTURE.md`](docs/architecture/VPS_TARGET_ARCHITECTURE.md); migration history remains in [`deploy/vps/MIGRATION_EXECUTION.md`](deploy/vps/MIGRATION_EXECUTION.md).

## Development

```sh
npm ci
npm run validate:release
npm run dev
npm run build
npm run validate:dist
```

`npm run build` writes disposable local frontend output to `dist/`; production
uses an immutable release on the VPS rather than editing this output in place.
The frontend toolchain supports Node 20.19+ or 22.12+; the production control
plane runs separately as the Node 24 `lcafe-site-api.service`.

`VITE_BASE_PATH` controls the public base and defaults to `/` for the production
domain. A separate `npm run build:pages` build is fixed to the GitHub project
base `/su/` and publishes the frontend-only pre-production preview at
`https://lcafee.github.io/su/` after every push to `main`. Its artifact contains
only Landing, static `/menu/` and `/menu2/` directory routes, required public
assets, and two byte-identical copies of the tracked development menu fixture.
It applies preview-only `noindex,nofollow` metadata and robots disallow rules.
It does not contain Admin, API/server code, `.htaccess`, production manifests,
runtime state, release artifacts, or configuration.

Local Vite development and preview serve the tracked
`src/menu/fixtures/current.json` at the same `managed-menu/current.json` and
`previous.json` paths used in production. No local database or PHP runtime is
required. The fixture is a self-contained development artifact and is not
generated from, or synchronized with, production menu data. The Pages build
reuses this same fixture and does not change the production snapshot boundary.

## Public routes

- `/` and `/index.html` — Landing
- `/menu` — Menu (canonical public URL; Nginx serves the internal static build
  entry and redirects legacy `/menu.html` visits)
- `/menu2` — retired noncanonical compatibility route; production and the
  static Pages entry redirect to the unified canonical `/menu`
- `/admin/` — separately built authenticated menu editor

The admin has two database-backed roles. Owners select one global Simple or Advanced mode;
cashiers only receive Simple. Both can edit daily category/item details, base
and existing option prices, images, ordering, archives, and explicit deletions.
Category introductions/layout, item metadata, external option codes, and publish retry remain owner-only. The Node API enforces this independently of the UI.
Advanced expands every category and shows all advanced fields directly; Simple
omits metadata, option management, revisions, recovery tools, and reports.
Special Offer and Price Options are fully editable in Simple and Advanced, including cashier Simple.
Special Offer uses the existing `is_featured` column; legacy `metadata.featured` is preserved on read and normalized on save.
Only external option codes, metadata, category display settings, and recovery are advanced.
The right-side category index opens and focuses each section (a horizontal bar
on phones). Deletions take effect on save and can be undone before saving.
Owners receive a paginated cashier activity report in Advanced with timestamps, revisions,
and before/after values. Menu saves and media uploads are logged transactionally;
failed saves are not reported as completed changes. Unsaved local drafts are not
persisted activity. Apply `server-node/migrations/002_admin_activity.sql` with the
existing migration runner before activating the new API; see `OPERATIONS.md`.
Admin sessions are bound to a database credential generation; the interactive
password-rotation CLI increments it without changing either role's permissions.

Vite builds Landing and the canonical Menu as public React entry points.
`menu2.html` is a lightweight compatibility redirect for static hosts. Public
links, QR codes, metadata, and crawlers continue to use `/menu` as the only
canonical Menu.

## Source ownership

- `src/landing/` owns the Landing components and motion.
- `src/menu/` owns the unified grid/list Menu rendering plus shared snapshot,
  preference, runtime, and category-navigation behavior.
- `src/menu2/` owns only the legacy compatibility redirect.
- `src/admin/` owns the isolated admin bundle.
- `src/styles/` preserves the approved visual system.
- `assets/` owns code-managed fonts, brand assets, icons, and public imagery.
- SQLite is authoritative for edited production menu data; the public menu fetches only
  persistent `managed-menu/current.json`, then `previous.json` as recovery.
- `managed-media/` is persistent runtime storage. Production releases ship only
  the code-owned placeholder from the historical local menu-image set.

The superseded generated frontend, pre-admin JSON/Excel/import/generator
toolchain, and retired Summer Pause campaign are isolated under `legacy/` for
recoverable historical reference. They are not build, release, provisioning,
deployment, menu-editing, or active product inputs.

The current Menu renders the thin `metal-fx` category rule for every category.
The effect is decorative and capability-gated: the content remains ordinary
React/CSS when WebGL is unavailable or Metal-FX initialization fails.

## Source and release workflow

Normal work uses Git as the source of truth and a manual production deployment:

```text
edit source
  -> validate/build locally
  -> commit + push
  -> package the intended exact release
  -> back up production
  -> deploy a new immutable VPS release
  -> verify /, /menu, /admin/, /api/session
```

A Git push does not deploy production automatically. GitHub Pages remains a
frontend-only pre-production preview. Production deployment must preserve
`/var/lib/lcafe-site`, `/etc/lcafe-site`, SQLite, managed menu/media, backups,
and the separate L Cafe Operations service. ParsPack is rollback-only and must
not receive normal content or code edits.

Do not build on the VPS and do not modify files inside the active release in
place. Deploy a complete intended release, switch the release pointer atomically,
then run the required health checks. Production menu changes are made only
through the VPS Admin, not through ParsPack.

The canonical production runbook, current state ledger, persistent-data
boundaries, API recovery procedure, and deployment checklist are in
[`OPERATIONS.md`](OPERATIONS.md).

Repository ACTIVE, HISTORICAL, and PRIVATE-RUNTIME ownership is defined in
[`GOVERNANCE.md`](GOVERNANCE.md). SEO-only planning is scoped under
[`docs/seo/`](docs/seo/); it is not the project state or general product roadmap.

## Landing versions and source maintenance

| Purpose | Location |
| --- | --- |
| Maintained production source | `main`; Original is the deployment default |
| Original landing | `src/landing/OriginalLanding.jsx`, `src/styles/landing-original.css` |
| Redesign concept | `src/landing/RedesignLanding.jsx`, `src/styles/landing-redesign.css` |
| Archived concept baseline | `preview/homepage-editorial-redesign`; retained, not deployed automatically |
| Production snapshots | `production-*` tags; the active SHA is in PROJECT_STATE.md |

The shared landing selector changes the entire page between Original (`/index.html`) and Redesign (`/redesign.html`). Styles are isolated by separate HTML entry points. Set `VITE_LANDING_MODE=original` or `redesign` once at build/deploy time to choose the site-wide root default; `.env.production` pins Original. A query `?landing=original` allows selecting Original when Redesign is the default. Redesign keeps its concept photographs and is noindex. Both versions are included in each build. GitHub Pages previews only `main`, including both pages; it never deploys the VPS.

The `production` branch records the exact deployed VPS source, while `main` also carries subsequent deployment documentation. Update `production` only after a successful manual VPS deployment.
