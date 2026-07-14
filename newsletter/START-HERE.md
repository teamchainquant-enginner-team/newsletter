# ChainQuant Daily Intelligence — START HERE

An AI newsletter agent: **collect → validate → write → render → preview → send**, every day at **07:00 UTC**.
Sends to your **Pro users + digest subscribers**. Reads live market, derivatives, on-chain, sector, and social data, then writes a plain-English research note with citations.

---

## 0. See it first (30 seconds, no keys, no setup)
Open **`out/sample.html`** in your browser. That's a real newsletter built from live July 14, 2026 market data.

---

## 1. Install
```bash
cd newsletter
npm install
cp .env.example .env
```

## 2. Fill in `.env`
**Required to send:**
| Key | Where to get it |
|---|---|
| `SUPABASE_URL` | already set to your project |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret!) |
| `RESEND_API_KEY` | Resend → API Keys |
| `NEWSLETTER_ADMIN_TOKEN` | make one up: `openssl rand -hex 32` |

**Strongly recommended:**
| Key | Why |
|---|---|
| `AI_PROVIDER_API_KEY` | Without it the writer falls back to a templated draft. With it, the prose is sharp. |
| `COINGECKO_API_KEY` | Free "Demo" key (no card) → stable 30 req/min instead of a low keyless limit. |

Everything else is optional — the pipeline degrades gracefully when a key is absent.

**In Resend: verify your domain (`chainquant.net`) and add the DKIM/SPF DNS records.** Sends will fail until you do. This is also what keeps you out of spam.

## 3. Verify the live data is real
```bash
npm run check:live
```
Prints real BTC/ETH/SOL prices, dominance, funding, and real whale transactions with explorer links. Cross-check a price against CoinGecko — if it matches, your data layer is wired.

## 4. Build a draft and preview it
```bash
npm start                      # server on :3002 + the 07:00 UTC scheduler

# in another terminal — build today's newsletter:
curl -X POST localhost:3002/api/newsletter/run -H "x-admin-token: $NEWSLETTER_ADMIN_TOKEN"
```
Then preview in a browser (send the `x-admin-token` header via a REST client like Postman/Insomnia):
```
GET localhost:3002/api/newsletter/preview
```

## 5. Send yourself a test
```bash
curl -X POST localhost:3002/api/newsletter/test \
  -H "x-admin-token: $NEWSLETTER_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"email":"you@chainquant.net"}'
```

## 6. Approve & send for real
```bash
curl -X POST localhost:3002/api/newsletter/approve/<RUN_ID> -H "x-admin-token: $TOKEN"
curl -X POST localhost:3002/api/newsletter/send/<RUN_ID>    -H "x-admin-token: $TOKEN"
```

## 7. Go live (hands-off daily at 07:00 UTC)
Set `NEWSLETTER_PREVIEW_MODE=false` and deploy. See **`DEPLOY.md`** for Render / Railway / Docker.
- `true` (default) → builds the draft each morning and waits for your approval.
- `false` → builds **and sends** automatically at 07:00 UTC.

---

## Recipients
- **Pro users** are pulled automatically from Supabase (`subscriptions.tier='pro'` or `profiles.license='pro'`).
- **Digest subscribers** come in via `POST /api/newsletter/subscribe` `{"email":"..."}`.
  Wire your site's signup box to it, or point people at the included page: `/subscribe.html`.
- Unsubscribes are automatic via the footer link in every email.

## What's in each newsletter
Headline + standfirst → Executive Summary → Overnight Market Summary → The Macro Read → Flows & Positioning → Top Whale Movements (24H) → Trending Narratives → Levels & Risk → The Other Side of the Trade → Watchlist for Today → Plain-English Glossary → Sources → Disclaimer.

## Guarantees built in
No fabricated data. Whale movements without a verifiable transaction link are **dropped**, not guessed. Every claim carries a source URL. The AI writes prose only — all numbers and links stay authoritative from the data collectors. One newsletter per date, enforced by the database.

## Docs
- `DEPLOY.md` — hosting, email setup, recipients, cron
- `README.md` — architecture, data sources, safeguards
