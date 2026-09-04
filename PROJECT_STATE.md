# L Cafe project state

Updated: 2026-09-05 (Asia/Tehran)

This is the authoritative mutable state ledger. Stable architecture and
procedures remain in `HANDOFF.md` and `OPERATIONS.md`; do not duplicate changing
SHAs or migration status elsewhere.

| Field | Authoritative value | Provenance |
| --- | --- | --- |
| Source baseline | The commit containing this ledger on `main` / `origin/main`; accepted pre-P1-B documentation baseline was `a0db4d7fb946c512ec04ff69c6d59ca15eba4e79` | commit-relative authoritative record |
| Source transition | Approved source `f604148b836cbbc54956ce33b8eb08e92ccaebd3` is active in production. Its File Manager activation exposed the missing split-ownership merge step; the live application rules were corrected without changing the opaque host suffix, and the repository now provides a validated merge helper for future File Manager deployments. | commit-relative authoritative record plus directly verified deployment result |
| Production SHA | `f604148b836cbbc54956ce33b8eb08e92ccaebd3` | directly verified production state |
| Release state | `release/current/` is the SHA-bound, locally generated artifact for `455032b7e5b3ebe3b8921c3da4af1f1a39f60ad1`; it has not been deployed. Production remains on the active `f604148b836cbbc54956ce33b8eb08e92ccaebd3` release. | artifact-observed plus current task boundary |
| Migration state | `001_menu_admin` active; `002_admin_roles` active; `003_media_lifecycle` active. Source migration `004_admin_session_epoch` is pending a future separately approved release, deployment, and activation; it is not active in production. | owner-confirmed production state plus source-defined pending change |
| Role state | `owner` and `cashier` active in production | owner-confirmed production state |
| Deployment state | Production activation succeeded through cPanel/File Manager; `/`, `/menu`, `/menu2`, `/admin/`, and logged-out `/api/session` are healthy; `/menu2` redirects to `/menu`; the host-owned fenced `.htaccess` runtime suffix was preserved byte-for-byte; persistent MySQL, config, session, revision, media, and menu runtime state was preserved | directly verified deployment result |
| Public menu snapshot | `managed-menu/current.json` remains revision `6` with SHA-256 `4a8eb9b8cd3f023bb2cb91d895ae6860edb4dee4b1bb709925c0d0bc49c64548`; `previous.json` remains revision `5` with SHA-256 `b8a2334ef42757a7bf10596ebfe6c8aed1bb7779069c9f26d9348d12f0aea8e4` | directly verified before/after deployment |
| Architecture | React/Vite Landing, Menu, and Admin; PHP 8.1+/MySQL control plane; MySQL publishes persistent static menu snapshots; ParsPack LiteSpeed shared host | source-defined plus owner-confirmed production state |
| Runtime ownership | Database, config, sessions, revisions, originals, managed snapshots/media, and the fenced ParsPack `.htaccess` runtime block are host-owned persistent state | owner-confirmed production state |
| Repository governance | `Lcafee/su` is public; normal direct pushes to `main` remain allowed; every push runs the frontend-only GitHub Pages preview workflow; Pages is pre-production only and does not approve, generate, or deploy a production release; `backup-remote` is unchanged | GitHub-observed plus source-defined workflow |
| Preview state | GitHub Pages uses the project base `/su/`; the Pages artifact is restricted to Landing, `/menu/`, `/menu2/`, required public assets/fonts, and preview copies of the tracked development menu fixture; the complete preview is `noindex,nofollow` | source-defined workflow and build guard |
| Blockers | Production password rotation remains blocked until the hardening release is separately approved for deployment, migration `004_admin_session_epoch` is confirmed active, and rotation is separately authorized. Destructive archive/media cleanup remains separately blocked pending owner confirmation of the backup-retention and coordinated-restore contract. | source-defined security boundary plus unresolved destructive-cleanup gate |
| Current phase | Admin session-epoch and rotation-CLI hardening is committed, pushed, and locally released as `32275776039ebf39f40e7d8deef13417d2625f23`; production remains on `f604148b836cbbc54956ce33b8eb08e92ccaebd3` with passwords unchanged and migration `004` inactive. | current release task plus directly verified prior production state |
| Next action | Obtain separate deployment approval before activating the generated release and migration `004_admin_session_epoch`. Do not deploy, apply migration `004`, or rotate credentials without the corresponding separate approvals. | current task boundary |
