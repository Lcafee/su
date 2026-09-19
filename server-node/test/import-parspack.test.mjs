import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrateScript = path.resolve(here, '..', 'scripts', 'migrate.mjs');
const importScript = path.resolve(here, '..', 'scripts', 'import-parspack.mjs');

function sourceDump() {
  const sha = 'a'.repeat(64);
  return `
INSERT INTO \`schema_migrations\` (\`version\`, \`applied_at\`) VALUES
('001', '2026-08-28 00:00:00.000000'),
('002', '2026-08-29 00:00:00.000000'),
('003', '2026-08-30 00:00:00.000000'),
('004', '2026-08-31 00:00:00.000000');

INSERT INTO \`admin_users\` (\`id\`, \`username\`, \`password_hash\`, \`role\`, \`is_active\`, \`failed_login_count\`, \`locked_until\`, \`last_login_at\`, \`created_at\`, \`updated_at\`, \`session_epoch\`) VALUES
(1, 'admin', '$2y$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuu', 'owner', 1, 0, NULL, NULL, '2026-08-28 00:00:00.000000', '2026-08-28 00:00:00.000000', 2);

INSERT INTO \`menu_state\` (\`id\`, \`edit_revision\`, \`published_revision\`, \`updated_at\`) VALUES
(1, 65, 65, '2026-09-17 12:44:18.237203');

INSERT INTO \`menu_categories\` (\`id\`, \`public_id\`, \`title\`, \`intro\`, \`layout\`, \`sort_order\`, \`archived_at\`, \`created_at\`, \`updated_at\`) VALUES
('11111111-1111-4111-8111-111111111111', 'cat-test', 'آزمایش', NULL, 'grid', 0, NULL, '2026-08-28 00:00:00.000000', '2026-08-28 00:00:00.000000');

INSERT INTO \`media_assets\` (\`id\`, \`source_sha256\`, \`source_mime\`, \`source_extension\`, \`width\`, \`height\`, \`byte_size\`, \`rendition_300_filename\`, \`rendition_600_filename\`, \`original_filename\`, \`retired_at\`, \`orphan_candidate_at\`, \`created_at\`) VALUES
('22222222-2222-4222-8222-222222222222', '${sha}', 'image/png', 'png', 1200, 1200, 12345, '${sha}-300.webp', '${sha}-600.webp', '${sha}.png', NULL, NULL, '2026-08-28 00:00:00.000000');

INSERT INTO \`menu_items\` (\`id\`, \`category_id\`, \`public_id\`, \`name\`, \`description\`, \`price_text\`, \`media_id\`, \`metadata_json\`, \`sort_order\`, \`archived_at\`, \`created_at\`, \`updated_at\`) VALUES
('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'menu-test-01', 'O\\'Reilly تست', 'توضیح', '۴۰۰', '22222222-2222-4222-8222-222222222222', '{"code":"3100"}', 0, NULL, '2026-08-28 00:00:00.000000', '2026-08-28 00:00:00.000000');

INSERT INTO \`menu_item_options\` (\`id\`, \`item_id\`, \`label\`, \`price_text\`, \`external_code\`, \`sort_order\`, \`created_at\`, \`updated_at\`) VALUES
('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'گزینه', '۴۲۰', '3101', 0, '2026-08-28 00:00:00.000000', '2026-08-28 00:00:00.000000');

INSERT INTO \`menu_revisions\` (\`revision\`, \`publish_state\`, \`actor_user_id\`, \`snapshot_sha256\`, \`error_message\`, \`created_at\`, \`published_at\`, \`lifecycle_retained\`, \`lifecycle_retain_until\`) VALUES
(65, 'published', 1, '${'b'.repeat(64)}', NULL, '2026-09-17 12:44:18.217542', '2026-09-17 12:44:18.236788', 0, NULL);
`;
}

test('ParsPack importer preserves source rows and refuses reuse of a non-empty target', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcafe-import-test-'));
  try {
    const dbPath = path.join(root, 'site.sqlite');
    const sqlPath = path.join(root, 'source.sql');
    fs.writeFileSync(sqlPath, sourceDump());
    const env = {
      ...process.env,
      LCAFE_SITE_DATA_ROOT: root,
      LCAFE_SITE_DB: dbPath,
    };

    execFileSync(process.execPath, [migrateScript], { env, stdio: 'pipe' });
    const output = execFileSync(
      process.execPath,
      [importScript, '--sql', sqlPath, '--db', dbPath],
      { env, encoding: 'utf8' },
    );
    const result = JSON.parse(output);
    assert.equal(result.ok, true);
    assert.deepEqual(result.menuState, { edit_revision: 65, published_revision: 65 });
    assert.equal(result.migratedLiveSessions, false);

    const db = new Database(dbPath, { readonly: true });
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_users').get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_categories').get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_item_options').get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_revisions').get().count, 1);
      assert.equal(db.prepare('SELECT name FROM menu_items').get().name, "O'Reilly تست");
      assert.deepEqual(JSON.parse(db.prepare('SELECT metadata_json FROM menu_items').get().metadata_json), { code: '3100' });
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN ('001','002','003','004')").get().count, 4);
    } finally {
      db.close();
    }

    const second = spawnSync(
      process.execPath,
      [importScript, '--sql', sqlPath, '--db', dbPath],
      { env, encoding: 'utf8' },
    );
    assert.notEqual(second.status, 0);
    assert.match(`${second.stderr}${second.stdout}`, /target table admin_users is not empty/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
