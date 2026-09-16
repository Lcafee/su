# Local content snapshot — required migration input

The latest local Main Site content is authoritative during migration. Do not regenerate or replace it from production or repository fixtures.

## Preferred handoff

Provide a ZIP of the current local Main Site project directory, excluding:

- `node_modules/`
- `dist/`
- generated release archives
- `.git/`
- secrets, credentials, `.deploy.ini`, private config and password notes

Keep all current content and referenced media/assets.

If the content lives outside the project directory, include the current menu/content export and all referenced media separately.

## Snapshot processing contract

Once received:

1. inventory files without modification;
2. identify content-bearing sources and media references;
3. create a manifest;
4. compute checksums;
5. compare against GitHub and current production only for reconciliation;
6. preserve local content values when content conflicts exist;
7. transform only from the checksummed snapshot into the new SQLite migration input.

Runtime-only production state such as password hashes, live sessions and server-generated history is reconciled separately and must not overwrite local menu content.
