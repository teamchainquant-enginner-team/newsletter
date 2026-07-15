/**
 * ONE-OFF TEST SEND — no server, no cron, no database.
 *
 *   node testEmail.js you@example.com
 *
 * Builds a real newsletter from live data and emails it to a single address.
 * Nothing is written to the database, no subscribers are touched, and this
 * does NOT count as the day's newsletter — so it's safe to run any time.
 *
 * Falls back to sample data automatically if live APIs are unreachable, so a
 * flaky network never blocks you from confirming that EMAIL DELIVERY works.
 */
import { Resend } from 'resend';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { collectMarket } from './collectors/marketCollector.js';
import { collectNews } from './collectors/newsCollector.js';
import { collectTrends } from './collectors/trendsCollector.js';
import { collectWhales } from './collectors/whaleCollector.js';
import { collectNarratives } from './collectors/narrativeCollector.js';
import { writeNewsletter } from './core/aiWriter.js';
import { polishCopy } from './core/copywriter.js';
import { validateCitations } from './core/citationValidator.js';
import { checkCoverage } from './core/coverageCheck.js';
import { renderHtml, renderText, UNSUB } from './core/renderEmail.js';
import { mockCollected } from './mockData.js';

const to = process.argv[2];
if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
  console.error('\nUsage: node testEmail.js you@example.com\n');
  process.exit(1);
}
if (!config.email.apiKey) {
  console.error('\n❌ RESEND_API_KEY is not set in .env — cannot send.\n');
  process.exit(1);
}

const line = (s = '') => console.log(s);

async function collectLive() {
  const market = await collectMarket();
  // If the market collector returned nothing, treat live data as unavailable.
  if (!market?.data?.majors?.length) throw new Error('no market data returned');
  const [news, trends, whales] = await Promise.all([
    collectNews().catch(() => ({ items: [], sources: [] })),
    collectTrends().catch(() => ({ data: {}, sources: [] })),
    collectWhales().catch(() => ({ items: [], sources: [] })),
  ]);
  const narratives = await collectNarratives({ news: news.items, trends: trends.data, market: market.data })
    .catch(() => ({ items: [], sources: [] }));
  return {
    market, news, trends, whales, narratives,
    allSources: [
      ...(market.sources || []), ...(news.sources || []), ...(trends.sources || []),
      ...(whales.sources || []), ...(narratives.sources || []),
    ],
  };
}

async function main() {
  line('\n── ChainQuant test send ─────────────────────────────');

  let collected, live = true;
  try {
    line('· collecting live market data…');
    collected = await collectLive();
    const btc = collected.market.data.majors.find((m) => m.symbol === 'BTC');
    line(`  ✅ live data OK (BTC $${btc?.price?.toLocaleString()})`);
  } catch (e) {
    live = false;
    collected = mockCollected;
    line(`  ⚠️  live data unavailable (${e.message}) — using sample data instead.`);
    line('     Email delivery is still fully tested; only the figures are sample.');
  }

  line('· writing…');
  let nl = await writeNewsletter(collected);

  const copy = await polishCopy(nl);
  nl = copy.newsletter;
  line(`  ${copy.polished ? '✅ copywriter pass applied' : `· copywriter skipped (${copy.reason})`}`);

  nl = validateCitations(nl, collected).newsletter;
  const cov = checkCoverage(nl);
  line(`  coverage: ${cov.covered}/${cov.total} promised elements`);

  const url = `${config.app.baseUrl}/api/newsletter/unsubscribe?token=TEST`;
  const html = renderHtml(nl, { baseUrl: config.app.baseUrl }).split(UNSUB).join(url);
  const text = renderText(nl).split(UNSUB).join(url);

  line(`· sending to ${to}…`);
  const resend = new Resend(config.email.apiKey);
  const { data, error } = await resend.emails.send({
    from: config.email.from,
    to,
    replyTo: config.email.replyTo,
    subject: `[TEST] ${nl.subject}`,
    html,
    text,
  });

  if (error) {
    line('\n❌ SEND FAILED');
    line(`   ${error.message || JSON.stringify(error)}`);
    line('\n   Most common causes:');
    line('   • Domain not fully verified in Resend (check DKIM/SPF are green)');
    line(`   • RESEND_FROM (${config.email.from}) uses a domain you have not verified`);
    line('   • API key lacks sending permission\n');
    process.exit(1);
  }

  line('\n✅ SENT');
  line(`   to      : ${to}`);
  line(`   subject : ${nl.subject}`);
  line(`   data    : ${live ? 'LIVE market data' : 'sample data'}`);
  line(`   id      : ${data?.id || 'n/a'}`);
  line('\n   Check the inbox (and spam, just in case). Nothing was written to the');
  line("   database and no subscribers were emailed — this doesn't count as today's send.\n");
}

main().catch((e) => { log.error('test send failed', { e: e.message }); console.error(e); process.exit(1); });
