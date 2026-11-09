# Marble brownie implementation

Approved brief: replace the pumpkin feature with a bold photographic Marble Brownie introduction, ten portions daily, manual remaining quantity through Admin, no automatic restocking. Preserve maroon/ivory, RTL, reduced motion and the menu-only product scope. Price is unspecified and must not inherit pumpkin pricing.

Approach: reuse authenticated menu saving/publication and public snapshots rather than add another inventory service. Poll the current snapshot every five seconds while visible; a failed/current-fallback read is not live inventory. Store dailyRemaining (integer 0–10) and dailyDate (Tehran calendar date) in item metadata. Stale dates show unconfirmed inventory. Cashiers may edit only these additional metadata fields on the seasonal item.

- [x] Test stock bounds, zero, stale day, timezone and missing configuration.
- [x] Add Admin activation and daily stock controls, API validation and cashier permissions.
- [x] Replace seasonal artwork/layout and synchronize published stock without resetting navigation.
- [x] Build public/Admin, run behavior tests, inspect desktop/mobile and document publication steps.

Verification limitation: full backend API integration cannot run here because the better-sqlite3 native dependency requires unavailable Visual Studio build tools. Standalone server validation tests and mocked owner/cashier browser save-payload checks pass; persistence still requires the supported Linux integration suite before release. See docs/marble-brownie.md.

Review focus: never claim ten in stock before staff confirmation; never expose yesterday's number as today's; preserve other metadata and role restrictions; never reuse pumpkin price; recover from network failure without a false live indicator. Production deployment remains a separate explicitly requested task under AGENTS.md.
