# L Cafe production operations

This is the canonical production runbook. Mutable live state, release SHAs,
revision numbers, rollback state, and blockers are authoritative only in
`PROJECT_STATE.md`.

Liara/VPS is the active production environment. ParsPack is retained unchanged
as rollback only and must not be used for normal edits or deployments.

## Production architecture

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

Main Site owns only its isolated VPS paths/service. L Cafe Operations remains a
separate application and must not be restarted, reconfigured, or written during
Main Site deployment.

Persistent production state lives outside immutable releases:

- `/var/lib/lcafe-site` — SQLite, managed menu/media, revisions, originals,
  backups, and runtime state;
- `/etc/lcafe-site` — private configuration;
- `/srv/lcafe-site/releases/<sha>` — immutable code releases;
- `/srv/lcafe-site/current` — active release symlink.

Never copy persistent data into a release or replace persistent directories
during code deployment.

## Edit authority

The VPS Admin at `/admin/` is the only production menu edit authority.

Production menu changes flow:

```text
/admin/
  -> Node/Fastify API
  -> SQLite
  -> managed-menu/current.json
  -> public /menu
```

Do not edit production menu content on ParsPack, in JSX, in local fixtures, or
by changing generated snapshots manually.

## Manual code deployment workflow

Production deployment is intentionally manual:

```text
edit source
  -> validate/build locally
  -> commit + push
  -> package the intended exact release
  -> back up production
  -> deploy new immutable release
  -> switch /srv/lcafe-site/current
  -> verify production
```

A Git push does not deploy production automatically. GitHub Pages is only a
frontend preview.

Before deployment:

1. confirm the exact intended commit;
2. run the repository validation/build commands;
3. create the exact VPS release artifact from that source;
4. take a current production backup;
5. confirm Operations is healthy and untouched;
6. record the current active release so rollback is deterministic.

Do not build on the VPS and do not edit files inside the active release in
place.

## Backup contract

A production backup must cover the coordinated persistent generation needed to
restore service, including SQLite and managed content. Use the release-owned
Node backup tooling where applicable and keep at least one verified copy
off-host.

A backup is not accepted only because files exist. Restoration evidence should
include SQLite integrity/FK checks and the expected edit/published revision.

## Deployment verification

After switching the active release, verify at minimum:

- `/` — HTTP 200 over HTTPS;
- `/menu` — HTTP 200;
- `/admin/` — HTTP 200 and current assets load;
- `GET /api/session` — HTTP 200 with valid JSON;
- `/readyz` — healthy with expected edit/published revision;
- `managed-menu/current.json` — expected revision;
- referenced managed media — HTTP 200;
- HTTP redirects to HTTPS;
- `www` redirects to apex as configured;
- `lcafe-site-api.service` is active;
- L Cafe Operations remains active and unchanged.

For a production Admin/auth change, also verify a real login/logout cycle when
the change affects authentication or session behavior.

## Rollback

ParsPack is retained as a DNS-level rollback destination and must remain
unchanged until explicitly retired.

Normal VPS code rollback should prefer the previous verified immutable VPS
release and preserved persistent state. A DNS rollback to ParsPack is a separate
explicit recovery action, not part of routine deploys.

Do not retire ParsPack, merge migration PRs, or perform destructive historical
cleanup as a side effect of an unrelated release.

## TLS and Nginx

Nginx terminates TLS and serves public static content. Production certificate
state and current DNS values belong in `PROJECT_STATE.md`, not this durable
runbook.

Changes to Nginx or TLS must be syntax-checked and isolated to the Main Site
configuration. Never modify the existing L Cafe Operations Nginx configuration
as part of Main Site work.

## Admin and credentials

Admin sessions are server-side. Passwords, private environment values, database
contents, and account secrets never belong in Git, logs, tracked docs, or shell
history.

Use only the current release's supported account/session tooling. Do not mutate
credential/session fields with ad-hoc SQLite statements.

## Repository and documentation protocol

For every production deployment record:

- exact release SHA;
- backup generation used;
- release switched from/to;
- health-check result;
- menu edit/published revision before and after;
- rollback action if any.

Keep secrets and absolute private credential details outside Git.

After mutable live state changes, update `PROJECT_STATE.md`. Update this file
only when the durable production procedure or ownership model changes.

Migration-era instructions under `deploy/vps/` are historical execution
records unless a document explicitly says it is the active production runbook.
