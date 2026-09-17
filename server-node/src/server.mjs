import Fastify from 'fastify';

import { loadConfig } from './config.mjs';
import { assertDatabaseHealthy, openDatabase } from './db.mjs';

const config = loadConfig();
const db = openDatabase(config.dbPath, { fileMustExist: true });
assertDatabaseHealthy(db);

const app = Fastify({
  logger: true,
  bodyLimit: 2_097_152,
  disableRequestLogging: false,
});

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/')) {
    reply.header('Cache-Control', 'no-store');
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
  };
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    reply.code(404);
    return {
      error: {
        type: 'not_found',
        message: 'The API route does not exist.',
        details: null,
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
