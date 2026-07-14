import { httpGet } from '../lib/http.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * Data-driven narratives. The backbone is REAL sector rotation (CoinGecko
 * category market-cap change 24h), boosted by news flow, Reddit chatter,
 * trending-search overlap, and optional Twitter mentions. Returns { items, sources }.
 * Each item: { narrative, momentum, change24h, evidence[], takeaway }.
 */
export async function collectNarratives({ news = [], trends = {}, market = {} } = {}) {
  const sectors = trends.sectors?.hot || [];
  const reddit = trends.reddit || [];
  const trending = trends.trending || [];
  const sources = [];

  // Seed from real sector performance; fall back to a small taxonomy if empty.
  const seeds = sectors.length
    ? sectors.map((s) => ({ name: cleanName(s.name), change24h: s.change24h, terms: tokens(s.name) }))
    : FALLBACK.map((f) => ({ name: f.name, change24h: null, terms: f.terms }));

  const social = await fetchSocial(seeds.map((s) => s.name));

  const scored = seeds.map((s) => {
    const evidence = [];
    let score = 0;

    // Real sector move (primary signal)
    if (Number.isFinite(s.change24h)) {
      score += Math.max(0, s.change24h) * 4 + Math.min(Math.abs(s.change24h), 10);
      evidence.push({ type: 'sector', label: `${s.name} market cap ${fmtPct(s.change24h)} 24h`, url: 'https://www.coingecko.com/en/categories' });
    }
    // News flow
    const nHits = news.filter((a) => match(a.title, s.terms));
    score += nHits.length * 7;
    nHits.slice(0, 2).forEach((h) => evidence.push({ type: 'news', label: `${h.outlet}: ${h.title}`, url: h.url }));
    // Reddit chatter
    const rHits = reddit.filter((p) => match(p.title, s.terms));
    score += rHits.length * 5;
    rHits.slice(0, 1).forEach((p) => evidence.push({ type: 'reddit', label: `Reddit: ${p.title} (${p.score} upvotes)`, url: p.url }));
    // Trending-search overlap
    const tHits = trending.filter((t) => match(`${t.name} ${t.symbol}`, s.terms));
    score += tHits.length * 6;
    tHits.slice(0, 1).forEach((t) => evidence.push({ type: 'trending', label: `${t.symbol} trending in searches`, url: 'https://www.coingecko.com/en/highlights/trending-crypto' }));
    // Social mentions (optional)
    const so = social[s.name];
    if (so?.count) { score += Math.min(so.count, 40); evidence.push({ type: 'social', label: `${so.count} recent X mentions`, url: so.url }); }

    return { narrative: s.name, momentum: Math.round(score), change24h: s.change24h ?? null, evidence };
  })
    .filter((n) => n.momentum > 0 && n.evidence.length)
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 6);

  scored.forEach((n) => sources.push({ source_type: 'social', title: `Narrative: ${n.narrative} (momentum ${n.momentum})`, url: n.evidence[0]?.url || null, confidence: 0.6, data: { evidence: n.evidence } }));
  log.info('narratives built', { count: scored.length, fromSectors: sectors.length });
  return { items: scored, sources };
}

const FALLBACK = [
  { name: 'AI coins', terms: ['ai', 'artificial intelligence', 'agent'] },
  { name: 'Memecoins', terms: ['meme', 'dog', 'pepe'] },
  { name: 'RWAs', terms: ['rwa', 'real world asset', 'tokeniz'] },
  { name: 'DePIN', terms: ['depin'] },
  { name: 'Solana ecosystem', terms: ['solana', 'sol'] },
  { name: 'ETF flows', terms: ['etf', 'inflow', 'outflow'] },
  { name: 'L2s', terms: ['layer 2', 'l2', 'rollup', 'base'] },
  { name: 'Stablecoins', terms: ['stablecoin', 'usdt', 'usdc'] },
];

const cleanName = (n) => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
const tokens = (n) => cleanName(n).toLowerCase().split(/[\s/&-]+/).filter((w) => w.length > 2);
const match = (text, terms) => { const t = (text || '').toLowerCase(); return terms.some((term) => t.includes(term)); };
const fmtPct = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%');

async function fetchSocial(names) {
  const out = {};
  if (!config.data.twitterapi) return out;
  for (const name of names) {
    try {
      const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(name + ' crypto')}&queryType=Latest`;
      const j = await httpGet(url, { headers: { 'x-api-key': config.data.twitterapi }, maxPerMin: 12 });
      out[name] = { count: j?.tweets?.length || j?.data?.length || 0, url: `https://twitter.com/search?q=${encodeURIComponent(name + ' crypto')}` };
    } catch (e) { log.warn('social count failed', { name, e: e.message }); }
  }
  return out;
}
