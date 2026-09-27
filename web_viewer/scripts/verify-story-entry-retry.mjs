// Source validation and renderer failure are distinct recovery boundaries.
// Keep the existing CI entry point; execute the replacement behavior regressions.
await import('./repair/player-entry.test.mjs')
