import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { loadConfig } from '../src/config.mjs';
import { assertDatabaseHealthy } from '../src/db.mjs';

function parseArgs(argv) {
  const args = {};
  const known = new Set(['--db', '--current', '--previous', '--media-dir', '--revisions-dir']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!known.has(token)) throw new Error(`unknown argument: ${token}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${token} requires a value`);
    args[token.slice(2)] = value;
    index += 1;
  }
  if (!args.current || !args.previous) {
    throw new Error('usage: npm run verify:import -- --current current.json --previous previous.json [--db site.sqlite] [--media-dir dir] [--revisions-dir dir]');
  }
  return args;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readSnapshot(file) {
  const bytes = fs.readFileSync(file);
  return { bytes, sha: sha256(bytes), value: JSON.parse(bytes.toString('utf8')) };
}

function collectPublicItems(snapshot) {
  const categories = snapshot.categories || [];
  const items = categories.flatMap((category) => category.items || []);
  return { categories, items };
}

function collectSnapshotMedia(snapshot) {
  const names = new Set();
  for (const category of snapshot.categories || []) {
    for (const item of category.items || []) {
      const image = item.image;
      if (!image) continue;
      if (image.src) names.add(path.basename(image.src));
      if (image.srcSet) {
        for (const part of image.srcSet.split(',')) {
          const url = part.trim().split(/\s+/)[0];
          if (url) names.add(path.basename(url));
        }
      }
    }
  }
  return names;
}

function assertSameSet(label, expected, actual) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} mismatch: ${missing.length} missing, ${extra.length} extra`);
  }
}

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();
const dbPath = path.resolve(args.db || config.dbPath);
const currentPath = path.resolve(args.current);
const previousPath = path.resolve(args.previous);

const current = readSnapshot(currentPath);
const previous = readSnapshot(previousPath);
const currentPublic = collectPublicItems(current.value);

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  db.pragma('foreign_keys = ON');
  assertDatabaseHealthy(db);

  const state = db.prepare('SELECT edit_revision, published_revision FROM menu_state WHERE id = 1').get();
  if (!state) throw new Error('menu_state row is missing');
  if (state.edit_revision !== state.published_revision) {
    throw new Error(`migration snapshot is not fully published: edit=${state.edit_revision}, published=${state.published_revision}`);
  }
  if (current.value.revision !== state.published_revision) {
    throw new Error(`current.json revision ${current.value.revision} != published revision ${state.published_revision}`);
  }

  const currentRevision = db.prepare(
    'SELECT revision, publish_state, snapshot_sha256 FROM menu_revisions WHERE revision = ?'
  ).get(current.value.revision);
  if (!currentRevision || currentRevision.publish_state !== 'published' || currentRevision.snapshot_sha256 !== current.sha) {
    throw new Error('current.json does not match its published menu_revisions record');
  }

  const previousRevision = db.prepare(
    'SELECT revision, publish_state, snapshot_sha256 FROM menu_revisions WHERE revision = ?'
  ).get(previous.value.revision);
  if (!previousRevision || previousRevision.publish_state !== 'published' || previousRevision.snapshot_sha256 !== previous.sha) {
    throw new Error('previous.json does not match its published menu_revisions record');
  }

  const activeCategoryIds = new Set(
    db.prepare('SELECT public_id FROM menu_categories WHERE archived_at IS NULL ORDER BY sort_order').all().map((row) => row.public_id)
  );
  const snapshotCategoryIds = new Set(currentPublic.categories.map((category) => category.id));
  assertSameSet('active categories vs current.json', activeCategoryIds, snapshotCategoryIds);

  const activeItemIds = new Set(
    db.prepare('SELECT public_id FROM menu_items WHERE archived_at IS NULL').all().map((row) => row.public_id)
  );
  const snapshotItemIds = new Set(currentPublic.items.map((item) => item.id));
  assertSameSet('active items vs current.json', activeItemIds, snapshotItemIds);

  let mediaSummary = null;
  if (args['media-dir']) {
    const mediaDir = path.resolve(args['media-dir']);
    const files = new Set(fs.readdirSync(mediaDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name));
    const dbMedia = db.prepare('SELECT rendition_300_filename, rendition_600_filename FROM media_assets').all();
    const expectedMedia = new Set(dbMedia.flatMap((row) => [row.rendition_300_filename, row.rendition_600_filename]));
    assertSameSet('database renditions vs managed-media directory', expectedMedia, files);
    for (const name of collectSnapshotMedia(current.value)) {
      if (!files.has(name)) throw new Error(`current.json references missing managed media: ${name}`);
    }
    mediaSummary = { dbAssets: dbMedia.length, expectedRenditions: expectedMedia.size, files: files.size };
  }

  let revisionsSummary = null;
  if (args['revisions-dir']) {
    const revisionsDir = path.resolve(args['revisions-dir']);
    const archiveFiles = fs.readdirSync(revisionsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const archiveHashes = new Set(archiveFiles.map((entry) => sha256(fs.readFileSync(path.join(revisionsDir, entry.name)))));
    const revisionRows = db.prepare('SELECT revision, snapshot_sha256 FROM menu_revisions WHERE snapshot_sha256 IS NOT NULL').all();
    const missing = revisionRows.filter((row) => !archiveHashes.has(row.snapshot_sha256));
    if (missing.length) throw new Error(`revision archive is missing ${missing.length} database snapshot hash(es)`);
    revisionsSummary = { databaseHashedRevisions: revisionRows.length, archiveFiles: archiveFiles.length };
  }

  console.log(JSON.stringify({
    ok: true,
    dbPath,
    revisions: {
      edit: state.edit_revision,
      published: state.published_revision,
      current: current.value.revision,
      previous: previous.value.revision,
      currentSha256: current.sha,
      previousSha256: previous.sha,
    },
    content: {
      activeCategories: activeCategoryIds.size,
      activeItems: activeItemIds.size,
    },
    media: mediaSummary,
    revisionArchive: revisionsSummary,
  }, null, 2));
} finally {
  db.close();
}
