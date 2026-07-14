// Charts are built from OUR OWN data and rendered as PNG via a chart service.
// PNG-by-URL is used (not inline SVG or base64) because Gmail/Outlook strip both;
// a hosted PNG <img> is the only thing that reliably renders in every email client.
// Default service is QuickChart (free, public). To self-host, set CHART_BASE_URL
// to your own QuickChart instance — same API, no code change.
import { config } from '../config.js';

const QC = (config.app.chartBase || 'https://quickchart.io/chart').replace(/\/$/, '');
const BLUE = '#1AA3FF', GREEN = '#2BC26E', RED = '#ff5470', TICK = '#8b97a8';
const GRID = 'rgba(255,255,255,0.06)';

function chartUrl(cfg, { w = 600, h = 260, bg = '#0b0f17' } = {}) {
  return `${QC}?w=${w}&h=${h}&bkg=${encodeURIComponent(bg)}&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

/** Price line for one asset over a window. series = [{t,p}]. */
export function priceChart(symbol, series, { hours = 24, w = 600, h = 200 } = {}) {
  const pts = (series || []).filter((x) => Number.isFinite(x.p));
  if (pts.length < 2) return null;
  const up = pts.at(-1).p >= pts[0].p;
  const color = up ? GREEN : RED;
  const labels = pts.map((x) => new Date(x.t).toISOString().slice(11, 16)); // HH:MM
  const every = Math.max(1, Math.floor(pts.length / 6));
  return chartUrl({
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: pts.map((x) => x.p),
        borderColor: color, borderWidth: 2, pointRadius: 0,
        fill: true, backgroundColor: up ? 'rgba(43,194,110,0.10)' : 'rgba(255,84,112,0.10)',
        tension: 0.25,
      }],
    },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: `${symbol} — last ${hours}h (UTC)`, color: TICK, font: { size: 12 } } },
      scales: {
        x: { ticks: { color: TICK, maxTicksLimit: 6, callback: (v, i) => (i % every === 0 ? labels[i] : '') }, grid: { display: false } },
        y: { ticks: { color: TICK }, grid: { color: GRID } },
      },
    },
  }, { w, h });
}

/** Convenience wrappers used by the renderer. */
export const priceChart24h = (sym, hist) => priceChart(sym, hist?.[sym]?.h24, { hours: 24 });
export const priceChart6h = (sym, hist) => priceChart(sym, hist?.[sym]?.h6, { hours: 6 });

/** 24h % change bars for the majors. */
export function majorsChart(majors = []) {
  const rows = (majors || []).filter((m) => Number.isFinite(m.change24h));
  if (!rows.length) return null;
  return chartUrl({
    type: 'bar',
    data: { labels: rows.map((m) => m.symbol), datasets: [{ data: rows.map((m) => +m.change24h.toFixed(2)), backgroundColor: rows.map((m) => (m.change24h >= 0 ? GREEN : RED)), borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: '24h change (%)', color: TICK, font: { size: 12 } } },
      scales: { x: { ticks: { color: TICK }, grid: { display: false } }, y: { ticks: { color: TICK }, grid: { color: GRID } } },
    },
  }, { h: 200 });
}

/** Narrative momentum bars. */
export function narrativeChart(narratives = []) {
  const rows = (narratives || []).filter((n) => Number.isFinite(n.momentum)).slice(0, 6);
  if (!rows.length) return null;
  return chartUrl({
    type: 'horizontalBar',
    data: { labels: rows.map((n) => n.narrative), datasets: [{ data: rows.map((n) => n.momentum), backgroundColor: BLUE, borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: 'Narrative momentum', color: TICK, font: { size: 12 } } },
      scales: { x: { ticks: { color: TICK }, grid: { color: GRID } }, y: { ticks: { color: TICK }, grid: { display: false } } },
    },
  }, { h: 280 });
}
