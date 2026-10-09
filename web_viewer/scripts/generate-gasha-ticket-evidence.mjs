import fs from 'node:fs'
import {buildGashaTicketEvidence,applyGashaTicketReview} from './lib/gasha-ticket-evidence.mjs'
import {sourceUnits,loadGeneralRevisions} from './lib/general-translation-batches.mjs'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const evidence=buildGashaTicketEvidence(read('public/data/masterdata/domains/item_catalog.json').entries,read('public/data/masterdata/gasha_index.json'),read('public/translations/zh-CN/archive-general/items.json').entries,read('config/gasha-ticket-name-aliases.json'),read('public/data/masterdata/domains/collection_media.json').entries)
const revisions=loadGeneralRevisions(process.cwd(),sourceUnits(process.cwd()))
applyGashaTicketReview(evidence,revisions)
fs.writeFileSync('public/data/editorial/gasha-ticket-evidence.json',JSON.stringify(evidence,null,2)+'\n')
console.log(JSON.stringify({summary:evidence.summary,unresolved:evidence.unresolved,groups:evidence.rows.map(r=>({source:r.source_name,translation:r.translation,matched:r.matched_ids,tickets:r.tickets.length}))},null,2))
