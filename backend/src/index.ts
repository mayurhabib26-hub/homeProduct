// Express API skeleton. Routes, services and the database land in Phase 1 —
// see docs/ROADMAP.md.

import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4000);

// Liveness: no dependency checks, deliberately. A slow database must not
// cause the load balancer to kill healthy instances. See docs/API.md §7.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(port, () => {
  console.log(`API listening on :${port}`);
});

// Finish in-flight requests before exiting, or every deploy drops whatever
// was mid-checkout. See docs/DEPLOYMENT.md §6.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
