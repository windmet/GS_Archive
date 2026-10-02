import assert from 'node:assert/strict'
import {buildArchiveUrl,readArchiveRoute,buildArchiveSourceQuery,readArchiveSourceRoute} from '../src/core/archiveRoute.js'
import {normalizeCollectionRoute} from '../src/core/CollectionRouteState.js'
import {createCollectionCatalogSession} from '../readmodels/runtime/CollectionCatalogSession.mjs'
import {honorGroup,honorSourceLabel,collectionSummary} from '../src/presentation/CollectionBrowse.js'
const collection={kind:'honors',category:'idol',idol:'001tom',unit:'01jup',attribute:'',page:3}
const route={view:'collection_catalog',collection,entity:'',query:'冬马'}
for(const entity of ['', 'honor:20101001']) {
  const restored=readArchiveRoute(buildArchiveUrl('http://localhost/',{...route,entity}))
  assert.deepEqual(restored.collection,collection);assert.equal(restored.entity,entity);assert.equal(restored.query,route.query)
  const source=buildArchiveSourceQuery(restored)
  assert.deepEqual(readArchiveSourceRoute(source).collection,collection)
}
assert.equal(readArchiveRoute('http://localhost/?view=collection_catalog&entity=honor:1').collection.kind,'honors')
assert.equal(normalizeCollectionRoute({entity:'item:1',collection}).entity,'')
assert.equal(normalizeCollectionRoute({collection:{kind:'honors',category:'achievement'}}).collection.category,'normal')
assert.equal(normalizeCollectionRoute({collection:{kind:'items',page:-1}}).collection.page,0)
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/',{...route,collection:{...collection,unit:'05w00',idol:'012yus'}})).collection.unit,'05w00')
assert.equal(normalizeCollectionRoute({collection:{kind:'honors',unit:'99abc',idol:'099xyz'}}).collection.unit,'')
assert.equal(normalizeCollectionRoute({collection:{kind:'honors',idol:'099xyz'}}).collection.idol,'')
assert.equal(honorGroup({honorType:1}),'normal')
assert.equal(collectionSummary({id:1},'honors','wrong-release'),null)
assert.equal(honorSourceLabel({id:1},'wrong-release'),'来源摘要暂不可用')
let details=0
const session=createCollectionCatalogSession({catalog:async()=>[{id:'1'}],detail:async()=>{details++;return {entry:{id:'1',key:'honor:1'}}}},()=>{})
await session.open('honors','',{selectDefault:false});assert.equal(details,0)
await session.open('honors','honor:1',{selectDefault:false});assert.equal(details,1)
await session.open('honors','',{selectDefault:false});assert.equal(session.state.detail,null);assert.equal(details,1)
session.dispose()
console.log('Collection route: explicit kind, close/refresh, source return, filters/page, legacy entity and summary-unavailable semantics passed')
