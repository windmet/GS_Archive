// The old test stripped imports with regular expressions and re-created a
// different function in a Function constructor. Exercise the real ESM boundary.
// Existing CI's --source/--expect candidate arguments remain accepted.
if (process.argv.includes('--expect') && process.argv[process.argv.indexOf('--expect') + 1] !== 'candidate') {
  throw new Error('Historical baseline reproduction is not the candidate verification path')
}
await import('./repair/voice-backends.test.mjs')
