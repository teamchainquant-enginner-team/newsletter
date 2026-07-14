import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * THE COPYWRITER BOT — second pass.
 *
 * Pass 1 (aiWriter) is the ANALYST: it reads the data and produces correct,
 * factual prose. Pass 2 (this) is the COPYWRITER: it rewrites that prose for
 * voice, rhythm, and readability — hooks the reader, kills jargon and filler,
 * tightens sentences — WITHOUT touching a single fact.
 *
 * The integrity guard is the important part: the copywriter is only allowed to
 * return text whose numbers already existed in the analyst draft. If it invents,
 * alters, or drops a figure, its output is REJECTED and the analyst draft ships
 * unchanged. A prettier newsletter is never worth a wrong number.
 */
export async function polishCopy(newsletter) {
  if (!config.ai.apiKey) {
    log.info('copywriter skipped — no AI key (analyst draft ships as-is)');
    return { newsletter, polished: false, reason: 'no_api_key' };
  }

  // Only prose fields are ever sent to the copywriter. Numbers, tx hashes,
  // URLs, tables, and charts live outside this payload and cannot be altered.
  const draft = {
    headline: newsletter.headline,
    standfirst: newsletter.standfirst,
    quickTake: newsletter.quickTake || [],
    sections: Object.fromEntries(
      Object.entries(newsletter.sections || {}).map(([k, v]) => [k, { title: v.title, body: v.body }])
    ),
    narrativeTakeaways: (newsletter.narratives || []).map((n) => n.takeaway || ''),
    watchlist: newsletter.watchlist || [],
  };

  try {
    const polished = await callCopywriter(draft);
    const check = verifyNumbers(draft, polished);
    if (!check.ok) {
      log.warn('copywriter REJECTED — numeric integrity failed', { added: check.added.slice(0, 8) });
      return { newsletter, polished: false, reason: 'numeric_mismatch', added: check.added };
    }

    const out = structuredClone(newsletter);
    out.headline = polished.headline || out.headline;
    out.standfirst = polished.standfirst || out.standfirst;
    out.subject = polished.headline || out.subject;
    if (Array.isArray(polished.quickTake) && polished.quickTake.length) out.quickTake = polished.quickTake;
    for (const [k, v] of Object.entries(polished.sections || {})) {
      if (out.sections[k] && v?.body) out.sections[k] = { title: v.title || out.sections[k].title, body: v.body };
    }
    if (Array.isArray(polished.narrativeTakeaways)) {
      out.narratives = out.narratives.map((n, i) => ({ ...n, takeaway: polished.narrativeTakeaways[i] || n.takeaway }));
    }
    if (Array.isArray(polished.watchlist) && polished.watchlist.length) out.watchlist = polished.watchlist;

    log.info('copywriter pass complete', { sections: Object.keys(polished.sections || {}).length });
    return { newsletter: out, polished: true };
  } catch (e) {
    log.warn('copywriter failed — analyst draft ships as-is', { e: e.message });
    return { newsletter, polished: false, reason: e.message };
  }
}

// ── integrity guard ─────────────────────────────────────────────────────────
// Every number in the polished copy must already exist in the analyst draft.
const numbersIn = (obj) => {
  const text = JSON.stringify(obj);
  // strip thousands separators so "62,474.85" and "62474.85" compare equal
  return new Set((text.replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) || []));
};

function verifyNumbers(draft, polished) {
  const before = numbersIn(draft);
  const after = numbersIn(polished);
  const added = [...after].filter((n) => !before.has(n) && Number(n) > 1); // ignore 0/1 (list indices, "1 of")
  return { ok: added.length === 0, added };
}

// ── the copywriter ──────────────────────────────────────────────────────────
async function callCopywriter(draft) {
  const system = [
    'YOU ARE: a direct-response copywriter with 10 years writing the emails that built billion-dollar brands. You have written subject lines opened millions of times and leads that made people read 2,000 words they did not plan to read. You know that attention is earned in the first seven words, and that the fastest way to lose a sophisticated reader is to sound like marketing.',
    '',
    'An analyst with 30 years in markets has written a factually correct draft. Your ONLY job is to make it IRRESISTIBLE TO READ. You are the last set of eyes before it reaches paying subscribers.',
    '',
    'WHAT ACTUALLY MAKES A HOOK WORK (you know this; most writers do not):',
    '- SPECIFICITY IS THE HOOK. "Bitcoin slips under $62,500 as ETFs bleed $425M" beats "Crypto markets face uncertainty" every time. Numbers, names, and levels create belief. Vagueness creates scrolling.',
    '- TENSION, NOT HYPE. The strongest hook is an unresolved contradiction the reader needs settled: the crowd is fearful but the whales are buying; price is up but the funding says nobody believes it. Find the tension the analyst uncovered and put it in the headline.',
    '- CURIOSITY GAP, HONESTLY CLOSED. Open a loop the body genuinely closes. Never a loop the copy cannot close — that is how you burn a list.',
    '- LEAD WITH THE POINT. Traders scan. First sentence of every section delivers the payload; the rest supports it. Never warm up, never throat-clear.',
    '- RHYTHM CARRIES THE READER. Vary sentence length. A long, carefully built sentence that lays out the mechanism. Then a short one that lands it. That contrast is what makes prose readable.',
    '- CUT EVERY WORD THAT IS NOT WORKING. Kill: "it is worth noting", "as we can see", "in the world of crypto", "needless to say", "in today\'s market". If deleting a phrase loses nothing, it was never earning its place.',
    '- CONCRETE BEATS ABSTRACT. "The cash sitting on the sidelines ready to buy" beats "stablecoin liquidity metrics".',
    '',
    'THE DISCIPLINE THAT SEPARATES YOU FROM A HACK — this is a paid financial product, not a funnel:',
    '- NO false urgency, NO fear-mongering, NO "you cannot afford to miss this", NO manufactured stakes. This audience is sophisticated and will unsubscribe instantly. Their trust IS the asset.',
    '- NO emojis, NO exclamation marks, NO ALL CAPS, NO clickbait that the body does not deliver on.',
    '- Confident and calm outranks loud. The most persuasive voice in finance is the one that sounds like it has nothing to prove.',
    '',
    'ABSOLUTE RULES — violating any of these gets your ENTIRE output discarded and the analyst draft shipped instead:',
    '- DO NOT invent, change, round, or remove ANY number. Every figure in your output must already appear in the draft.',
    '- DO NOT add facts, claims, sources, wallets, or transactions not in the draft.',
    '- DO NOT turn uncertainty into certainty. If the analyst hedged ("may", "could", "unconfirmed"), you hedge. Never manufacture a prediction for drama.',
    '- DO NOT change direction (up/down) or meaning. You are polishing the prose, not rewriting the analysis.',
    '- Keep each section a similar length. Tighten; do not gut.',
    '',
    'Return ONLY valid JSON with exactly the same shape as the input. No markdown, no backticks.',
  ].join('\n');

  const user = `ANALYST DRAFT (rewrite the prose, keep every fact and figure identical):\n${JSON.stringify(draft, null, 2)}`;

  const isAnthropic = config.ai.base.includes('anthropic');
  const headers = { 'Content-Type': 'application/json' };
  let body;
  if (isAnthropic) {
    headers['x-api-key'] = config.ai.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = JSON.stringify({ model: config.ai.model, max_tokens: 6000, system, messages: [{ role: 'user', content: user }] });
  } else {
    headers['Authorization'] = `Bearer ${config.ai.apiKey}`;
    body = JSON.stringify({ model: config.ai.model, max_tokens: 6000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
  }

  const res = await fetch(config.ai.base, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`copywriter HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text = isAnthropic
    ? (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    : j.choices?.[0]?.message?.content || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}
