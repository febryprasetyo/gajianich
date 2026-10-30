import { loadEnv } from './config/env';
import { createApp } from './app';
import { closeDatabase } from './db';
import { startAdmsRealtimeListener, stopAdmsRealtimeListener } from './services/admsRealtimeListener';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Backend server running on port ${env.port} [${env.nodeEnv}]`);
  startAdmsRealtimeListener().catch((err) => {
    console.error('Failed to initialize ADMS realtime listener on boot:', err);
  });
});

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  try {
    await stopAdmsRealtimeListener();
  } catch (err) {
    console.warn('Error while stopping ADMS listener:', err);
  }
  server.close(async () => {
    try {
      await closeDatabase();
      console.log('Database connections closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
