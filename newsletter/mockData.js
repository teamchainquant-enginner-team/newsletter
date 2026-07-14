// Illustrative data ONLY — offline rendering/preview. Not sent to clients.
// Values approximate real levels (Jun 2026) so the sample looks credible; live
// runs replace all of this with real API data.
export const mockCollected = {
  market: { data: {
    majors: [
      { symbol: 'BTC', name: 'Bitcoin', price: 64412, change1h: 0.08, change24h: 0.42, change7d: -2.1, mcap: 1.27e12, vol24h: 2.8e10 },
      { symbol: 'ETH', name: 'Ethereum', price: 1741, change1h: 0.15, change24h: 0.61, change7d: -4.3, mcap: 2.1e11, vol24h: 1.4e10 },
      { symbol: 'SOL', name: 'Solana', price: 73.5, change1h: -0.22, change24h: -1.04, change7d: -6.8, mcap: 4.0e10, vol24h: 2.2e9 },
    ],
    top: [
      { symbol: 'BTC', price: 64412, change24h: 0.42, change7d: -2.1 },
      { symbol: 'ETH', price: 1741, change24h: 0.61, change7d: -4.3 },
      { symbol: 'USDT', price: 1.0, change24h: -0.02, change7d: 0.0 },
      { symbol: 'BNB', price: 595, change24h: 0.83, change7d: 1.2 },
      { symbol: 'SOL', price: 73.5, change24h: -1.04, change7d: -6.8 },
      { symbol: 'XRP', price: 1.14, change24h: -0.36, change7d: -3.1 },
      { symbol: 'DOGE', price: 0.083, change24h: -0.31, change7d: -5.2 },
      { symbol: 'TRX', price: 0.33, change24h: 1.53, change7d: 2.4 },
      { symbol: 'HYPE', price: 69.07, change24h: 1.14, change7d: 8.9 },
      { symbol: 'ADA', price: 0.41, change24h: -0.9, change7d: -4.0 },
    ],
    global: { totalMcapUsd: 2.21e12, totalVolUsd: 8.6e10, mcapChange24h: 0.38, btcDominance: 58.5, ethDominance: 9.6, activeCoins: 17200 },
    funding: { BTC: { fundingRate: 0.0061, markPrice: 64420 }, ETH: { fundingRate: 0.0090, markPrice: 1742 }, SOL: { fundingRate: -0.0042, markPrice: 73.4 } },
    openInterest: { BTC: { oiUsd: 1.84e10 }, ETH: { oiUsd: 7.2e9 }, SOL: { oiUsd: 1.6e9 } },
    longShort: { ratio: 1.12, longPct: 52.8, shortPct: 47.2 },
    liquidations: { BTC: { long24h: 4.2e7, short24h: 1.9e7 }, ETH: { long24h: 2.1e7, short24h: 1.1e7 }, SOL: { long24h: 9e6, short24h: 6e6 } },
    fearGreed: { value: 46, label: 'Neutral', prev: 51 },
    defiTvl: { tvlUsd: 9.45e10, change24h: 0.6, change7d: -2.8 },
    gainers: [{ symbol: 'HYPE', name: 'Hyperliquid', change24h: 1.14 }, { symbol: 'TRX', name: 'TRON', change24h: 1.53 }],
    losers: [{ symbol: 'SOL', name: 'Solana', change24h: -1.04 }],
  }, sources: [
    { source_type: 'market', title: 'Majors — price & 1h/24h/7d change (BTC/ETH/SOL)', url: 'https://www.coingecko.com/' },
    { source_type: 'market', title: 'Fear & Greed Index: 46 (Neutral)', url: 'https://alternative.me/crypto/fear-and-greed-index/' },
    { source_type: 'market', title: 'Perp funding rates (Binance USD\u24c8-M)', url: 'https://www.binance.com/en/futures/funding-history/perpetual/real-time-funding-rate' },
  ] },
  news: { items: [
    { outlet: 'CoinDesk', title: 'ETF flows favor ETH and SOL as bitcoin sees Grayscale-led outflows', url: 'https://www.coindesk.com/', published_at: new Date().toISOString() },
    { outlet: 'The Block', title: 'MoneyGram joins Solana as validator amid stablecoin payment push', url: 'https://www.theblock.co/', published_at: new Date().toISOString() },
  ], sources: [
    { source_type: 'news', title: 'CoinDesk: ETF flows favor ETH and SOL', url: 'https://www.coindesk.com/' },
    { source_type: 'news', title: 'The Block: MoneyGram joins Solana as validator', url: 'https://www.theblock.co/' },
  ] },
  whales: { items: [
    { chain: 'ethereum', asset: 'ETH', amount: 8600, usd: 15_000_000, entity: 'Binance', from: '0xab...', to: '0xbinance', txHash: '0xdef456abc7890123def456abc7890123def456abc7890123def456abc7890123', txUrl: 'https://etherscan.io/tx/0xdef456abc7890123def456abc7890123def456abc7890123def456abc7890123', ts: new Date().toISOString(), interpretation: 'Inflow to Binance — possible sell-side pressure.' },
    { chain: 'bitcoin', asset: 'BTC', amount: 180, usd: 11_600_000, entity: 'unknown wallet', txHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', txUrl: 'https://blockchair.com/bitcoin/transaction/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', ts: new Date().toISOString(), interpretation: 'Wallet-to-wallet transfer; counterparties unlabeled.' },
    { chain: 'ethereum', asset: 'USDC', amount: 25_000_000, usd: 25_000_000, entity: 'Coinbase', from: '0xcoinbase', to: '0xcd...', txHash: '0x789abc123def456789abc123def456789abc123def456789abc123def4567890', txUrl: 'https://etherscan.io/tx/0x789abc123def456789abc123def456789abc123def456789abc123def4567890', ts: new Date().toISOString(), interpretation: 'Outflow from Coinbase — withdrawal to private/custody wallet.' },
  ], sources: [
    { source_type: 'whale', title: 'USDC $25,000,000 — ethereum', url: 'https://etherscan.io/tx/0x789abc123def456789abc123def456789abc123def456789abc123def4567890' },
  ] },
  narratives: { items: [
    { narrative: 'ETF flows', momentum: 42, evidence: [{ type: 'news', label: 'CoinDesk: ETF flows favor ETH and SOL', url: 'https://www.coindesk.com/' }] },
    { narrative: 'Solana ecosystem', momentum: 31, evidence: [{ type: 'news', label: 'The Block: MoneyGram validator on Solana', url: 'https://www.theblock.co/' }, { type: 'market', label: 'HYPE +8.9% 7d', url: 'https://www.coingecko.com/' }] },
    { narrative: 'Stablecoins', momentum: 19, evidence: [{ type: 'whale', label: '$25M USDC exchange outflow', url: 'https://etherscan.io/' }] },
  ], sources: [{ source_type: 'social', title: 'Narrative: ETF flows (momentum 42)', url: 'https://www.coindesk.com/' }] },
  trends: { data: {
    trending: [
      { name: 'Hyperliquid', symbol: 'HYPE', rank: 18, change24h: 1.14 },
      { name: 'Bonk', symbol: 'BONK', rank: 62, change24h: 7.8 },
      { name: 'Jupiter', symbol: 'JUP', rank: 55, change24h: 3.2 },
      { name: 'Pyth Network', symbol: 'PYTH', rank: 78, change24h: -4.6 },
      { name: 'Ondo', symbol: 'ONDO', rank: 40, change24h: 5.1 },
    ],
    sectors: {
      hot: [
        { name: 'Real World Assets (RWA)', change24h: 4.8, mcap: 2.1e10 },
        { name: 'Solana Ecosystem', change24h: 3.1, mcap: 9.8e10 },
        { name: 'Artificial Intelligence (AI)', change24h: 2.4, mcap: 2.6e10 },
        { name: 'Meme', change24h: 1.9, mcap: 5.4e10 },
        { name: 'DePIN', change24h: 1.2, mcap: 8.0e9 },
        { name: 'Liquid Staking', change24h: 0.6, mcap: 4.0e10 },
      ],
      cold: [
        { name: 'Gaming (GameFi)', change24h: -3.4, mcap: 1.2e10 },
        { name: 'Layer 2 (L2)', change24h: -2.1, mcap: 2.8e10 },
      ],
    },
    stablecoins: { totalUsd: 1.71e11, change24h: 0.21, change7d: 0.9, deltaUsd24h: 3.6e8 },
    chains: [ { name: 'Ethereum', tvl: 5.2e10 }, { name: 'Solana', tvl: 9.1e9 }, { name: 'Tron', tvl: 8.4e9 }, { name: 'BSC', tvl: 5.9e9 }, { name: 'Base', tvl: 3.8e9 } ],
    reddit: [
      { title: 'Daily Crypto Discussion - what are you watching today?', score: 412, comments: 1200, url: 'https://www.reddit.com/r/CryptoCurrency/' },
      { title: 'ETF outflows continue for a sixth straight week - what does it mean?', score: 980, comments: 540, url: 'https://www.reddit.com/r/CryptoCurrency/' },
      { title: 'Solana validator count hits new high', score: 624, comments: 210, url: 'https://www.reddit.com/r/CryptoCurrency/' },
    ],
  }, sources: [
    { source_type: 'social', title: 'Trending searches: HYPE, BONK, JUP, PYTH', url: 'https://www.coingecko.com/en/highlights/trending-crypto' },
    { source_type: 'market', title: 'Sector performance by market cap (24h)', url: 'https://www.coingecko.com/en/categories' },
    { source_type: 'market', title: 'Stablecoin supply (DefiLlama)', url: 'https://defillama.com/stablecoins' },
    { source_type: 'social', title: 'r/CryptoCurrency community pulse', url: 'https://www.reddit.com/r/CryptoCurrency/hot/' },
  ] },
};
mockCollected.allSources = [
  ...mockCollected.market.sources, ...mockCollected.news.sources,
  ...mockCollected.trends.sources, ...mockCollected.whales.sources, ...mockCollected.narratives.sources,
];
