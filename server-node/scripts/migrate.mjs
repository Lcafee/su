import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { loadConfig } from '../src/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '..', 'migrations');
const config = loadConfig();

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true, mode: 0o750 });

const db = new Database(config.dbPath);
try {
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');

  const files = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const file of files) {
    const version = path.basename(file, '.sql');
    const hasMigrationTable = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
    ).get();
    const alreadyApplied = hasMigrationTable
      ? db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)
      : null;
    if (alreadyApplied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
      ).run(version, new Date().toISOString());
      db.exec('COMMIT');
      console.log(`applied ${version}`);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
} finally {
  db.close();
}
