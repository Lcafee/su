-- Bind every admin session to the credential generation that created it.
-- The PHP migration runner validates and creates this column idempotently,
-- then executes this marker statement. The runner re-inspects after a
-- duplicate-column race and accepts only the exact expected definition.
INSERT INTO schema_migrations (version)
VALUES ('004_admin_session_epoch')
ON DUPLICATE KEY UPDATE version = VALUES(version);
