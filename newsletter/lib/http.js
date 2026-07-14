import { log } from './logger.js';

// Per-host token buckets so one slow/greedy API can't starve the run.
const buckets = new Map();
function rateGate(host, maxPerMin) {
  const now = Date.now();
  const b = buckets.get(host) || { calls: [] };
  b.calls = b.calls.filter((t) => now - t < 60_000);
  if (b.calls.length >= maxPerMin) return false;
  b.calls.push(now);
  buckets.set(host, b);
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with timeout, retry on 429/5xx/network, and a per-host rate cap.
 * Returns the parsed body (json|text) or throws after exhausting retries.
 */
export async function httpGet(url, {
  headers = {},
  as = 'json',
  timeoutMs = 12_000,
  retries = 3,
  backoffMs = 800,
  maxPerMin = 30,
  method = 'GET',
  body = null,
} = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // crude wait if rate-limited locally
    let guard = 0;
    while (!rateGate(host, maxPerMin) && guard++ < 20) await sleep(500);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { retriable: true, status: res.status });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return as === 'text' ? await res.text() : await res.json();
    } catch (err) {
      clearTimeout(timer);
      const retriable = err.retriable || err.name === 'AbortError' || err.name === 'TypeError';
      if (attempt < retries && retriable) {
        const wait = backoffMs * 2 ** attempt;
        log.warn(`retrying ${host}`, { attempt: attempt + 1, wait, reason: err.message });
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

export const httpPost = (url, opts = {}) =>
  httpGet(url, { ...opts, method: 'POST' });
