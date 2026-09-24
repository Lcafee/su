# Migration source audit checklist — completed

Status: historical migration checklist. The Liara/VPS cutover and ParsPack
snapshot reconciliation are complete; current production state is recorded in
`../../PROJECT_STATE.md`.

This checklist records the source audit completed before backend implementation.

- [x] PHP API route inventory
- [x] MySQL table/index/constraint inventory
- [x] authentication and session lifecycle
- [x] CSRF enforcement
- [x] owner/cashier authorization matrix
- [x] menu load/save transaction behavior
- [x] snapshot publish and retry behavior
- [x] media upload/rendition behavior
- [x] revision/archive behavior
- [x] public `current.json` / `previous.json` contract
- [x] `.htaccess` routing/protection/cache/security translation requirements to Nginx
- [x] runtime-owned files/directories
- [x] production-only state requiring reconciliation
- [x] local-content snapshot manifest and checksums

The final no-later-edits reconciliation used owner attestation dated
2026-09-18 against the 2026-09-17 ParsPack export; it was not a fresh technical
capture. See `PROJECT_STATE.md` for the remaining rollback and retention notes.
