# L Cafe project state

Updated: 2026-09-03 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P1-B documentation baseline was `a0db4d7fb946c512ec04ff69c6d59ca15eba4e79` | commit-relative authoritative record |
| Source transition | This documentation-only transition records the successful consolidated production deployment of approved source `67c384a49f229ade119ca2cea86428d98357301a`: production and `release/current/` are aligned to that SHA; the non-destructive managed-media lifecycle foundation is deployed; the public menu snapshot and host-owned persistent runtime state were preserved; destructive cleanup remains disabled | commit-relative authoritative record plus owner-confirmed deployment result |
| Production SHA | `67c384a49f229ade119ca2cea86428d98357301a` | owner-confirmed production state |
| Release state | `release/current/` is the SHA-bound artifact for `67c384a49f229ade119ca2cea86428d98357301a` and is the active production release | artifact-observed plus owner-confirmed deployment result |
| Migration state | `001_menu_admin` active; `002_admin_roles` active; `003_media_lifecycle` active | owner-confirmed production state |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Deployment state | Production activation succeeded; `/`, `/menu`, `/admin/`, and logged-out `/api/session` are healthy; the host-owned fenced `.htaccess` runtime block was preserved unchanged; persistent MySQL, config, session, revision, media, and menu runtime state was preserved | owner-confirmed deployment result |
| Public menu snapshot | `managed-menu/current.json` remains revision `6` with SHA-256 `556aec17b82c1326ce463e104e8dd07e38e736bd0fa34ac5d04a0ea2dd61e682`; `previous.json` remains present | owner-confirmed deployment result |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Repository governance | `Lcafee/su` is public; normal direct pushes to `main` remain allowed; every push runs the frontend-only GitHub Pages preview workflow; Pages is pre-production only and does not approve, generate, or deploy a production release; `backup-remote` is unchanged | GitHub-observed plus source-defined workflow |
| Preview state | GitHub Pages uses the project base `/su/`; the Pages artifact is restricted to Landing, `/menu/`, `/menu2/`, required public assets/fonts, and preview copies of the tracked development menu fixture; the complete preview is `noindex,nofollow` | source-defined workflow and build guard |
| Blockers | No blocker remains for the completed consolidated production transition or the next roadmap work. Destructive archive/media cleanup remains intentionally deferred until the owner confirms the production backup retention horizon and coordinated database/snapshot/original/rendition restore contract. | owner directive plus unresolved destructive-cleanup gate |
| Current phase | Consolidated production deployment complete; the non-destructive managed-media lifecycle foundation is active in production; destructive eligibility and cleanup remain disabled | owner-confirmed deployment result |
| Next action | Resume the next separately authorized roadmap item. Do not begin destructive archive/media cleanup until the backup-retention and coordinated-restore contract is owner-confirmed. | current task boundary |
