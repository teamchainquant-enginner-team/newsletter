import { majorsChart, narrativeChart, priceChart24h, priceChart6h } from './chartGen.js';

const UNSUB = '%%UNSUB%%';
const DISCLAIMER = 'This content is for informational purposes only and does not constitute financial, investment, legal, or tax advice. Digital assets are risky and volatile. Always do your own research.';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtUsd = (v) => (v == null ? 'n/a' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 4 : 0 }));
const fmtBig = (v) => { if (v == null) return 'n/a'; const a = Math.abs(v); if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'; return fmtUsd(v); };
const pct = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%');
const pcol = (v) => (v == null ? MUT : v >= 0 ? GREEN : RED);
const paras = (txt) => String(txt || '').split(/\n{2,}/).filter(Boolean);
const cleanCat = (n) => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();

const BG = '#07090f', CARD = '#0d121c', CARD2 = '#0a0e16', LINE = '#1b2230', BLUE = '#1AA3FF', TXT = '#e7ecf3', MUT = '#8b97a8', GREEN = '#2BC26E', RED = '#ff5470';

// Editorial section: H2-style header + flowing prose + optional embedded data.
function section(title, body, extra = '') {
  const p = paras(body).map((x) => `<p style="color:${TXT};font-size:15px;line-height:1.68;margin:0 0 12px">${esc(x)}</p>`).join('') || `<p style="color:${MUT};font-size:14px;margin:0 0 12px">Limited data this run.</p>`;
  return `<tr><td class="pad" style="padding:20px 30px;border-bottom:1px solid ${LINE}">
    <h2 style="font-size:17px;font-weight:800;color:${TXT};margin:0 0 12px;letter-spacing:-.2px">${esc(title)}</h2>
    ${p}${extra}
  </td></tr>`;
}

export function renderHtml(nl, { baseUrl = 'https://chainquant.net' } = {}) {
  const charts = { majors: majorsChart(nl.majors), narr: narrativeChart(nl.narratives) };
  const hist = nl.history || null;
  const priceCharts = hist ? ['BTC', 'ETH', 'SOL'].map((s) => {
    const c24 = priceChart24h(s, hist), c6 = priceChart6h(s, hist);
    if (!c24 && !c6) return '';
    return `<div style="margin-bottom:10px">
      ${c24 ? `<img src="${c24}" alt="${s} 24h price chart" width="100%" style="border-radius:6px;border:1px solid ${LINE};display:block">` : ''}
      ${c6 ? `<img src="${c6}" alt="${s} 6h price chart" width="100%" style="border-radius:6px;border:1px solid ${LINE};display:block;margin-top:6px">` : ''}
    </div>`;
  }).filter(Boolean).join('') : '';
  const priceChartBlock = priceCharts ? dataInset('Price action — 24h & 6h', priceCharts) : '';
  const sn = nl.snapshot || {};
  const sec = nl.sections || {};

  // price ribbon (majors)
  const ribbon = (nl.majors || []).map((m) => `<span style="white-space:nowrap"><span style="color:${TXT};font-weight:700">${esc(m.symbol)}</span> <span style="color:${TXT};font-family:'IBM Plex Mono',monospace">${fmtUsd(m.price)}</span> <span style="color:${pcol(m.change24h)}">${pct(m.change24h)}</span></span>`).join('<span style="color:#2a3342"> &nbsp;·&nbsp; </span>');

  // stats ribbon
  const stats = [
    ['Total mcap', fmtBig(sn.totalMcap), pct(sn.mcapChange24h), pcol(sn.mcapChange24h)],
    ['BTC dom', sn.btcDom != null ? sn.btcDom.toFixed(1) + '%' : 'n/a', '', MUT],
    ['ETH dom', sn.ethDom != null ? sn.ethDom.toFixed(1) + '%' : 'n/a', '', MUT],
    ['Fear & Greed', sn.fng ? `${sn.fng.value} ${sn.fng.label}` : 'n/a', '', sn.fng && /greed/i.test(sn.fng.label) ? GREEN : sn.fng && /fear/i.test(sn.fng.label) ? RED : MUT],
    ['DeFi TVL', sn.defiTvl ? fmtBig(sn.defiTvl.tvlUsd) : 'n/a', sn.defiTvl ? pct(sn.defiTvl.change24h) : '', sn.defiTvl ? pcol(sn.defiTvl.change24h) : MUT],
  ].map(([l, v, c, col]) => `<td style="padding:8px 10px;border:1px solid ${LINE};vertical-align:top"><div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${MUT}">${esc(l)}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:${TXT};font-weight:700;margin-top:2px">${esc(v)}${c ? ` <span style="font-size:10px;font-weight:400;color:${col}">${esc(c)}</span>` : ''}</div></td>`).join('');

  const quick = (nl.quickTake || []).map((b) => `<li style="margin:0 0 7px;color:${TXT};font-size:14px;line-height:1.5">${esc(b)}</li>`).join('');

  // data inset: top-10 table
  const topRows = (nl.topTable || []).map((t) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${TXT};font-weight:700;font-size:12px">${esc(t.symbol)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${TXT};font-family:'IBM Plex Mono',monospace;font-size:12px;text-align:right">${fmtUsd(t.price)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-size:12px;color:${pcol(t.change24h)}">${pct(t.change24h)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-size:12px;color:${pcol(t.change7d)}">${pct(t.change7d)}</td></tr>`).join('');
  const topTable = topRows ? dataInset('Markets — top 10', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr><th style="text-align:left;padding:5px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">Asset</th><th style="text-align:right;padding:5px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">Price</th><th style="text-align:right;padding:5px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">24h</th><th style="text-align:right;padding:5px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${MUT};border-bottom:1px solid ${LINE}">7d</th></tr>${topRows}</table>`) : '';

  const fundingLine = nl.funding ? `<p style="color:${MUT};font-size:12px;margin:4px 0 10px;font-family:'IBM Plex Mono',monospace">Perp funding (8h): ${['BTC', 'ETH', 'SOL'].map((k) => nl.funding[k] ? `${k} <span style="color:${pcol(nl.funding[k].fundingRate)}">${pct(nl.funding[k].fundingRate)}</span>` : '').filter(Boolean).join('  ·  ')}</p>` : '';

  // derivatives inset: open interest, long/short, liquidations
  const oi = nl.openInterest, ls = nl.longShort, liq = nl.liquidations;
  let derivInner = '';
  if (oi) derivInner += `<div style="color:${MUT};font-size:12px;margin-bottom:4px">Open interest (bets open): ${['BTC', 'ETH', 'SOL'].map((k) => oi[k]?.oiUsd ? `<span style="color:${TXT}">${k}</span> ${fmtBig(oi[k].oiUsd)}` : '').filter(Boolean).join(' · ')}</div>`;
  if (ls) derivInner += `<div style="color:${MUT};font-size:12px;margin-bottom:4px">Crowd positioning (BTC futures): <span style="color:${GREEN}">${ls.longPct?.toFixed(0)}% long</span> / <span style="color:${RED}">${ls.shortPct?.toFixed(0)}% short</span></div>`;
  if (liq) derivInner += `<div style="color:${MUT};font-size:12px">24h liquidations: ${['BTC', 'ETH', 'SOL'].map((k) => liq[k] ? `${k} ${fmtBig((liq[k].long24h || 0) + (liq[k].short24h || 0))}` : '').filter(Boolean).join(' · ')}</div>`;
  const derivInset = derivInner ? dataInset('Derivatives & positioning', `<div style="border:1px solid ${LINE};border-radius:8px;padding:10px 12px;background:${CARD}">${derivInner}</div>`) : '';

  const sb = nl.stablecoins;
  const stableLine = sb ? `<p style="color:${MUT};font-size:12px;margin:8px 0 0">Stablecoin "dry powder": <span style="color:${TXT};font-family:'IBM Plex Mono',monospace">${fmtBig(sb.totalUsd)}</span> <span style="color:${pcol(sb.change24h)}">${pct(sb.change24h)} 24h</span> — sideline cash ready to buy.</p>` : '';

  // sectors inset (real category rotation)
  const sectorInset = nl.sectors?.hot?.length ? dataInset('Sector rotation (24h)', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${nl.sectors.hot.slice(0, 6).map((s) => `<tr><td style="padding:5px 10px;border-bottom:1px solid ${LINE};color:${TXT};font-size:12px">${esc(cleanCat(s.name))}</td><td style="padding:5px 10px;border-bottom:1px solid ${LINE};text-align:right;font-size:12px;color:${pcol(s.change24h)}">${pct(s.change24h)}</td></tr>`).join('')}</table>`) : '';

  // trending searches inset
  const trendingInset = nl.trending?.length ? dataInset('Trending in searches', `<div style="font-size:12px;line-height:1.9">${nl.trending.slice(0, 6).map((x) => `<span style="display:inline-block;border:1px solid ${LINE};border-radius:14px;padding:2px 9px;margin:0 4px 4px 0;color:${TXT}">${esc(x.symbol)} <span style="color:${pcol(x.change24h)}">${pct(x.change24h)}</span></span>`).join('')}</div>`) : '';

  // reddit pulse inset
  const redditInset = nl.reddit?.length ? dataInset('Community pulse — r/CryptoCurrency', nl.reddit.slice(0, 4).map((p) => `<a href="${esc(p.url)}" style="display:block;color:${TXT};font-size:12px;text-decoration:none;margin-bottom:5px;line-height:1.4">↑ ${p.score} &nbsp;${esc(p.title)}</a>`).join('')) : '';

  // whale inset
  const whaleRows = (nl.whales || []).length ? nl.whales.map((w) => {
    const dir = /inflow/i.test(w.interpretation || '') ? ['INFLOW', RED] : /outflow/i.test(w.interpretation || '') ? ['OUTFLOW', GREEN] : ['TRANSFER', BLUE];
    return `<tr><td style="padding:10px 12px;border-bottom:1px solid ${LINE}">
        <span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:.5px;color:${BG};background:${dir[1]};border-radius:3px;padding:2px 5px">${dir[0]}</span>
        <span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${BLUE};border:1px solid ${LINE};border-radius:3px;padding:2px 5px;margin-left:3px">${esc(w.chain)}</span>
        <strong style="color:${TXT};margin-left:4px">${esc(w.asset)}</strong> <span style="color:${TXT};font-family:'IBM Plex Mono',monospace">${fmtBig(w.usd)}</span>
        <a href="${esc(w.txUrl)}" style="color:${BLUE};text-decoration:none;font-size:11px;margin-left:6px">tx →</a>
        <div style="color:${MUT};font-size:12px;margin-top:3px">${esc(w.entity)} — ${esc(w.interpretation || '')}</div></td></tr>`;
  }).join('') : `<tr><td style="padding:12px;color:${MUT};font-size:13px">No qualifying movements (≥ $1M with a verifiable transaction) in the past 24h.</td></tr>`;
  const whaleInset = dataInset('Tracked transfers ≥ $1M', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;overflow:hidden">${whaleRows}</table>`);

  // narrative inset
  const narrInset = (nl.narratives || []).length ? dataInset('Momentum board', (nl.narratives).map((n, i) => {
    const max = Math.max(...nl.narratives.map((x) => x.momentum || 0), 1);
    const w = Math.round(((n.momentum || 0) / max) * 100);
    return `<div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between"><span style="color:${TXT};font-size:13px;font-weight:600">${i + 1}. ${esc(n.narrative)}</span><span style="color:${BLUE};font-family:'IBM Plex Mono',monospace;font-size:11px">${esc(n.momentum)}</span></div>
        <div style="height:5px;background:${CARD2};border-radius:3px;margin:5px 0;overflow:hidden"><div style="height:5px;width:${w}%;background:${BLUE}"></div></div>
        ${n.takeaway ? `<div style="color:${MUT};font-size:12px;line-height:1.5;margin-bottom:3px">${esc(n.takeaway)}</div>` : ''}
        ${(n.evidence || []).slice(0, 2).map((e) => `<a href="${esc(e.url)}" style="color:${BLUE};font-size:11px;text-decoration:none;display:block">• ${esc(e.label)}</a>`).join('')}</div>`;
  }).join('') + (charts.narr ? `<img src="${charts.narr}" alt="narrative momentum" width="100%" style="margin-top:6px;border-radius:6px;border:1px solid ${LINE}">` : '')) : '';

  const levelRows = (nl.keyLevels || []).map((k) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${TXT};font-weight:700;font-size:12px">${esc(k.asset)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${TXT};font-family:'IBM Plex Mono',monospace;font-size:12px;white-space:nowrap">${esc(k.level)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${MUT};font-size:12px">${esc(k.meaning)}</td></tr>`).join('');
  const levelsInset = levelRows ? dataInset('Key levels', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${levelRows}</table>`) : '';

  const jargonInset = (nl.jargon || []).length ? dataInset('Plain-English glossary', `<div style="border:1px solid ${LINE};border-radius:8px;padding:12px 14px;background:${CARD}">${(nl.jargon).map((j) => `<div style="margin-bottom:7px"><span style="color:${BLUE};font-weight:700;font-size:12px">${esc(j.term)}</span> <span style="color:${MUT};font-size:12px">— ${esc(j.plain)}</span></div>`).join('')}</div>`) : '';

  const watch = (nl.watchlist || []).map((w) => `<li style="margin:0 0 6px;color:${TXT};font-size:14px;line-height:1.5">${esc(w)}</li>`).join('');
  const watchInset = watch ? dataInset('On the radar', `<ul style="margin:0;padding-left:18px">${watch}</ul>`) : '';

  const sources = (nl.sources || []).map((s) => `<li style="margin:0 0 4px"><a href="${esc(s.url)}" style="color:${BLUE};text-decoration:none">${esc(s.label)}</a></li>`).join('');

  const majorsChartImg = charts.majors ? `<img src="${charts.majors}" alt="24h change" width="100%" style="margin:6px 0 4px;border-radius:6px;border:1px solid ${LINE}">` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>ChainQuant Daily Intelligence</title>
<style>
  @media (max-width:600px){ .wrap{width:100%!important} .pad{padding:18px!important} .ribbon td,.stat td{display:block!important;width:100%!important;box-sizing:border-box} h1{font-size:22px!important} }
  body{margin:0;background:${BG};-webkit-text-size-adjust:100%} a{word-break:break-word}
</style></head>
<body style="margin:0;background:${BG};font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TXT}">
<div style="display:none;max-height:0px;overflow:hidden;mso-hide:all">${esc(nl.standfirst || nl.headline || 'ChainQuant Daily Intelligence')}</div>
<div style="display:none;max-height:0px;overflow:hidden;mso-hide:all">${'&#8203;&#847;&#8203;&#847;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:${BG};border:1px solid ${LINE};border-radius:14px;overflow:hidden">

  <!-- masthead + headline -->
  <tr><td class="pad" style="padding:22px 30px 18px;border-bottom:1px solid ${LINE}">
    <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${BLUE}">ChainQuant Daily Intelligence</div>
    <h1 style="font-size:26px;line-height:1.22;font-weight:800;color:${TXT};margin:12px 0 10px;letter-spacing:-.5px">${esc(nl.headline || '')}</h1>
    ${nl.standfirst ? `<div style="font-size:15px;line-height:1.5;color:${MUT};margin-bottom:12px">${esc(nl.standfirst)}</div>` : ''}
    <div style="font-size:12px;color:${MUT};border-top:1px solid ${LINE};padding-top:10px">By the <span style="color:${TXT}">ChainQuant Intelligence Desk</span> · Markets · <span style="font-family:'IBM Plex Mono',monospace">${esc(nl.date || '')}</span></div>
  </td></tr>

  <!-- price ribbon -->
  <tr><td class="pad" style="padding:12px 30px;border-bottom:1px solid ${LINE};background:${CARD2}">
    <div style="font-size:13px;line-height:1.8">${ribbon}</div>
  </td></tr>
  <tr><td class="pad" style="padding:12px 30px;border-bottom:1px solid ${LINE}">
    <table role="presentation" class="stat" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${stats}</tr></table>
  </td></tr>

  <!-- Quick Take -->
  <tr><td class="pad" style="padding:18px 30px 6px">
    <div style="border:1px solid ${LINE};border-left:3px solid ${BLUE};border-radius:8px;padding:14px 16px;background:${CARD}">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${BLUE};margin-bottom:8px">Executive Summary</div>
      <ul style="margin:0;padding-left:18px">${quick || `<li style="color:${MUT}">No summary available.</li>`}</ul>
    </div>
  </td></tr>
  <tr><td style="height:6px"></td></tr>

  <!-- editorial sections with embedded data -->
  ${section(sec.backdrop?.title || 'Overnight Market Summary', sec.backdrop?.body, majorsChartImg + priceChartBlock + topTable)}
  ${sec.macro?.body ? section(sec.macro?.title || 'The Macro Read', sec.macro?.body) : ''}
  ${section(sec.flows?.title || 'Flows & Positioning', sec.flows?.body, fundingLine + derivInset + stableLine)}
  ${section(sec.onchain?.title || 'Top Whale Movements — Past 24H', sec.onchain?.body, whaleInset)}
  ${section(sec.narratives?.title || 'Trending Narratives', sec.narratives?.body, sectorInset + trendingInset + narrInset + redditInset)}
  ${sec.levels?.body ? section(sec.levels?.title || 'Levels & Risk', sec.levels?.body, levelsInset) : ''}
  ${sec.contrarian?.body ? section(sec.contrarian?.title || 'The Other Side of the Trade', sec.contrarian?.body) : ''}
  ${section(sec.weekAhead?.title || 'Watchlist for Today', sec.weekAhead?.body, watchInset + jargonInset)}

  <!-- sources -->
  <tr><td class="pad" style="padding:18px 30px;border-bottom:1px solid ${LINE}">
    <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${BLUE};margin-bottom:8px">Sources</div>
    <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.5">${sources || `<li style="color:${MUT}">—</li>`}</ul>
  </td></tr>

  <!-- disclaimer -->
  <tr><td class="pad" style="padding:18px 30px;background:${CARD}">
    <p style="color:${MUT};font-size:11px;line-height:1.5;margin:0 0 10px">${esc(DISCLAIMER)}</p>
    <p style="color:${MUT};font-size:11px;margin:0">ChainQuant · <a href="${esc(baseUrl)}" style="color:${BLUE};text-decoration:none">chainquant.net</a> · <a href="${UNSUB}" style="color:${MUT};text-decoration:underline">Unsubscribe</a></p>
  </td></tr>

</table></td></tr></table></body></html>`;
}

function dataInset(caption, inner) {
  return `<div style="margin:6px 0 4px"><div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${MUT};margin-bottom:6px">${esc(caption)}</div>${inner}</div>`;
}

export function renderText(nl) {
  const sn = nl.snapshot || {}, sec = nl.sections || {};
  const L = ['CHAINQUANT DAILY INTELLIGENCE', '', (nl.headline || '').toUpperCase(), nl.standfirst || '', `By the ChainQuant Intelligence Desk · ${nl.date || ''}`, ''];
  L.push((nl.majors || []).map((m) => `${m.symbol} ${fmtUsd(m.price)} ${pct(m.change24h)}`).join('  ·  '));
  L.push(`mcap ${fmtBig(sn.totalMcap)} (${pct(sn.mcapChange24h)}) · BTC dom ${sn.btcDom?.toFixed(1)}% · F&G ${sn.fng?.value} ${sn.fng?.label}`, '');
  L.push('QUICK TAKE'); (nl.quickTake || []).forEach((b) => L.push(` - ${b}`)); L.push('');
  for (const k of ['backdrop', 'macro', 'flows', 'onchain', 'narratives', 'levels', 'contrarian', 'weekAhead']) {
    const s = sec[k]; if (!s) continue;
    L.push((s.title || k).toUpperCase()); paras(s.body).forEach((p) => L.push(p)); L.push('');
  }
  if ((nl.whales || []).length) { L.push('TRACKED TRANSFERS ≥ $1M'); nl.whales.forEach((w) => L.push(`  [${w.chain}] ${w.asset} ${fmtBig(w.usd)} — ${w.interpretation} — ${w.txUrl}`)); L.push(''); }
  if ((nl.narratives || []).length) { L.push('MOMENTUM BOARD'); nl.narratives.forEach((n, i) => L.push(`  ${i + 1}. ${n.narrative} (${n.momentum})${n.takeaway ? ' — ' + n.takeaway : ''}`)); L.push(''); }
  if ((nl.watchlist || []).length) { L.push('ON THE RADAR'); nl.watchlist.forEach((w) => L.push(` - ${w}`)); L.push(''); }
  L.push('SOURCES'); (nl.sources || []).forEach((s) => L.push(` - ${s.label}: ${s.url}`));
  L.push('', DISCLAIMER, '', `Unsubscribe: ${UNSUB}`);
  return L.join('\n');
}

export { UNSUB, DISCLAIMER };
