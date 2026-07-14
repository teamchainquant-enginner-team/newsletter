import { httpGet } from '../lib/http.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

// Keyless public API works (low rate limit). A FREE Demo key (no credit card)
// raises it to a stable 30/min and is sent via the x-cg-demo-api-key header.
const CG_BASE = 'https://api.coingecko.com/api/v3';
const cgHeaders = config.data.coingecko ? { 'x-cg-demo-api-key': config.data.coingecko } : {};
const CG_OPTS = { headers: cgHeaders, maxPerMin: config.data.coingecko ? 28 : 8 };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Deep market snapshot. Returns { data, sources }.
 * Pulls multi-timeframe majors, a top-coins table, global dominance/volume,
 * sentiment, DeFi TVL, and perp funding so the writer has real material.
 */
export async function collectMarket() {
  const out = { data: {}, sources: [] };

  // 1) Majors with 1h / 24h / 7d
  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&price_change_percentage=1h,24h,7d`;
    const rows = await httpGet(url, CG_OPTS);
    out.data.majors = (rows || []).map((r) => ({
      symbol: r.symbol?.toUpperCase(), name: r.name, price: num(r.current_price),
      change1h: num(r.price_change_percentage_1h_in_currency),
      change24h: num(r.price_change_percentage_24h_in_currency ?? r.price_change_percentage_24h),
      change7d: num(r.price_change_percentage_7d_in_currency),
      mcap: num(r.market_cap), vol24h: num(r.total_volume),
      high24h: num(r.high_24h), low24h: num(r.low_24h),
    }));
    out.sources.push({ source_type: 'market', title: 'Majors — price & 1h/24h/7d change (BTC/ETH/SOL)', url: 'https://www.coingecko.com/', confidence: 0.95, data: { majors: out.data.majors }, published_at: new Date().toISOString() });
  } catch (e) { log.warn('market: majors failed', { e: e.message }); }

  // 2) Top coins table + movers (24h & 7d)
  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h,7d`;
    const rows = await httpGet(url, CG_OPTS);
    const pick = (r) => ({ symbol: r.symbol?.toUpperCase(), name: r.name, price: num(r.current_price), change24h: num(r.price_change_percentage_24h_in_currency ?? r.price_change_percentage_24h), change7d: num(r.price_change_percentage_7d_in_currency), vol24h: num(r.total_volume), mcap: num(r.market_cap) });
    const all = (rows || []).map(pick);
    out.data.top = all.slice(0, 10);
    const movable = all.filter((r) => r.change24h != null);
    out.data.gainers = [...movable].sort((a, b) => b.change24h - a.change24h).slice(0, 5);
    out.data.losers = [...movable].sort((a, b) => a.change24h - b.change24h).slice(0, 5);
    out.sources.push({ source_type: 'market', title: 'Top-50 markets, 24h/7d movers', url: 'https://www.coingecko.com/', confidence: 0.9, data: { gainers: out.data.gainers, losers: out.data.losers } });
  } catch (e) { log.warn('market: top/movers failed', { e: e.message }); }

  // 3) Global: total mcap, total volume, dominance
  try {
    const g = (await httpGet(`${CG_BASE}/global`, CG_OPTS))?.data;
    if (g) {
      out.data.global = {
        totalMcapUsd: num(g.total_market_cap?.usd), totalVolUsd: num(g.total_volume?.usd),
        mcapChange24h: num(g.market_cap_change_percentage_24h_usd),
        btcDominance: num(g.market_cap_percentage?.btc), ethDominance: num(g.market_cap_percentage?.eth),
        activeCoins: g.active_cryptocurrencies,
      };
      out.sources.push({ source_type: 'market', title: 'Global market cap, volume & dominance', url: 'https://www.coingecko.com/en/global-charts', confidence: 0.9, data: out.data.global });
    }
  } catch (e) { log.warn('market: global failed', { e: e.message }); }

  // 4) Fear & Greed (alternative.me, free + keyless)
  try {
    const fng = await httpGet('https://api.alternative.me/fng/?limit=2');
    const v = fng?.data?.[0], prev = fng?.data?.[1];
    if (v) {
      out.data.fearGreed = { value: Number(v.value), label: v.value_classification, prev: prev ? Number(prev.value) : null };
      out.sources.push({ source_type: 'market', title: `Fear & Greed Index: ${v.value} (${v.value_classification})`, url: 'https://alternative.me/crypto/fear-and-greed-index/', confidence: 0.85, data: out.data.fearGreed });
    }
  } catch (e) { log.warn('market: fng failed', { e: e.message }); }

  // 5) DeFi TVL trend (DefiLlama, free)
  try {
    const series = await httpGet('https://api.llama.fi/v2/historicalChainTvl');
    if (Array.isArray(series) && series.length > 7) {
      const last = series.at(-1), d1 = series.at(-2), d7 = series.at(-8);
      out.data.defiTvl = { tvlUsd: last.tvl, change24h: d1?.tvl ? ((last.tvl - d1.tvl) / d1.tvl) * 100 : null, change7d: d7?.tvl ? ((last.tvl - d7.tvl) / d7.tvl) * 100 : null };
      out.sources.push({ source_type: 'market', title: 'Total DeFi TVL (DefiLlama)', url: 'https://defillama.com/', confidence: 0.85, data: out.data.defiTvl });
    }
  } catch (e) { log.warn('market: defillama failed', { e: e.message }); }

  // 6) Perp funding (Binance USDⓈ-M, free + keyless) — sentiment/positioning read
  try {
    const syms = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' };
    const funding = {};
    for (const [k, sym] of Object.entries(syms)) {
      try {
        const p = await httpGet(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, { maxPerMin: 20 });
        funding[k] = { fundingRate: num(parseFloat(p.lastFundingRate)) != null ? parseFloat(p.lastFundingRate) * 100 : null, markPrice: num(parseFloat(p.markPrice)) };
      } catch { /* per-symbol skip */ }
    }
    if (Object.keys(funding).length) {
      out.data.funding = funding;
      out.sources.push({ source_type: 'market', title: 'Perp funding rates (Binance USDⓈ-M)', url: 'https://www.binance.com/en/futures/funding-history/perpetual/real-time-funding-rate', confidence: 0.8, data: funding });
    }
  } catch (e) { log.warn('market: funding failed', { e: e.message }); }

  // 7) Derivatives positioning: open interest + long/short ratio (Binance, keyless)
  try {
    const oi = {};
    for (const [k, sym] of Object.entries({ BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' })) {
      try {
        const [o, p] = await Promise.all([
          httpGet(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`, { maxPerMin: 20 }),
          httpGet(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, { maxPerMin: 20 }),
        ]);
        const contracts = parseFloat(o.openInterest), mark = parseFloat(p.markPrice);
        oi[k] = { oiUsd: Number.isFinite(contracts) && Number.isFinite(mark) ? contracts * mark : null };
      } catch { /* skip symbol */ }
    }
    try {
      const ls = await httpGet('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1', { maxPerMin: 20 });
      const r = ls?.[0];
      if (r) out.data.longShort = { ratio: num(parseFloat(r.longShortRatio)), longPct: num(parseFloat(r.longAccount) * 100), shortPct: num(parseFloat(r.shortAccount) * 100) };
    } catch { /* skip */ }
    if (Object.keys(oi).length) out.data.openInterest = oi;
    if (out.data.openInterest || out.data.longShort) out.sources.push({ source_type: 'market', title: 'Derivatives: open interest & long/short ratio (Binance)', url: 'https://www.binance.com/en/futures/funding-history/perpetual/open-interest', confidence: 0.8, data: { oi: out.data.openInterest, longShort: out.data.longShort } });
  } catch (e) { log.warn('market: derivatives failed', { e: e.message }); }

  // 8) Liquidations (optional — needs a CoinGlass key; skipped gracefully if absent)
  if (config.data.coinglass) {
    try {
      const j = await httpGet('https://open-api-v4.coinglass.com/api/futures/liquidation/coin-list?ex=Binance', { headers: { 'CG-API-KEY': config.data.coinglass }, maxPerMin: 10 });
      const rows = j?.data || [];
      const find = (s) => rows.find((r) => (r.symbol || '').toUpperCase() === s);
      out.data.liquidations = ['BTC', 'ETH', 'SOL'].reduce((a, s) => { const r = find(s); if (r) a[s] = { long24h: num(r.longLiquidationUsd24h), short24h: num(r.shortLiquidationUsd24h) }; return a; }, {});
      out.sources.push({ source_type: 'market', title: '24h liquidations (CoinGlass)', url: 'https://www.coinglass.com/LiquidationData', confidence: 0.8, data: out.data.liquidations });
    } catch (e) { log.warn('market: liquidations failed', { e: e.message }); }
  }

  // 9) Price history for 6h / 24h charts (CoinGecko market_chart)
  try {
    const hist = {};
    const map = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
    for (const [id, sym] of Object.entries(map)) {
      try {
        // days=1 gives ~5-minute granularity — enough for both the 24h and 6h views
        const j = await httpGet(`${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1`, CG_OPTS);
        const pts = (j?.prices || []).map(([t, p]) => ({ t, p })).filter((x) => Number.isFinite(x.p));
        if (pts.length) {
          const cut6 = Date.now() - 6 * 3600 * 1000;
          hist[sym] = { h24: pts, h6: pts.filter((x) => x.t >= cut6) };
        }
      } catch { /* per-coin skip */ }
    }
    if (Object.keys(hist).length) {
      out.data.history = hist;
      out.sources.push({ source_type: 'chart', title: 'BTC/ETH/SOL 6h & 24h price history', url: 'https://www.coingecko.com/', confidence: 0.9, data: { series: Object.keys(hist) } });
    }
  } catch (e) { log.warn('market: history failed', { e: e.message }); }

  return out;
}
