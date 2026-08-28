# L Cafe handoff

## Active architecture

```text
/          -> index.html       -> src/landing/main.jsx -> LandingApp
/menu      -> menu.html        -> src/menu/main.jsx    -> managed snapshot
/admin/    -> admin/index.html -> src/admin/main.jsx   -> /api
/api       -> server/public/api/index.php
                              -> api/_app/<approved-sha>/app
                              -> MySQL + persistent runtime paths
```

The public and admin UIs are separate React + Vite entry points. Production has
no Node server. Apache/LiteSpeed exposes physical `menu.html` canonically as
`/menu`. The PHP/MySQL control plane edits and publishes menu state; public menu
requests never query MySQL and instead fetch `managed-menu/current.json`, then
`previous.json` as recovery.

The retired generated-HTML/Python/runtime-loader implementation is isolated in
`legacy/retired-generated-frontend/` as read-only history and is excluded from
the active build.

## Ownership

- `src/landing/`, `src/menu/`, `src/admin/`, and `src/styles/` own UI behavior.
- `server/app/`, `server/public/api/`, `server/migrations/`, and `server/bin/`
  own the control plane, provisioning, and one-time migration.
- MySQL owns editable production menu content and revision state.
- `managed-menu/` and `managed-media/` are public persistent runtime output;
  private config, sessions, revision archives, and originals remain outside the
  document root.
- `menu.json` is legacy migration/reference data. The tracked snapshot under
  `src/menu/fixtures/` supports local Vite development only.

`MenuApp` owns category navigation; memoized category/product boundaries and a
shared `ResizeObserver` manage rendering. Variants are informational rows, not
selections. `metal-fx` is a capability-gated decorative enhancement: ordinary
React/CSS content remains usable when WebGL is absent or initialization fails.

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
the internal manifests from public output.

Approved generation is a hard stop. Deployment requires separate explicit
authorization. Code deployment never publishes menu changes or owns persistent
runtime data. See `OPERATIONS.md` for the live-state record, ParsPack procedure,
read-only remote audit, and recovery guidance.

## Content workflow

Production menu copy, order, prices, photos, Sepidz codes, variants, and add-ons
are edited in `/admin/`, saved to MySQL, and published to the managed snapshot.
Do not edit JSX, `menu.json`, the Excel export, or the local fixture as a way to
change the live menu. `menu.json`, `menu_xlsx.py`, and `optimize_images.py` remain
migration/maintenance utilities only.

For UI/code changes, edit source, validate, commit, push, obtain exact-SHA
approval, generate the release, then stop at the approval boundary. For host or
runtime work, follow `OPERATIONS.md` and preserve all persistent paths.
