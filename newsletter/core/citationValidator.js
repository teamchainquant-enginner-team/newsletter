import { log } from '../lib/logger.js';

const isUrl = (u) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);

/**
 * Validates the structured newsletter against the collected evidence.
 * Safeguards enforced:
 *  - every whale movement must have a tx/explorer URL → else dropped
 *  - every news/source citation must be a real URL → else dropped
 *  - narrative evidence links must be URLs → invalid ones stripped
 *  - returns { newsletter, report } with counts of what was removed
 * Never throws; returns a sanitized newsletter.
 */
export function validateCitations(newsletter, collected) {
  const report = { droppedWhales: 0, droppedSources: 0, strippedEvidence: 0 };
  const nl = structuredClone(newsletter);

  // Whales
  if (Array.isArray(nl.whales)) {
    const before = nl.whales.length;
    nl.whales = nl.whales.filter((w) => isUrl(w.txUrl));
    report.droppedWhales = before - nl.whales.length;
  }

  // Narrative evidence
  if (Array.isArray(nl.narratives)) {
    for (const n of nl.narratives) {
      if (Array.isArray(n.evidence)) {
        const before = n.evidence.length;
        n.evidence = n.evidence.filter((e) => isUrl(e.url));
        report.strippedEvidence += before - n.evidence.length;
      }
    }
  }

  // Sources list
  if (Array.isArray(nl.sources)) {
    const before = nl.sources.length;
    nl.sources = nl.sources.filter((s) => isUrl(s.url));
    report.droppedSources = before - nl.sources.length;
  }

  if (report.droppedWhales || report.droppedSources || report.strippedEvidence) {
    log.warn('citation validator removed unverifiable content', report);
  }
  return { newsletter: nl, report };
}
