import fs from 'node:fs'
import path from 'node:path'
import {cardLineShardDrift, writeCardLineShards} from './lib/card-line-shards.mjs'

// Re-split card-lines.json into the per-line shards pages read. generate-archive-general-translations
// does this itself; run this after editing card-lines.json any other way. --check only reports drift.
const directory = path.resolve(import.meta.dirname, '../public/translations/zh-CN/archive-general')
const {entries} = JSON.parse(fs.readFileSync(path.join(directory, 'card-lines.json'), 'utf8'))
if (process.argv.includes('--check')) {
  const drift = cardLineShardDrift(directory, entries)
  if (drift.length) { console.error(`Card line shards out of date (${drift.slice(0, 5).join(', ')}); run node scripts/generate-card-line-shards.mjs`); process.exit(1) }
  console.log('Card line shards match card-lines.json')
} else {
  writeCardLineShards(directory, entries)
  console.log('Card line shards written')
}
