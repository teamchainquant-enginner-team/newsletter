// Live verification — run in YOUR environment (where outbound network works):
//   node checkLive.js
// Hits the free APIs the pipeline uses and prints real values so you can
// confirm prices and whale data are accurate before trusting a send.
import { collectMarket } from './collectors/marketCollector.js';
import { collectWhales } from './collectors/whaleCollector.js';

const f = (v, d = 2) => (v == null ? 'n/a' : Number(v).toFixed(d));

const run = async () => {
  console.log('\n=== CoinGecko (free) — real-time prices ===');
  const m = await collectMarket();
  for (const x of m.data.majors || []) console.log(`  ${x.symbol.padEnd(4)} $${f(x.price)}  24h ${f(x.change24h)}%  7d ${f(x.change7d)}%`);
  if (m.data.global) console.log(`  BTC dom ${f(m.data.global.btcDominance, 1)}%  total mcap $${(m.data.global.totalMcapUsd / 1e12).toFixed(2)}T`);
  if (m.data.fearGreed) console.log(`  Fear & Greed ${m.data.fearGreed.value} (${m.data.fearGreed.label})`);
  if (m.data.funding) console.log(`  Funding BTC ${f(m.data.funding.BTC?.fundingRate, 4)}%  ETH ${f(m.data.funding.ETH?.fundingRate, 4)}%`);
  console.log(`  market sources: ${m.sources.length}`);

  console.log('\n=== Whales (free: Blockchair + ClankApp) — past 24h ===');
  const w = await collectWhales();
  if (!w.items.length) console.log('  (none ≥ $1M with a verifiable tx right now)');
  for (const x of w.items.slice(0, 6)) console.log(`  [${x.chain}] ${x.asset} $${Math.round(x.usd).toLocaleString()}  ${x.txUrl}`);

  console.log('\nIf prices match a public source (CoinGecko/CoinMarketCap), live data is wired correctly.\n');
};
run().catch((e) => { console.error('checkLive failed:', e.message); process.exit(1); });
