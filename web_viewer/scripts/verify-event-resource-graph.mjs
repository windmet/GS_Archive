import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createArchiveAssetResolver} from './lib/archive-assets.mjs'
import {editorialSourceHash,EDITORIAL_SOURCE_HASH_FORMAT} from './lib/editorial-source-hash.mjs'
import {eventResources,storyEventResources} from '../src/data/eventResourceGraph.js'
const root=fileURLToPath(new URL('../',import.meta.url)),assets=createArchiveAssetResolver()
const sourceOnly=process.argv.includes('--source-only')
const json=async relative=>JSON.parse(await readFile(path.join(root,relative),'utf8'))
const graph=await json('public/data/editorial/event-resource-graph.json')
const events=(await json('public/data/masterdata/domains/event_supplement_index.json')).entries
const media=await json('public/data/masterdata/domains/event_media.json')
const manifest=await json('public/data/archive_manifest.json')
const exchanges=await json('public/data/editorial/event-exchange-evidence.json')
const cards=(await json('public/data/masterdata/card_index.json')).cards
assert.equal(graph.events.length,events.length)
assert.equal(new Set(graph.events.map(e=>e.id)).size,events.length)
assert.equal(graph.sourceHashFormat,EDITORIAL_SOURCE_HASH_FORMAT)
assert.equal(editorialSourceHash(Buffer.from('{"label":"活动"}\r\n')),editorialSourceHash(Buffer.from('{"label":"活动"}\n')))
assert.notEqual(editorialSourceHash(Buffer.from('{"label":"活动"}\n')),editorialSourceHash(Buffer.from('{"label":"故事"}\n')))
assert.notEqual(editorialSourceHash(Buffer.from('{"label":"活动"}\n')),editorialSourceHash(Buffer.from('{ "label":"活动"}\n')),'non-newline source bytes remain bound')
for(const [source,hash] of Object.entries(graph.sources))assert.equal(editorialSourceHash(await readFile(path.join(root,source))),hash,`Stale source ${source}`)
for(const event of graph.events){
  const raw=events.find(e=>e.eventCode===event.eventCode)
  const legacy=manifest.unit_event_relations.find(e=>String(e.event_code)===event.eventCode)
  assert.equal(event.id,String(legacy?.event_id||`event:${event.eventCode}`))
  assert.equal(event.title,raw.name)
  assert.equal(event.startAt,raw.term.openAt)
  assert.equal(event.endAt,raw.term.closeAt)
  assert.ok(event.hero,`Missing hero ${event.id}`)
  for(const binding of [event.hero,event.thumbnail,event.storyCover,...(event.exchangeRewards?.cards || []).map(card=>card.image)].filter(Boolean)){
    assert.match(binding.sha256,/^[a-f0-9]{64}$/);assert(binding.width>0&&binding.height>0)
    if(sourceOnly)continue
    const file=binding.url.startsWith('/assets/domain-images/')?assets.domainImagePath(binding.url.slice('/assets/domain-images/'.length)):path.join(root,'public',binding.url)
    const bytes=await readFile(file)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),binding.sha256)
    assert.equal(bytes.readUInt32BE(16),binding.width)
    assert.equal(bytes.readUInt32BE(20),binding.height)
  }
  if(event.thumbnail)assert.equal(event.thumbnail.sha256,media.entries[`event:${raw.id}`].banner.sha256)
  assert.equal(event.gashas,undefined,'Coincident dates do not create event-gasha content links')
  const exchange=exchanges.events.find(row=>row.eventCode===event.eventCode)
  assert.equal(Boolean(event.exchangeRewards),Boolean(exchange))
  if(exchange){
    assert.equal(event.kind,'collection')
    assert.equal(exchange.eventDetailId,raw.eventDetailId)
    assert.equal(exchange.startAt,raw.term.openAt)
    assert.equal(exchange.title,raw.name)
    assert.equal(event.exchangeRewards.source.kind,'community-wiki')
    assert.deepEqual(event.exchangeRewards.source,exchange.source)
    assert.deepEqual(event.exchangeRewards.exchangeRows,exchange.exchangeRows)
    const detail=await json(`public/data/masterdata/domains/event_details/${event.eventCode}.json`)
    for(const reward of event.exchangeRewards.cards){
      const card=cards.find(row=>row.resource_id===reward.card_resource_id)
      const evidence=exchange.cards.find(row=>row.resourceId===reward.card_resource_id)
      assert.ok(card&&evidence)
      assert.equal(reward.card_title,card.title)
      assert.equal(reward.character_id,card.character_id)
      assert.equal(reward.rarity,card.rarity)
      assert.deepEqual(reward.cost,evidence.cost)
      assert.equal(reward.exchangeLimit,evidence.exchangeLimit)
      assert.ok(detail.items.some(item=>item.itemId===reward.cost.itemId))
    }
    // Editorial exchange cards must never become client PT/story rewards.
    assert.equal(event.rewardCardCount,0)
  }
  const view={identity:{id:event.id,eventCode:event.eventCode,title:event.title},period:{startAt:event.startAt,endAt:event.endAt}}
  assert.equal(eventResources(view.identity)?.id,event.id)
  assert.equal(eventResources({...view.identity,title:'stale'}),null)
  assert.equal(eventResources({...view.identity,id:'event:wrong'}),null)
  assert.equal(eventResources({...view.identity,release_at:event.startAt+1}),null)
}
assert.equal(graph.roster.length,49)
assert.equal(graph.events.filter(event=>event.exchangeRewards).length,17)
assert.equal(graph.events.reduce((n,event)=>n+(event.exchangeRewards?.cards.length||0),0),51)
const readings=(await json('public/data/reading/manifest.json')).entries
for(const event of graph.events.filter(event=>event.storyAvailable)){
 assert.ok(event.storyCover,'Use clean KV for reading discovery')
 assert.ok(event.storyCast.every(code=>graph.roster.some(idol=>idol.code===code)))
 assert.ok(readings.some(row=>row.document_id===event.firstReadingId&&row.parent_file===event.storyFile&&row.status==='ready'),'Reader identity must bind to the exact parent story')
}
assert.equal(eventResources({event_code:'not-recorded'}),null)
assert.equal(storyEventResources({sectionId:'10001',eventRelation:{event_code:'10001',event_id:'430001'}}),null)
assert.equal(storyEventResources({sectionId:'30001',eventRelation:{event_code:'10001',event_id:'410001'}}),null)
const original=graph.events.find(e=>e.eventCode==='10001'),reprint=graph.events.find(e=>e.eventCode==='10019')
assert.equal(reprint.heroRole,'original-announcement')
assert.equal(reprint.hero.url,original.hero.url)
assert.notEqual(reprint.thumbnail.url,original.thumbnail.url)
assert.notEqual(reprint.startAt,original.startAt)
console.log(`Event resource graph: ${events.length} identities; ${sourceOnly?'source-bound descriptors; media bytes not checked':'hero and thumbnail bytes/dimensions verified'}; no temporal gasha joins; stale identities and dates rejected`)
