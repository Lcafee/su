# Shared VPS Isolation Contract

Status: canonical host-boundary contract for L Cafe Main Site while it shares one VPS with L Cafe Operations Platform.

## Purpose

L Cafe Main Site and L Cafe Operations Platform may run on the same Liara VPS to reduce infrastructure cost and duplicated services. Sharing the host does **not** make them one application, one deployment unit, or one operational scope.

The only intentionally shared layer is the VPS operating system and explicitly shared infrastructure such as Nginx/TLS. Application code, processes, databases, writable state, secrets, deployments, logs, backups, and agent authority remain isolated.

## Application ownership

| Concern | Main Site | Operations |
| --- | --- | --- |
| Repository | `Lcafee/su` | `Lcafee/l-cafe-operations-platform` |
| Public domain | `l-cafe.ir`, `www.l-cafe.ir` | `ops.lcafe-esf.ir` |
| Service | `lcafe-site-api.service` | `lcafe.service` |
| Bind | `127.0.0.1:3100` | `127.0.0.1:3000` |
| Runtime user | `lcafe-site` | Operations-owned; latest read-only preflight observed the existing service running as `root` |
| Code root | `/srv/lcafe-site` | `/app` |
| Data root | `/var/lib/lcafe-site` | `/var/lib/lcafe` |
| Config root | `/etc/lcafe-site` | `/etc/lcafe` |
| Database | `/var/lib/lcafe-site/site.sqlite` | `/var/lib/lcafe/lcafe.sqlite` |

These ownership boundaries are hard boundaries, not naming conventions.

## Main Site runtime model

The Main Site is optimized so normal customer traffic does not depend on the application process:

- Nginx serves Landing/Menu/Admin build output as static files.
- Nginx serves `managed-menu/*` and `managed-media/*` directly.
- only `/api/*` is proxied to the Main Site control-plane process on `127.0.0.1:3100`.
- the Main Site API owns only Main Site authentication, menu editing/publishing, media processing, and Main Site SQLite state.
- Operations traffic never routes through the Main Site process.

The public menu snapshot remains the customer-serving boundary; an API restart must not make the already-published public menu unavailable.

## Filesystem isolation

`lcafe-site` must not have write access to Operations-owned state. The reciprocal Operations runtime-user policy is owned by the Operations project; Main Site migration must not change or normalize the currently observed Operations service user.

Required separation:

```text
/srv/lcafe-site/            # Main Site code
/var/lib/lcafe-site/        # Main Site DB, snapshots, managed media, private originals
/etc/lcafe-site/            # Main Site private configuration

/app/                       # Operations code
/var/lib/lcafe/             # Operations DB/runtime state
/etc/lcafe/                 # Operations private configuration
```

Never place one application's SQLite file, upload directory, secrets, generated state, or logs under the other application's roots.

## Process and service isolation

- one systemd service per application;
- no shared Node process;
- no shared application process manager configuration;
- no command in a Main Site deployment may restart, stop, reload, migrate, or inspect-write `lcafe.service`;
- no Operations deployment may restart, stop, reload, migrate, or inspect-write `lcafe-site-api.service`;
- application-specific deploy users should receive service-specific `sudo` permissions only, not unrestricted service control.

A change to one application must be deployable and rollbackable without restarting the other application.

## Database isolation

The applications must never share a SQLite file, schema, migration runner, connection pool, or backup transaction.

Main Site migrations may operate only on `/var/lib/lcafe-site/site.sqlite`.
Operations migrations may operate only on `/var/lib/lcafe/lcafe.sqlite`.

Cross-project joins, direct reads, or "temporary" access to the sibling database are forbidden. If future product integration is required, it must use a separately designed API/event contract rather than filesystem or database coupling.

## Nginx and TLS

Nginx is shared infrastructure, but ownership remains separated by server block/config file.

Expected split:

```text
/etc/nginx/sites-available/lcafe-site.conf
/etc/nginx/sites-available/lcafe-ops.conf
```

A Main Site task may prepare or validate the Main Site server block but must not rewrite the Operations server block. An Operations task has the reciprocal restriction.

Any change that genuinely modifies global Nginx behavior, shared TLS policy, host firewalling, system packages, peer-project users, disks, or host-wide resource limits is a **separate shared-infrastructure task** and must evaluate both applications before applying the change. Creating the dedicated `lcafe-site` user and installing a Main Site-only server block are permitted only when the owner explicitly scopes Main Site staging/provisioning; they still do not authorize changes to Operations.

## Deployment isolation

Each repository owns only its own deployment workflow.

Main Site deployment may modify only Main Site release/code paths, Main Site persistent paths, `lcafe-site-api.service`, and the Main Site Nginx server block when explicitly in scope.

Operations deployment may modify only Operations release/code paths, Operations persistent paths, `lcafe.service`, and the Operations Nginx server block when explicitly in scope.

Do not create a generic deploy script with write authority over both applications.

## Secrets and configuration

Secrets are application-specific:

```text
/etc/lcafe-site/*   # Main Site only
/etc/lcafe/*        # Operations only
```

Do not reuse application credentials merely because the services run on one host. Do not copy secrets into the sibling repository or sibling environment.

## Backups and restore

Backups must be independently identifiable and independently restorable.

- Main Site backup set: Main Site SQLite, published snapshots, managed media, private originals/revision archive as applicable.
- Operations backup set: Operations SQLite and Operations-owned persistent state.

A restore procedure for one application must not overwrite or stop the other application.

## Resource sharing

CPU, RAM, disk, network, and Nginx are physically shared resources. Capacity changes are therefore infrastructure concerns, but application optimization remains project-scoped.

Before host-wide resource changes, inspect both services. Do not solve Main Site pressure by changing Operations configuration, or vice versa, unless the task is explicitly scoped as shared infrastructure.

## Agent / automation rule

For any Main Site task:

1. read `.agent/project-boundary.json`;
2. treat every `forbidden_targets` entry as unavailable for mutation;
3. do not use the sibling repository or runtime as a source of implementation authority;
4. stop before making shared-host/global infrastructure changes unless the user explicitly scoped the task for both applications;
5. never "clean up" or normalize sibling paths/services while deploying Main Site.

The fact that both applications run on the same VPS is context for safety, **not permission to cross project boundaries**.

## Incident rule

If a Main Site deployment or migration exposes a problem in Operations, preserve Operations state and report it separately. Do not repair Operations from a Main Site task. The reciprocal rule applies to Operations tasks.

## Change rule

Any future change to domains, ports, users, service names, code/data/config roots, or the shared-host topology must update this document and `.agent/project-boundary.json` in the affected repository. If the change affects both applications, both repositories' isolation documents must be updated in the same infrastructure change.