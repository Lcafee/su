# Main Site VPS Migration Runbook

For the current concise execution contract, use `deploy/vps/MIGRATION_EXECUTION.md`. This longer runbook preserves the full sequence and cutover gates.

This runbook is intentionally staging-first. It must not modify the live ParsPack site, `l-cafe.ir` DNS, `lcafe.service`, `/app`, `/var/lib/lcafe`, or the Operations database.

## 0. Required inputs

Keep outside Git:

- production MySQL dump;
- `current.json`;
- `previous.json`;
- extracted `managed-media/` or the original `managed-media.zip` for private extraction;
- extracted `menu-revisions/` or the original `menu-revisions.zip` for private extraction;
- private `media-originals/` when available for archival migration.

Never commit the SQL dump or private config.

## 1. Use the committed locked dependency set

`server-node/package-lock.json` is already committed and CI-verified. Deployment must use `npm ci`; do not regenerate or update dependencies during staging.

## 2. Build a disposable SQLite migration target

Use a fresh directory. Never point the importer at a live DB.

```bash
export LCAFE_SITE_DATA_ROOT=/tmp/lcafe-site-migration
export LCAFE_SITE_DB=/tmp/lcafe-site-migration/site.sqlite
cd server-node
npm run migrate
npm run import:parspack -- --sql /secure/input/h415280_lcafe_prod.sql
```

The importer is fail-closed and refuses a non-empty target database.

## 3. Verify the imported snapshot

```bash
npm run verify:import -- \
  --current /secure/input/current.json \
  --previous /secure/input/previous.json \
  --media-dir /secure/input/managed-media \
  --revisions-dir /secure/input/menu-revisions
```

Do not continue if any count, hash, FK, integrity or media check fails.

## 4. Build/package the staging release off-host

Build the exact approved SHA in the connected operator/Claude/CI workspace, never on the VPS:

```bash
node deploy/vps/package-staging-release.mjs \
  --approve <full-approved-sha> \
  --out /tmp/lcafe-main-site-<full-approved-sha>.tar.gz
```

The packager runs the existing frontend build/validation in a detached exact-SHA worktree and writes a hash-bound manifest into the archive. Record the printed archive SHA-256 and transfer the archive to a private root-only VPS path. The VPS bootstrap verifies both the transport hash and embedded manifest before installing it.

The VPS may run locked `npm ci --omit=dev` for the Node API runtime dependencies, but it must not build the frontend.

## 5. VPS preflight — read only

Before provisioning Main Site, capture:

```bash
free -h
df -h
systemctl status lcafe --no-pager
systemctl status nginx --no-pager
ss -ltnp
node --version
nginx -T
```

Do not print secrets. Confirm port 3100 and all proposed Main Site paths are free. Confirm Operations remains healthy on 127.0.0.1:3000.

## 6. Provision isolated Main Site identity/state

Create dedicated runtime ownership only:

```text
user/group: lcafe-site
code:       /srv/lcafe-site
state:      /var/lib/lcafe-site
config:     /etc/lcafe-site
service:    lcafe-site-api.service
bind:       127.0.0.1:3100
```

Do not grant `lcafe-site` write access to Operations paths.

## 7. Stage an immutable release

Use the verified off-host archive with `deploy/vps/bootstrap-staging.sh <sha> <archive> <archive-sha256>`. The bootstrap verifies source scope, archive integrity, and the embedded file manifest before atomic release promotion.

Release shape:

```text
/srv/lcafe-site/releases/<git-sha>/
/srv/lcafe-site/current -> releases/<git-sha>
```

Copy the verified SQLite database and persistent snapshots/media into `/var/lib/lcafe-site` before starting the API. Persistent state is not stored inside the release. Before service start, the SQLite database and sidecars must be owned by `lcafe-site:lcafe-site`; never run the API as root to bypass permissions.

## 8. Install service and isolated Nginx config

- install `deploy/vps/lcafe-site-api.service` as its own systemd unit;
- create `/etc/lcafe-site/site.env` from the example with root-only permissions;
- install the Main Site Nginx server block separately from the existing Operations server block;
- run `nginx -t` before reload;
- start only `lcafe-site-api.service`;
- do not restart `lcafe.service`.

## 9. Staging validation

Use a staging hostname or hosts-file override before changing production DNS.

Required checks:

- `/`, `/menu`, `/admin/` render correctly;
- legacy menu redirects match production;
- `current.json` revision 65 and all media load;
- API health/ready checks pass;
- full admin API compatibility tests pass once route implementation is complete;
- visual regression for fixed mobile and desktop viewports passes;
- Operations remains healthy throughout.

## 10. Backup/restore gate

Before production cutover:

- create an SQLite online backup;
- archive managed menu/media/private revision state;
- copy backup off-box;
- perform one restore drill into a disposable path;
- run `verify:import` or equivalent post-restore verification.

## 11. Cutover

Only after all gates pass:

1. reduce DNS TTL ahead of the planned change if needed;
2. take a final short read-only production snapshot/reconciliation if content changed since the migration input was captured;
3. import/reconcile that delta or recapture the snapshot;
4. switch `l-cafe.ir`/`www.l-cafe.ir` to the VPS;
5. verify public and admin routes;
6. retain ParsPack unchanged as rollback-only during the observation window.

Do not retire PHP/MySQL/ParsPack until the new runtime is explicitly accepted.
