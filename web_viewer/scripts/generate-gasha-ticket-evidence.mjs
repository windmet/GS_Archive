import fs from 'node:fs'
import {buildGashaTicketEvidence} from './lib/gasha-ticket-evidence.mjs'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const evidence=buildGashaTicketEvidence(read('public/data/masterdata/domains/item_catalog.json').entries,read('public/data/masterdata/gasha_index.json'),read('public/translations/zh-CN/archive-general/items.json').entries,read('config/gasha-ticket-name-aliases.json'))
fs.writeFileSync('public/data/editorial/gasha-ticket-evidence.json',JSON.stringify(evidence,null,2)+'\n')
console.log(JSON.stringify({summary:evidence.summary,unresolved:evidence.unresolved,groups:evidence.rows.map(r=>({source:r.source_name,translation:r.translation,matched:r.matched_ids,tickets:r.tickets.length}))},null,2))
