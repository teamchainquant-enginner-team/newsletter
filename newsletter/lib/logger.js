// Minimal structured logger. Swap for Winston if you want file transports —
// the interface (info/warn/error/step) is intentionally Winston-compatible.
const ts = () => new Date().toISOString();
const line = (level, msg, meta) =>
  `${ts()} [${level}] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;

export const log = {
  info: (msg, meta) => console.log(line('info', msg, meta)),
  warn: (msg, meta) => console.warn(line('warn', msg, meta)),
  error: (msg, meta) => console.error(line('error', msg, meta)),
  // Times a pipeline step and logs start/finish/fail uniformly.
  async step(name, fn) {
    const t0 = Date.now();
    this.info(`▶ ${name}`);
    try {
      const out = await fn();
      this.info(`✓ ${name}`, { ms: Date.now() - t0 });
      return out;
    } catch (err) {
      this.error(`✗ ${name}`, { ms: Date.now() - t0, error: err.message });
      throw err;
    }
  },
};
