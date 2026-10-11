import assert from 'node:assert/strict'
import fs from 'node:fs'
import {buildGashaTicketEvidence,applyGashaTicketReview,ticketGashaName,sourceHash,normalizeGashaName} from './lib/gasha-ticket-evidence.mjs'
import {supplementGashaCatalog,attachGashaTickets,gashaTicketLinks,translatedGashaName,gashaTicketPeriodLabel} from '../src/data/gashaTicketCatalog.js'
import {filterGashaCatalog,buildGashaCategoryOptions} from '../src/data/gashaCatalog.js'
import {validateItemIdolNames} from './lib/item-idol-name-policy.mjs'
import {sourceUnits,loadGeneralRevisions,protectedTokens} from './lib/general-translation-batches.mjs'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const items=read('public/data/masterdata/domains/item_catalog.json').entries,index=read('public/data/masterdata/gasha_index.json'),overlay=read('public/data/editorial/gasha-ticket-evidence.json'),translations=read('public/translations/zh-CN/archive-general/items.json').entries
const revisions=loadGeneralRevisions(process.cwd(),sourceUnits(process.cwd()))
assert.deepEqual(overlay,applyGashaTicketReview(buildGashaTicketEvidence(items,index,translations,read('config/gasha-ticket-name-aliases.json'),read('public/data/masterdata/domains/collection_media.json').entries),revisions),'Regenerate stale ticket evidence')
assert.equal(overlay.unresolved.length,0)
const before=JSON.stringify(index),base=index.gashas.filter(g=>g.phase==='primary'),catalog=supplementGashaCatalog(base,index.meta)
assert.equal(catalog.rows.length,82);assert.equal(new Set(catalog.rows.map(r=>r.id)).size,82)
assert.equal(catalog.summary.ticket_supplement_count,25);assert.equal(catalog.summary.gasha_count,61)
assert.equal(catalog.summary.derived_pickup_count,336)
assert.equal(buildGashaCategoryOptions({meta:catalog.summary},catalog.rows).find(o=>o.value==='ticket_named').count,25)
assert.equal(JSON.stringify(index),before)
const itemMap=new Map(items.map(item=>[String(item.id),item])),covered=new Set()
for(const row of overlay.rows){
 assert.equal(row.source_hash,sourceHash(row.source_name))
 assert.deepEqual(protectedTokens(row.translation),protectedTokens(row.source_name),'Pool name numeric identity')
 for(const ticket of row.tickets){
  assert(!covered.has(ticket.id),'One ticket must not bind to conflicting pools');covered.add(ticket.id)
  const original=itemMap.get(ticket.id)
  assert.equal(ticket.source_name,original.nameJa);assert.equal(ticket.source_hash,sourceHash(original.nameJa))
  assert.equal(ticket.source_description,original.descriptionText?.plain||'');assert.equal(ticket.description_hash,sourceHash(ticket.source_description))
  assert.equal(ticket.translation,translations.item.name[original.nameJa])
  assert(ticket.image?.url?.startsWith('/assets/domain-images/')&&ticket.image.width>0&&ticket.image.height>0,`Ticket icon ${ticket.id}`)
  const links=gashaTicketLinks(ticket.id)
  assert(links.length)
  for(const link of links)assert(catalog.rows.some(pool=>pool.id===link.id),'Every item link has a reachable catalog detail')
 }
 assert.equal(translatedGashaName(row.source_name,'zh-CN'),row.translation)
 assert.equal(translatedGashaName(row.source_name,'ja-JP'),row.source_name)
 if(!row.matched_ids.length){const pool=catalog.rows.find(p=>p.id===row.id);assert.equal(pool.start_at,null);assert.equal(pool.end_at,null);assert.deepEqual(pool.derived_pickup_cards,[]);assert.equal(pool.banner_url,null)}
}
assert.equal(covered.size,273)
assert.equal(overlay.excluded_tickets.length,2)
assert.equal(ticketGashaName('スタンプガシャセレクションチケット'),null)
const bonus=items.find(item=>item.nameJa.startsWith('彩光の欠片 SSR付き！'))
assert(bonus);assert.equal(gashaTicketLinks(bonus.id)[0]?.display_name,'朱く染まる湯の街 温泉旅館物語ガシャ')
assert.deepEqual(gashaTicketLinks('no-item'),[])
assert.equal(ticketGashaName('FES限定彩光の欠片'),null)
assert.equal(ticketGashaName('プラチナSRスカウトチケット'),null)
assert.notEqual(normalizeGashaName('新生活を彩る一品 文房具コラボガシャ'),normalizeGashaName('新生活を彩る一品 文房具コラボスタンプガシャ'))
const stage=overlay.rows.find(r=>r.matched_ids.length>1)
assert.equal(stage.tickets.length,8);assert.equal(gashaTicketLinks(stage.tickets[0].id).length,2)
assert(gashaTicketLinks(stage.tickets[0].id).every(link=>link.ambiguous))
for(const link of gashaTicketLinks(stage.tickets[0].id))assert.equal(link.start_at,base.find(pool=>String(pool.id)===link.id).start_at)
assert.deepEqual(gashaTicketLinks(stage.tickets[0].id).map(link=>gashaTicketPeriodLabel(link.start_at)),['2022年10月1日','2022年12月4日'])
assert.equal(gashaTicketPeriodLabel(null),'')
for(const pool of base)assert.equal(attachGashaTickets(pool).tickets.length,pool.category==='stage_step_up'?8:overlay.rows.find(r=>r.matched_ids.includes(String(pool.id))).tickets.length)
const stale={...base[0],display_name:base[0].display_name+'changed'};assert.equal(attachGashaTickets(stale),stale)
assert(filterGashaCatalog(catalog.rows,{query:'幻影的Masquerade',nameSearchText:source=>source+' '+translatedGashaName(source)}).some(row=>row.source_type==='item-masterdata'))
assert.equal([...revisions.values()].filter(e=>e.kind==='item').length,857)
for(const e of revisions.values())if(e.kind==='item')validateItemIdolNames(e.source,e.translation,e.decision)
assert.throws(()=>validateItemIdolNames('大河 タケルの感謝のきもち','大河猛的心意'))
assert.throws(()=>validateItemIdolNames('タケルとお揃いのリストバンド','猛同款的护腕'))
assert.throws(()=>validateItemIdolNames('キリオの贈り物','桐绪的礼物'))
assert.throws(()=>validateItemIdolNames('天ヶ瀬 冬馬の贈り物','天之濑冬马的礼物'))
assert.equal([...revisions.values()].filter(e=>e.kind==='costume'&&e.status==='reviewed').length,496)
const audit=read('config/translation-audit/general-gasha.json')
assert.equal(audit.length,81)
for(const row of audit){
 const evidence=overlay.rows.find(pool=>pool.source_hash===row.sourceHash)
 assert(evidence&&row.status===evidence.status&&row.references.length&&row.sourceHash===sourceHash(row.source))
 if(row.status==='reviewed')assert.equal(revisions.get(`metadata:v1:item:name:${sourceHash(evidence.tickets.find(ticket=>ticket.id===evidence.translation_item_id).source_name)}`).status,'reviewed')
}
console.log('PASS: 857 item fields, fixed idol names, 273 tickets with verified icons, 81 pool names / 82 catalog records, 25 supplements; exact source and hashes, unresolved STAGE identity, no fabricated dates/cards, bilingual search and bidirectional reachable links.')
