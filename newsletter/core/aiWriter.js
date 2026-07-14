import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * Editorial desk note that TRANSLATES noisy market/social data into plain English
 * a normal person can digest, while staying quantitative and useful.
 * AI writes prose only; numbers/hashes/links stay authoritative from collectors.
 * Always emits the canonical sections the product promises.
 */
export async function writeNewsletter(collected) {
  const facts = compactFacts(collected);
  let prose;
  try {
    prose = config.ai.apiKey ? await callAI(facts) : templatedProse(collected);
  } catch (e) {
    log.warn('AI writer failed — templated fallback', { e: e.message });
    prose = templatedProse(collected);
  }
  return assemble(collected, prose);
}

function assemble(c, prose) {
  const m = c.market?.data || {}, g = m.global || {}, t = c.trends?.data || {};
  const whales = (c.whales?.items || []).map((w, i) => ({ chain: w.chain, asset: w.asset, amount: w.amount, usd: w.usd, entity: w.entity || 'unknown wallet', txUrl: w.txUrl, ts: w.ts, interpretation: prose.whaleInterpretations?.[i] || w.interpretation || null }));
  const narratives = (c.narratives?.items || []).map((n, i) => ({ narrative: n.narrative, momentum: n.momentum, change24h: n.change24h, evidence: n.evidence || [], takeaway: prose.narrativeTakeaways?.[i] || null }));
  const seen = new Set();
  const sources = [...(c.allSources || [])].filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)).map((s) => ({ label: s.title || s.url, url: s.url })).slice(0, 32);
  const sec = prose.sections || {};
  const S = (k, dt) => ({ title: sec[k]?.title || dt, body: sec[k]?.body || '' });

  return {
    headline: prose.headline || defaultHeadline(c),
    standfirst: prose.standfirst || '',
    subject: prose.headline || defaultHeadline(c),
    date: new Date().toUTCString(),
    quickTake: prose.quickTake || [],
    sections: {
      backdrop: S('backdrop', 'Overnight Market Summary'),
      macro: S('macro', 'The Macro Read'),
      flows: S('flows', 'Flows & Positioning'),
      onchain: S('onchain', 'Top Whale Movements — Past 24H'),
      narratives: S('narratives', 'Trending Narratives'),
      levels: S('levels', 'Levels & Risk'),
      contrarian: S('contrarian', 'The Other Side of the Trade'),
      weekAhead: S('weekAhead', 'Watchlist for Today'),
    },
    keyLevels: prose.keyLevels || [],
    jargon: prose.jargon || [],
    snapshot: { totalMcap: g.totalMcapUsd, mcapChange24h: g.mcapChange24h, totalVol: g.totalVolUsd, btcDom: g.btcDominance, ethDom: g.ethDominance, fng: m.fearGreed || null, defiTvl: m.defiTvl || null },
    majors: m.majors || [], history: m.history || null, funding: m.funding || null, openInterest: m.openInterest || null, longShort: m.longShort || null, liquidations: m.liquidations || null,
    topTable: (m.top || []).slice(0, 10),
    sectors: t.sectors || null, trending: t.trending || null, stablecoins: t.stablecoins || null, reddit: t.reddit || null, chains: t.chains || null,
    whales, narratives, watchlist: prose.watchlist || [], sources,
  };
}

function compactFacts(c) {
  const m = c.market?.data || {}, t = c.trends?.data || {};
  return {
    majors: m.majors, global: m.global, funding: m.funding, openInterest: m.openInterest, longShort: m.longShort, liquidations: m.liquidations,
    fearGreed: m.fearGreed, defiTvl: m.defiTvl, gainers: m.gainers, losers: m.losers, top: (m.top || []).slice(0, 8),
    sectors: t.sectors, trending: t.trending, stablecoins: t.stablecoins, chains: t.chains,
    reddit: (t.reddit || []).slice(0, 6).map((r) => r.title),
    news: (c.news?.items || []).slice(0, 12).map((n) => ({ outlet: n.outlet, title: n.title })),
    whales: (c.whales?.items || []).map((w) => ({ chain: w.chain, asset: w.asset, usd: Math.round(w.usd), entity: w.entity, dir: w.interpretation })),
    narratives: (c.narratives?.items || []).map((n) => ({ narrative: n.narrative, momentum: n.momentum, change24h: n.change24h })),
  };
}

async function callAI(facts) {
  const system = [
    'YOU ARE: a markets analyst with 30 years across cycles — you traded the dot-com blowoff, 2008, the QE decade, the 2020 liquidity flood, and the rate-shock years — with the last 15 spent exclusively in crypto. You were there for Mt. Gox, the 2017 ICO mania, the 2018 nuclear winter, DeFi summer, the 2021 top, the LUNA/3AC/FTX chain of failures, and the ETF era. You write ChainQuant Daily Intelligence, read by traders at 07:00 UTC before they take risk.',
    '',
    'HOW 30 YEARS ACTUALLY CHANGES YOUR ANALYSIS — this is what separates you from a bot reading a ticker:',
    '- YOU THINK IN REGIMES, NOT DAYS. Ask first: what regime is this? (risk-on melt-up, chop/range, orderly correction, liquidation cascade, capitulation, disbelief recovery.) The same -2% day means totally different things in different regimes. Name the regime, then interpret within it.',
    '- YOU KNOW PRICE IS THE LEAST INFORMATIVE VARIABLE. Positioning, leverage, liquidity, and flows tell you what price is ABOUT to be forced to do. Always ask: who is offside here, and what would force them to act?',
    '- YOU HUNT FOR THE DIVERGENCE. The story is almost always where two signals disagree: price up but funding negative, market cap up but dominance down, rally on falling volume, sentiment at an extreme while flows say the opposite. Lead with the divergence when you find one.',
    '- YOU HAVE SEEN EVERY NARRATIVE BEFORE. You recognize the difference between capital rotating (durable, shows in volume and flows) and attention rotating (ephemeral, shows only in social and price). Say which one this is.',
    '- YOU DISTRUST SINGLE DATA POINTS. One whale transfer is noise; a pattern of exchange inflows across days is signal. One ETF outflow day is noise; a streak is a change in the institutional bid. Say explicitly when something is noise.',
    '- YOU REMEMBER THAT MOST BIG ON-CHAIN MOVES ARE PLUMBING. Exchange hot/cold reshuffles, custodial consolidation, market-maker rebalancing. A veteran does not scream "whale dumping" at a wallet transfer. State the innocent explanation alongside the bearish one.',
    '- YOU RESPECT REFLEXIVITY. Leverage amplifies moves in both directions; forced sellers create the very cascade they feared. Explain the mechanism, not just the outcome.',
    '- YOU ARE HUMBLE ABOUT PREDICTION AND RUTHLESS ABOUT RISK. You never predict price. You frame if/then scenarios, name what would invalidate your read, and size the risk. You have watched confident people get carried out.',
    '- YOU KNOW SENTIMENT EXTREMES ARE CONTEXT, NOT TRIGGERS. "Extreme Fear" has stayed extreme for months before. Never present a sentiment reading as a buy or sell signal.',
    '',
    'MISSION: turn the noise of crypto social media and the dryness of market data into clear, plain-English intelligence a smart non-expert can act on — without ever dumbing down the substance.',
    'TRANSLATION RULES:',
    '- Define every metric in plain words the first time it appears (e.g. "funding — the fee traders pay to keep a leveraged bet open"). Briefly, inline, never condescending.',
    '- Always answer the "so what?" — what this means for someone about to take risk today.',
    '',
    'VOICE: flowing prose, senior, calm, quantitative. No hype, no emojis, no exclamation marks, no "stay tuned", no financial advice.',
    '',
    'STRUCTURE (keep ALL sections; these are promised to subscribers). Each needs a title and a SUBSTANTIAL body of 4-7 sentences (two paragraphs where warranted, separated by a blank line). Every sentence must carry information:',
    '   backdrop  = Overnight Market Summary: BTC/ETH/SOL (24h AND 7d), total cap, volume, dominance. Name the regime. Distinguish a broad move from a narrow one, and whether volume confirms it.',
    '   macro     = The Macro Read: how crypto sits against rates, oil, equities, geopolitics, the dollar, and institutional/ETF demand — using ONLY macro items present in the data. Explain the TRANSMISSION MECHANISM (why that event reaches a crypto price), not just that it happened. If no macro data, say so briefly and move on.',
    '   flows     = Flows & Positioning: funding, open interest, long/short, liquidations, stablecoin supply ("dry powder"). Build a picture of WHO is offside and what would force them out. Name the squeeze or cascade scenario explicitly.',
    '   onchain   = Top Whale Movements: interpret the transfers as a GROUP, not a list. Net exchange in/outflow, stablecoin movement, accumulation vs distribution. Always give the innocent (plumbing) explanation alongside the directional one. State what would confirm or refute the read.',
    '   narratives= Trending Narratives: which themes have momentum and WHY. Explicitly separate capital rotation from attention rotation. Note what is rotating in and what is quietly fading.',
    '   levels    = Levels & Risk: the specific levels that matter (24h high/low, 7d range, round-number magnets), what breaks if they go, and how a disciplined trader frames risk. NEVER predict — only if/then.',
    '   contrarian= The Other Side of the Trade: steelman the opposite of the prevailing read, honestly and specifically. Name exactly what would have to be true for it to work. This is the section that makes this research rather than a hype letter.',
    '   weekAhead = Watchlist for Today: catalysts, levels, unlocks, macro prints, flows to watch — specific and actionable.',
    '- keyLevels: 3-5 objects {asset, level, meaning} drawn from the real data.',
    '- jargon: 2-4 objects {term, plain} — the trickiest terms used today, each defined in one plain sentence.',
    '',
    'STRICT: Use ONLY provided data. Never invent numbers, wallets, transactions, sources, or quotes. Never claim certainty about future price. When data is thin, say so — a veteran is comfortable saying "we do not know yet".',
    'Return ONLY valid JSON, no markdown.',
  ].join('\n');

  const user = `DATA:\n${JSON.stringify(facts)}\n\nReturn JSON:\n{\n` +
    `  "headline": string, "standfirst": string,\n  "quickTake": [string],\n` +
    `  "sections": { "backdrop":{"title":string,"body":string}, "macro":{"title":string,"body":string}, "flows":{"title":string,"body":string}, "onchain":{"title":string,"body":string}, "narratives":{"title":string,"body":string}, "levels":{"title":string,"body":string}, "contrarian":{"title":string,"body":string}, "weekAhead":{"title":string,"body":string} },\n` +
    `  "keyLevels": [{"asset":string,"level":string,"meaning":string}],\n` +
    `  "jargon": [{"term":string,"plain":string}],\n` +
    `  "whaleInterpretations": [string], "narrativeTakeaways": [string], "watchlist": [string]\n}`;

  const isAnthropic = config.ai.base.includes('anthropic');
  const headers = { 'Content-Type': 'application/json' };
  let body;
  if (isAnthropic) { headers['x-api-key'] = config.ai.apiKey; headers['anthropic-version'] = '2023-06-01'; body = JSON.stringify({ model: config.ai.model, max_tokens: 6000, system, messages: [{ role: 'user', content: user }] }); }
  else { headers['Authorization'] = `Bearer ${config.ai.apiKey}`; body = JSON.stringify({ model: config.ai.model, max_tokens: 6000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }); }
  const res = await fetch(config.ai.base, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text = isAnthropic ? (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n') : j.choices?.[0]?.message?.content || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── Deterministic, plain-English fallback ────────────────────────────────────
function templatedProse(c) {
  const m = c.market?.data || {}, g = m.global || {}, t = c.trends?.data || {};
  const btc = maj(m, 'BTC'), eth = maj(m, 'ETH'), sol = maj(m, 'SOL');
  const topNarr = c.narratives?.items?.[0];
  const bigWhale = (c.whales?.items || [])[0];
  const altRotation = g.mcapChange24h > 0 && btc?.change24h != null && btc.change24h < g.mcapChange24h;
  const sb = t.stablecoins;

  const vol = g.totalVolUsd;
  const broad = (m.top || []).filter((t) => Number.isFinite(t.change24h));
  const down = broad.filter((t) => t.change24h < 0).length;
  const breadth = broad.length ? `${down} of the top ${broad.length} are lower on the day` : '';
  const backdrop = btc
    ? `Bitcoin ${verb(btc.change24h)} ${fmtUsd(btc.price)}, ${fmtPct(btc.change24h)} over 24 hours and ${fmtPct(btc.change7d)} across the week. Ether sits at ${fmtUsd(eth?.price)} (${fmtPct(eth?.change24h)}) and Solana at ${fmtUsd(sol?.price)} (${fmtPct(sol?.change24h)}). The whole market is worth ${fmtBig(g.totalMcapUsd)}, ${fmtPct(g.mcapChange24h)} on the day, on ${fmtBig(vol)} of volume. ${breadth ? breadth.charAt(0).toUpperCase() + breadth.slice(1) + ', so this is a broad move rather than one coin dragging the average.' : ''}\n\n${altRotation ? 'Notably, the broader market is outpacing Bitcoin while its dominance slips to ' + fmtNum(g.btcDominance) + '% — the classic fingerprint of money rotating out of the safest crypto asset and down into smaller, riskier ones. That rotation usually shows up late in a risk-on stretch and is worth respecting while it lasts.' : 'Bitcoin still commands ' + fmtNum(g.btcDominance) + '% of the market, so it is setting the direction; when it moves this way, individual coin stories tend to stop mattering and everything trades together.'} ${m.fearGreed ? 'Sentiment reads ' + m.fearGreed.value + '/100 (' + m.fearGreed.label + ')' + (m.fearGreed.prev != null ? ', ' + (m.fearGreed.value >= m.fearGreed.prev ? 'up' : 'down') + ' from ' + m.fearGreed.prev + ' yesterday' : '') + ' — a crowd-psychology gauge, not a timing tool.' : ''}`
    : 'Market data was limited this run; figures will populate once live feeds return.';

  const ls = m.longShort;
  const flows = `${m.funding ? `Funding — the recurring fee traders pay to keep a leveraged bet open — is ${fmtPct(m.funding.BTC?.fundingRate)} on Bitcoin. ${m.funding.BTC?.fundingRate >= 0 ? 'Bullish bets are paying to stay open, so the crowd still leans long; that is a slow bleed for longs and a cushion for shorts.' : 'Bearish bets are paying to stay open, which means positioning has turned defensive — and crowded shorts are exactly the fuel a sharp rally runs on.'}` : 'Funding data was unavailable this run.'} ${ls ? `Roughly ${fmtNum(ls.longPct)}% of futures accounts sit long against ${fmtNum(ls.shortPct)}% short.` : ''} ${m.openInterest?.BTC?.oiUsd ? `Open interest — the total value of leveraged bets currently open — stands at ${fmtBig(m.openInterest.BTC.oiUsd)} on Bitcoin; the higher it climbs, the more violent any forced unwind becomes.` : ''}\n\n${sb ? `Stablecoins, the cash already parked inside crypto and ready to buy, total ${fmtBig(sb.totalUsd)} and are ${sb.deltaUsd24h >= 0 ? `up ${fmtBig(Math.abs(sb.deltaUsd24h || 0))} in 24 hours — fresh buying power arriving, which typically precedes demand rather than following it` : `down ${fmtBig(Math.abs(sb.deltaUsd24h || 0))} in 24 hours — dry powder leaving the system, which removes a floor under prices`}. ` : ''}${m.liquidations?.BTC ? `Liquidations over the past day ran ${fmtBig((m.liquidations.BTC.long24h || 0) + (m.liquidations.BTC.short24h || 0))} on Bitcoin alone — forced selling by traders whose leverage ran out, which is what turns an ordinary dip into a cascade. ` : ''}The practical read: leverage decides how far a move travels, and flows decide whether it lasts.`;

  const wc = c.whales?.items?.length || 0;
  const inflows = (c.whales?.items || []).filter((w) => /inflow/i.test(w.interpretation || '')).length;
  const outflows = (c.whales?.items || []).filter((w) => /outflow/i.test(w.interpretation || '')).length;
  const onchain = wc
    ? `${wc} transfer${wc > 1 ? 's' : ''} of $1M or more cleared on-chain in the past 24 hours${bigWhale ? `, the largest a ${fmtBig(bigWhale.usd)} ${bigWhale.asset} move` : ''}. ${inflows > outflows ? `More of them moved onto exchanges (${inflows}) than off (${outflows}), which tilts the read toward distribution — coins arriving on an exchange are coins that can be sold.` : outflows > inflows ? `More moved off exchanges (${outflows}) than onto them (${inflows}), which tilts toward accumulation — coins leaving an exchange usually go into longer-term storage and shrink the tradable float.` : 'Flows were balanced between exchanges and private wallets, so no clean directional signal emerges from the transfers themselves.'}\n\nA caution that matters: a large transfer is not automatically a trade. A meaningful share of whale alerts are exchanges reshuffling their own hot and cold wallets, or custodians consolidating client funds — mechanically identical to a whale repositioning, but with no market intent behind it. The confirmation to look for is whether an exchange inflow is followed by actual selling pressure in price within a day or so; if it is not, treat it as a reshuffle and move on. Every transfer below links to its blockchain record, and where the owner is unidentifiable we say "unknown wallet" rather than guessing a name.`
    : 'No transfers above the $1M threshold came with a verifiable blockchain record this run, so this section is deliberately empty. We do not list a whale movement we cannot link to an on-chain transaction — an unverifiable claim is worse than no claim.';

  const hotSectors = (t.sectors?.hot || []).slice(0, 3).map((s) => `${cleanCat(s.name)} (${fmtPct(s.change24h)})`).join(', ');
  const trendingTxt = (t.trending || []).slice(0, 4).map((x) => x.symbol).join(', ');
  const narr = `${hotSectors ? `The hottest corners of the market today are ${hotSectors} — these are the themes pulling in money right now. ` : ''}${trendingTxt ? `On the social side, the coins people are searching most are ${trendingTxt}. ` : ''}${topNarr ? `${topNarr.narrative} tops our momentum board, which blends real price moves, news, and community chatter into one score — treat it as "where attention is," not a buy signal.` : 'Narrative signal was thin this run.'}`;

  // Macro read — only from macro items actually present in the news data
  const macroNews = (c.news?.items || []).filter((n) => /fed|rate|inflation|oil|iran|war|tariff|etf|treasury|dollar|equit|stock|kospi|geopolit/i.test(n.title || ''));
  const macroTxt = macroNews.length
    ? `${macroNews.slice(0, 2).map((n) => n.title).join('. ')}. These matter to crypto because Bitcoin still trades as a risk asset: when geopolitical tension or rising oil prices push investors toward safety, the money that leaves stocks tends to leave crypto too — and it leaves the most speculative corners first.\n\nThe institutional channel is the second transmission line. Spot ETFs are now the main pipe through which traditional money enters Bitcoin, so their daily net flows are a direct read on whether Wall Street is adding or trimming. Persistent outflows remove a steady bid that the market had grown used to.`
    : 'No clear macro catalysts surfaced in the news feed this run. In quiet macro conditions crypto tends to trade on its own flows — ETF demand, leverage, and on-chain supply — rather than borrowing direction from equities or rates.';

  // Levels & risk — derived from real 24h high/low and 7d context
  const levels = [];
  for (const x of [btc, eth, sol].filter(Boolean)) {
    if (x.high24h && x.low24h) levels.push({ asset: x.symbol, level: `${fmtUsd(x.low24h)} – ${fmtUsd(x.high24h)}`, meaning: '24h range — the edges are where the day\'s buyers and sellers drew their lines.' });
    else if (x.price) levels.push({ asset: x.symbol, level: fmtUsd(x.price), meaning: `Spot reference; ${fmtPct(x.change7d)} over the past week sets the trend context.` });
  }
  const levelsTxt = btc
    ? `Bitcoin is the level that matters for everything else — when it moves, correlation across the market spikes and individual coin stories stop mattering for a while. It sits at ${fmtUsd(btc.price)}, ${fmtPct(btc.change7d)} over the week${btc.low24h && btc.high24h ? `, having traded between ${fmtUsd(btc.low24h)} and ${fmtUsd(btc.high24h)} in the last 24 hours` : ''}. The honest framing is conditional, not predictive: if the lower edge of that range gives way on rising volume, the move usually extends because leveraged longs get forced out; if it holds and volume dries up, the range simply continues.\n\nFor risk, the discipline is boring and it works: size positions so that being wrong at the range edge is survivable, and avoid adding leverage into a market where sentiment is already at an extreme. Extremes cut both ways — they mark exhaustion far more often than they mark the start of a trend.`
    : 'Insufficient price data this run to frame levels responsibly.';

  // Contrarian — steelman the opposite of the tape
  const bearish = (btc?.change24h ?? 0) < 0 || (g.mcapChange24h ?? 0) < 0;
  const contraTxt = bearish
    ? `The tape is red, so here is the honest bull case. Sentiment at ${m.fearGreed ? `${m.fearGreed.value}/100 (${m.fearGreed.label})` : 'depressed levels'} is historically where bottoms get built, not where tops break — when almost everyone is already fearful, the marginal seller becomes scarce. Selling driven by geopolitics tends to be fast and shallow rather than structural, because it changes no fundamental about the networks themselves.\n\nWhat would have to be true for the bull case to work: ETF flows would need to flip from outflow to inflow, exchange balances would need to stop rising, and price would need to hold its recent low on lighter volume. Absent those, "extreme fear" is just a description of the present, not a signal.`
    : `The tape is green, so here is the honest bear case. Rallies that come with rising leverage rather than rising spot demand are fragile — they unwind at the first sharp move because the same leverage that lifted price is forced to sell into weakness. Attention-driven narratives can lift a sector's market cap without a single dollar of durable capital committing to it.\n\nWhat would invalidate the bullish read: funding climbing while price stalls, exchange inflows rising into strength, or ETF flows failing to confirm the move. If the rally is real, spot demand and flows will show up alongside it.`;

  return {
    headline: defaultHeadline(c),
    standfirst: btc ? `${altRotation ? 'Money rotates into alts' : 'Bitcoin sets the tone'} as ${topNarr?.narrative || 'flows'} and on-chain movement frame the session.` : 'A data-light session; figures populate when live feeds return.',
    quickTake: [
      btc ? `Bitcoin ${verb(btc.change24h)} ${fmtUsd(btc.price)} (${fmtPct(btc.change24h)} today, ${fmtPct(btc.change7d)} this week).` : null,
      g.mcapChange24h != null ? `The total market is ${fmtBig(g.totalMcapUsd)}, ${fmtPct(g.mcapChange24h)} on the day; Bitcoin is ${fmtNum(g.btcDominance)}% of it.` : null,
      sb ? `Sideline cash (stablecoins) sits at ${fmtBig(sb.totalUsd)}, ${sb.deltaUsd24h >= 0 ? 'rising' : 'falling'} — a read on buying power.` : null,
      hotSectors ? `Hot themes: ${hotSectors}.` : null,
      wc ? `${wc} whale transfer${wc > 1 ? 's' : ''} of $1M+ tracked on-chain${bigWhale ? `, top ${fmtBig(bigWhale.usd)} ${bigWhale.asset}` : ''}.` : null,
    ].filter(Boolean).slice(0, 5),
    sections: {
      backdrop: { title: 'Overnight Market Summary', body: backdrop },
      macro: { title: 'The Macro Read', body: macroTxt },
      flows: { title: 'Flows & Positioning', body: flows },
      onchain: { title: 'Top Whale Movements — Past 24H', body: onchain },
      narratives: { title: 'Trending Narratives', body: narr },
      levels: { title: 'Levels & Risk', body: levelsTxt },
      contrarian: { title: 'The Other Side of the Trade', body: contraTxt },
      weekAhead: { title: 'Watchlist for Today', body: 'The levels and flows below are what decide the next move. Token unlocks add new supply to a market that has to absorb it; US economic data and central-bank commentary set the risk appetite that crypto borrows from; and ETF net flows show whether institutions are stepping in or stepping back. Watch these before adding risk.' },
    },
    keyLevels: levels,
    jargon: [
      { term: 'Funding rate', plain: 'The recurring fee traders pay to keep a leveraged bet open — positive means bullish bets are paying, negative means bearish ones are.' },
      { term: 'Dominance', plain: "Bitcoin's share of the total crypto market — when it falls while the market rises, money is spreading into smaller coins." },
      { term: 'Exchange inflow', plain: 'Coins moving onto an exchange, which often (but not always) means someone is getting ready to sell.' },
      { term: 'Dry powder', plain: 'Stablecoins sitting on the sidelines — cash that is already in crypto and ready to buy.' },
    ],
    whaleInterpretations: (c.whales?.items || []).map((w) => w.interpretation || 'Large transfer; counterparties unlabeled.'),
    narrativeTakeaways: (c.narratives?.items || []).map((n) => `${n.narrative}: ${n.change24h != null ? `sector ${fmtPct(n.change24h)} today` : `momentum ${n.momentum}`} — rising attention, but wait for volume to confirm before chasing.`),
    watchlist: ['Key Bitcoin price level vs the last few sessions', 'Token unlocks in the next 24-48h (new supply hitting the market)', 'US economic data / Fed speakers', 'Spot ETF inflows vs outflows (BTC, ETH, SOL)', 'Stablecoin mints/burns (buying power entering or leaving)'],
  };
}

const maj = (m, s) => m.majors?.find((x) => x.symbol === s);
const cleanCat = (n) => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
const fmtUsd = (v) => (v == null ? 'n/a' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 4 : 0 }));
const fmtPct = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%');
const fmtNum = (v) => (v == null ? 'n/a' : Number(v).toFixed(1));
const fmtBig = (v) => { if (v == null) return 'n/a'; const a = Math.abs(v); if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'; return fmtUsd(v); };
const verb = (ch) => (ch == null ? 'trades at' : ch > 1.5 ? 'pushes up to' : ch < -1.5 ? 'slips to' : 'holds near');

function defaultHeadline(c) {
  // Hook mechanics even without the AI: lead with the sharpest TENSION in the
  // data, and make it specific (a number, a name, a level) — vagueness kills.
  const m = c.market?.data || {}, g = m.global || {};
  const btc = maj(m, 'BTC');
  const top = c.narratives?.items?.[0]?.narrative;
  const big = (c.whales?.items || [])[0];
  const fng = m.fearGreed?.value;
  const funding = m.funding?.BTC?.fundingRate;

  // Rank the available tensions — the strongest unresolved contradiction wins.
  const altRotation = g.mcapChange24h > 0 && btc?.change24h != null && btc.change24h < g.mcapChange24h;
  const fearButBid = fng != null && fng <= 30 && (btc?.change24h ?? 0) > 0;
  const rallyNoBelief = (btc?.change24h ?? 0) > 0 && funding != null && funding < 0;
  const greedNoFollow = fng != null && fng >= 70 && (btc?.change24h ?? 0) < 0;

  const frame = fearButBid ? 'Fear says sell, the tape says otherwise'
    : rallyNoBelief ? 'A rally nobody believes'
    : greedNoFollow ? 'Greed at the top, cracks underneath'
    : altRotation ? 'Money leaves Bitcoin'
    : btc?.change24h == null ? 'Crypto markets in focus'
    : Math.abs(btc.change24h) < 1 ? 'Coiled and quiet'
    : btc.change24h > 0 ? 'Bid returns'
    : 'Pressure builds';

  const lead = btc ? `Bitcoin ${verb(btc.change24h)} ${fmtUsd(btc.price)}` : 'Crypto markets mixed';
  const cats = [
    top ? `${top} leads the board` : null,
    big ? `${fmtBig(big.usd)} ${big.asset} ${/inflow/i.test(big.interpretation || '') ? 'hits an exchange' : /outflow/i.test(big.interpretation || '') ? 'leaves an exchange' : 'moves on-chain'}` : null,
  ].filter(Boolean).slice(0, 2);

  return `${frame}: ${lead}${cats.length ? ` as ${cats.join(' and ')}` : ''}`;
}

