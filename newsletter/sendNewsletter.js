import { Resend } from 'resend';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { db, getRun, updateRun, logEvent, alreadySentForDate, latestRun } from './lib/supabase.js';
import { syncProUsers, getActiveRecipients } from './recipients.js';
import { UNSUB } from './core/renderEmail.js';
import { alertPartialFailure } from './alerts.js';

const resend = config.email.apiKey ? new Resend(config.email.apiKey) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function unsubUrl(token) {
  return `${config.app.baseUrl}/api/newsletter/unsubscribe?token=${token}`;
}

/** Send a stored run to all active recipients. Idempotent per date. */
export async function sendRun(runId) {
  if (!resend) throw new Error('RESEND_API_KEY not set — cannot send.');
  const run = await getRun(runId);
  if (!run) throw new Error('run not found');
  if (run.status === 'sent') { log.warn('run already sent', { runId }); return run; }
  if (!['preview_ready', 'approved'].includes(run.status))
    throw new Error(`run status is "${run.status}" — not sendable`);
  if (await alreadySentForDate(run.run_date)) { log.warn('another run already sent for date', { date: run.run_date }); return run; }
  if (!run.html_content) throw new Error('run has no rendered content');

  await syncProUsers();                       // materialize Pro users as subscribers
  const recipients = await getActiveRecipients();
  log.info('sending newsletter', { runId, recipients: recipients.length });

  let sent = 0, failed = 0;
  for (const r of recipients) {
    const url = unsubUrl(r.unsubscribe_token);
    const html = run.html_content.split(UNSUB).join(url);
    const text = run.text_content ? run.text_content.split(UNSUB).join(url) : undefined;
    try {
      const { error } = await resend.emails.send({
        from: config.email.from,
        to: r.email,
        replyTo: config.email.replyTo,
        subject: run.subject,
        html, text,
        headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      sent++;
      await logEvent(runId, r.id, 'sent');
    } catch (e) {
      failed++;
      log.warn('send failed', { email: r.email, e: e.message });
      await logEvent(runId, r.id, 'failed', { error: e.message });
    }
    await sleep(120); // gentle rate limit
  }

  const updated = await updateRun(runId, { status: 'sent', sent_at: new Date().toISOString() });
  log.info('newsletter sent', { runId, sent, failed });
  // Any bounce/rejection is worth a human's attention (e.g. unverified domain).
  if (failed > 0) {
    await alertPartialFailure({ runId, runDate: run.run_date, sent, failed });
  }
  return updated;
}

/** Send the latest approved (or preview_ready) run. Used by the manual flow. */
export async function sendLatestApproved() {
  const run = (await latestRun('approved')) || (await latestRun('preview_ready'));
  if (!run) { log.warn('no approved/preview_ready run to send'); return null; }
  return sendRun(run.id);
}

/** Send a single test email of a run (no events, no status change). */
export async function sendTest(toEmail, runId = null) {
  if (!resend) throw new Error('RESEND_API_KEY not set.');
  const run = runId ? await getRun(runId) : await latestRun();
  if (!run?.html_content) throw new Error('no rendered run available to test');
  const url = `${config.app.baseUrl}/api/newsletter/unsubscribe?token=TEST`;
  const html = run.html_content.split(UNSUB).join(url);
  const text = run.text_content ? run.text_content.split(UNSUB).join(url) : undefined;
  const { error } = await resend.emails.send({
    from: config.email.from, to: toEmail, replyTo: config.email.replyTo,
    subject: `[TEST] ${run.subject}`, html, text,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  log.info('test email sent', { toEmail, runId: run.id });
  return { ok: true, runId: run.id };
}

/** Public unsubscribe handler (called by the route). */
export async function unsubscribeByToken(token) {
  if (!token || token === 'TEST') return { ok: false, reason: 'invalid token' };
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ subscription_status: 'unsubscribed' })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, reason: 'not found' };
  await logEvent(null, data.id, 'unsubscribed');
  return { ok: true };
}
