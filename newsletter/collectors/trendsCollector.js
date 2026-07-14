import { httpGet } from '../lib/http.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const cgHeaders = config.data.coingecko ? { 'x-cg-demo-api-key': config.data.coingecko } : {};
const CG_OPTS = { headers: cgHeaders, maxPerMin: config.data.coingecko ? 28 : 8 };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The "what's hot + social pulse + sectors" layer — the stuff retail newsletters
 * lead with. All free + keyless: CoinGecko trending & categories, DefiLlama
 * stablecoins & chains, Reddit community pulse. Returns { data, sources }.
 */
export async function collectTrends() {
  const out = { data: {}, sources: [] };

  // 1) Trending coins — what people are searching RIGHT NOW (retail attention)
  try {
    const j = await httpGet(`${CG_BASE}/search/trending`, CG_OPTS);
    out.data.trending = (j?.coins || []).slice(0, 7).map((c) => ({
      name: c.item?.name, symbol: c.item?.symbol?.toUpperCase(), rank: c.item?.market_cap_rank,
      change24h: num(c.item?.data?.price_change_percentage_24h?.usd),
    }));
    if (out.data.trending.length) out.sources.push({ source_type: 'social', title: `Trending searches: ${out.data.trending.slice(0, 4).map((t) => t.symbol).join(', ')}`, url: 'https://www.coingecko.com/en/highlights/trending-crypto', confidence: 0.8, data: out.data.trending });
  } catch (e) { log.warn('trends: trending failed', { e: e.message }); }

  // 2) Sector / category performance — real narrative rotation (AI, memes, RWA…)
  try {
    const cats = await httpGet(`${CG_BASE}/coins/categories`, CG_OPTS);
    const usable = (cats || []).filter((c) => num(c.market_cap) && c.market_cap > 2e8 && num(c.market_cap_change_24h));
    const sorted = [...usable].sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h);
    out.data.sectors = {
      hot: sorted.slice(0, 6).map((c) => ({ name: c.name, change24h: c.market_cap_change_24h, mcap: c.market_cap, top: (c.top_3_coins_id || c.top_3_coins || []).slice(0, 3) })),
      cold: sorted.slice(-3).reverse().map((c) => ({ name: c.name, change24h: c.market_cap_change_24h, mcap: c.market_cap })),
    };
    if (out.data.sectors.hot.length) out.sources.push({ source_type: 'market', title: 'Sector performance by market cap (24h)', url: 'https://www.coingecko.com/en/categories', confidence: 0.85, data: out.data.sectors });
  } catch (e) { log.warn('trends: categories failed', { e: e.message }); }

  // 3) Stablecoin supply — "dry powder" liquidity (mint = inflows, burn = outflows)
  try {
    const series = await httpGet('https://stablecoins.llama.fi/stablecoincharts/all', { maxPerMin: 20 });
    if (Array.isArray(series) && series.length > 7) {
      const val = (x) => x?.totalCirculatingUSD?.peggedUSD ?? null;
      const last = val(series.at(-1)), d1 = val(series.at(-2)), d7 = val(series.at(-8));
      out.data.stablecoins = { totalUsd: last, change24h: d1 ? ((last - d1) / d1) * 100 : null, change7d: d7 ? ((last - d7) / d7) * 100 : null, deltaUsd24h: d1 != null ? last - d1 : null };
      out.sources.push({ source_type: 'market', title: 'Stablecoin supply (DefiLlama)', url: 'https://defillama.com/stablecoins', confidence: 0.85, data: out.data.stablecoins });
    }
  } catch (e) { log.warn('trends: stablecoins failed', { e: e.message }); }

  // 4) Top chains by TVL — where on-chain capital sits
  try {
    const chains = await httpGet('https://api.llama.fi/v2/chains', { maxPerMin: 20 });
    out.data.chains = (chains || []).filter((c) => num(c.tvl)).sort((a, b) => b.tvl - a.tvl).slice(0, 5).map((c) => ({ name: c.name, tvl: c.tvl }));
    if (out.data.chains.length) out.sources.push({ source_type: 'market', title: 'Top chains by TVL (DefiLlama)', url: 'https://defillama.com/chains', confidence: 0.8, data: out.data.chains });
  } catch (e) { log.warn('trends: chains failed', { e: e.message }); }

  // 5) Reddit community pulse — what r/CryptoCurrency is actually talking about
  try {
    const j = await httpGet('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=15', { headers: { 'User-Agent': 'ChainQuant-Daily/1.0' }, maxPerMin: 15 });
    const posts = (j?.data?.children || []).map((c) => c.data).filter((p) => p && !p.stickied);
    out.data.reddit = posts.slice(0, 6).map((p) => ({ title: p.title, score: p.score, comments: p.num_comments, url: `https://www.reddit.com${p.permalink}` }));
    if (out.data.reddit.length) out.sources.push({ source_type: 'social', title: 'r/CryptoCurrency community pulse', url: 'https://www.reddit.com/r/CryptoCurrency/hot/', confidence: 0.6, data: out.data.reddit });
  } catch (e) { log.warn('trends: reddit failed', { e: e.message }); }

  return out;
}
