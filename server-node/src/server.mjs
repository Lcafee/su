import multipart from '@fastify/multipart';
import Fastify from 'fastify';

import { registerAuthRoutes } from './auth.mjs';
import { loadConfig } from './config.mjs';
import { assertDatabaseHealthy, openDatabase } from './db.mjs';
import { installApiErrorHandler } from './http.mjs';
import { registerMediaRoute } from './media.mjs';
import { registerReadOnlyMenuRoutes } from './menu-read.mjs';
import { registerMenuWriteRoutes } from './menu-write.mjs';
import { createMutationLock } from './mutation-lock.mjs';

const config = loadConfig();
const db = openDatabase(config.dbPath, { fileMustExist: true });
assertDatabaseHealthy(db);
const mutationLock = createMutationLock({ timeoutMs: 10_000 });

const app = Fastify({
  logger: true,
  bodyLimit: 2_097_152,
  disableRequestLogging: false,
});

await app.register(multipart, {
  throwFileSizeLimit: true,
  limits: {
    fileSize: config.uploads.maxBytes,
    files: 1,
    fields: 0,
    parts: 1,
  },
});

installApiErrorHandler(app);

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/')) {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Pragma', 'no-cache');
    reply.header('X-Content-Type-Options', 'nosniff');
  }
  return payload;
});

app.get('/healthz', async () => ({ ok: true, service: 'lcafe-site-api' }));

app.get('/readyz', async (_request, reply) => {
  const migration = db.prepare(
    "SELECT 1 AS ok FROM schema_migrations WHERE version = '001_base'"
  ).get();
  const state = db.prepare(
    'SELECT edit_revision, published_revision FROM menu_state WHERE id = 1'
  ).get();
  if (!migration || !state) {
    reply.code(503);
    return { ok: false };
  }
  return {
    ok: true,
    editRevision: state.edit_revision,
    publishedRevision: state.published_revision,
    mutationQueue: mutationLock.queued,
  };
});

registerAuthRoutes(app, { db, config });
registerReadOnlyMenuRoutes(app, { db, config });
registerMenuWriteRoutes(app, { db, config, mutationLock });
registerMediaRoute(app, { db, config, mutationLock });

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    reply.code(404);
    return {
      error: {
        type: 'not_found',
        message: 'The API route does not exist.',
        details: [],
      },
    };
  }
  reply.code(404);
  return { error: 'not_found' };
});

app.addHook('onClose', async () => {
  db.close();
});

async function shutdown(signal) {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, 'shutdown failed');
    process.exit(1);
  }
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

try {
  await app.listen({ host: config.bindHost, port: config.port });
} catch (error) {
  app.log.error(error);
  db.close();
  process.exit(1);
}
