import { createClient } from '@supabase/supabase-js';
import { config, assertCoreEnv } from '../config.js';

assertCoreEnv();

export const db = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});

const todayUTC = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ── newsletter_runs ────────────────────────────────────────────────────────
export async function createRun(runDate = todayUTC()) {
  const { data, error } = await db
    .from('newsletter_runs')
    .insert({ run_date: runDate, status: 'collecting' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRun(id, patch) {
  const { data, error } = await db
    .from('newsletter_runs')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRun(id) {
  const { data, error } = await db.from('newsletter_runs').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Has a newsletter already been SENT for this date? (dup-guard)
export async function alreadySentForDate(runDate = todayUTC()) {
  const { data, error } = await db
    .from('newsletter_runs')
    .select('id')
    .eq('run_date', runDate)
    .eq('status', 'sent')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function latestRun(status = null) {
  let q = db.from('newsletter_runs').select('*').order('created_at', { ascending: false }).limit(1);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0] || null;
}

export async function listRuns(limit = 30) {
  const { data, error } = await db
    .from('newsletter_runs')
    .select('id, run_date, status, subject, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ── newsletter_sources ─────────────────────────────────────────────────────
export async function saveSources(runId, sources) {
  if (!sources?.length) return;
  const rows = sources.map((s) => ({
    run_id: runId,
    source_type: s.source_type,
    title: s.title || null,
    url: s.url || null,
    published_at: s.published_at || null,
    extracted_data_json: s.data || {},
    confidence_score: s.confidence ?? null,
  }));
  const { error } = await db.from('newsletter_sources').insert(rows);
  if (error) throw error;
}

// ── newsletter_events ──────────────────────────────────────────────────────
export async function logEvent(runId, subscriberId, eventType, metadata = {}) {
  const { error } = await db.from('newsletter_events').insert({
    run_id: runId,
    subscriber_id: subscriberId,
    event_type: eventType,
    metadata_json: metadata,
  });
  if (error) log_safe(error);
}
function log_safe(e) {
  // Event logging must never break a send.
  console.error('event log failed:', e.message);
}

export { todayUTC };
