# L Cafe

Static React + Vite frontend for the L Cafe Landing and Menu.

## Development

```sh
npm ci
npm run validate:release
npm run dev
npm run build
npm run validate:dist
```

`npm run build` writes the deployable site to `dist/`. No Node server is needed
in production. The project is pinned to Node 20.19+ or 22.12+ (CI uses Node 22), matching the Vite 8 runtime
requirement.

`VITE_BASE_PATH` controls the public base and defaults to `/` for the custom
domain. The GitHub Pages workflow sets it to `/su/` and deploys `dist/` through
the official Pages artifact flow.

## Public routes

- `/` and `/index.html` — Landing
- `/menu.html` — Menu

Vite builds both HTML files as separate React entry points so the established
Menu URL remains compatible with QR codes and static hosting.

## Source ownership

- `src/landing/` owns the Landing components and motion.
- `src/menu/` owns Menu rendering and interaction state.
- `src/styles/` preserves the approved visual system.
- `menu.json` remains the only Menu content source.
- `assets/` and `uploads/` contain the existing public media and fonts.

The superseded generated-HTML toolchain is isolated under
`legacy/retired-generated-frontend/` for recoverable historical reference. It
is not part of the build and is not an alternative source of truth.

The current Menu renders the thin `metal-fx` category rule for every category.
The effect is decorative and capability-gated: the content remains ordinary
React/CSS when WebGL is unavailable or Metal-FX initialization fails.

`L_Cafe_Menu_Content.xlsx` is a generated view of `menu.json`, not a second
source of truth. Regenerate it after Menu data changes with `py menu_xlsx.py`.
The optional Python maintenance utilities use the packages pinned in
`requirements-tools.txt`; they are not production dependencies.

## Packaging and deployment

After `npm run build`:

```sh
py package.py
py deploy.py --dry-run
py deploy.py
```

`package.py` archives exactly the contents of `dist/`. `deploy.py` uploads that
same served file set and refuses to deploy when the build-manifest hashes no
longer match the active source tree. The internal `.lcafe-build.json` manifest
is intentionally excluded from the public upload ZIP.

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
