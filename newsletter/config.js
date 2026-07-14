import dotenv from 'dotenv';
dotenv.config();

const bool = (v, d = false) =>
  v == null ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'ChainQuant Daily <daily@chainquant.net>',
    replyTo: process.env.RESEND_REPLY_TO || 'support@chainquant.net',
  },
  ai: {
    apiKey: process.env.AI_PROVIDER_API_KEY,
    base: process.env.AI_API_BASE || 'https://api.anthropic.com/v1/messages',
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
  },
  alerts: {
    // Operational alerts (failures / drafts awaiting approval) — not subscriber mail.
    to: process.env.ALERT_EMAIL || 'alerts@chainquant.net',
    enabled: !['0', 'false', 'no', 'off'].includes(String(process.env.ALERTS_ENABLED ?? 'true').toLowerCase()),
  },
  data: {
    coingecko: process.env.COINGECKO_API_KEY || '',
    moralis: process.env.MORALIS_API_KEY || '',
    helius: process.env.HELIUS_API_KEY || '',
    bitquery: process.env.BITQUERY_API_KEY || '',
    vybe: process.env.VYBE_API_KEY || '',
    twitterapi: process.env.TWITTERAPI_IO_KEY || '',
    coinglass: process.env.COINGLASS_API_KEY || '',
  },
  app: {
    baseUrl: process.env.APP_BASE_URL || 'https://chainquant.net',
    previewMode: bool(process.env.NEWSLETTER_PREVIEW_MODE, true),
    sendTime: process.env.DAILY_NEWSLETTER_SEND_TIME || '07:00',
    timezone: process.env.NEWSLETTER_TIMEZONE || 'UTC',
    adminToken: process.env.NEWSLETTER_ADMIN_TOKEN || '',
    chartBase: process.env.CHART_BASE_URL || 'https://quickchart.io/chart',
    port: parseInt(process.env.PORT || '3002', 10),
  },
};

// Fail fast on the few vars without which nothing can work.
export function assertCoreEnv() {
  const missing = [];
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}

// Soft checks — pipeline still runs, but these subsystems degrade gracefully.
export function envWarnings() {
  const w = [];
  if (!config.email.apiKey) w.push('RESEND_API_KEY missing — sending disabled.');
  if (!config.ai.apiKey) w.push('AI_PROVIDER_API_KEY missing — AI writer falls back to a templated draft.');
  if (!config.data.moralis && !config.data.helius && !config.data.bitquery)
    w.push('No on-chain keys — whale section will be empty (shown as "no qualifying movements").');
  return w;
}
