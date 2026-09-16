# Production content snapshot — required migration input

The current ParsPack production host is the authoritative source for the newest Main Site content and site runtime data during migration. Local project content and repository fixtures are not allowed to overwrite newer production values.

The filename is retained for compatibility with earlier migration notes, but this document now defines a **ParsPack production snapshot**, not a local snapshot.

## Required production handoff

Create a read-only export from the current ParsPack host containing:

1. the Main Site MySQL database (a full dump is preferred; at minimum include `schema_migrations`, `admin_users`, `menu_state`, `menu_categories`, `media_assets`, `menu_items`, `menu_item_options`, and `menu_revisions`);
2. public `managed-menu/current.json` and `managed-menu/previous.json`;
3. the complete public `managed-media/` directory;
4. private managed-media originals and revision/snapshot archives when available;
5. the production runtime `.htaccess` only if it contains host-owned behavior not represented in GitHub.

Do **not** include live session files, database credentials, private configuration secrets, passwords in plaintext, cPanel credentials, API keys, or unrelated account data.

## Snapshot processing contract

Once received:

1. inventory the export without modification;
2. compute SHA-256 checksums and create a manifest;
3. verify `current.json` against the database's published/edit revision state;
4. reconcile media database rows against public renditions and private originals;
5. identify archived/current categories and items, roles, revisions and publish state;
6. compare against GitHub only to understand code/schema compatibility;
7. preserve ParsPack production values when content conflicts with local or repository fixtures;
8. transform only from the checksummed production snapshot into the new SQLite migration input.

## Authority rules

- GitHub `Lcafee/su` is authoritative for application/UI source code.
- ParsPack production is authoritative for the current menu/content, managed media, admin account state and publish/revision state.
- Live sessions are ephemeral and are not migrated.
- Plaintext credentials and host secrets are not migration input.
- The Operations Platform and its VPS data remain out of scope.
