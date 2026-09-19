# Main Site Production Cutover

Status: historical accepted cutover record. The Liara/VPS cutover is complete; this file is no longer an active execution contract. Use `OPERATIONS.md` for current production procedure and `PROJECT_STATE.md` for live state.

## Fixed boundaries

Main Site:
- active tested application release: `b8afd23722e6d8400af1207b0474de1f1888df83`
- API: `127.0.0.1:3100`
- state: `/var/lib/lcafe-site`
- config: `/etc/lcafe-site`
- service: `lcafe-site-api.service`

Operations must remain untouched:
- `lcafe.service`
- `127.0.0.1:3000`
- `/app`
- `/var/lib/lcafe`
- `/etc/lcafe`
- `/etc/nginx/sites-available/lcafe`

Do not stop or restart Operations. Every Nginx change must pass `nginx -t` before a graceful reload.

Do not retire/delete ParsPack, PHP/MySQL, the older Main Site release, or any rollback material during this task.



## DNS-already-changing emergency ordering

Because the owner has already initiated DNS changes, do not leave `l-cafe.ir` falling through to the existing default Operations Nginx vhost while propagation occurs.

Use this ordering:
1. record the old ParsPack rollback destination if it is immediately available;
2. install/enable the Main Site HTTP-bootstrap vhost and verify Operations is still healthy;
3. freeze normal menu edits on both backends;
4. perform the fresh ParsPack reconciliation and backup gate;
5. issue TLS and activate HTTPS only after reconciliation succeeds.

The HTTP-bootstrap vhost may temporarily serve the already-verified staged generation while reconciliation runs. Do not treat that temporary HTTP availability as production acceptance, and do not permit Admin login/editing until HTTPS and final reconciliation are complete.

## 1. Record rollback facts first

Before public activation, privately record:
- VPS public IPv4 receiving the new DNS record;
- current public A/CNAME answers for `l-cafe.ir` and `www.l-cafe.ir` from at least two public resolvers;
- the old ParsPack destination needed to reverse DNS if rollback is required;
- active Main Site release symlink;
- current edit/published revision and current.json SHA-256.

If the old ParsPack destination cannot be recovered from the DNS/provider/cPanel history, report that as a rollback deficiency. Do not invent it.

## 2. Fresh final ParsPack reconciliation

The staging import is revision 65 and must not be assumed current merely because staging is healthy.

Take a fresh read-only ParsPack capture immediately before final public activation:
- production MySQL dump;
- `managed-menu/current.json`;
- `managed-menu/previous.json`;
- managed media;
- menu revision archive;
- originals when available (archival, not required to serve public traffic).

Compare revision/hash/state with the staged VPS state.

### If ParsPack is still exactly the staged generation

If current revision/hash and database/menu/media/revision state are unchanged from the verified rev65 capture, record `FINAL_RECONCILIATION_UNCHANGED` and continue.

### If ParsPack changed

Do not patch the live SQLite database row-by-row.

Import the fresh capture into a new disposable SQLite target with the existing migration/import/verify tools. Require full verifier PASS against the fresh current/previous/media/revisions inputs.

Then:
1. create/verify a backup of the currently active VPS state;
2. stop only `lcafe-site-api.service`;
3. preserve the old DB as rollback material;
4. atomically place the verified replacement DB and synchronize the matching persistent snapshots/media/revision archive;
5. restore ownership/modes;
6. start only `lcafe-site-api.service`;
7. require health/ready and snapshot/media verification before continuing.

Never mix a new database with old current.json/media or vice versa.

## 3. Backup gate

Create a private backup directory outside the public roots, for example:

`/root/lcafe-main-site-backups/<UTC-timestamp>/`

Create:
- an online SQLite backup using `server-node/scripts/backup-state.mjs`;
- a tar archive of `managed-menu`, `managed-media`, `menu-revisions`, and `media-originals`;
- a private copy of Main Site configuration if appropriate for disaster recovery; never print its contents.

Record SHA-256 for backup artifacts.

Restore-drill the SQLite backup into a disposable path and require:
- `integrity_check = ok`;
- zero foreign-key violations;
- edit/published revision equals the active generation.

Copy/download the backup set off the VPS if the connected operator environment supports it. If off-box copy is impossible, report it explicitly; do not claim the off-box gate passed.

## 4. Public HTTP bootstrap while DNS propagates

The repository provides:

`deploy/vps/lcafe-site.http-bootstrap.nginx.conf`

Install it as a Main Site-only Nginx site, separate from the Operations site. It:
- serves the already-tested Main Site over HTTP;
- exposes the ACME webroot under `/.well-known/acme-challenge/`;
- does not enable Admin login over insecure HTTP;
- does not touch Operations.

Use `/var/www/letsencrypt` as the ACME webroot. Confirm the directory exists and is readable by Nginx.

Before reload:
- ensure no existing Main Site production server block conflicts;
- run `nginx -t`;
- if validation fails, restore the previous Main Site Nginx state;
- graceful reload only.

After reload confirm:
- Operations still active on 3000;
- `Host: l-cafe.ir` reaches the Main Site on port 80 locally;
- an ACME challenge test file can be fetched through the Main Site HTTP vhost.

## 5. TLS certificate

Wait until the hostname being certified resolves publicly to this VPS.

Prefer a webroot certificate flow so Nginx/Operations are not stopped.

If Certbot is absent, installing the distro `certbot` package is authorized for this Main Site cutover. Do not use a plugin that rewrites the Operations Nginx configuration.

Certificate names:
- always `l-cafe.ir`;
- include `www.l-cafe.ir` only when its public DNS also resolves correctly to this VPS.

Use the ACME webroot:
`/var/www/letsencrypt`

Do not enable the repository production HTTPS config until the referenced certificate/key actually exist.

If only `l-cafe.ir` is publicly certifiable and `www.l-cafe.ir` is not yet ready, use `deploy/vps/lcafe-site.apex.nginx.conf` after issuing an apex-only certificate. Replace it with the full `lcafe-site.nginx.conf` only after `www` DNS is correct and the certificate has been reissued/expanded to cover both names.

## 6. Activate production HTTPS vhost

Repository configs:

- full apex + www: `deploy/vps/lcafe-site.nginx.conf`
- temporary apex-only fallback: `deploy/vps/lcafe-site.apex.nginx.conf`

Install it as a separate Main Site Nginx site. Do not edit the existing Operations file.

Perform the switch fail-closed:
1. stage the production Main Site config;
2. disable only the temporary Main Site HTTP-bootstrap symlink;
3. enable the Main Site production symlink;
4. run `nginx -t`;
5. on failure, restore the HTTP-bootstrap Main Site symlink and leave Operations untouched;
6. on success, graceful reload Nginx.

The production vhost must route:
- static Landing/Menu/Admin directly from `/srv/lcafe-site/current/dist`;
- managed snapshots/media directly from `/var/lib/lcafe-site`;
- only `/api/*` to `127.0.0.1:3100`.

## 7. HTTPS production checks

Minimum checks after activation:
- `https://l-cafe.ir/` -> 200;
- `https://l-cafe.ir/menu` -> 200;
- `https://l-cafe.ir/admin/` -> 200;
- `https://l-cafe.ir/api/session` -> 200;
- `https://l-cafe.ir/managed-menu/current.json` -> active reconciled revision;
- at least one referenced managed-media URL -> 200 `image/webp`;
- legacy menu routes redirect to canonical `/menu`;
- HTTP apex redirects to HTTPS after production config is active;
- certificate hostname/validity is correct;
- `lcafe-site-api.service` active;
- `lcafe.service` active;
- ports 3100 and 3000 still owned by their respective apps;
- `nginx -t` PASS.

## 8. Real Admin authentication gate

A logged-out `/api/session` check is not enough for cutover acceptance.

Over real HTTPS:
1. perform one interactive login with an existing owner account;
2. confirm authenticated session loads the existing menu at the reconciled revision;
3. do not change/publish menu content merely for testing;
4. logout and confirm the session is invalidated.

Never place the plaintext credential in shell history, tracked files, logs, or chat output. If the automation has no secure credential path, ask the owner to perform the login interactively instead of requesting the password in text.

## 9. Propagation and rollback

During DNS propagation, some clients may still reach ParsPack. Keep ParsPack unchanged and available as rollback.

Do not make normal menu edits on both backends during the split-DNS interval. Once the VPS is accepted as production, use the VPS Admin as the only edit authority.

Rollback if the new public path has a material failure:
- restore DNS to the recorded ParsPack destination if required;
- keep the VPS state intact for diagnosis;
- do not delete or mutate the ParsPack rollback generation.

## Completion criteria

Production cutover is complete only when:
- final ParsPack reconciliation PASS;
- backup/restore PASS (and off-box status explicitly recorded);
- public DNS reaches the VPS for the intended hostname(s);
- valid HTTPS is active;
- public routes/media/API PASS;
- real Admin login/logout PASS;
- Operations remains healthy/untouched.

After those facts are observed, update `PROJECT_STATE.md` with the live VPS production state and then consider merging PR #7. ParsPack retirement is a later explicit action.
