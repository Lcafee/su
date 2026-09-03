# L Cafe handoff

Mutable state is authoritative in `PROJECT_STATE.md`.

## Active architecture

```text
/          -> index.html       -> src/landing/main.jsx -> LandingApp
/menu      -> menu.html        -> src/menu/main.jsx    -> managed snapshot
/menu2     -> production redirect / static compatibility entry -> /menu
/admin/    -> admin/index.html -> src/admin/main.jsx   -> /api
/api       -> server/public/api/index.php
                              -> api/_app/<approved-sha>/app
                              -> MySQL + persistent runtime paths
```

The public and admin UIs are separate React + Vite entry points. Production has
no Node server. Apache/LiteSpeed exposes physical `menu.html` canonically as
`/menu`. `/menu2` redirects to that canonical route and its static compatibility
entry is noindex. The PHP/MySQL control plane edits and publishes menu state;
the unified Menu fetches `managed-menu/current.json`, then `previous.json` as
recovery, and never queries MySQL.

The retired generated frontend, pre-admin JSON/Excel/import/generator
implementation, and Summer Pause campaign are isolated under `legacy/` as
read-only history and are excluded from active build, release, provisioning,
deployment, and product-maintenance paths.

## Ownership

- `src/landing/`, `src/menu/`, `src/menu2/`, `src/admin/`, and `src/styles/` own
  UI behavior.
- `server/app/`, `server/public/api/`, `server/migrations/`, and `server/bin/`
  own the control plane, schema migrations, provisioning, and secure account
  creation.
- MySQL owns editable production menu content and revision state.
- `managed-menu/` and `managed-media/` are public persistent runtime output;
  private config, sessions, revision archives, and originals remain outside the
  document root.
- The tracked snapshot under `src/menu/fixtures/` supports local Vite and the
  isolated GitHub Pages preview; it is independent of production runtime state
  and archived menu inputs.
- Root `.htaccess` is composite: release code owns the public rules and the host
  owns the final fenced runtime block. Deployment preserves the block; manual
  ZIPs omit the root file.

`MenuRuntime` owns shared snapshot loading, fallback, retry, and hardened
category-navigation state. One `MenuApp` owns both grid and list presentations
through a local versioned preference and `data-menu-view`; switching preserves
the mounted product tree and the active section anchor. Memoized category/product
boundaries and a shared `ResizeObserver` manage rendering.
Variants are informational rows, not selections. `metal-fx` is a
capability-gated decorative enhancement: ordinary React/CSS content remains
usable when WebGL is absent or initialization fails.

## Build and release

```text
npm ci
npm run validate:release
npm run build
npm run validate:dist
```

`dist/` is disposable and never deployable. After a specific pushed full SHA is
explicitly approved, `npm run release:generate -- --approve <full-sha>` builds
that commit in a detached worktree and atomically updates ignored
`release/current/`. Its manifests bind the SHA, base path, inputs, and generated
hashes. `package.py` and `deploy.py` accept only that approved artifact and omit
the internal manifests from public output. File-manager packages also omit root
`.htaccess`; FTPS deployment composes its release-owned portion with the opaque
host runtime block.

Every push to `main` separately runs `npm run build:pages` and deploys
`dist-pages/` to the `/su/` GitHub Pages project path. That allowlisted artifact
contains only Landing, static directory entries for `/menu/` and `/menu2/`,
required public assets, and preview copies of the tracked fixture. Build guards
reject Admin/server modules, production/runtime files, missing preview search
isolation, and URLs outside `/su/`. This preview step never creates or deploys
a production release.

Approved generation is a hard stop. Deployment requires separate explicit
authorization. Code deployment never publishes menu changes or owns persistent
runtime data. See `OPERATIONS.md` for durable production procedure, read-only
remote comparison, and recovery guidance; see `PROJECT_STATE.md` for mutable
state.

## Content workflow

Production menu copy, order, prices, photos, Sepidz codes, variants, and add-ons
are edited in `/admin/`, saved to MySQL, and published to the managed snapshot.
Owners have the full editor and publish-retry control. Cashiers can perform
normal category/item/media/order/archive/save-and-publish operations, while
advanced category fields and item metadata/options are hidden and rejected by
the API if changed. Accounts are created only with the interactive host CLI.
Do not edit JSX, archived inputs, or the local fixture to change the live menu.
Both roles and migrations `001_menu_admin` and `002_admin_roles` are active in
production; the exact mutable record remains in `PROJECT_STATE.md`.

For UI/code changes, edit source, validate, commit, push, obtain exact-SHA
approval, generate the release, then stop at the approval boundary. For host or
runtime work, follow `OPERATIONS.md` and preserve all persistent paths.
