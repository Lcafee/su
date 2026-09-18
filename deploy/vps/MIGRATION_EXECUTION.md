# Main Site Migration Execution Guide

Use this file as the execution contract for staging the L Cafe Main Site on the Liara VPS. Keep execution concise; do not redesign, re-audit, or add QA beyond the gates below.

## Scope

Run on the actual VPS `ubuntu-lcafe-ops-beta` as root.

Main Site owns only:
- `/srv/lcafe-site`
- `/var/lib/lcafe-site`
- `/etc/lcafe-site`
- `lcafe-site-api.service`
- `127.0.0.1:3100`
- Main Site-specific Nginx staging/production files

Never mutate:
- `/app`
- `/var/lib/lcafe`
- `/etc/lcafe`
- `lcafe.service`
- `127.0.0.1:3000`
- existing `/etc/nginx/sites-available/lcafe`

Do not change DNS, production TLS, ParsPack, or merge PR #7 during this staging phase.

Owner scope for this task explicitly includes creating the Main Site-only `lcafe-site` OS user, installing the Main Site-only staging Nginx file, and a syntax-checked graceful Nginx reload. It does not authorize global Nginx changes or any Operations mutation.

## Known VPS state

- Ubuntu 24.04
- 2 vCPU / 3.8 GiB RAM
- Node 24.20.0
- nginx 1.24.0
- Operations healthy on `127.0.0.1:3000`
- Main Site API target: `127.0.0.1:3100`
- internal staging: `127.0.0.1:8081`

Keep prepared systemd limits:
- `NODE_OPTIONS=--max-old-space-size=256`
- `MemoryHigh=384M`
- `MemoryMax=640M`
- `CPUQuota=100%`
- `TasksMax=128`

## Production baseline

Expected:
- categories 12
- menu items 97 total / 90 active / 7 archived
- options 35
- media assets 126
- renditions 252
- menu revisions 65
- admin users 2
- edit revision 65
- published revision 65
- previous revision 64

Known SHA-256:
- SQL: `3e68990a2718e8bfd77adcb7ce130004ccd476b2d06ee2780342e1c98fbcd5a2`
- current.json: `3faeebfaa7c786c0d9e5c1ddfd5fd233f2550726c64028d741b9cec74f4fe3d7`
- previous.json: `dd35c31b4af97313a324dbab90bee03ee53f49345ce8ceb3951d6248ec2d0f0e`
- managed-media.zip, only if original ZIP is present: `7aef6245273bb7a82cf046b5614e151616dce0cadea49d85099c11913d245d8c`

Do not compare ZIP hashes to extracted directories. Use `verify:import` for extracted managed-media and menu-revisions.

## Execution

1. Confirm hostname/root, `lcafe.service` active, port 3000 still Operations, port 3100 free.
2. Run `deploy/vps/bootstrap-staging.sh <approved-sha>`. Require `STAGING_BOOTSTRAP_OK`.
3. Required private inputs under `/root/lcafe-main-site-migration-input`:
   - `h415280_lcafe_prod.sql`
   - `current.json`
   - `previous.json`
   - either extracted `managed-media/` or `managed-media.zip`
   - either extracted `menu-revisions/` or `menu-revisions.zip`
   `media-originals/` is optional and non-blocking. If ZIP inputs are supplied, validate archive integrity and extract them only inside this private input root before running `verify:import`.
4. Verify only known file hashes above. Never print SQL contents, password hashes, sessions, or private env values.
5. In `/srv/lcafe-site/current/server-node`:
   - if `/var/lib/lcafe-site/site.sqlite` does not exist, run the prepared migration;
   - if it already contains imported app data, stop instead of deleting/overwriting it;
   - run the prepared ParsPack importer with explicit SQL and DB paths.
6. Run existing `verify:import` with explicit DB/current/previous/media/revisions paths. Require integrity/FK/revision/hash/content/media/archive checks to pass.
7. Before starting the service, ensure `/var/lib/lcafe-site/site.sqlite` and any SQLite sidecars are owned by `lcafe-site:lcafe-site`; the data directory must remain writable by `lcafe-site`. Never solve a permission failure by running the API as root.
8. Install verified persistent content into:
   - `/var/lib/lcafe-site/managed-menu/`
   - `/var/lib/lcafe-site/managed-media/`
   - `/var/lib/lcafe-site/menu-revisions/`
   - optional originals into `/var/lib/lcafe-site/media-originals/`
   Apply minimum ownership/permissions: `lcafe-site` writes persistent state; Nginx can read only public menu/media.
9. Configure `/etc/lcafe-site/site.env` without exposing its contents. Start/enable only `lcafe-site-api.service`.
10. Minimum required checks:
   - Main Site service active
   - `127.0.0.1:3100` listening
   - `/healthz` PASS
   - `/readyz` PASS with edit/published 65/65
   - `lcafe.service` still active on 3000
   - `nginx -t` PASS
   - internal staging `http://127.0.0.1:8081`: `/`, `/menu`, `/admin/`, current.json, managed media, `/api/session`
   - current.json revision 65

Do not require full login over the HTTP staging listener; production auth uses Secure cookies and the `https://l-cafe.ir` Origin.

## Stop condition

When internal staging is healthy, STOP. Do not perform DNS/TLS cutover, retire ParsPack/PHP/MySQL, merge PR #7, or modify Operations. A fresh ParsPack reconciliation is required immediately before final cutover.

If blocked, report only:
1. exact blocker
2. exact action/input required
3. last completed phase

Final status should be compact: bootstrap, source verification, SQLite import, import verification, persistent content, API, staging, Operations health, active release SHA, imported revision, blocker if any, next step.
