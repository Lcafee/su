# L Cafe

React + Vite frontend with a PHP/MySQL menu-admin control plane and static
snapshot delivery for the public menu.

Current mutable source, release, production, migration, phase, and blocker state
is authoritative in [`PROJECT_STATE.md`](PROJECT_STATE.md).

## Development

```sh
npm ci
npm run validate:release
npm run dev
npm run build
npm run validate:dist
```

`npm run build` writes disposable local output to `dist/`; it is not an approved
production release and the deploy tooling will not consume it. No Node server
is needed in production. The project is pinned to Node 20.19+ or 22.12+ (CI
uses Node 22), matching the Vite 8 runtime requirement.

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
- `/menu` — Menu (canonical public URL; Apache/LiteSpeed serves the internal
  `menu.html` build entry and permanently redirects legacy `/menu.html` visits)
- `/menu2` — retired noncanonical compatibility route; production and the
  static Pages entry redirect to the unified canonical `/menu`
- `/admin/` — separately built authenticated menu editor

The admin has two database-backed roles. Owners receive the complete editor and
publish-recovery controls. Cashiers retain normal category, item, price, media,
ordering, archive, save, and publish work while advanced category fields, item
metadata/options, and publish retry remain owner-only. PHP enforces this
boundary independently of the React UI.

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
- MySQL is authoritative for edited menu data; the public menu fetches only
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

Normal work has one editable source of truth and one GitHub flow:

```sh
# edit in this repository
git add <files>
git commit -m "Describe the change"
git push
```

That push updates only the GitHub Pages pre-production preview. Production
still requires owner approval of an exact pushed SHA, separate release
generation, and a separately authorized deployment task.

Only after a specific pushed commit is explicitly approved, generate its
production artifact with the full SHA:

```sh
npm run release:generate -- --approve <full-commit-sha>
```

The generator refuses a dirty working tree or a commit that is not present on
an `origin/*` branch. It builds a detached worktree for that exact commit and
atomically promotes the result to ignored `release/current/`. The artifact's
`.lcafe-release.json` records the commit and every generated file hash. Normal
`npm run build` and `npm run dev` never write there.

Release generation is the operating boundary: source changes, commit and push,
explicit approval, generate `release/current/`, then stop. Release approval does
not authorize production deployment. Codex may deploy only in a separate task
that explicitly instructs it to do so.

The pre-consolidation approved artifact is preserved unchanged under
`release/legacy-approved/`. It has no recorded Git SHA, so it is retained only
as a rollback/reference snapshot and is intentionally not accepted by the new
package or deploy commands.

## Manual packaging and production deployment

These commands are separate manual operations after release generation. They are
never invoked by a build, release command, Git hook, or GitHub workflow:

```sh
py package.py
py merge_htaccess.py --live .live.htaccess
py deploy.py --dry-run
py deploy.py --check-remote
py deploy.py
```

`package.py` archives the file-manager-safe public contents of
`release/current/`; it deliberately excludes root `.htaccess`. `deploy.py`
uploads the approved served set. Both refuse missing, edited, or
unknown-commit release artifacts. The internal `.lcafe-build.json` and
`.lcafe-release.json` manifests are intentionally excluded from the public
upload ZIP and FTPS upload.

For the File Manager path, first download the current live root `.htaccess` to
the ignored `.live.htaccess` path. `merge_htaccess.py` combines the approved
application rules with that file's single final host-owned runtime suffix and
writes the separate ignored `lcafe-merged.htaccess` staging artifact. It refuses
to overwrite the downloaded input and verifies that the opaque suffix is
byte-identical. The composite is uploaded separately through private cPanel
staging; it is never added to the public release ZIP or Git.

`--dry-run` is a local-only release/upload preview and never reads credentials
or connects. `--check-remote` connects read-only, confirms the existing target,
compares every release-owned file by SHA-256, and verifies staging protection;
it makes no remote change and never writes `.deploy-state.json`.

Deploy-owned temporary files are denied by `.htaccess` before staging begins.
The release owns its code-managed portion; the production host owns one final fenced
runtime block. Deployment preserves that block byte-for-byte and fails safely
on missing, malformed, or duplicate ownership markers.
On a host that still has the older `.htaccess`, the first deploy will stop before
creating any temporary upload. After confirming the FTP document root with the
read-only `--check-remote` command or the hosting file manager, run the one-time
bootstrap explicitly:

```sh
py deploy.py --bootstrap-htaccess
```

Future deploys verify the remote protection automatically and clean abandoned
`.lcafe-uploading` files before and after interrupted deployments. A genuinely
empty first-upload directory must be provisioned with its host runtime block
before deployment; `--new` does not bypass this requirement. The bootstrap
installs only release rules and never creates or reconstructs private content.

Host-specific PHP runtime settings remain outside release ownership. Never add
the private-config path, bootstrap path, or host-only runtime block to Git or a
generated release.

The canonical production runbook, current state ledger, persistent-data
boundaries, API recovery procedure, and deployment checklist are in
[`OPERATIONS.md`](OPERATIONS.md).

Repository ACTIVE, HISTORICAL, and PRIVATE-RUNTIME ownership is defined in
[`GOVERNANCE.md`](GOVERNANCE.md). SEO-only planning is scoped under
[`docs/seo/`](docs/seo/); it is not the project state or general product roadmap.
