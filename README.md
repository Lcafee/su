# L Cafe

Static React + Vite frontend for the L Cafe Landing and Menu.

## Development

```sh
npm install
npm run dev
npm run build
```

`npm run build` writes the deployable site to `dist/`. No Node server is needed
in production.

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

The first real `metal-fx` prototype wraps the `روتین` category heading. It is
intentionally not enabled for the other categories yet.

## Packaging and deployment

After `npm run build`:

```sh
py package.py
py deploy.py --dry-run
py deploy.py
```

`package.py` archives exactly the contents of `dist/`. `deploy.py` uploads that
same file set and refuses to deploy a stale Vite build.
