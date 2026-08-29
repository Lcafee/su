# Repository governance

This document owns repository classification and documentation placement.
`PROJECT_STATE.md` remains the only mutable source/release/production-state
ledger. `OPERATIONS.md` owns durable operator procedure, not changing host
observations.

## ACTIVE

Active source and project authority are maintained as current inputs:

- application and server source: `src/`, `server/`, `admin/`, and `scripts/`;
- code-owned public assets: `assets/`;
- release and deployment source: `.htaccess`, `deploy.py`, `package.py`, the
  Vite configs, package manifests, and root HTML/robots/sitemap files;
- canonical project documents: `README.md`, `PRODUCT.md`, `DESIGN.md`,
  `ENTITY_SPEC.md`, `GROUND_TRUTH.md`, `HANDOFF.md`, `OPERATIONS.md`,
  `PROJECT_STATE.md`, `AGENTS.md`, and this file;
- design sidecar state: `.impeccable/`;
- scoped SEO planning: `docs/seo/`.

Files under ACTIVE ownership may be changed only through the workflow and
authority documented by their canonical owner. A filename under `assets/` is
not enough to prove use: source references and the explicit Vite copy list
define whether a public asset is active.

## HISTORICAL

`legacy/` contains recoverable history and is not an active build, release,
provisioning, deployment, menu-editing, or product-maintenance input. Its
subtrees include the retired generated frontend, pre-admin menu import history,
and the retired Summer Pause campaign.

Historical files stay available for provenance. Do not repair, modernize, or
silently promote them back into active source. A deliberate restoration must
first establish a new active owner and update this document.

## PRIVATE-RUNTIME

The following are local generated state or host-owned persistent state and do
not belong in tracked source:

- local/generated: `.git/`, `.claude/`, `node_modules/`, `dist/`,
  `graphify-out/`, `__pycache__/`, `lcafe-site.zip`, logs, temporary office
  files, `.deploy-state.json`, and `.deploy.ini`;
- retained untracked source material: root `uploads/`; it has no active build or
  runtime ownership, and any promoted code asset must move into `assets/`;
- approved local artifacts: `release/`; `release/legacy-approved/` is retained
  until a separately authorized retention decision;
- host runtime: `.lcafe-private/`, `server/config.php`, `managed-menu/`,
  `managed-media/`, database/session/revision/original-media state, and the
  fenced host-owned runtime block in live root `.htaccess`.

Credentials, real hostnames, account identifiers, absolute host paths, and the
contents of the host runtime block must remain in the approved private operator
record or host configuration, never in Git.

## Change and removal rules

- Preserve Git history where it already provides recovery; do not keep obsolete
  active-tree copies solely as informal backups.
- Remove an asset only when active source references and release/build copying
  both show that it has no active dependency.
- Keep mutable production facts only in `PROJECT_STATE.md`; do not duplicate
  them across runbooks.
- Release generation, deployment, production access, and menu publication each
  require their own explicit authorization.

## GitHub governance

`Lcafee/su` is private. Normal direct pushes to `main` remain allowed. The
current GitHub plan does not provide branch deletion or force-push protection
for this private repository, so those safeguards are not active. This is an
accepted residual governance risk and does not block continued development.

No pull-request requirement, approval requirement, CI, required status check,
workflow, merge queue, or deployment automation was added. No tracked
`.github/` policy or workflow currently exists. Revisit branch protection only
if the GitHub plan changes.

The remote `backup-remote` branch remains intentionally preserved without
rewrite, deletion, tagging, or other mutation.
