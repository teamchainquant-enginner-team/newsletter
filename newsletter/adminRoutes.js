import express from 'express';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { getRun, latestRun, listRuns, updateRun } from './lib/supabase.js';
import { runPipeline } from './pipeline.js';
import { sendRun, sendTest, unsubscribeByToken } from './sendNewsletter.js';
import { subscribeEmail } from './recipients.js';

export const router = express.Router();

// ── auth (all /admin routes) ────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!config.app.adminToken) return res.status(500).json({ error: 'NEWSLETTER_ADMIN_TOKEN not configured' });
  if (req.get('x-admin-token') !== config.app.adminToken) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// List recent runs
router.get('/admin/runs', requireAdmin, async (_req, res) => {
  try { res.json(await listRuns(50)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Preview rendered HTML in the browser (latest or by id)
router.get('/admin/preview/:id?', requireAdmin, async (req, res) => {
  try {
    const run = req.params.id ? await getRun(req.params.id) : await latestRun();
    if (!run?.html_content) return res.status(404).send('No rendered newsletter yet.');
    res.set('Content-Type', 'text/html').send(run.html_content);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trigger a pipeline run now (draft only; force re-runs even if sent)
router.post('/admin/run', requireAdmin, async (req, res) => {
  try {
    const out = await runPipeline({ trigger: 'manual', force: !!req.query.force, autoSend: false });
    res.json({ ok: true, run: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Approve a draft (preview_ready -> approved)
router.post('/admin/approve/:id', requireAdmin, async (req, res) => {
  try {
    const run = await getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'not found' });
    if (run.status !== 'preview_ready') return res.status(400).json({ error: `status is ${run.status}` });
    const updated = await updateRun(run.id, { status: 'approved', approved_at: new Date().toISOString() });
    res.json({ ok: true, run: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send a run to all recipients
router.post('/admin/send/:id', requireAdmin, async (req, res) => {
  try { res.json({ ok: true, run: await sendRun(req.params.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Send a single test email: body { email, runId? }
router.post('/admin/test', requireAdmin, express.json(), async (req, res) => {
  try {
    if (!req.body?.email) return res.status(400).json({ error: 'email required' });
    res.json(await sendTest(req.body.email, req.body.runId || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── public subscribe (no auth) ──────────────────────────────────────────────
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
router.post('/subscribe', express.json(), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
    await subscribeEmail(email, req.body?.user_id || null);
    res.json({ ok: true, message: "You're subscribed to ChainQuant Daily." });
  } catch (e) { log.error('subscribe failed', { e: e.message }); res.status(500).json({ error: 'Could not subscribe right now.' }); }
});

// ── public unsubscribe (no auth) ────────────────────────────────────────────
router.get('/unsubscribe', async (req, res) => {
  try {
    const r = await unsubscribeByToken(req.query.token);
    const msg = r.ok ? 'You have been unsubscribed from ChainQuant Daily.' : 'Unsubscribe link is invalid or already used.';
    res.set('Content-Type', 'text/html').send(
      `<body style="background:#07090f;color:#e7ecf3;font-family:Inter,Arial,sans-serif;padding:48px;text-align:center">
       <h2 style="color:#1AA3FF">ChainQuant</h2><p>${msg}</p></body>`
    );
  } catch (e) { log.error('unsubscribe failed', { e: e.message }); res.status(500).send('Error processing request.'); }
});
