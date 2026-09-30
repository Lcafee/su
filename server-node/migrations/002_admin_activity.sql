CREATE TABLE IF NOT EXISTS admin_activity (
    id INTEGER PRIMARY KEY,
    actor_user_id INTEGER NULL,
    actor_username TEXT NOT NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('owner', 'cashier')),
    action TEXT NOT NULL,
    revision INTEGER NULL,
    details_json TEXT NOT NULL CHECK (json_valid(details_json)),
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES admin_users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_admin_activity_role_id ON admin_activity (actor_role, id DESC);
