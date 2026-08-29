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
domain. There is no active GitHub Pages deployment; the obsolete preview was
disabled after its workflow was retired.

Local Vite development and preview serve the tracked
`src/menu/fixtures/current.json` at the same `managed-menu/current.json` and
`previous.json` paths used in production. No local database or PHP runtime is
required. The fixture is a self-contained development artifact and is not
generated from, or synchronized with, production menu data.

## Public routes

- `/` and `/index.html` — Landing
- `/menu` — Menu (canonical public URL; Apache/LiteSpeed serves the internal
  `menu.html` build entry and permanently redirects legacy `/menu.html` visits)
- `/admin/` — separately built authenticated menu editor

The admin has two database-backed roles. Owners receive the complete editor and
publish-recovery controls. Cashiers retain normal category, item, price, media,
ordering, archive, save, and publish work while advanced category fields, item
metadata/options, and publish retry remain owner-only. PHP enforces this
boundary independently of the React UI.

Vite builds both HTML files as separate React entry points. The physical
`menu.html` file remains an internal static-hosting detail; public links, QR
codes, metadata, and crawlers use `/menu`.

## Source ownership

- `src/landing/` owns the Landing components and motion.
- `src/menu/` owns Menu rendering and interaction state.
- `src/admin/` owns the isolated admin bundle.
- `src/styles/` preserves the approved visual system.
- MySQL is authoritative for edited menu data; the public menu fetches only
  persistent `managed-menu/current.json`, then `previous.json` as recovery.
- `managed-media/` is persistent runtime storage. Production releases ship only
  the code-owned placeholder from the historical local menu-image set.

The superseded generated frontend and the pre-admin JSON/Excel/import/generator
toolchain are isolated under `legacy/` for recoverable historical reference.
They are not build, release, provisioning, deployment, or menu-editing inputs.

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

`--dry-run` is a local-only release/upload preview and never reads credentials
or connects. `--check-remote` connects read-only, confirms the existing target,
compares every release-owned file by SHA-256, and verifies staging protection;
it makes no remote change and never writes `.deploy-state.json`.

Deploy-owned temporary files are denied by `.htaccess` before staging begins.
The release owns its code-managed portion; ParsPack owns one final fenced
runtime block. Deployment preserves that block byte-for-byte and fails safely
on missing, malformed, or duplicate ownership markers.
On a host that still has the older `.htaccess`, the first deploy will stop before
creating any temporary upload. After confirming the FTP document root with the
read-only `--check-remote` command or the ParsPack file manager, run the one-time
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

The canonical ParsPack runbook, current live-state record, persistent-data
boundaries, API recovery procedure, and deployment checklist are in
[`OPERATIONS.md`](OPERATIONS.md).
