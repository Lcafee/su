# L Cafe project state

Updated: 2026-09-01 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P1-B documentation baseline was `a0db4d7fb946c512ec04ff69c6d59ca15eba4e79` | commit-relative authoritative record |
| Source transition | This source transition records the completed Public Menu robustness hardening from baseline `1aae2da264b7d78e879fa83dc7fa1b51a490b4b0`; production and release state are unchanged, and no release or deployment was generated | commit-relative authoritative record |
| Production SHA | `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a` | owner-confirmed production state |
| Release state | `release/current/` is the SHA-bound artifact for `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a`; it is the current production release, while source HEAD is newer and has no approved release | artifact-observed plus owner confirmation |
| Migration state | `001_menu_admin` active; `002_admin_roles` active | owner-confirmed production state |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Repository governance | `Lcafee/su` is private; normal direct pushes to `main` remain allowed; deletion/force-push protection is unavailable on the current GitHub plan; no PR, approval, CI, status-check, workflow, merge-queue, or deployment-automation requirement was added; `backup-remote` is unchanged | GitHub-observed plus owner acceptance |
| Blockers | None. Missing private-repository branch protection is an accepted residual governance risk, not a development blocker. | owner directive |
| Current phase | Public Menu hardening source implementation complete; release and deployment remain separately authorized work | owner directive |
| Next action | Resume the next separately authorized roadmap item; any QA, release generation, or deployment remains outside this source transition. | current task boundary |
