# L Cafe project state

Updated: 2026-08-30 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P1-A baseline was `aa3b0ee99d82af6ab7b2784c59533d801230adae` | commit-relative authoritative record |
| Source transition | P0 and P1-A repository hygiene/documentation ownership form one coherent source baseline; production and release state are unchanged | commit-relative authoritative record |
| Production SHA | `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a` | owner-confirmed production state |
| Release state | `release/current/` is the SHA-bound artifact for `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a`; it is the current production release, while source HEAD is newer and has no approved release | artifact-observed plus owner confirmation |
| Migration state | `001_menu_admin` active; `002_admin_roles` active | owner-confirmed production state |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Blockers | None for P1-A. Repository visibility, GitHub settings, `main` protection, and remote governance are intentionally deferred. | owner directive |
| Current phase | P1-A repository hygiene and documentation ownership complete | owner directive |
| Next action | Decide the separately scoped P1-B GitHub governance model; no visibility, settings, protection, or remote-branch change is authorized by this source transition. | current task boundary |
