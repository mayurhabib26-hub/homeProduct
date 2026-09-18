import { createApp } from './app.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
});

/**
 * Crash handlers.
 *
 * Without these an unhandled rejection takes the process down with nothing in
 * the log explaining why — the worst possible failure, because it looks like
 * the host killed you. Log first, then exit: a process in an unknown state
 * must not keep serving payments.
 */
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection — exiting');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5_000).unref();
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — exiting');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 5_000).unref();
});

/**
 * Finish in-flight requests before exiting, or every deploy drops whatever
 * was mid-checkout. See docs/DEPLOYMENT.md §6.
 */
const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
