import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {validateChoreographyCatalog} from '../../src/core/chibiChoreographyShards.js'
import {validateStageEffectCatalog} from '../../src/core/chibiStageEffectShards.js'
import {validateConsumerCatalog} from '../../src/core/chibiConsumerShards.js'

const catalogKeys=['data/stage-choreography-shards.json','data/stage-effect-shards.json','data/stage-consumer-shards.json']
const prefixes=['assets/live-chibi/choreography/shards/','assets/live-chibi/stage-effects/shards/','assets/live-chibi/consumer-shards/']
export const isStageShardKey=key=>prefixes.some(prefix=>key.startsWith(prefix))
export const requiresStageShardValidation=inventory=>Object.hasOwn(inventory,'stage_shards')
  || inventory.entries.some(entry=>catalogKeys.includes(entry.request_key) || isStageShardKey(entry.request_key))
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')

// Use the runtime catalogs, not a second naming/schema implementation. Catalog
// bytes are included in the closure so a stale inventory cannot select old data.
export async function loadStageShardClosure(publicRoot) {
  const required=new Map(),catalogs=[]
  for(const key of catalogKeys) {
    const source=path.join(publicRoot,key),bytes=await fs.readFile(source)
    const data=JSON.parse(bytes.toString('utf8'))
    required.set(key,{source,bytes:bytes.length,sha256:sha256(bytes)})
    catalogs.push(data)
  }
  const [choreography,effects,consumers]=catalogs
  validateChoreographyCatalog(choreography,'choreography/index.json')
  validateStageEffectCatalog(effects);validateConsumerCatalog(consumers)
  for(const catalog of [effects,consumers]) {
    assert.equal(catalog.choreographyIndexSha256,choreography.index.sourceBinding.sha256,'Stage catalog canonical source mismatch')
    assert.deepEqual(Object.keys(catalog.songs).sort(),Object.keys(choreography.shards).sort(),'Stage catalog song set mismatch')
    for(const song of choreography.index.songs) {
      assert.equal(catalog.songs[song.id].songCode,song.songCode,'Stage catalog song code mismatch')
      assert.equal(catalog.songs[song.id].source,song.source,'Stage catalog song source mismatch')
    }
  }
  const descriptors=[...Object.values(choreography.shards),effects.common,...Object.values(effects.songs),
    consumers.common,...Object.values(consumers.songs),...Object.values(consumers.emitters)]
  for(const descriptor of descriptors) {
    const key=descriptor.file.slice(1)
    assert(!required.has(key),'Duplicate stage shard key')
    required.set(key,{source:path.join(publicRoot,key),bytes:descriptor.bytes,sha256:descriptor.sha256})
  }
  return {required,shardFiles:descriptors.length,catalogFiles:catalogKeys.length}
}

export async function assertStageShardInventory(entries,closure) {
  const selected=new Map()
  for(const entry of entries) {
    const key=entry.request_key
    if(!closure.required.has(key) && !isStageShardKey(key))continue
    assert(!selected.has(key),`Duplicate stage inventory entry: ${key}`)
    assert(closure.required.has(key),`Stale stage shard in inventory: ${key}`)
    selected.set(key,entry)
  }
  let bytes=0
  for(const [key,expected] of closure.required) {
    const entry=selected.get(key)
    assert(entry,`Missing stage inventory dependency: ${key}`)
    assert.equal(await fs.realpath(entry.source),await fs.realpath(expected.source),`Stage source path mismatch: ${key}`)
    const content=await fs.readFile(entry.source)
    assert.equal(content.length,expected.bytes,`Stage shard size mismatch: ${key}`)
    assert.equal(entry.source_size,expected.bytes,`Stage inventory size mismatch: ${key}`)
    assert.equal(sha256(content),expected.sha256,`Stage shard SHA-256 mismatch: ${key}`)
    if(entry.source_sha256)assert.equal(entry.source_sha256,expected.sha256,`Stage inventory SHA-256 mismatch: ${key}`)
    bytes+=content.length
  }
  return {catalogFiles:closure.catalogFiles,shardFiles:closure.shardFiles,bytes}
}
