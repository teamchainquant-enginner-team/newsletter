// Daily entrypoint used by cron / GitHub Actions (`npm run run:once`).
// Wraps runPipeline with real error handling so failures print a READABLE
// reason instead of Node's useless "UnhandledPromiseRejection #<Object>".
import { assertCoreEnv } from './config.js';

// Fail fast and clearly if the essential env is missing (the usual cause).
try {
  assertCoreEnv();
} catch (e) {
  console.error('\n❌ Cannot start: ' + e.message);
  console.error('   Add these as GitHub repo secrets (or .env locally):');
  console.error('   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const { runPipeline } = await import('./pipeline.js');

try {
  const result = await runPipeline({ trigger: process.env.GITHUB_ACTIONS ? 'cron' : 'manual' });
  if (result?.skipped) {
    console.log('\nℹ️  Skipped — a newsletter was already sent for today.\n');
  } else {
    console.log(`\n✅ Done — status: ${result?.status || 'complete'}${result?.id ? `  (run ${result.id})` : ''}\n`);
  }
  process.exit(0);
} catch (err) {
  // Supabase and fetch errors often reject with an object, not an Error —
  // dig out something human-readable instead of "#<Object>".
  const msg = err?.message || err?.error?.message || err?.details || err?.hint || JSON.stringify(err);
  console.error('\n❌ Pipeline failed: ' + msg);
  if (err?.code) console.error('   code: ' + err.code);
  if (err?.stack && err.message) console.error(err.stack);
  process.exit(1);
}
