# L Cafe

React + Vite frontend with a PHP/MySQL menu-admin control plane and static
snapshot delivery for the public menu.

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

`VITE_BASE_PATH` controls the public base and defaults to `/` for the custom
domain. The manually dispatched GitHub Pages workflow sets it to `/su/` and
generates an approved artifact for the exact commit entered by the operator.

Local Vite development and preview serve the tracked
`src/menu/fixtures/current.json` at the same `managed-menu/current.json` and
`previous.json` paths used in production. No local database or PHP runtime is
required. Regenerate that preview fixture from the legacy reference with
`npm run menu:fixture`.

## Public routes

- `/` and `/index.html` — Landing
- `/menu.html` — Menu
- `/admin/` — separately built authenticated menu editor

Vite builds both HTML files as separate React entry points so the established
Menu URL remains compatible with QR codes and static hosting.

## Source ownership

- `src/landing/` owns the Landing components and motion.
- `src/menu/` owns Menu rendering and interaction state.
- `src/admin/` owns the isolated admin bundle.
- `src/styles/` preserves the approved visual system.
- MySQL is authoritative for edited menu data; the public menu fetches only
  persistent `managed-menu/current.json`, then `previous.json` as recovery.
- `menu.json` is legacy migration/reference input and is not a public runtime
  data source.
- `managed-media/` is persistent runtime storage. Legacy menu images remain in
  source for migration/local preview, but production releases ship only the
  code-owned placeholder from that legacy set.

The superseded generated-HTML toolchain is isolated under
`legacy/retired-generated-frontend/` for recoverable historical reference. It
is not part of the build and is not an alternative source of truth.

The current Menu renders the thin `metal-fx` category rule for every category.
The effect is decorative and capability-gated: the content remains ordinary
React/CSS when WebGL is unavailable or Metal-FX initialization fails.

`L_Cafe_Menu_Content.xlsx` is a historical generated view of the legacy
`menu.json`, not a second source of truth. The optional Python maintenance
utilities use the packages pinned in `requirements-tools.txt`; they are not
production dependencies.

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
py deploy.py
```

`package.py` archives exactly the public contents of `release/current/`.
`deploy.py` uploads that same served file set. Both refuse missing, edited, or
unknown-commit release artifacts. The internal `.lcafe-build.json` and
`.lcafe-release.json` manifests are intentionally excluded from the public
upload ZIP and FTPS upload.

Deploy-owned temporary files are denied by `.htaccess` before staging begins.
On a host that still has the older `.htaccess`, the first deploy will stop before
creating any temporary upload. After confirming the FTP document root with
`--dry-run`, run the one-time bootstrap explicitly:

```sh
py deploy.py --bootstrap-htaccess
```

Future deploys verify the remote protection automatically and clean abandoned
`.lcafe-uploading` files before and after interrupted deployments. A genuinely
empty first-upload directory passed with `--new` bootstraps the same protection
automatically.
