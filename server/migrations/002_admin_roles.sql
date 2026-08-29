-- Add explicit menu-admin roles. Existing accounts predate roles and retain
-- their historical full access as owners.

ALTER TABLE admin_users
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner', 'cashier'))
        AFTER password_hash;

INSERT INTO schema_migrations (version)
VALUES ('002_admin_roles')
ON DUPLICATE KEY UPDATE version = VALUES(version);
