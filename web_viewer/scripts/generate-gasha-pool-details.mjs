// Per-gasha detail files: the pool's wiki page (rules, exchange, step-up prices, source text) and, for ticket-only
// pools, the client's own art. Written to public/data/editorial/gasha-pools/<gasha id>.json and fetched only when a
// gasha opens; index.json (imported by the catalogue) lists which ids have one and the art for ticket-only pools.
import fs from 'node:fs'
import path from 'node:path'
import {buildGashaPoolDetails} from './lib/gasha-pool-details.mjs'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const out = 'public/data/editorial/gasha-pools'
const {details, index} = buildGashaPoolDetails({
  pages: read('public/data/editorial/wiki-gasha-pages.json'),
  media: read('public/data/editorial/gasha-pool-media.json'),
  config: read('config/gasha-pool-media.v1.json'),
  gashaIndex: read('public/data/masterdata/gasha_index.json'),
  tickets: read('public/data/editorial/gasha-ticket-evidence.json'),
  cardIndex: read('public/data/masterdata/card_index.json'),
})
fs.rmSync(out, {recursive: true, force: true})
fs.mkdirSync(out, {recursive: true})
for (const [id, detail] of Object.entries(details)) fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify(detail) + '\n')
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n')
console.log(JSON.stringify(index.summary))
