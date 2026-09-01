# L Cafe project state

Updated: 2026-09-01 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P1-B documentation baseline was `a0db4d7fb946c512ec04ff69c6d59ca15eba4e79` | commit-relative authoritative record |
| Source transition | This source transition records the non-destructive managed-media lifecycle foundation from baseline `4756273aedec6ecfb1a3c780b1fc205abad7cfe4`: shared advisory locking, authoritative reference inventory, orphan-candidate bookkeeping, revision-retention structure, and dry-run/reporting CLI are source-implemented; destructive cleanup is disabled; production and release state are unchanged, and no release or deployment was generated | commit-relative authoritative record |
| Production SHA | `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a` | owner-confirmed production state |
| Release state | `release/current/` is the SHA-bound artifact for `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a`; it is the current production release, while source HEAD is newer and has no approved release | artifact-observed plus owner confirmation |
| Migration state | `001_menu_admin` active; `002_admin_roles` active; `003_media_lifecycle` is source-defined but has not been released, deployed, or confirmed active in production | owner-confirmed production state plus source-defined transition |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Repository governance | `Lcafee/su` is private; normal direct pushes to `main` remain allowed; deletion/force-push protection is unavailable on the current GitHub plan; no PR, approval, CI, status-check, workflow, merge-queue, or deployment-automation requirement was added; `backup-remote` is unchanged | GitHub-observed plus owner acceptance |
| Blockers | No blocker to the non-destructive source foundation. Destructive archive/media cleanup remains factually gated until the owner confirms the production backup retention horizon and coordinated database/snapshot/original/rendition restore contract. Missing private-repository branch protection remains an accepted residual governance risk. | owner directive plus unresolved production fact |
| Current phase | Non-destructive managed-media lifecycle source foundation complete; destructive eligibility remains disabled; release and deployment remain separately authorized work | owner directive |
| Next action | In a separately authorized task, consolidate this source transition with the next approved release work; do not enable destructive cleanup until the backup/restore gate is owner-confirmed. QA, release generation, and deployment remain outside this source transition. | current task boundary |
