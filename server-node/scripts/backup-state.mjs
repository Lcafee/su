import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { loadConfig } from '../src/config.mjs';

function fail(message) {
  throw new Error(`backup: ${message}`);
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!read) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out-dir') {
    fail('usage: node scripts/backup-state.mjs --out-dir <private-directory>');
  }

  const config = loadConfig();
  const outDir = path.resolve(args[1]);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(outDir, 0o700);

  const source = new Database(config.dbPath, { readonly: true, fileMustExist: true });
  const state = source.prepare(
    'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
  ).get();
  if (!state) {
    source.close();
    fail('menu_state is missing');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalPath = path.join(outDir, `site-${stamp}-r${state.edit_revision}.sqlite`);
  const tempPath = `${finalPath}.tmp-${process.pid}`;

  try {
    await source.backup(tempPath);
  } finally {
    source.close();
  }

  const backup = new Database(tempPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = backup.pragma('integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      fail('integrity_check failed');
    }
    const fk = backup.pragma('foreign_key_check');
    if (fk.length !== 0) {
      fail(`foreign_key_check returned ${fk.length} violation(s)`);
    }
    const copiedState = backup.prepare(
      'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
    ).get();
    if (!copiedState
        || copiedState.edit_revision !== state.edit_revision
        || copiedState.published_revision !== state.published_revision) {
      fail('backup revision does not match source revision');
    }
  } finally {
    backup.close();
  }

  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, finalPath);
  const stat = fs.statSync(finalPath);

  console.log(JSON.stringify({
    ok: true,
    file: finalPath,
    sha256: sha256(finalPath),
    bytes: stat.size,
    editRevision: state.edit_revision,
    publishedRevision: state.published_revision,
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
