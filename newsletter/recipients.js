import { db } from './lib/supabase.js';
import { log } from './lib/logger.js';

/**
 * Recipients = Pro users  ∪  digest buyers (anyone with an active subscriber row).
 *
 * Pro users are detected from BOTH sources of truth used by the app:
 *   subscriptions.tier='pro' & status='active'  OR  profiles.license='pro'.
 *
 * We "materialize" Pro users into newsletter_subscribers (insert-if-absent) so
 * every recipient has a row with an unsubscribe_token and can opt out — and so
 * a previously-unsubscribed Pro user is NOT silently re-added (on-conflict keeps
 * their existing status). Digest buyers already live in newsletter_subscribers.
 */
export async function syncProUsers() {
  // Pull Pro emails from subscriptions
  const { data: subs, error: e1 } = await db
    .from('subscriptions')
    .select('user_id, tier, status, users:users!inner(id, email)')
    .eq('tier', 'pro')
    .eq('status', 'active');
  if (e1) throw e1;

  // Pull Pro emails from profiles.license (second source of truth)
  const { data: profs, error: e2 } = await db
    .from('profiles')
    .select('id, email, license')
    .eq('license', 'pro');
  if (e2) throw e2;

  const map = new Map(); // email -> user_id
  for (const s of subs || []) {
    const em = s.users?.email?.toLowerCase();
    if (em) map.set(em, s.user_id);
  }
  for (const p of profs || []) {
    const em = p.email?.toLowerCase();
    if (em && !map.has(em)) map.set(em, p.id);
  }
  if (!map.size) return 0;

  const rows = [...map].map(([email, user_id]) => ({
    user_id,
    email,
    subscription_status: 'active',
  }));

  // insert-if-absent on the unique email; never overwrite an existing row
  const { error } = await db
    .from('newsletter_subscribers')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true });
  if (error) throw error;
  log.info('synced pro users into subscribers', { count: rows.length });
  return rows.length;
}

/** Add or re-activate a subscriber by email (used by the public subscribe form). */
export async function subscribeEmail(email, userId = null) {
  const row = { email: String(email).toLowerCase().trim(), subscription_status: 'active' };
  if (userId) row.user_id = userId;
  // upsert on email re-activates a previously unsubscribed address without
  // clobbering an existing user_id (not included in the update payload).
  const { error } = await db.from('newsletter_subscribers').upsert(row, { onConflict: 'email' });
  if (error) throw error;
  log.info('subscriber added/reactivated', { email: row.email });
  return true;
}

/** Active recipients, each with id + unsubscribe_token for the footer link. */
export async function getActiveRecipients() {
  const { data, error } = await db
    .from('newsletter_subscribers')
    .select('id, email, unsubscribe_token, preferences_json')
    .eq('subscription_status', 'active');
  if (error) throw error;
  return data || [];
}
