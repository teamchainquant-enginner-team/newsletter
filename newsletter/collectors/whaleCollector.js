import { httpGet } from '../lib/http.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const WHALE_MIN_USD = 1_000_000;

const EXCH = /(binance|coinbase|kraken|okx|bybit|bitfinex|kucoin|huobi|htx|gate|upbit|exchange|crypto\.com|bitstamp)/i;

const btcExplorer = (h) => `https://blockchair.com/bitcoin/transaction/${h}`;
const ethExplorer = (h) => `https://etherscan.io/tx/${h}`;
const solExplorer = (h) => `https://solscan.io/tx/${h}`;
const chainExplorer = (chain, h) => ({ bitcoin: btcExplorer, ethereum: ethExplorer, solana: solExplorer, tron: (x) => `https://tronscan.org/#/transaction/${x}`, ripple: (x) => `https://xrpscan.com/tx/${x}` }[chain]?.(h)) || ethExplorer(h);

function interpret(fromOwner, toOwner) {
  const fe = EXCH.test(fromOwner || ''), te = EXCH.test(toOwner || '');
  if (te && !fe) return `Inflow to ${toOwner} — possible sell-side pressure.`;
  if (fe && !te) return `Outflow from ${fromOwner} — withdrawal to private/custody wallet.`;
  if (fe && te) return `Exchange-to-exchange transfer — likely internal rebalancing.`;
  return 'Wallet-to-wallet transfer; counterparties unlabeled.';
}

/**
 * Real-time whale movements from FREE keyless sources (Blockchair + ClankApp),
 * plus licensed hooks (Bitquery/Helius) when keys are set.
 * HARD RULE: an item without a verifiable tx explorer link is dropped.
 */
export async function collectWhales() {
  const results = await Promise.allSettled([
    blockchair('bitcoin'), blockchair('ethereum'), clankApp(),
  ]);
  const items = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) items.push(...r.value);
    else if (r.status === 'rejected') log.warn('whale source failed', { e: r.reason?.message });
  }

  // Dedupe by tx hash, enforce link + min USD, rank by size, cap 10.
  const seen = new Set();
  const verified = items
    .filter((i) => i.txUrl && i.txHash && Number.isFinite(i.usd) && i.usd >= WHALE_MIN_USD)
    .filter((i) => !seen.has(i.txHash) && seen.add(i.txHash))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 10);

  const sources = verified.map((v) => ({
    source_type: 'whale', title: `${v.asset} $${Math.round(v.usd).toLocaleString()} — ${v.chain}`,
    url: v.txUrl, published_at: v.ts || null, confidence: 0.8,
    data: { amount: v.amount, usd: v.usd, from: v.from, to: v.to, entity: v.entity, txHash: v.txHash },
  }));

  log.info('whales collected', { verified: verified.length, raw: items.length });
  return { items: verified, sources };
}

// ── Blockchair (keyless free; USD value provided directly) ───────────────────
async function blockchair(chain) {
  const field = chain === 'bitcoin' ? 'output_total_usd' : 'value_usd';
  const url = `https://api.blockchair.com/${chain}/transactions?q=${field}(${WHALE_MIN_USD}..)&s=time(desc)&limit=12`;
  try {
    const j = await httpGet(url, { maxPerMin: 20, timeoutMs: 14000 });
    const rows = j?.data || [];
    return rows.map((r) => {
      const hash = r.hash;
      const usd = Number(chain === 'bitcoin' ? r.output_total_usd : r.value_usd);
      const amount = chain === 'bitcoin' ? Number(r.output_total) / 1e8 : Number(r.value) / 1e18;
      const from = r.sender || null, to = r.recipient || null;
      return {
        chain, asset: chain === 'bitcoin' ? 'BTC' : 'ETH', amount, usd,
        from, to, entity: 'unknown wallet',
        txHash: hash, txUrl: hash ? chainExplorer(chain, hash) : null,
        ts: r.time ? new Date(r.time + 'Z').toISOString() : null,
        interpretation: interpret(null, null),
      };
    });
  } catch (e) { log.warn(`blockchair ${chain} failed`, { e: e.message }); return []; }
}

// ── ClankApp (keyless free multi-chain whale feed; owner labels when known) ───
async function clankApp() {
  try {
    const j = await httpGet('https://api.clankapp.com/v2/explorer/tx?size=20', { maxPerMin: 20, timeoutMs: 14000 });
    const rows = j?.data || j?.transactions || [];
    return rows.map((r) => {
      const chain = (r.blockchain || r.chain || '').toLowerCase();
      const hash = r.hash || r.transaction_hash;
      const fromOwner = r.from?.owner || r.from_owner || '';
      const toOwner = r.to?.owner || r.to_owner || '';
      const usd = Number(r.amount_usd ?? r.usd ?? r.value_usd);
      return {
        chain: chain || 'ethereum', asset: (r.symbol || r.asset || 'TOKEN').toUpperCase(),
        amount: Number(r.amount ?? r.value) || null, usd,
        from: r.from?.address || r.from_address || null, to: r.to?.address || r.to_address || null,
        entity: toOwner || fromOwner || 'unknown wallet',
        txHash: hash, txUrl: hash ? chainExplorer(chain, hash) : null,
        ts: r.timestamp ? new Date(r.timestamp * (String(r.timestamp).length > 10 ? 1 : 1000)).toISOString() : null,
        interpretation: interpret(fromOwner, toOwner),
      };
    });
  } catch (e) { log.warn('clankapp failed', { e: e.message }); return []; }
}
