# L Cafe project state

Updated: 2026-08-30 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P0 UX authority was `f466155753f47d5e7e9a19c2b11c856d96597f9f` | commit-relative authoritative record |
| Source transition | This ledger and the completed P0 integrity implementation form one coherent source baseline | commit-relative authoritative record |
| Production SHA | `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a` | owner-confirmed production state |
| Release state | `release/current/` is the SHA-bound artifact for `d2a87a274e9bb9304abb79d2bb3aa0e89445d51a`; it is the current production release, while source HEAD is newer and has no approved release | artifact-observed plus owner confirmation |
| Migration state | `001_menu_admin` active; `002_admin_roles` active | owner-confirmed production state |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Blockers | None for P0 implementation. Production actions remain separately authorized. | current task decision |
| Current phase | P0 project integrity complete | owner directive |
| Next action | Resume `ROADMAP.md` at its lock gate; release generation and deployment remain separately approved. | current task boundary |
