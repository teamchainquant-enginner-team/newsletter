import express from 'express';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { router } from './adminRoutes.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.disable('x-powered-by');

// Minimal CORS so chainquant.net can POST to /subscribe & /unsubscribe from the browser.
const allowedOrigins = [config.app.baseUrl, config.app.baseUrl.replace('://', '://www.')];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Hosted test signup page + any static assets (public/).
app.use(express.static('public'));

// API. To mount inside an EXISTING Express app instead of running standalone:
//   import { router as nl } from './newsletter/adminRoutes.js';
//   app.use('/api/newsletter', nl);
//   import { startScheduler } from './newsletter/scheduler.js'; startScheduler();
app.use('/api/newsletter', router);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'chainquant-newsletter', previewMode: config.app.previewMode }));

app.listen(config.app.port, () => {
  log.info(`newsletter service on :${config.app.port}`, { previewMode: config.app.previewMode });
  // In-process daily cron (07:00 UTC). On hosts using a SEPARATE cron job
  // (e.g. Render Cron), set RUN_SCHEDULER=false to avoid double sends.
  if (process.env.RUN_SCHEDULER !== 'false') startScheduler();
});
