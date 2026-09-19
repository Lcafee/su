import { buildApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { assertDatabaseHealthy, openDatabase } from './db.mjs';

const config = loadConfig();
const db = openDatabase(config.dbPath, { fileMustExist: true });
assertDatabaseHealthy(db);

const { app } = await buildApp({ db, config, logger: true });

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
