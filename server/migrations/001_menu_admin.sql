-- L Cafe menu-admin foundation. MySQL 8.0+ or compatible MariaDB with InnoDB,
-- utf8mb4, foreign keys, and the JSON type is required.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) NOT NULL PRIMARY KEY,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(6) NULL,
    last_login_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    edit_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    published_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT chk_menu_state_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO menu_state (id, edit_revision, published_revision)
VALUES (1, 0, 0)
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS menu_categories (
    id CHAR(36) NOT NULL PRIMARY KEY,
    public_id VARCHAR(100) NOT NULL,
    title VARCHAR(191) NOT NULL,
    intro TEXT NULL,
    layout VARCHAR(16) NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_menu_categories_public_id (public_id),
    KEY ix_menu_categories_public_order (archived_at, sort_order),
    CONSTRAINT chk_menu_categories_layout CHECK (layout IN ('grid', 'addons'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_assets (
    id CHAR(36) NOT NULL PRIMARY KEY,
    source_sha256 CHAR(64) NOT NULL,
    source_mime VARCHAR(64) NOT NULL,
    source_extension VARCHAR(8) NOT NULL,
    width INT UNSIGNED NOT NULL,
    height INT UNSIGNED NOT NULL,
    byte_size BIGINT UNSIGNED NOT NULL,
    rendition_300_filename VARCHAR(191) NOT NULL,
    rendition_600_filename VARCHAR(191) NOT NULL,
    original_filename VARCHAR(191) NOT NULL,
    retired_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_media_assets_source_sha256 (source_sha256),
    UNIQUE KEY uq_media_assets_300 (rendition_300_filename),
    UNIQUE KEY uq_media_assets_600 (rendition_600_filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
    id CHAR(36) NOT NULL PRIMARY KEY,
    category_id CHAR(36) NOT NULL,
    public_id VARCHAR(100) NOT NULL,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    price_text VARCHAR(64) NULL,
    media_id CHAR(36) NULL,
    metadata_json JSON NOT NULL,
    sort_order INT UNSIGNED NOT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_menu_items_public_id (public_id),
    KEY ix_menu_items_category_order (category_id, archived_at, sort_order),
    KEY ix_menu_items_media (media_id),
    CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES menu_categories (id),
    CONSTRAINT fk_menu_items_media FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_item_options (
    id CHAR(36) NOT NULL PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    label VARCHAR(191) NOT NULL,
    price_text VARCHAR(64) NOT NULL,
    external_code VARCHAR(64) NULL,
    sort_order INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY ix_menu_item_options_order (item_id, sort_order),
    CONSTRAINT fk_menu_item_options_item FOREIGN KEY (item_id) REFERENCES menu_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_revisions (
    revision BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    publish_state VARCHAR(16) NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    snapshot_sha256 CHAR(64) NULL,
    error_message TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    published_at DATETIME(6) NULL,
    KEY ix_menu_revisions_publish_state (publish_state, revision),
    CONSTRAINT fk_menu_revisions_actor FOREIGN KEY (actor_user_id) REFERENCES admin_users (id) ON DELETE SET NULL,
    CONSTRAINT chk_menu_revisions_state CHECK (publish_state IN ('pending', 'published', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version)
VALUES ('001_menu_admin')
ON DUPLICATE KEY UPDATE version = VALUES(version);
