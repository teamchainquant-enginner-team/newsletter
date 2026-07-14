import cron from 'node-cron';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { runPipeline } from './pipeline.js';

// "07:00" -> "0 7 * * *"
function toCron(hhmm) {
  const [h, m] = String(hhmm).split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`bad DAILY_NEWSLETTER_SEND_TIME: ${hhmm}`);
  return `${m} ${h} * * *`;
}

export function startScheduler() {
  const expr = toCron(config.app.sendTime);
  log.info('scheduler armed', {
    cron: expr, timezone: config.app.timezone,
    sendTime: config.app.sendTime, previewMode: config.app.previewMode,
  });

  cron.schedule(expr, async () => {
    log.info('cron fired — running daily newsletter');
    try {
      await runPipeline({ trigger: 'cron' });
      // In preview mode the run stops at preview_ready and waits for approval.
    } catch (e) {
      log.error('cron run failed', { e: e.message });
    }
  }, { timezone: config.app.timezone });
}

// Allow running this file directly as a dedicated scheduler process.
if (import.meta.url === `file://${process.argv[1]}`) {
  startScheduler();
  log.info('scheduler process running; press Ctrl+C to exit.');
}
