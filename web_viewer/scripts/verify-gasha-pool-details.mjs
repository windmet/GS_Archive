// Checks the per-gasha rule and art files: they rebuild exactly from their sources, every ticket-only pool is named
// once in config/gasha-pool-media.v1.json, every wiki fact reads as a Chinese statement, and (when the local media
// package is present) each art file matches the hash the media index records.
//   node scripts/verify-gasha-pool-details.mjs [--require-media]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {buildGashaPoolDetails} from './lib/gasha-pool-details.mjs'
import {gashaRuleGroups} from '../src/presentation/gashaRuleFacts.js'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }
const out = 'public/data/editorial/gasha-pools'
const config = read('config/gasha-pool-media.v1.json')
const media = read('public/data/editorial/gasha-pool-media.json')
const tickets = read('public/data/editorial/gasha-ticket-evidence.json')
const pages = read('public/data/editorial/wiki-gasha-pages.json')

const {details, index} = buildGashaPoolDetails({pages, media, config, tickets,
  gashaIndex: read('public/data/masterdata/gasha_index.json'), cardIndex: read('public/data/masterdata/card_index.json')})
const committed = new Set(fs.readdirSync(out).filter(name => name !== 'index.json'))
for (const [id, detail] of Object.entries(details)) {
  const file = `${id}.json`
  check(committed.delete(file), `${file}: missing`)
  if (fs.existsSync(path.join(out, file))) check(fs.readFileSync(path.join(out, file), 'utf8') === JSON.stringify(detail) + '\n', `${file}: differs from a rebuild`)
}
check(!committed.size, `stale detail files: ${[...committed].join(', ')}`)
check(fs.readFileSync(path.join(out, 'index.json'), 'utf8') === JSON.stringify(index, null, 1) + '\n', 'index.json differs from a rebuild')

// Ticket-only pools: each is named once, as a pool with art or as unresolved.
const ticketOnly = tickets.rows.filter(row => !row.matched_ids.length).map(row => row.id)
const named = [...config.pools.map(pool => pool.pool), ...config.unresolved.flatMap(row => row.pools)]
for (const id of ticketOnly) check(named.filter(value => value === id).length === 1, `${id}: named ${named.filter(value => value === id).length} times in the media config`)
check(named.every(id => ticketOnly.includes(id)), 'media config names a pool that is not ticket-only')
const configHash = crypto.createHash('sha256').update(fs.readFileSync('config/gasha-pool-media.v1.json')).digest('hex')
check(media.config?.sha256 === configHash, 'gasha-pool-media.json was prepared from another config; rerun scripts/prepare-gasha-pool-media.py')

// Every fact the extractor recognised has a Chinese statement.
const names = {gashaName: value => value, itemName: value => value}
let facts = 0, statements = 0
for (const page of pages.pages) {
  facts += page.facts.length
  for (const fact of page.facts) check(gashaRuleGroups([fact], page.title, names).length === 1, `${page.title}: no statement for ${fact.kind} 「${fact.line}」`)
  // Sections often restate a rule; the page shows each statement once.
  statements += gashaRuleGroups(page.facts, page.title, names).reduce((sum, group) => sum + group.items.length, 0)
}

// Art files, when this checkout has the local media package (public/assets is not tracked).
let hashed = 0
const assets = Object.values(media.media).flatMap(entry => Object.values(entry))
const present = fs.existsSync('public/assets/gasha-pool')
check(present || !process.argv.includes('--require-media'), 'public/assets/gasha-pool is missing')
if (present) for (const asset of assets) {
  const file = path.join('public', asset.url)
  if (!fs.existsSync(file)) { failures.push(`${asset.url}: missing`); continue }
  check(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === asset.sha256, `${asset.url}: hash differs`)
  hashed++
}

console.log(JSON.stringify({details: Object.keys(details).length, ticket_only: ticketOnly.length, facts, statements, media_files: assets.length, hashed}))
if (failures.length) { console.error(failures.slice(0, 40).join('\n')); console.error(`${failures.length} failure(s)`); process.exit(1) }
console.log('gasha pool details ok')
