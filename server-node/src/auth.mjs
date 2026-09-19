import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { ApiError, requireAllowedOrigin, requireObjectBody } from './http.mjs';

// Login is password-only, so a failed attempt identifies no account. One
// process-wide throttle replaces the per-account lockout; this single API
// process receives all login traffic.
let loginFailureCount = 0;
let loginLockedUntilMs = 0;

const DUMMY_HASH = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

function nowSqlUtc(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '000');
}

function parseSqlUtc(value) {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/.exec(value);
  if (!match) return Number.NaN;
  const millis = (match[3] || '').slice(0, 3).padEnd(3, '0');
  return Date.parse(`${match[1]}T${match[2]}.${millis}Z`);
}

function parseCookies(header) {
  const cookies = new Map();
  for (const part of String(header || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function sessionIdFromRequest(request, config) {
  const value = parseCookies(request.headers.cookie).get(config.security.sessionName) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function setSessionCookie(reply, config, id) {
  reply.header(
    'Set-Cookie',
    `${config.security.sessionName}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict`,
  );
}

function clearSessionCookie(reply, config) {
  reply.header(
    'Set-Cookie',
    `${config.security.sessionName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict`,
  );
}

function normalizedRole(role) {
  if (role !== 'owner' && role !== 'cashier') {
    throw new ApiError(503, 'schema_unavailable', 'The admin role is invalid.');
  }
  return role;
}

function deleteExpiredSessions(db, config, nowSeconds) {
  db.prepare(
    'DELETE FROM admin_sessions WHERE last_seen < ? OR issued_at < ?'
  ).run(
    nowSeconds - config.security.idleTimeoutSeconds,
    nowSeconds - config.security.absoluteTimeoutSeconds,
  );
}

export function sessionContext(db, config, request, { touch = true } = {}) {
  const sessionId = sessionIdFromRequest(request, config);
  if (!sessionId) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const row = db.prepare(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.session_epoch AS session_epoch,
      s.csrf_token,
      s.issued_at,
      s.last_seen,
      u.username,
      u.role,
      u.session_epoch AS user_session_epoch,
      u.is_active
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(sessionId);

  if (!row) return null;
  const expired = (nowSeconds - row.last_seen) > config.security.idleTimeoutSeconds
    || (nowSeconds - row.issued_at) > config.security.absoluteTimeoutSeconds;
  const invalid = expired
    || row.is_active !== 1
    || row.session_epoch !== row.user_session_epoch;
  if (invalid) {
    db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(sessionId);
    return null;
  }

  if (touch) {
    db.prepare('UPDATE admin_sessions SET last_seen = ? WHERE id = ?').run(nowSeconds, sessionId);
    row.last_seen = nowSeconds;
  }

  return {
    sessionId,
    session: {
      csrfToken: row.csrf_token,
      epoch: row.session_epoch,
      issuedAt: row.issued_at,
      lastSeen: row.last_seen,
    },
    user: {
      id: row.user_id,
      username: row.username,
      role: normalizedRole(row.role),
    },
  };
}

export function requireUser(db, config, request) {
  const context = sessionContext(db, config, request);
  if (!context) {
    throw new ApiError(401, 'authentication_required', 'Authentication is required.');
  }
  return context;
}

export function requireOwner(user) {
  if (user.role !== 'owner') {
    throw new ApiError(403, 'permission_denied', 'Owner access is required.');
  }
}

export function requireCsrf(config, request, context) {
  requireAllowedOrigin(request, config);
  const expected = context.session.csrfToken;
  const actual = request.headers['x-csrf-token'];
  if (typeof actual !== 'string') {
    throw new ApiError(403, 'csrf_rejected', 'The CSRF token is missing or invalid.');
  }
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  if (expectedBytes.length !== actualBytes.length || !crypto.timingSafeEqual(expectedBytes, actualBytes)) {
    throw new ApiError(403, 'csrf_rejected', 'The CSRF token is missing or invalid.');
  }
}

function sessionPayload(context) {
  if (!context) return { authenticated: false };
  return {
    authenticated: true,
    user: context.user,
    csrfToken: context.session.csrfToken,
  };
}

async function verifyPassword(password, hash) {
  const normalized = hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
  return bcrypt.compare(password, normalized);
}

export function registerAuthRoutes(app, { db, config }) {
  app.get('/api/session', async (request) => sessionPayload(sessionContext(db, config, request)));

  app.post('/api/session/login', { bodyLimit: 32_768 }, async (request, reply) => {
    requireAllowedOrigin(request, config);
    const input = requireObjectBody(request);
    const password = input.password;
    if (typeof password !== 'string' || password === '' || Buffer.byteLength(password, 'utf8') > 4096) {
      throw new ApiError(401, 'invalid_credentials', 'The password is incorrect.');
    }

    const now = new Date();
    const nowMs = now.getTime();
    if (loginLockedUntilMs > nowMs) {
      throw new ApiError(401, 'invalid_credentials', 'The password is incorrect.');
    }

    const candidates = db.prepare(`
      SELECT id, username, password_hash, session_epoch
      FROM admin_users WHERE is_active = 1 ORDER BY id
    `).all();

    // Compare against every active account and never short-circuit: stopping at
    // the first match would let response time reveal which account owns the
    // password. With no active accounts, still spend one comparison.
    let matched = null;
    let matchCount = 0;
    for (const candidate of candidates.length ? candidates : [{ id: null, password_hash: DUMMY_HASH }]) {
      const isMatch = await verifyPassword(password, candidate.password_hash);
      if (isMatch && candidate.id !== null) {
        matchCount += 1;
        if (!matched) matched = candidate;
      }
    }

    // Without a username the password is the identifier, so two accounts sharing
    // one would make the login ambiguous. Refuse rather than pick an account.
    const row = matchCount === 1 ? matched : null;

    if (!row) {
      // The attempt names no account, so the failure cannot be charged to one:
      // counting it against every user would let anyone lock out the owner.
      loginFailureCount += 1;
      if (loginFailureCount >= config.security.maxLoginFailures) {
        loginLockedUntilMs = nowMs + config.security.loginLockSeconds * 1000;
        loginFailureCount = 0;
      }
      throw new ApiError(401, 'invalid_credentials', 'The password is incorrect.');
    }

    loginFailureCount = 0;
    loginLockedUntilMs = 0;

    const update = db.prepare(`
      UPDATE admin_users
      SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
      WHERE id = ? AND session_epoch = ? AND password_hash = ?
    `).run(nowSqlUtc(now), nowSqlUtc(now), row.id, row.session_epoch, row.password_hash);
    if (update.changes !== 1) {
      throw new ApiError(401, 'invalid_credentials', 'The password is incorrect.');
    }

    const oldSessionId = sessionIdFromRequest(request, config);
    if (oldSessionId) db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(oldSessionId);
    const nowSeconds = Math.floor(nowMs / 1000);
    deleteExpiredSessions(db, config, nowSeconds);
    const sessionId = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO admin_sessions
        (id, user_id, session_epoch, csrf_token, issued_at, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, row.id, row.session_epoch, csrfToken, nowSeconds, nowSeconds, now.toISOString());
    setSessionCookie(reply, config, sessionId);

    return sessionPayload(sessionContext(db, config, {
      headers: { cookie: `${config.security.sessionName}=${sessionId}` },
    }, { touch: false }));
  });

  app.delete('/api/session', async (request, reply) => {
    const context = requireUser(db, config, request);
    requireCsrf(config, request, context);
    db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(context.sessionId);
    clearSessionCookie(reply, config);
    return { authenticated: false };
  });
}
