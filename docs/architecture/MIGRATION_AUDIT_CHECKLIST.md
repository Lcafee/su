# Migration source audit checklist

Populate only from repository evidence before backend implementation.

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
- [ ] production-only state requiring reconciliation
- [ ] local-content snapshot manifest and checksums

The two remaining items require the newest local content snapshot and, later, a read-only comparison with production runtime state. They do not block the source-level backend design map.
