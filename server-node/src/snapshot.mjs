import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function assertWritableDirectory(directory, purpose) {
  const resolved = fs.realpathSync(directory);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error(`${purpose} storage is unavailable.`);
  fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
  return resolved;
}

function tempPath(directory, prefix) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = path.join(directory, `${prefix}${crypto.randomBytes(12).toString('hex')}`);
    try {
      const fd = fs.openSync(candidate, 'wx', 0o600);
      fs.closeSync(fd);
      return candidate;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Could not reserve a snapshot staging file.');
}

function writeCompleteFile(filePath, bytes, mode) {
  const fd = fs.openSync(filePath, 'w', mode);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(fd, bytes, offset, bytes.length - offset, offset);
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(filePath, mode);
}

function removeIfExists(filePath) {
  try { fs.unlinkSync(filePath); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function snapshotTimestamp(db, revision) {
  const row = db.prepare('SELECT created_at FROM menu_revisions WHERE revision = ?').get(revision);
  const raw = row?.created_at;
  if (typeof raw === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z)?$/.exec(raw);
    if (match) {
      return `${match[1]}T${match[2]}.${(match[3] || '').padEnd(6, '0').slice(0, 6)}Z`;
    }
  }
  return new Date().toISOString().replace(/(\.\d{3})Z$/, '$1000Z');
}

export function prepareSnapshot(config, snapshot, revision) {
  const publicDir = assertWritableDirectory(config.paths.managedMenu, 'Public snapshot');
  const archiveDir = assertWritableDirectory(config.paths.menuRevisions, 'Snapshot archive');
  const bytes = Buffer.from(`${JSON.stringify(snapshot)}\n`, 'utf8');
  const sha = sha256(bytes);
  const temp = tempPath(publicDir, '.current-');
  const archive = path.join(archiveDir, `menu-${String(revision).padStart(20, '0')}-${sha}.json`);
  let archiveCreated = false;

  try {
    writeCompleteFile(temp, bytes, 0o644);
    if (fs.existsSync(archive)) {
      const existingSha = sha256(fs.readFileSync(archive));
      if (existingSha !== sha) throw new Error('A revision archive has unexpected contents.');
    } else {
      const archiveTemp = tempPath(archiveDir, '.revision-');
      try {
        writeCompleteFile(archiveTemp, bytes, 0o644);
        fs.renameSync(archiveTemp, archive);
        archiveCreated = true;
      } finally {
        removeIfExists(archiveTemp);
      }
    }
  } catch (error) {
    removeIfExists(temp);
    throw error;
  }

  return { temp, archive, archiveCreated, sha256: sha };
}

export function discardPreparedSnapshot(prepared, { discardArchive = false } = {}) {
  removeIfExists(prepared.temp);
  if (discardArchive && prepared.archiveCreated) removeIfExists(prepared.archive);
}

export function promotePreparedSnapshot(config, prepared) {
  const publicDir = assertWritableDirectory(config.paths.managedMenu, 'Public snapshot');
  const current = path.join(publicDir, 'current.json');
  const previous = path.join(publicDir, 'previous.json');

  if (fs.existsSync(current)) {
    const previousTemp = tempPath(publicDir, '.previous-');
    try {
      writeCompleteFile(previousTemp, fs.readFileSync(current), 0o644);
      fs.renameSync(previousTemp, previous);
    } finally {
      removeIfExists(previousTemp);
    }
  }

  fs.renameSync(prepared.temp, current);
}
