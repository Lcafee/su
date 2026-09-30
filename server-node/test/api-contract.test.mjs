import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import crypto from 'node:crypto';
import sharp from 'sharp';

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

import { buildApp } from '../src/app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '..', 'migrations', '001_base.sql');

function sqlNow(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '000');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lcafe-site-test-'));
  for (const name of ['managed-menu', 'managed-media', 'menu-revisions', 'media-originals']) {
    fs.mkdirSync(path.join(root, name), { mode: 0o750 });
  }
  const dbPath = path.join(root, 'site.sqlite');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  db.exec(fs.readFileSync(path.resolve(here, '..', 'migrations', '002_admin_activity.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.resolve(here, '..', 'migrations', '002_featured_items.sql'), 'utf8'));
  const now = sqlNow();
  db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('001_base', now);
  db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('002_admin_activity', now);
  db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('002_featured_items', now);
  db.prepare(
    'INSERT INTO menu_state (id, edit_revision, published_revision, updated_at) VALUES (1, 0, 0, ?)'
  ).run(now);
  const phpHash = bcrypt.hashSync('owner-secret', 10).replace('$2b$', '$2y$');
  db.prepare(`
    INSERT INTO admin_users
      (id, username, password_hash, role, session_epoch, is_active,
       failed_login_count, locked_until, last_login_at, created_at, updated_at)
    VALUES (1, 'admin', ?, 'owner', 2, 1, 0, NULL, NULL, ?, ?)
  `).run(phpHash, now, now);

  const config = {
    bindHost: '127.0.0.1',
    port: 3100,
    allowedOrigin: 'https://l-cafe.ir',
    dataRoot: root,
    dbPath,
    paths: {
      managedMenu: path.join(root, 'managed-menu'),
      managedMedia: path.join(root, 'managed-media'),
      menuRevisions: path.join(root, 'menu-revisions'),
      mediaOriginals: path.join(root, 'media-originals'),
    },
    security: {
      sessionName: 'lcafe_admin',
      idleTimeoutSeconds: 1800,
      absoluteTimeoutSeconds: 28800,
      maxLoginFailures: 5,
      loginLockSeconds: 900,
    },
    uploads: {
      maxBytes: 8 * 1024 * 1024,
      maxPixels: 20_000_000,
      webpQuality: 82,
    },
  };
  return { root, db, config };
}

async function login(app) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session/login',
    headers: { origin: 'https://l-cafe.ir', 'content-type': 'application/json' },
    payload: { username: 'admin', password: 'owner-secret' },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.user.username, 'admin');
  assert.equal(body.user.role, 'owner');
  assert.match(body.csrfToken, /^[a-f0-9]{64}$/);
  const setCookie = response.headers['set-cookie'];
  assert.ok(setCookie);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  return {
    cookie: String(setCookie).split(';', 1)[0],
    csrf: body.csrfToken,
  };
}

test('session, csrf and atomic snapshot flow preserve the admin contract', async (t) => {
  const { root, db, config } = fixture();
  const { app } = await buildApp({ db, config, logger: false });
  t.after(async () => {
    await app.close();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const anonymous = await app.inject({ method: 'GET', url: '/api/session' });
  assert.equal(anonymous.statusCode, 200);
  assert.deepEqual(anonymous.json(), { authenticated: false });

  const session = await login(app);

  const menu = await app.inject({
    method: 'GET',
    url: '/api/admin/menu',
    headers: { cookie: session.cookie },
  });
  assert.equal(menu.statusCode, 200);
  assert.deepEqual(menu.json(), { revision: 0, publishedRevision: 0, categories: [] });

  const csrfRejected = await app.inject({
    method: 'PUT',
    url: '/api/admin/menu',
    headers: {
      cookie: session.cookie,
      origin: 'https://l-cafe.ir',
      'content-type': 'application/json',
    },
    payload: { baseRevision: 0, categories: [] },
  });
  assert.equal(csrfRejected.statusCode, 403);
  assert.equal(csrfRejected.json().error.type, 'csrf_rejected');

  const saveOne = await app.inject({
    method: 'PUT',
    url: '/api/admin/menu',
    headers: {
      cookie: session.cookie,
      origin: 'https://l-cafe.ir',
      'x-csrf-token': session.csrf,
      'content-type': 'application/json',
    },
    payload: { baseRevision: 0, categories: [] },
  });
  assert.equal(saveOne.statusCode, 200);
  assert.deepEqual(saveOne.json(), { revision: 1, published: true, publishState: 'published' });

  const currentOne = JSON.parse(fs.readFileSync(path.join(root, 'managed-menu', 'current.json'), 'utf8'));
  assert.equal(currentOne.revision, 1);
  assert.deepEqual(currentOne.categories, []);
  assert.equal(fs.existsSync(path.join(root, 'managed-menu', 'previous.json')), false);

  const saveTwo = await app.inject({
    method: 'PUT',
    url: '/api/admin/menu',
    headers: {
      cookie: session.cookie,
      origin: 'https://l-cafe.ir',
      'x-csrf-token': session.csrf,
      'content-type': 'application/json',
    },
    payload: { baseRevision: 1, categories: [] },
  });
  assert.equal(saveTwo.statusCode, 200);
  assert.equal(saveTwo.json().revision, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'managed-menu', 'current.json'), 'utf8')).revision, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'managed-menu', 'previous.json'), 'utf8')).revision, 1);

  const conflict = await app.inject({
    method: 'PUT',
    url: '/api/admin/menu',
    headers: {
      cookie: session.cookie,
      origin: 'https://l-cafe.ir',
      'x-csrf-token': session.csrf,
      'content-type': 'application/json',
    },
    payload: { baseRevision: 0, categories: [] },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.type, 'revision_conflict');
  assert.equal(conflict.json().error.details.currentRevision, 2);

  const status = await app.inject({
    method: 'GET',
    url: '/api/admin/publish-status',
    headers: { cookie: session.cookie },
  });
  assert.equal(status.statusCode, 200);
  assert.deepEqual(status.json().editRevision, 2);
  assert.deepEqual(status.json().publishedRevision, 2);
  assert.equal(status.json().state, 'published');

  const logout = await app.inject({
    method: 'DELETE',
    url: '/api/session',
    headers: {
      cookie: session.cookie,
      origin: 'https://l-cafe.ir',
      'x-csrf-token': session.csrf,
    },
  });
  assert.equal(logout.statusCode, 200);
  assert.deepEqual(logout.json(), { authenticated: false });
});

test('cashier basic prices, explicit deletion and activity reports enforce the role boundary', async (t) => {
  const { root, db, config } = fixture();
  const { app } = await buildApp({ db, config, logger: false });
  t.after(async () => { await app.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const owner = await login(app);
  const now = sqlNow();
  db.prepare(`INSERT INTO admin_users
    (id, username, password_hash, role, created_at, updated_at)
    VALUES (2, 'cashier', ?, 'cashier', ?, ?)`).run(bcrypt.hashSync('cashier-secret', 4), now, now);
  const cashierLogin = await app.inject({ method: 'POST', url: '/api/session/login',
    headers: { origin: config.allowedOrigin }, payload: { username: 'cashier', password: 'cashier-secret' } });
  assert.equal(cashierLogin.statusCode, 200);
  const cashier = { cookie: String(cashierLogin.headers['set-cookie']).split(';', 1)[0], csrf: cashierLogin.json().csrfToken };
  const headers = (session) => ({ cookie: session.cookie, origin: config.allowedOrigin, 'x-csrf-token': session.csrf });
  const save = (session, payload) => app.inject({ method: 'PUT', url: '/api/admin/menu', headers: headers(session), payload });
  const getDocument = async () => (await app.inject({ method: 'GET', url: '/api/admin/menu', headers: headers(owner) })).json();
  const payload = (document) => ({ baseRevision: document.revision, categories: document.categories });
  const categoryId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const optionId = crypto.randomUUID();
  const seed = { baseRevision: 0, categories: [{ id: categoryId, publicId: 'coffee', title: 'قهوه', intro: 'توضیح مالک', layout: 'grid', archived: false,
    items: [{ id: itemId, publicId: 'latte', name: 'لاته', description: null, price: null, mediaId: null, metadata: { featured: true }, archived: false,
      options: [{ id: optionId, label: 'بزرگ', price: '۱۸۰', code: 'large' }] }] }] };
  assert.equal((await save(owner, seed)).statusCode, 200);
  const baseline = await getDocument();
  const ownerActivityCount = db.prepare('SELECT COUNT(*) AS count FROM admin_activity').get().count;
  const forbiddenEdits = [
    (doc) => { doc.categories[0].intro = 'cashier intro'; },
    (doc) => { doc.categories[0].layout = 'addons'; },
    (doc) => { doc.categories[0].items[0].metadata.caption = 'advanced'; },
    (doc) => { doc.categories[0].items[0].options[0].code = 'other'; },
  ];
  for (const edit of forbiddenEdits) {
    const changed = structuredClone(baseline);
    edit(changed);
    const response = await save(cashier, payload(changed));
    assert.equal(response.statusCode, 403, response.body);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_activity').get().count, ownerActivityCount);
  const changed = structuredClone(baseline);
  changed.categories[0].items[0].options[0].price = '۲۰۰';
  const addedId = crypto.randomUUID();
  changed.categories[0].items.push({ id: addedId, publicId: 'espresso', name: 'اسپرسو', price: '۱۲۰', description: null, mediaId: null, metadata: {}, options: [], archived: false });
  const saved = await save(cashier, payload(changed));
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().revision, 2);
  const published = JSON.parse(fs.readFileSync(path.join(root, 'managed-menu', 'current.json'), 'utf8'));
  assert.equal(published.categories[0].items[0].options[0].price, '۲۰۰');
  const auditCount = db.prepare('SELECT COUNT(*) AS count FROM admin_activity').get().count;
  assert.equal((await save(cashier, payload(changed))).statusCode, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_activity').get().count, auditCount);

  let doc = await getDocument();
  doc.categories[0].items = doc.categories[0].items.filter((item) => item.id !== itemId);
  assert.equal((await save(cashier, payload(doc))).statusCode, 422);
  assert.equal((await save(cashier, { ...payload(doc), deletedItemIds: [itemId, crypto.randomUUID()] })).statusCode, 422);
  const deleted = await save(cashier, { ...payload(doc), deletedItemIds: [itemId] });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_item_options WHERE item_id = ?').get(itemId).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count, 1);

  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/activity' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/activity', headers: headers(cashier) })).statusCode, 403);
  const report = await app.inject({ method: 'GET', url: '/api/admin/activity', headers: headers(owner) });
  assert.equal(report.statusCode, 200);
  const entries = report.json().entries;
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.username === 'cashier' && !Number.isNaN(Date.parse(entry.createdAt))));
  assert.equal(entries[0].details.changes.find((change) => change.id === itemId).operation, 'delete');
  const priceChange = entries[1].details.changes.find((change) => change.id === itemId).fields.find((field) => field.field === 'options');
  assert.equal(priceChange.before[0].price, '۱۸۰');
  assert.equal(priceChange.after[0].price, '۲۰۰');
  assert.equal(entries[1].details.changes.find((change) => change.id === addedId).operation, 'create');
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/activity?before=-1', headers: headers(owner) })).statusCode, 422);

  // A log failure must roll back the content and revision, not silently lose accountability.
  db.exec("CREATE TRIGGER reject_activity BEFORE INSERT ON admin_activity BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
  doc = await getDocument();
  doc.categories[0].items[0].name = 'unsaved failure';
  assert.equal((await save(cashier, payload(doc))).statusCode, 500);
  assert.equal((await getDocument()).categories[0].items[0].name, 'اسپرسو');
  assert.equal((await getDocument()).revision, 3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'managed-menu', 'current.json'), 'utf8')).revision, 3);
  db.exec('DROP TRIGGER reject_activity');

  const deletion = await save(cashier, { baseRevision: 3, categories: [], deletedCategoryIds: [categoryId], deletedItemIds: [addedId] });
  assert.equal(deletion.statusCode, 200, deletion.body);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM menu_categories').get().count, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  for (let index = 0; index < 51; index += 1) await save(cashier, { baseRevision: index + 4, categories: [] });
  const pageOne = (await app.inject({ method: 'GET', url: '/api/admin/activity', headers: headers(owner) })).json();
  const pageTwo = (await app.inject({ method: 'GET', url: `/api/admin/activity?before=${pageOne.nextCursor}`, headers: headers(owner) })).json();
  assert.equal(pageOne.entries.length, 50);
  assert.equal(pageTwo.entries.length, 4);
  assert.equal(pageTwo.nextCursor, null);
  assert.ok(pageTwo.entries.every((entry) => entry.id < pageOne.nextCursor));
});

test('cashier uploads are audited and roll back database changes if logging fails', async (t) => {
  const { root, db, config } = fixture();
  const now = sqlNow();
  db.prepare(`INSERT INTO admin_users (id, username, password_hash, role, created_at, updated_at)
    VALUES (2, 'cashier', ?, 'cashier', ?, ?)`).run(bcrypt.hashSync('cashier-secret', 4), now, now);
  const { app } = await buildApp({ db, config, logger: false });
  t.after(async () => { await app.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const response = await app.inject({ method: 'POST', url: '/api/session/login', headers: { origin: config.allowedOrigin }, payload: { username: 'cashier', password: 'cashier-secret' } });
  const cookie = String(response.headers['set-cookie']).split(';', 1)[0];
  async function upload(color) {
    const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: color } }).jpeg().toBuffer();
    const boundary = 'test-media-boundary';
    return app.inject({ method: 'POST', url: '/api/admin/media',
      headers: { cookie, origin: config.allowedOrigin, 'x-csrf-token': response.json().csrfToken, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), jpeg, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    });
  }
  const uploaded = await upload('#ffffff');
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const entry = db.prepare('SELECT * FROM admin_activity').get();
  assert.equal(entry.actor_role, 'cashier');
  assert.equal(entry.action, 'media.upload');
  assert.equal(JSON.parse(entry.details_json).mediaId, uploaded.json().media.id);
  db.exec("CREATE TRIGGER reject_activity BEFORE INSERT ON admin_activity BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
  assert.equal((await upload('#681f2d')).statusCode, 500);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_activity').get().count, 1);
});
