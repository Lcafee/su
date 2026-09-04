-- Bind every admin session to the credential generation that created it.
-- Incrementing session_epoch invalidates all previously issued sessions.

ALTER TABLE admin_users
    ADD COLUMN session_epoch BIGINT UNSIGNED NOT NULL DEFAULT 1
        AFTER role;

INSERT INTO schema_migrations (version)
VALUES ('004_admin_session_epoch')
ON DUPLICATE KEY UPDATE version = VALUES(version);
