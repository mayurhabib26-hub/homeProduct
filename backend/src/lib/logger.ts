/**
 * Structured JSON logging. Never console.log — unstructured, unfilterable.
 *
 * No PII: log orderNumber and look the rest up. A log store full of phone
 * numbers and addresses is a DPDP breach waiting to happen.
 * See docs/OBSERVABILITY.md §2.
 */
import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.phone',
      'req.body.email',
      'req.body.address',
      'req.body.customer',
      '*.razorpaySignature',
    ],
    remove: true,
  },
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
