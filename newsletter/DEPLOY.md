# Deploying ChainQuant Daily — hosting, email & recipients

You upload **one Node service**. Your database (Supabase) and email (Resend) are already hosted — you only point this service at them with env vars.

---

## 1. What to upload
Upload the entire `newsletter/` folder. Do **not** upload `.env`, `node_modules/`, or `out/` (the `.gitignore` already excludes them).

Files that matter for hosting:
- `server.js` — the web service (subscribe / unsubscribe / admin endpoints) + in-process 7 AM UTC cron
- `Dockerfile`, `Procfile`, `render.yaml` — pick whichever your host uses
- `public/subscribe.html` — a ready-made signup page served at `/subscribe.html`
- `.env.example` — copy its keys into your host's environment settings

---

## 2. Connect email (Resend)
1. Create a Resend account, add and **verify your sending domain** (`chainquant.net`) — add the DKIM/SPF DNS records Resend gives you. This is what keeps you out of spam.
2. Create an API key → set `RESEND_API_KEY`.
3. Set `RESEND_FROM="ChainQuant Daily <daily@chainquant.net>"` and `RESEND_REPLY_TO=support@chainquant.net`.

Until the domain is verified, sends will fail — that's Resend, not the app.

---

## 3. Connect recipients (who gets it)
Recipients = **Pro users** ∪ **digest subscribers**. Two paths feed the list:
- **Pro users** are pulled automatically from your Supabase `subscriptions` / `profiles` tables every send (no action needed).
- **Digest subscribers** are anyone who hits the subscribe endpoint:

```
POST  https://<your-host>/api/newsletter/subscribe
Content-Type: application/json
{ "email": "person@example.com" }      // optional: "user_id": "<uuid>"
```

Wire your existing site signup box to it (one fetch):
```js
await fetch('https://<your-host>/api/newsletter/subscribe', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
});
```
Or just link people to the hosted page: `https://<your-host>/subscribe.html`.

Unsubscribes are automatic — every email's footer link hits `/api/newsletter/unsubscribe?token=…` and flips that subscriber to `unsubscribed` (respected on every future send).

---

## 4. Set environment variables
Copy every key from `.env.example` into your host's env settings. Required to send:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEWSLETTER_ADMIN_TOKEN`.
Recommended: `AI_PROVIDER_API_KEY` (for the real prose), `COINGECKO_API_KEY` (free Demo key).
Send timing: `DAILY_NEWSLETTER_SEND_TIME=07:00`, `NEWSLETTER_TIMEZONE=UTC`.
Go live (auto-send): `NEWSLETTER_PREVIEW_MODE=false`. Keep `true` to review each morning before it sends.

---

## 5. Deploy — pick one

### A. Railway / Fly / a VPS (always-on) — simplest
One process runs the endpoints **and** the 7 AM UTC cron in-process.
- Start command: `node server.js`
- Keep `RUN_SCHEDULER` unset (defaults on).
- VPS: run under pm2 → `pm2 start server.js --name chainquant-newsletter`.

### B. Render (web + native cron) — most reliable
Use the included `render.yaml` (New → Blueprint). It creates:
- a **web service** running `node server.js` with `RUN_SCHEDULER=false` (endpoints only), and
- a **cron job** at `0 7 * * *` UTC running `npm run run:once` (builds + sends).

Set the secret env vars in the dashboard for both. (Avoid Render's free web tier — it sleeps.)

### C. Docker (anywhere)
```bash
docker build -t chainquant-newsletter .
docker run -p 3002:3002 --env-file .env chainquant-newsletter
```

---

## 6. Verify after deploy
```bash
curl https://<your-host>/health                  # {"ok":true,...}
node checkLive.js                                # real prices + whale txs (run locally or via host shell)
# send yourself a test:
curl -X POST https://<your-host>/api/newsletter/test \
  -H "x-admin-token: $NEWSLETTER_ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"email":"you@chainquant.net"}'
# preview today's draft in a browser (send the x-admin-token header via a REST client):
#   https://<your-host>/api/newsletter/preview
```

Once the domain is verified and `NEWSLETTER_PREVIEW_MODE=false`, the digest sends to Pro users + subscribers every morning at **07:00 UTC** automatically.
