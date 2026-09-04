-- Bind every admin session to the credential generation that created it.
-- Incrementing session_epoch invalidates all previously issued sessions.
--
-- The migration runner executes statements independently. Serialize retries
-- while inspecting the schema and applying the DDL so concurrent provisioners
-- cannot both observe a missing column and race into duplicate ALTER errors.
-- A lock timeout or schema-definition mismatch deliberately prepares invalid
-- SQL, stopping the migration before its completion marker can be written.
SET @lcafe_session_epoch_lock_name = CONCAT('lcafe:004:', MD5(DATABASE()));
SET @lcafe_session_epoch_lock = IF(
    IS_USED_LOCK(@lcafe_session_epoch_lock_name) = CONNECTION_ID(),
    1,
    GET_LOCK(@lcafe_session_epoch_lock_name, 60)
);

SET @lcafe_session_epoch_sql = IF(
    @lcafe_session_epoch_lock = 1,
    IF(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'admin_users'
              AND column_name = 'session_epoch'
        ),
        'ALTER TABLE admin_users ADD COLUMN session_epoch BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER role',
        IF(
            EXISTS (
                SELECT 1
                FROM information_schema.columns c
                INNER JOIN information_schema.columns r
                    ON r.table_schema = c.table_schema
                   AND r.table_name = c.table_name
                   AND r.column_name = 'role'
                WHERE c.table_schema = DATABASE()
                  AND c.table_name = 'admin_users'
                  AND c.column_name = 'session_epoch'
                  AND LOWER(c.data_type) = 'bigint'
                  AND LOWER(c.column_type) LIKE 'bigint% unsigned'
                  AND c.is_nullable = 'NO'
                  AND c.column_default = '1'
                  AND c.ordinal_position = r.ordinal_position + 1
            ),
            'SELECT 1',
            'THIS IS NOT VALID SQL'
        )
    ),
    'THIS IS NOT VALID SQL'
);

PREPARE lcafe_session_epoch_stmt FROM @lcafe_session_epoch_sql;
EXECUTE lcafe_session_epoch_stmt;
DEALLOCATE PREPARE lcafe_session_epoch_stmt;

-- The marker write is idempotent, allowing the guarded DDL and marker to be
-- retried independently after any interruption.
INSERT INTO schema_migrations (version)
VALUES ('004_admin_session_epoch')
ON DUPLICATE KEY UPDATE version = VALUES(version);

SELECT RELEASE_LOCK(@lcafe_session_epoch_lock_name);
