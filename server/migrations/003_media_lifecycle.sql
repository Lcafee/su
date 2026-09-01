-- Non-destructive managed-media lifecycle foundation. Destructive cleanup is
-- intentionally not enabled by this migration or its companion CLI.

ALTER TABLE media_assets
    ADD COLUMN orphan_candidate_at DATETIME(6) NULL AFTER retired_at,
    ADD KEY ix_media_assets_orphan_candidate (orphan_candidate_at, created_at);

ALTER TABLE menu_revisions
    ADD COLUMN lifecycle_retained TINYINT(1) NOT NULL DEFAULT 0 AFTER published_at,
    ADD COLUMN lifecycle_retain_until DATETIME(6) NULL AFTER lifecycle_retained,
    ADD KEY ix_menu_revisions_lifecycle_retention (
        lifecycle_retained,
        lifecycle_retain_until,
        revision
    );

INSERT INTO schema_migrations (version)
VALUES ('003_media_lifecycle')
ON DUPLICATE KEY UPDATE version = VALUES(version);
