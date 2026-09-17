PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'cashier')),
    session_epoch INTEGER NOT NULL DEFAULT 1 CHECK (session_epoch >= 1),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until TEXT NULL,
    last_login_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    session_epoch INTEGER NOT NULL CHECK (session_epoch >= 1),
    csrf_token TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_admin_sessions_user ON admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_admin_sessions_last_seen ON admin_sessions (last_seen);

CREATE TABLE IF NOT EXISTS menu_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    edit_revision INTEGER NOT NULL DEFAULT 0 CHECK (edit_revision >= 0),
    published_revision INTEGER NOT NULL DEFAULT 0 CHECK (published_revision >= 0),
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id TEXT PRIMARY KEY NOT NULL,
    public_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    intro TEXT NULL,
    layout TEXT NOT NULL CHECK (layout IN ('grid', 'addons')),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    archived_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_menu_categories_public_order
    ON menu_categories (archived_at, sort_order);

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY NOT NULL,
    source_sha256 TEXT NOT NULL UNIQUE CHECK (length(source_sha256) = 64),
    source_mime TEXT NOT NULL,
    source_extension TEXT NOT NULL,
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
    rendition_300_filename TEXT NOT NULL UNIQUE,
    rendition_600_filename TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    retired_at TEXT NULL,
    orphan_candidate_at TEXT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_media_assets_orphan_candidate
    ON media_assets (orphan_candidate_at, created_at);

CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL,
    public_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NULL,
    price_text TEXT NULL,
    media_id TEXT NULL,
    metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    archived_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES menu_categories (id),
    FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_menu_items_category_order
    ON menu_items (category_id, archived_at, sort_order);
CREATE INDEX IF NOT EXISTS ix_menu_items_media ON menu_items (media_id);

CREATE TABLE IF NOT EXISTS menu_item_options (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL,
    label TEXT NOT NULL,
    price_text TEXT NOT NULL,
    external_code TEXT NULL,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES menu_items (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_menu_item_options_order
    ON menu_item_options (item_id, sort_order);

CREATE TABLE IF NOT EXISTS menu_revisions (
    revision INTEGER PRIMARY KEY CHECK (revision >= 0),
    publish_state TEXT NOT NULL CHECK (publish_state IN ('pending', 'published', 'failed')),
    actor_user_id INTEGER NULL,
    snapshot_sha256 TEXT NULL CHECK (snapshot_sha256 IS NULL OR length(snapshot_sha256) = 64),
    error_message TEXT NULL,
    created_at TEXT NOT NULL,
    published_at TEXT NULL,
    lifecycle_retained INTEGER NOT NULL DEFAULT 0 CHECK (lifecycle_retained IN (0, 1)),
    lifecycle_retain_until TEXT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES admin_users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_menu_revisions_publish_state
    ON menu_revisions (publish_state, revision);
CREATE INDEX IF NOT EXISTS ix_menu_revisions_lifecycle_retention
    ON menu_revisions (lifecycle_retained, lifecycle_retain_until, revision);
