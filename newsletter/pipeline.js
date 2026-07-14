import { config, envWarnings } from './config.js';
import { log } from './lib/logger.js';
import { createRun, updateRun, saveSources, alreadySentForDate, todayUTC } from './lib/supabase.js';
import { collectMarket } from './collectors/marketCollector.js';
import { collectNews } from './collectors/newsCollector.js';
import { collectTrends } from './collectors/trendsCollector.js';
import { collectNarratives } from './collectors/narrativeCollector.js';
import { collectWhales } from './collectors/whaleCollector.js';
import { writeNewsletter } from './core/aiWriter.js';
import { validateCitations } from './core/citationValidator.js';
import { polishCopy } from './core/copywriter.js';
import { checkCoverage } from './core/coverageCheck.js';
import { renderHtml, renderText } from './core/renderEmail.js';
import { sendRun } from './sendNewsletter.js';
import { alertPipelineFailed, alertDraftReady, alertPartialFailure } from './alerts.js';

/**
 * Runs the full daily pipeline.
 * @param {object} opts { trigger:'cron'|'manual', force:boolean, autoSend:boolean }
 * Behaviour:
 *  - If a newsletter is already SENT for today and !force → skips.
 *  - Always produces a draft and stores it (status preview_ready).
 *  - Sends automatically only when preview mode is OFF (or autoSend=true).
 */
export async function runPipeline({ trigger = 'manual', force = false, autoSend = null } = {}) {
  for (const w of envWarnings()) log.warn(w);

  const runDate = todayUTC();
  if (!force && (await alreadySentForDate(runDate))) {
    log.info('newsletter already sent for today — skipping', { runDate });
    return { skipped: true };
  }

  const run = await createRun(runDate);
  log.info('pipeline started', { runId: run.id, runDate, trigger });
  let step = 'init';

  try {
    // 1) Collect (each collector degrades to empty on failure)
    const market = (step = 'collect:market', await log.step('collect:market', () => collectMarket()));
    const news = (step = 'collect:news', await log.step('collect:news', () => collectNews()));
    const trends = (step = 'collect:trends', await log.step('collect:trends', () => collectTrends()));
    const whales = (step = 'collect:whales', await log.step('collect:whales', () => collectWhales()));
    const narratives = (step = 'collect:narratives', await log.step('collect:narratives', () =>
      collectNarratives({ news: news.items, trends: trends.data, market: market.data })));

    const collected = {
      market, news, trends, whales, narratives,
      allSources: [
        ...(market.sources || []), ...(news.sources || []), ...(trends.sources || []),
        ...(whales.sources || []), ...(narratives.sources || []),
      ],
    };
    await saveSources(run.id, collected.allSources);

    // 2) Write
    await updateRun(run.id, { status: 'writing' });
    let newsletter = (step = 'write:ai', await log.step('write:ai', () => writeNewsletter(collected)));

    // 3) COPYWRITER pass — rewrites prose for voice/readability. Rejected
    //    automatically if it alters any figure (analyst draft then ships as-is).
    step = 'write:copywriter';
    const copy = await log.step('write:copywriter', () => polishCopy(newsletter));
    newsletter = copy.newsletter;

    // 4) Validate citations (drop unverifiable content)
    step = 'validate:citations';
    const { newsletter: clean, report } = validateCitations(newsletter, collected);
    newsletter = clean;

    // 5) Coverage check — every promised element must be present
    step = 'validate:coverage';
    const coverage = checkCoverage(newsletter);

    // 4) Render
    const html = renderHtml(newsletter, { baseUrl: config.app.baseUrl });
    const text = renderText(newsletter);

    // 5) Store draft
    const metrics = {
      whales: newsletter.whales.length,
      narratives: newsletter.narratives.length,
      sources: newsletter.sources.length,
      news: news.items.length,
      validator: report,
      coverage,
      copywriter: { polished: copy.polished, reason: copy.reason || null },
    };
    const saved = await updateRun(run.id, {
      subject: newsletter.subject,
      html_content: html,
      text_content: text,
      sources_json: collected.allSources,
      metrics_json: metrics,
      status: 'preview_ready',
    });
    log.info('draft ready', { runId: run.id, ...metrics });
    if (!coverage.ok) {
      await alertPartialFailure({
        runId: run.id, runDate, sent: 0, failed: 0,
        degraded: coverage.missingRequired.map((m) => `MISSING: ${m}`),
      }).catch(() => {});
    }

    // 6) Auto-send only if preview mode off (or explicitly forced)
    const shouldSend = autoSend == null ? !config.app.previewMode : autoSend;
    if (shouldSend) {
      log.info('preview mode off — sending now', { runId: run.id });
      return await sendRun(run.id);
    }
    log.info('preview mode on — awaiting manual approval', { runId: run.id });
    await alertDraftReady({ runId: run.id, runDate, subject: newsletter.subject, metrics });
    return saved;
  } catch (err) {
    log.error('pipeline failed', { runId: run.id, step, error: err.message });
    await updateRun(run.id, { status: 'failed', error_message: `[${step}] ${err.message}` }).catch(() => {});
    // Tell a human. A silent 07:00 failure is the worst outcome.
    await alertPipelineFailed({ runId: run.id, runDate, step, error: err.stack || err.message, trigger });
    throw err;
  }
}
