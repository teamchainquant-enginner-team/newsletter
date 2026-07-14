import { log } from '../lib/logger.js';

/**
 * COVERAGE CHECK — enforces the promise made to subscribers.
 *
 * ChainQuant advertises that every 07:00 newsletter contains seven things.
 * This verifies each one is actually present before the email can go out.
 * A missing element = a broken promise to a paying customer, so it's checked
 * mechanically rather than trusted.
 *
 * Severity:
 *   required  → if missing, the run is marked degraded and you get an ops alert.
 *   graceful  → may legitimately be empty (e.g. no whale tx cleared the $1M bar
 *               with a verifiable hash). The section must then SAY so honestly
 *               rather than silently vanish — that's still coverage.
 */
export const PROMISED = [
  { key: 'overnight_summary', label: 'Overnight cryptocurrency market summary', severity: 'required' },
  { key: 'developments_24h', label: 'Most important developments, past 24h', severity: 'required' },
  { key: 'whale_movements', label: 'Top whale movements & notable wallet activity', severity: 'graceful' },
  { key: 'trending', label: 'Trending tokens, sectors & market narratives', severity: 'required' },
  { key: 'momentum', label: 'Social & market momentum insights', severity: 'graceful' },
  { key: 'visuals_citations', label: 'Charts, supporting visuals & source citations', severity: 'required' },
  { key: 'opportunities_risks', label: 'Key opportunities, risks & developments to monitor', severity: 'required' },
];

const has = (s) => typeof s === 'string' && s.trim().length > 20;

export function checkCoverage(nl) {
  const sec = nl.sections || {};
  const results = {
    // 1. Overnight market summary
    overnight_summary: has(sec.backdrop?.body) && (nl.majors || []).length > 0,
    // 2. Most important developments from the past 24h (macro/news read)
    developments_24h: has(sec.macro?.body) || has(sec.flows?.body),
    // 3. Whale movements — present if we have verified txs, OR the section
    //    honestly states none qualified (graceful, still covered).
    whale_movements: (nl.whales || []).length > 0 || has(sec.onchain?.body),
    // 4. Trending tokens, sectors, narratives
    trending: (nl.narratives || []).length > 0 || (nl.sectors?.hot || []).length > 0 || has(sec.narratives?.body),
    // 5. Social & market momentum
    momentum: (nl.narratives || []).some((n) => Number.isFinite(n.momentum))
      || (nl.trending || []).length > 0 || (nl.reddit || []).length > 0,
    // 6. Charts, visuals, citations
    visuals_citations: (nl.sources || []).length > 0 && ((nl.majors || []).length > 0 || (nl.narratives || []).length > 0),
    // 7. Opportunities, risks, what to monitor
    opportunities_risks: (nl.watchlist || []).length > 0
      && (has(sec.levels?.body) || has(sec.contrarian?.body) || has(sec.weekAhead?.body)),
  };

  const missing = PROMISED.filter((p) => !results[p.key]);
  const missingRequired = missing.filter((p) => p.severity === 'required');

  const report = {
    covered: PROMISED.length - missing.length,
    total: PROMISED.length,
    missing: missing.map((p) => p.label),
    missingRequired: missingRequired.map((p) => p.label),
    ok: missingRequired.length === 0,
  };

  if (report.ok) log.info('coverage check passed', { covered: `${report.covered}/${report.total}` });
  else log.warn('coverage check — REQUIRED elements missing', { missing: report.missingRequired });

  return report;
}
