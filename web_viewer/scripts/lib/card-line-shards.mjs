import fs from 'node:fs'
import path from 'node:path'
import {cardLineShardFile, splitCardLineEntries} from '../../src/presentation/CardLineShards.mjs'

const render = shard => JSON.stringify(shard) + '\n'

// The published per-line shards for one card-lines overlay; whole directory replaced, so a
// re-split never leaves a stale shard behind.
export function writeCardLineShards(directory, entries) {
  const target = path.join(directory, 'card-lines')
  fs.rmSync(target, {recursive: true, force: true})
  fs.mkdirSync(target, {recursive: true})
  for (const [key, shard] of Object.entries(splitCardLineEntries(entries)))
    fs.writeFileSync(path.join(directory, cardLineShardFile(key)), render(shard))
}

// Drift between card-lines.json and its shards: [] when in sync.
export function cardLineShardDrift(directory, entries) {
  const expected = splitCardLineEntries(entries), drift = []
  const present = fs.existsSync(path.join(directory, 'card-lines')) ? fs.readdirSync(path.join(directory, 'card-lines')) : []
  for (const name of present) if (!Object.hasOwn(expected, name.replace(/\.json$/, ''))) drift.push(`unexpected ${name}`)
  for (const [key, shard] of Object.entries(expected)) {
    const file = path.join(directory, cardLineShardFile(key))
    if (!fs.existsSync(file)) drift.push(`missing ${key}`)
    else if (fs.readFileSync(file, 'utf8') !== render(shard)) drift.push(`stale ${key}`)
  }
  return drift
}
