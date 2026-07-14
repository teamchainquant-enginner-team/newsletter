# ChainQuant Daily — Newsletter Pipeline

AI newsletter agent: **collect → validate → write → render → preview → send**, daily at **07:00 UTC**.
Self-contained service that talks straight to Supabase + Resend. Runs as its own process, or mount its router into your existing Express app.

## What was added

**Supabase (already applied to project `segccrrecdhzfwgptqsi`):** four additive tables — `newsletter_runs`, `newsletter_sources`, `newsletter_subscribers`, `newsletter_events`. RLS on, service-role-only. No existing tables touched.

**Code (`newsletter/`):**
```
config.js            env load + validation
recipients.js        Pro users ∪ digest buyers; materializes Pro into subscribers
pipeline.js          orchestrator
sendNewsletter.js    Resend delivery, per-recipient unsubscribe, dup-guard
scheduler.js         node-cron @ 07:00 UTC
adminRoutes.js       preview / approve / send / test + public unsubscribe
server.js            standalone entry (or mount the router)
lib/                 supabase client, logger, http (retry+rate-limit)
collectors/          market, whale, news, narrative
core/                aiWriter, citationValidator, chartGen, renderEmail
testNewsletter.js    offline sample generator (no DB/network/send)
```

## Data sources (all free + keyless unless noted, real-time)
- **Prices / markets:** CoinGecko — majors with 1h/24h/7d, top-10 table, dominance, total mcap/volume (keyless, or a free Demo key for 30/min).
- **Derivatives:** Binance USDⓈ-M perps — funding, open interest, long/short ratio (keyless).
- **Liquidations:** CoinGlass (optional — set `COINGLASS_API_KEY`; skipped if absent).
- **Sentiment:** alternative.me Fear & Greed.
- **DeFi:** DefiLlama — total TVL + top chains.
- **Sector rotation:** CoinGecko categories — real 24h market-cap change per theme (AI, RWA, memes, DePIN, Solana…). This drives the narratives.
- **Trending / social pulse:** CoinGecko trending searches + r/CryptoCurrency hot — what retail is actually watching and discussing.
- **Stablecoin supply ("dry powder"):** DefiLlama stablecoins — mint/burn as a liquidity read.
- **Whale movements:** Blockchair (BTC+ETH, USD-valued) + ClankApp (multi-chain, exchange-owner labels). Every whale row keeps a real explorer link or it's dropped.
- **News:** RSS — CoinDesk, The Block, Decrypt, DL News, Cointelegraph.
- Optional licensed upgrades: Moralis, Helius, Bitquery, Vybe, TwitterAPI.io. No Nansen/Dune/Arkham/Debank.

Every issue always renders the promised sections: **Executive Summary, Overnight Market Summary, Flows & Positioning, Top Whale Movements (Past 24H), Trending Narratives, Watchlist for Today, Sources, Disclaimer.** The writer is instructed to translate jargon into plain English (defining funding, open interest, dominance, "dry powder," etc.) while staying quantitative.

## Verify the live data (run in YOUR environment)
```bash
node checkLive.js
```
Prints real BTC/ETH/SOL prices, dominance, funding, and a few real whale txs so you can confirm accuracy against any public source before trusting a send. (Won't run from a no-egress sandbox — run it where outbound network is allowed.)

## Recipients
Pro users (`subscriptions.tier='pro'` active **or** `profiles.license='pro'`) **plus** anyone with an active row in `newsletter_subscribers` (your $4.99 digest buyers / email signups). Before each send, Pro users are inserted into `newsletter_subscribers` (insert-if-absent, so a prior unsubscribe is respected), giving everyone a working unsubscribe link.

> Wire your digest-subscribe box / Stripe webhook to `insert into newsletter_subscribers (user_id,email)`. That's the only integration point you own.

## Environment
Copy `.env.example` → `.env`. Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEWSLETTER_ADMIN_TOKEN`. Recommended: `AI_PROVIDER_API_KEY` (Anthropic), and the licensed data keys `MORALIS_API_KEY`, `HELIUS_API_KEY`, `BITQUERY_API_KEY`, `VYBE_API_KEY`, `TWITTERAPI_IO_KEY`. Missing data/AI keys degrade gracefully (sections show "data limited"; AI falls back to a templated draft). `NEWSLETTER_PREVIEW_MODE=true` keeps sends manual.

## Run locally
```bash
cd newsletter && npm install
cp .env.example .env   # fill in keys
npm start              # server on :3002 + scheduler in-process
```

## Test preview (no keys needed)
```bash
npm run test:sample    # writes out/sample.html — open in a browser
```

## Generate a real draft now, then preview in the browser
```bash
curl -X POST localhost:3002/api/newsletter/run -H "x-admin-token: $NEWSLETTER_ADMIN_TOKEN"
# then open:
open "localhost:3002/api/newsletter/preview"   # add the x-admin-token header via a REST client
```

## Approve & send (manual, while preview mode is on)
```bash
curl -X POST localhost:3002/api/newsletter/approve/<RUN_ID> -H "x-admin-token: $TOKEN"
curl -X POST localhost:3002/api/newsletter/send/<RUN_ID>    -H "x-admin-token: $TOKEN"
# single test email:
curl -X POST localhost:3002/api/newsletter/test -H "x-admin-token: $TOKEN" \
     -H "content-type: application/json" -d '{"email":"you@chainquant.net"}'
```

## Trigger the full daily run manually
```bash
npm run run:once       # collect → write → draft (sends only if preview mode is off)
```

## Deploy the daily cron (07:00 UTC)
- **Same box as your API:** mount the router + call `startScheduler()` in your main server (see comment in `server.js`), keep one process always-on.
- **Separate worker:** run `node scheduler.js` under pm2/systemd, or a host scheduler (Railway/Render cron, or a system crontab calling `npm run run:once`). Time is interpreted in UTC via `NEWSLETTER_TIMEZONE`.

With `NEWSLETTER_PREVIEW_MODE=true` the cron builds the draft and waits; flip to `false` for fully automatic 07:00 UTC sends.

## Safeguards built in
One sent newsletter per date (DB-enforced); whale items without a real tx link are dropped; AI writes prose only — numbers and links stay authoritative from the collectors; no Nansen/Dune/Arkham/Debank; per-step logging; retries + per-host rate limits; graceful fallbacks; disclaimer + unsubscribe on every email.

## Nothing existing was changed
Only additive DB tables and a new `newsletter/` folder. Your frontend, existing routes, and other tables are untouched.
