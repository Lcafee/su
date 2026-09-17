import path from 'node:path';

function intEnv(name, fallback, min) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

function absoluteEnv(name, fallback) {
  const value = process.env[name]?.trim() || fallback;
  if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return value;
}

export function loadConfig() {
  const dataRoot = absoluteEnv('LCAFE_SITE_DATA_ROOT', '/var/lib/lcafe-site');
  const dbPath = absoluteEnv('LCAFE_SITE_DB', path.join(dataRoot, 'site.sqlite'));

  return Object.freeze({
    bindHost: process.env.LCAFE_SITE_BIND_HOST?.trim() || '127.0.0.1',
    port: intEnv('LCAFE_SITE_PORT', 3100, 1),
    allowedOrigin: process.env.LCAFE_SITE_ALLOWED_ORIGIN?.trim() || 'https://l-cafe.ir',
    dataRoot,
    dbPath,
    paths: Object.freeze({
      managedMenu: absoluteEnv('LCAFE_SITE_MANAGED_MENU_DIR', path.join(dataRoot, 'managed-menu')),
      managedMedia: absoluteEnv('LCAFE_SITE_MANAGED_MEDIA_DIR', path.join(dataRoot, 'managed-media')),
      menuRevisions: absoluteEnv('LCAFE_SITE_MENU_REVISIONS_DIR', path.join(dataRoot, 'menu-revisions')),
      mediaOriginals: absoluteEnv('LCAFE_SITE_MEDIA_ORIGINALS_DIR', path.join(dataRoot, 'media-originals')),
    }),
    security: Object.freeze({
      sessionName: process.env.LCAFE_SITE_SESSION_NAME?.trim() || 'lcafe_admin',
      idleTimeoutSeconds: intEnv('LCAFE_SITE_IDLE_TIMEOUT_SECONDS', 1800, 60),
      absoluteTimeoutSeconds: intEnv('LCAFE_SITE_ABSOLUTE_TIMEOUT_SECONDS', 28800, 60),
      maxLoginFailures: intEnv('LCAFE_SITE_MAX_LOGIN_FAILURES', 5, 1),
      loginLockSeconds: intEnv('LCAFE_SITE_LOGIN_LOCK_SECONDS', 900, 60),
    }),
    uploads: Object.freeze({
      maxBytes: intEnv('LCAFE_SITE_UPLOAD_MAX_BYTES', 8 * 1024 * 1024, 1),
      maxPixels: intEnv('LCAFE_SITE_UPLOAD_MAX_PIXELS', 20_000_000, 1),
      webpQuality: intEnv('LCAFE_SITE_WEBP_QUALITY', 82, 1),
    }),
  });
}
