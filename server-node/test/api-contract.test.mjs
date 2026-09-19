import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  const now = sqlNow();
  db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('001_base', now);
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
