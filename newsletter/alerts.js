import { Resend } from 'resend';
import { config } from './config.js';
import { log } from './lib/logger.js';

// Operational alerts (pipeline failures / degraded runs) — NOT subscriber email.
// Goes to alerts@chainquant.net so a broken 07:00 UTC run never fails silently.
const resend = config.email.apiKey ? new Resend(config.email.apiKey) : null;

const BG = '#07090f', LINE = '#1b2230', TXT = '#e7ecf3', MUT = '#8b97a8', RED = '#ff5470', AMBER = '#E0A23A';

function wrap(title, color, rows, body) {
  return `<div style="background:${BG};padding:24px;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:${TXT}">
    <div style="max-width:560px;margin:0 auto;border:1px solid ${LINE};border-left:3px solid ${color};border-radius:10px;padding:20px">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${color}">ChainQuant · Newsletter Ops</div>
      <h2 style="font-size:18px;margin:10px 0 14px;color:${TXT}">${title}</h2>
      ${rows.map(([k, v]) => `<div style="font-size:13px;margin-bottom:6px"><span style="color:${MUT}">${k}:</span> <span style="color:${TXT};font-family:'IBM Plex Mono',monospace">${v ?? '—'}</span></div>`).join('')}
      ${body ? `<pre style="margin-top:14px;padding:12px;background:#0d121c;border:1px solid ${LINE};border-radius:6px;color:${MUT};font-size:12px;white-space:pre-wrap;word-break:break-word">${escapeHtml(body)}</pre>` : ''}
      <div style="margin-top:16px;font-size:11px;color:${MUT};border-top:1px solid ${LINE};padding-top:12px">
        Preview the draft: <a href="${config.app.baseUrl}" style="color:#1AA3FF;text-decoration:none">${config.app.baseUrl}</a> · This is an automated ops alert, not a subscriber email.
      </div>
    </div></div>`;
}
const escapeHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function send(subject, html, text) {
  if (!config.alerts.enabled) return;
  if (!resend) { log.warn('alert not sent — RESEND_API_KEY missing'); return; }
  try {
    const { error } = await resend.emails.send({
      from: config.email.from,
      to: config.alerts.to,
      replyTo: config.alerts.to,
      subject, html, text,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    log.info('ops alert sent', { to: config.alerts.to, subject });
  } catch (e) {
    // An alert failing must never crash the pipeline — just log it loudly.
    log.error('ops alert FAILED to send', { error: e.message });
  }
}

/** The 07:00 UTC run threw — the newsletter did NOT go out. */
export async function alertPipelineFailed({ runId, runDate, step, error, trigger }) {
  const subject = `🔴 ChainQuant Daily FAILED — ${runDate}`;
  const rows = [['Date', runDate], ['Run ID', runId], ['Trigger', trigger], ['Failed at', step || 'unknown step'], ['Time', new Date().toISOString()]];
  const html = wrap('Daily newsletter run failed', RED, rows, error);
  const text = `ChainQuant Daily FAILED\nDate: ${runDate}\nRun: ${runId}\nTrigger: ${trigger}\nStep: ${step}\n\n${error}\n\nNo newsletter was sent. Fix and re-run: npm run run:once`;
  await send(subject, html, text);
}

/** Run completed, but some sends bounced/failed, or data sources were degraded. */
export async function alertPartialFailure({ runId, runDate, sent, failed, degraded = [] }) {
  const subject = `⚠️ ChainQuant Daily — ${failed} send failure${failed === 1 ? '' : 's'} (${runDate})`;
  const rows = [['Date', runDate], ['Run ID', runId], ['Delivered', sent], ['Failed', failed], ['Degraded sources', degraded.length ? degraded.join(', ') : 'none']];
  const html = wrap('Daily newsletter sent with issues', AMBER, rows, null);
  const text = `ChainQuant Daily sent with issues\nDate: ${runDate}\nDelivered: ${sent}\nFailed: ${failed}\nDegraded: ${degraded.join(', ') || 'none'}`;
  await send(subject, html, text);
}

/** Preview mode is on: a draft is waiting for approval and will NOT auto-send. */
export async function alertDraftReady({ runId, runDate, subject: subj, metrics }) {
  const subject = `📝 ChainQuant Daily draft ready for approval — ${runDate}`;
  const rows = [
    ['Date', runDate], ['Run ID', runId], ['Subject', escapeHtml(subj)],
    ['Whales', metrics?.whales], ['Narratives', metrics?.narratives], ['Sources', metrics?.sources],
  ];
  const html = wrap('Draft ready — awaiting your approval', '#1AA3FF', rows,
    `Preview: GET /api/newsletter/preview/${runId}\nApprove: POST /api/newsletter/approve/${runId}\nSend:    POST /api/newsletter/send/${runId}\n(send header: x-admin-token)`);
  const text = `Draft ready — awaiting approval\nDate: ${runDate}\nRun: ${runId}\nSubject: ${subj}\n\nPreview: /api/newsletter/preview/${runId}\nApprove: /api/newsletter/approve/${runId}\nSend: /api/newsletter/send/${runId}`;
  await send(subject, html, text);
}
