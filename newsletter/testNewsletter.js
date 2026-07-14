// Generates a complete sample newsletter WITHOUT touching the DB, network, or
// sending anything. Writes HTML + text to ./out for visual review.
import { writeFileSync, mkdirSync } from 'node:fs';
import { writeNewsletter } from './core/aiWriter.js';
import { validateCitations } from './core/citationValidator.js';
import { renderHtml, renderText } from './core/renderEmail.js';
import { mockCollected } from './mockData.js';

async function main() {
  const newsletter = await writeNewsletter(mockCollected); // no AI key => templated
  const { newsletter: clean, report } = validateCitations(newsletter, mockCollected);
  const html = renderHtml(clean, { baseUrl: 'https://chainquant.net' });
  const text = renderText(clean);

  mkdirSync('./out', { recursive: true });
  writeFileSync('./out/sample.html', html);
  writeFileSync('./out/sample.txt', text);

  console.log('Sample newsletter generated:');
  console.log('  subject :', clean.subject);
  console.log('  whales  :', clean.whales.length);
  console.log('  narrs   :', clean.narratives.length);
  console.log('  sources :', clean.sources.length);
  console.log('  validator removed:', JSON.stringify(report));
  console.log('  → ./out/sample.html  (open in a browser)');
  console.log('  → ./out/sample.txt');
}
main().catch((e) => { console.error(e); process.exit(1); });
