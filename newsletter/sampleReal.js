// Builds a sample from REAL market data captured 2026-07-14 (sources cited in the note).
// Intraday price-line charts (6h/24h) are NOT included here because a real price *path*
// can't be reconstructed from point-in-time figures — those render on live runs from
// CoinGecko market_chart via chartGen.priceChart24h/priceChart6h.
import { readFileSync, writeFileSync } from 'node:fs';
import { writeNewsletter } from './core/aiWriter.js';
import { validateCitations } from './core/citationValidator.js';
import { renderHtml, renderText } from './core/renderEmail.js';

const charts = JSON.parse(readFileSync('out/charts_b64.json', 'utf8'));
const now = new Date().toISOString();

const collected = {
  market: { data: {
    majors: [
      { symbol: 'BTC', name: 'Bitcoin', price: 62474.85, change1h: -0.12, change24h: -1.98, change7d: -2.4, mcap: 1.25e12, vol24h: 3.71e10, high24h: 63780, low24h: 61800 },
      { symbol: 'ETH', name: 'Ethereum', price: 1785.76, change1h: 0.05, change24h: 0.03, change7d: -3.1, mcap: 2.15e11, vol24h: 1.2e10, high24h: 1810, low24h: 1736 },
      { symbol: 'SOL', name: 'Solana', price: 75.12, change1h: -0.30, change24h: -1.91, change7d: -4.6, mcap: 4.1e10, vol24h: 1.58e9, high24h: 77.28, low24h: 74.6 },
    ],
    top: [
      { symbol: 'BTC', price: 62474.85, change24h: -1.98, change7d: -2.4 },
      { symbol: 'ETH', price: 1785.76, change24h: 0.03, change7d: -3.1 },
      { symbol: 'USDT', price: 0.9988, change24h: -0.03, change7d: 0.0 },
      { symbol: 'XRP', price: 1.07, change24h: -0.93, change7d: -2.8 },
      { symbol: 'SOL', price: 75.12, change24h: -1.91, change7d: -4.6 },
      { symbol: 'DOGE', price: 0.0721, change24h: -0.35, change7d: -3.9 },
      { symbol: 'SHIB', price: 0.00000413, change24h: -2.13, change7d: -5.1 },
    ],
    global: { totalMcapUsd: 2.23e12, totalVolUsd: 6.85e10, mcapChange24h: -1.5, btcDominance: 56.2, ethDominance: 9.65, activeCoins: 17563 },
    funding: { BTC: { fundingRate: -0.0043 }, ETH: { fundingRate: -0.0021 }, SOL: { fundingRate: -0.0065 } },
    openInterest: { BTC: { oiUsd: 1.62e10 }, ETH: { oiUsd: 6.4e9 }, SOL: { oiUsd: 1.3e9 } },
    longShort: { ratio: 0.94, longPct: 48.4, shortPct: 51.6 },
    fearGreed: { value: 22, label: 'Extreme Fear', prev: 28 },
    defiTvl: { tvlUsd: 9.2e10, change24h: -1.1, change7d: -3.2 },
    gainers: [{ symbol: 'DOT', name: 'Polkadot', change24h: 3.4 }, { symbol: 'XRP', name: 'XRP Ledger', change24h: 1.2 }],
    losers: [{ symbol: 'PI', name: 'Pi Network', change24h: -14.08 }],
  }, sources: [
    { source_type: 'market', title: 'CoinMarketCap — BTC $62,474.85 (-1.98% 24h), total cap $2.23T', url: 'https://coinmarketcap.com/', published_at: now },
    { source_type: 'market', title: 'Forbes Digital Assets — ETH $1,785.76, SOL $75.12, XRP $1.07', url: 'https://www.forbes.com/digital-assets/crypto-prices/', published_at: now },
    { source_type: 'market', title: 'CoinGecko — BTC dominance 56.6%, ETH 9.75%, 24h volume $60.2B', url: 'https://www.coingecko.com/', published_at: now },
    { source_type: 'market', title: 'Fear & Greed Index: 22 (Extreme Fear), down from 28', url: 'https://alternative.me/crypto/fear-and-greed-index/', published_at: now },
  ] },
  news: { items: [
    { outlet: 'CoinGecko', title: 'US spot Bitcoin ETFs saw roughly $425M in net outflows Monday as geopolitical risk escalated', url: 'https://www.coingecko.com/', published_at: now },
    { outlet: 'CoinGecko', title: 'Korea stock rout deepens; Upbit 24h volume surges 1,426% as KOSPI falls 4%', url: 'https://www.coingecko.com/', published_at: now },
    { outlet: 'CoinGecko', title: "BlackRock's tokenized fund BUIDL tops $900M on Avalanche, doubling in a week", url: 'https://www.coingecko.com/', published_at: now },
    { outlet: 'The Block', title: 'Dormant Bitcoin address moves 2,931 BTC (~$188M) after seven years of inactivity', url: 'https://www.theblock.co/', published_at: now },
    { outlet: 'Cointribune', title: 'CryptoQuant flags elevated exchange inflows; average BTC deposit size doubles from ~1 to ~2 BTC', url: 'https://www.cointribune.com/en/exchange-inflows-hint-at-rising-bitcoin-volatility/', published_at: now },
  ], sources: [
    { source_type: 'news', title: 'Spot BTC ETFs: ~$425M net outflows Monday', url: 'https://www.coingecko.com/' },
    { source_type: 'news', title: 'The Block: 2,931 BTC dormant wallet reactivates (~$188M)', url: 'https://www.theblock.co/' },
    { source_type: 'news', title: 'CryptoQuant: exchange inflow deposit size doubling', url: 'https://www.cointribune.com/en/exchange-inflows-hint-at-rising-bitcoin-volatility/' },
    { source_type: 'news', title: 'BlackRock BUIDL tops $900M on Avalanche', url: 'https://www.coingecko.com/' },
  ] },
  trends: { data: {
    trending: [ { symbol: 'DOT', change24h: 3.4 }, { symbol: 'XRP', change24h: -0.93 }, { symbol: 'PI', change24h: -14.08 }, { symbol: 'BTC', change24h: -1.98 } ],
    sectors: { hot: [
      { name: 'Polkadot Ecosystem', change24h: 3.4 }, { name: 'XRP Ledger Ecosystem', change24h: 1.2 },
      { name: 'Real World Assets (RWA)', change24h: 0.9 }, { name: 'Stablecoins', change24h: 0.0 },
      { name: 'Artificial Intelligence (AI)', change24h: -1.4 }, { name: 'Layer 2 (L2)', change24h: -2.6 },
    ], cold: [{ name: 'Layer 2 (L2)', change24h: -2.6 }] },
    stablecoins: { totalUsd: 5.629e10, change24h: 0.1, change7d: 0.4, deltaUsd24h: 5.6e7 },
    chains: [{ name: 'Ethereum', tvl: 5.0e10 }, { name: 'Solana', tvl: 8.8e9 }, { name: 'Tron', tvl: 8.2e9 }],
    reddit: [],
  }, sources: [
    { source_type: 'market', title: 'CoinGecko — top gainers: Polkadot Ecosystem, XRP Ledger Ecosystem', url: 'https://www.coingecko.com/' },
    { source_type: 'market', title: 'CoinMarketCap — stablecoin volume $56.29B (103% of total market volume)', url: 'https://coinmarketcap.com/' },
  ] },
  // Whale rows are EMPTY on purpose: this sample was built without live API access, and
  // the pipeline's hard rule is that no movement ships without a verifiable tx hash.
  // Live runs populate this from Blockchair + ClankApp with real explorer links.
  whales: { items: [], sources: [] },
  narratives: { items: [
    { narrative: 'Polkadot Ecosystem', momentum: 46, change24h: 3.4, evidence: [{ type: 'sector', label: 'Top gaining sector on the day (CoinGecko)', url: 'https://www.coingecko.com/en/categories' }] },
    { narrative: 'XRP Ledger Ecosystem', momentum: 41, change24h: 1.2, evidence: [{ type: 'sector', label: 'Second-best sector move (CoinGecko)', url: 'https://www.coingecko.com/en/categories' }] },
    { narrative: 'RWA / Tokenization', momentum: 33, change24h: 0.9, evidence: [{ type: 'news', label: "BlackRock's BUIDL tops $900M on Avalanche, doubling in a week", url: 'https://www.coingecko.com/' }] },
    { narrative: 'Stablecoins', momentum: 24, change24h: 0.0, evidence: [{ type: 'market', label: 'Stablecoin volume $56.29B = 103% of total market volume', url: 'https://coinmarketcap.com/' }] },
    { narrative: 'ETF flows', momentum: 18, change24h: null, evidence: [{ type: 'news', label: 'US spot BTC ETFs: ~$425M net outflows Monday', url: 'https://www.coingecko.com/' }] },
  ], sources: [ { source_type: 'social', title: 'Narrative momentum board (evidence-weighted)', url: 'https://www.coingecko.com/en/categories' } ] },
};
collected.allSources = [ ...collected.market.sources, ...collected.news.sources, ...collected.trends.sources, ...collected.narratives.sources ];

const nl = await writeNewsletter(collected);
const { newsletter: clean } = validateCitations(nl, collected);
let html = renderHtml(clean, { baseUrl: 'https://chainquant.net' });
const text = renderText(clean);

// Swap the chart <img> URLs for the locally-generated base64 PNGs so the charts are
// visible in this offline sample. (Production emails use hosted PNG URLs — see chartGen.js.)
html = html.replace(/<img src="https:\/\/quickchart\.io[^"]*" alt="24h change"/, `<img src="${charts.change24h}" alt="24h change"`);
html = html.replace(/<img src="https:\/\/quickchart\.io[^"]*" alt="narrative momentum"/, `<img src="${charts.narratives}" alt="narrative momentum"`);

writeFileSync('out/sample.html', html);
writeFileSync('out/sample.txt', text);
console.log('subject :', clean.subject);
console.log('narratives:', clean.narratives.length, '| sources:', clean.sources.length, '| whales:', clean.whales.length);
console.log('→ out/sample.html');
