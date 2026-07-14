import Parser from 'rss-parser';
import { log } from '../lib/logger.js';

const parser = new Parser({ timeout: 12_000 });

// Public RSS feeds these outlets publish for syndication (no scraping/paywall bypass).
const FEEDS = [
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'DL News', url: 'https://www.dlnews.com/arc/outboundfeeds/rss/' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
];

/** Returns { items, sources }; items are recent headlines with real article URLs. */
export async function collectNews() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const items = [];

  const settled = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items || []).map((it) => ({
        outlet: f.name,
        title: it.title?.trim(),
        url: it.link,
        published_at: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        snippet: (it.contentSnippet || '').slice(0, 280),
      }));
    })
  );

  for (const r of settled) {
    if (r.status === 'fulfilled') items.push(...r.value);
    else log.warn('news feed failed', { e: r.reason?.message });
  }

  const recent = items
    .filter((i) => i.title && i.url && i.published_at && new Date(i.published_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 15);

  const sources = recent.map((i) => ({
    source_type: 'news', title: `${i.outlet}: ${i.title}`, url: i.url,
    published_at: i.published_at, confidence: 0.9, data: { snippet: i.snippet },
  }));

  return { items: recent, sources };
}
