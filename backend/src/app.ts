import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { isProduction } from './lib/env.js';
import { requestId } from './middleware/request-id.js';
import { adminCors } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { catalogueRouter } from './routes/catalogue.js';
import { ordersRouter } from './routes/orders.js';
import { adminAuthRouter } from './routes/admin-auth.js';
import { customerAuthRouter } from './routes/customer-auth.js';
import { adminRouter } from './routes/admin.js';
import { adminProductsRouter } from './routes/admin-products.js';
import { metricsRouter } from './routes/metrics.js';
import { webhooksRouter } from './routes/webhooks.js';
import { getDb } from './db/client.js';
import { sql } from 'drizzle-orm';
import { queueDepth } from './lib/queue.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  /**
   * The API returns JSON, never HTML, so its CSP can be maximally strict:
   * nothing is allowed to load or execute from an API response. The pages'
   * own policies live in each app's public/_headers, applied by the CDN.
   * See docs/SECURITY.md §3.10.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'none'"],
        },
      },
      // Set by the CDN in front; duplicating it here risks the two disagreeing.
      strictTransportSecurity: isProduction,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  // Before the routers, so preflights are answered without reaching them.
  app.use(adminCors);
  app.use(requestId);
    // genReqId reuses the id set by our own middleware so the HTTP log line
  // and every application log line for a request share one id.
  app.use(pinoHttp({ logger, genReqId: (req) => String((req as unknown as { id: string }).id) }));
  // Webhooks mount BEFORE express.json(): they need the raw bytes to verify
  // their HMAC. Parsing first silently breaks every signature.
  app.use('/api', webhooksRouter);

  app.use(express.json({ limit: '100kb' }));

  /**
   * Liveness: no dependency checks, deliberately.
   *
   * If this checked Postgres, a 30-second database blip would make the load
   * balancer kill every instance at once, turning a degradation into an
   * outage it cannot recover from. See docs/API.md §7.
   */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /** Readiness: for deploy gating, not liveness. */
  app.get('/api/health/ready', async (_req, res) => {
    try {
      await getDb().execute(sql`select 1`);
      const queues = await queueDepth();
      res.json({ status: 'ready', database: 'ok', queues });
    } catch {
      res.status(503).json({ status: 'not-ready', database: 'unreachable' });
    }
  });

  app.use('/api', catalogueRouter);
  app.use('/api', ordersRouter);
  app.use('/api', customerAuthRouter);
  app.use('/api', adminAuthRouter);
  app.use('/api', adminRouter);
  app.use('/api', adminProductsRouter);
  app.use('/api', metricsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
