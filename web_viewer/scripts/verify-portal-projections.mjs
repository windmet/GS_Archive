import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {buildPortalDesktopOverview} from '../src/presentation/ArchivePortalPresentation.js'
import {songMatchesIdol,storyMatchesIdol,eventMatchesIdol,idolEventIds} from '../src/presentation/CatalogIdolScope.js'
import {eventResources} from '../src/data/eventResourceGraph.js'
const root=process.argv[2]
assert.ok(root,'Supply the actual read-model root')
const boot=JSON.parse(await fs.readFile(path.join(root,'bootstrap.inline.json')))
async function read(descriptor) {
  const bytes=await fs.readFile(path.join(root,'pages',descriptor.url.slice(1)))
  assert.equal(bytes.length,descriptor.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256)
  const envelope=JSON.parse(bytes);assert.equal(envelope.release,boot.release);assert.equal(envelope.kind,descriptor.kind)
  return envelope.data
}
const domains={}
for(const name of ['cards','songs','stories','events','idols']) {
  const index=await read(boot.domains[name]);domains[name]=(await Promise.all(index.pages.map(read))).flatMap(page=>page.rows)
}
const index=await read(boot.domains.portal),sizes=[]
assert.equal(Object.keys(index.scopes).length,50)
for(const idol of [null,...boot.idols]) {
  const id=idol?.id || 'all',descriptor=index.scopes[id],data=await read(descriptor),overview=data.overview
  assert.equal(data.id,id);assert.equal(overview.scopeId,idol?.id || '')
  assert.ok(descriptor.bytes<=(idol?32:64)*1024);sizes.push({id,bytes:descriptor.bytes})
  const detail=idol?await read(domains.idols.find(row=>row.id===idol.id).detail):null
  const selected={cards:domains.cards.filter(row=>!idol || row.character_id===id),
    songs:domains.songs.filter(row=>row.variant_kind==='primary' && songMatchesIdol(row,idol)),
    stories:domains.stories.filter(row=>row.exists===true && storyMatchesIdol(row,idol)),
    events:domains.events.map(row=>({...row,resources:eventResources(row)})).filter(row=>eventMatchesIdol(row,idol,idolEventIds(detail)))}
  for(const domain of Object.keys(selected))assert.equal(overview.footprints.find(row=>row.id===domain).value,selected[domain].length,`${id} ${domain}`)
  assert.equal(overview.cardCounts.total,selected.cards.length)
  for(const row of overview.collections.cards)assert.ok(selected.cards.some(card=>card.resource_id===row.id))
  for(const row of overview.collections.songs)assert.ok(selected.songs.some(song=>song.song_code===row.id || song.song_code===row.songCode))
}
const storyIndex=await read(boot.domains.stories),located=new Map()
assert.equal(Object.keys(storyIndex.detailLocatorShards).length,32)
for(const descriptor of Object.values(storyIndex.detailLocatorShards)) {
  assert.ok(descriptor.bytes<=32*1024)
  for(const row of (await read(descriptor)).rows) {assert.ok(!located.has(row.file));located.set(row.file,row.detail)}
}
assert.equal(located.size,domains.stories.length)
for(const row of domains.stories)assert.deepEqual(located.get(row.file),row.detail)
console.log(JSON.stringify({release:boot.release,scopes:50,storyLocators:located.size,globalBytes:sizes.find(row=>row.id==='all').bytes,maxIdolBytes:Math.max(...sizes.filter(row=>row.id!=='all').map(row=>row.bytes)),scope:'All real scopes, independent directory ownership/count parity, descriptor bytes/hash and complete story locator parity; no Browser claim'},null,2))
