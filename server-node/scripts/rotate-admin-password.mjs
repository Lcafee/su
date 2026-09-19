import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

import { loadConfig } from '../src/config.mjs';

// Matches the cost the admin hashes were imported with room to spare; login now
// compares against every active account, so this also bounds that work.
const BCRYPT_COST = 12;

function fail(message) {
  throw new Error(`rotate-admin-password: ${message}`);
}

function nowSqlUtc(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace('Z', '000');
}

// The password arrives on stdin, never in argv: argv is visible to any local
// process through /proc and is kept in shell history.
function readPasswordFromStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(input.replace(/\r?\n$/, '')));
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--username') {
    fail('usage: node scripts/rotate-admin-password.mjs --username <name> < password-on-stdin');
  }
  const username = args[1];

  const password = await readPasswordFromStdin();
  if (!password) fail('no password was supplied on stdin');
  if (Buffer.byteLength(password, 'utf8') > 4096) fail('password exceeds 4096 bytes');

  const config = loadConfig();
  const db = new Database(config.dbPath, { fileMustExist: true });
  try {
    const user = db.prepare(
      'SELECT id, username, role, is_active, session_epoch FROM admin_users WHERE username = ?'
    ).get(username);
    if (!user) fail(`no admin user named ${username}`);
    if (user.is_active !== 1) fail(`admin user ${username} is not active`);

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const now = nowSqlUtc();

    // Bumping session_epoch invalidates every existing session for this user,
    // so a rotated credential cannot be outlived by a session that used the old
    // one. Clearing the lockout keeps a locked account from staying locked.
    const result = db.prepare(`
      UPDATE admin_users
      SET password_hash = ?, session_epoch = session_epoch + 1,
          failed_login_count = 0, locked_until = NULL, updated_at = ?
      WHERE id = ? AND session_epoch = ?
    `).run(hash, now, user.id, user.session_epoch);
    if (result.changes !== 1) fail('the account changed while rotating; nothing was written');

    const updated = db.prepare(
      'SELECT session_epoch FROM admin_users WHERE id = ?'
    ).get(user.id);

    // Never print the password or the hash.
    console.log(JSON.stringify({
      ok: true,
      username: user.username,
      role: user.role,
      sessionEpoch: updated.session_epoch,
      rotatedAt: now,
    }));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
