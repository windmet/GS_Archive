import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const file='public/data/editorial/carnival-wiki-source.json',bytes=fs.readFileSync(file)
const wiki=read(file),events=read('public/data/masterdata/domains/event_supplement_index.json').entries.filter(e=>e.eventKind==='collection')
const cards=read('public/data/masterdata/card_index.json').cards,idols=read('public/data/masterdata/idol_unit_dictionary.json').idols
const compact=s=>s.replace(/\s/g,'').replace('アスラン＝ベルゼビュートⅡ世','アスラン=BBⅡ世')
const output=[]
assert.equal(wiki.events.length,events.length)
for(const event of events){
 const date=new Date(event.term.openAt*1000),source=wiki.events.find(row=>row.year===date.getUTCFullYear()&&row.month===date.getUTCMonth()+1)
 assert(source,`Missing Carnival source ${event.eventCode}`)
 const detail=read(`public/data/masterdata/domains/event_details/${event.eventCode}.json`)
 const resolved=source.cards.map(row=>{
  const matches=cards.filter(card=>card.title===row.title&&card.rarity===row.rarity&&card.release_at===event.term.openAt&&compact(idols.find(idol=>idol.idol_code===card.character_id)?.display_name||'')===compact(row.idolName))
  assert.equal(matches.length,1,`Ambiguous Wiki card ${event.eventCode}: ${row.title}`)
  const exchange=source.exchangeRows.find(item=>item.label===`〖${row.title}〗${row.idolName}`)
  assert(exchange,`Missing exchange cost ${row.title}`)
  const cost=exchange.cost.match(/^315ステッカー×(\d+)$/)
  assert(cost,`Unsupported card cost ${row.title}`)
  const sticker=detail.items.find(item=>item.role==='rareItemId')
  assert(sticker,`Missing sticker identity ${event.eventCode}`)
  return {resourceId:matches[0].resource_id,title:row.title,characterId:matches[0].character_id,rarity:row.rarity,cost:{itemId:sticker.itemId,nameJa:'315ステッカー',amount:Number(cost[1])},exchangeLimit:exchange.limit}
 })
 output.push({eventCode:event.eventCode,eventDetailId:event.eventDetailId,title:event.name,startAt:event.term.openAt,
  source:{kind:'community-wiki',title:`315カーニバル（${source.year}年${source.month}月） · Wikiwiki`,url:source.url,checkedAt:source.checkedAt,section:'イベント限定報酬 / イベントアイテム交換報酬',sourceFile:file,sourceSha256:createHash('sha256').update(bytes).digest('hex')},
  cards:resolved,exchangeRows:source.exchangeRows,periodText:source.periodText,exchangeDeadlineText:source.exchangeDeadlineText})
}
fs.writeFileSync('public/data/editorial/event-exchange-evidence.json',JSON.stringify({schemaVersion:1,events:output},null,2)+'\n')
console.log(JSON.stringify({events:output.length,cards:output.reduce((n,e)=>n+e.cards.length,0),exchangeRows:output.reduce((n,e)=>n+e.exchangeRows.length,0)}))
