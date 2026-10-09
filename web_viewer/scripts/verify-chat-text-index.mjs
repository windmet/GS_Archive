import { execFileSync } from 'node:child_process'

// The tracked chat text index must match the local chat corpus (public/data/compiled).
execFileSync(process.execPath, ['scripts/generate-chat-text-index.mjs', '--check'], { stdio: 'inherit' })
