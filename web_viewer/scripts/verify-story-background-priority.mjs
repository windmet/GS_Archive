// A persistent rolling window replaces one-shot deferred draining.
// Keep the existing CI entry point; execute the replacement behavior regressions.
await import('./repair/warmup-window.test.mjs')
