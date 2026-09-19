import Database from 'better-sqlite3';

export function openDatabase(dbPath, { readonly = false, fileMustExist = true } = {}) {
  const db = new Database(dbPath, { readonly, fileMustExist });
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (!readonly) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.pragma('wal_autocheckpoint = 1000');
  }
  return db;
}

export function assertDatabaseHealthy(db) {
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`SQLite integrity_check failed: ${integrity}`);
  const foreignKeyViolations = db.pragma('foreign_key_check');
  if (foreignKeyViolations.length > 0) {
    throw new Error(`SQLite foreign_key_check failed with ${foreignKeyViolations.length} violation(s)`);
  }
}
