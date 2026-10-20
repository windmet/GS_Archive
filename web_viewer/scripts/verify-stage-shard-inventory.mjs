import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {loadStageShardClosure,assertStageShardInventory,isStageShardKey,requiresStageShardValidation} from './lib/stage-shard-inventory.mjs'
const root=fileURLToPath(new URL('..',import.meta.url))
const fixtureParent=await fs.realpath(os.tmpdir())
const fixture=await fs.mkdtemp(path.join(fixtureParent,'stage-inventory-'))
const hash=data=>createHash('sha256').update(data).digest('hex')
const keys=['data/stage-choreography-shards.json','data/stage-effect-shards.json','data/stage-consumer-shards.json','data/stage-original-lineups.json']
const write=async(key,content)=>{const file=path.join(fixture,key);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content)}
try {
  // Keep real tracked catalog identities/contracts, replace only payload hashes
  // with tiny fixtures so CI does not need any ignored native corpus.
  const catalogs=await Promise.all(keys.map(async key=>JSON.parse(await fs.readFile(path.join(root,'public',key),'utf8'))))
  const [choreography,effects,consumers]=catalogs
  const descriptors=[...Object.values(choreography.shards),effects.common,...Object.values(effects.songs),consumers.common,...Object.values(consumers.songs),...Object.values(consumers.emitters)]
  for(const descriptor of descriptors) {
    const content=Buffer.from('{}\n'),sha256=hash(content)
    descriptor.file=descriptor.file.replace(descriptor.sha256,sha256);descriptor.sha256=sha256;descriptor.bytes=content.length
    await write(descriptor.file.slice(1),content)
  }
  for(let i=0;i<keys.length;i++)await write(keys[i],JSON.stringify(catalogs[i])+'\n')
  const closure=await loadStageShardClosure(fixture)
  const entries=[...closure.required].map(([request_key,item])=>({request_key,source:item.source,source_size:item.bytes,source_sha256:item.sha256}))
  const receipt=await assertStageShardInventory(entries,closure)
  assert.equal(receipt.shardFiles,descriptors.length);assert.equal(receipt.catalogFiles,4)
  assert(requiresStageShardValidation({entries,stage_shards:receipt}))
  assert(requiresStageShardValidation({entries:[entries[0]]}),'Legacy stage inputs still require validation')
  assert(requiresStageShardValidation({entries:[],stage_shards:receipt}),'Removing all rows cannot bypass a current inventory receipt')
  assert(!requiresStageShardValidation({entries:[{request_key:'assets/icon.txt'}]}),'Retain legacy non-stage scoped increments')
  await assert.rejects(assertStageShardInventory(entries.slice(1),closure),/Missing stage inventory dependency/)
  await assert.rejects(assertStageShardInventory(entries.filter(row=>row.request_key!=='data/stage-original-lineups.json'),closure),
    /Missing stage inventory dependency: data\/stage-original-lineups.json/)
  await assert.rejects(assertStageShardInventory([...entries,entries[0]],closure),/Duplicate stage inventory entry/)
  const stale='assets/live-chibi/stage-effects/shards/stale.json'
  assert(isStageShardKey(stale));assert(!closure.required.has(stale))
  await assert.rejects(assertStageShardInventory([...entries,{request_key:stale}],closure),/Stale stage shard/)
  const row=entries.at(-1),original=await fs.readFile(row.source)
  await fs.writeFile(row.source,Buffer.alloc(original.length,32))
  await assert.rejects(assertStageShardInventory(entries,closure),/SHA-256 mismatch/)
  await fs.writeFile(row.source,original)
  await assert.rejects(assertStageShardInventory(entries.map(item=>item===row?{...item,source_size:item.source_size+1}:item),closure),/inventory size mismatch/)
  await assert.rejects(assertStageShardInventory(entries.map(item=>item===row?{...item,source_sha256:'0'.repeat(64)}:item),closure),/inventory SHA-256 mismatch/)
  const redirect=path.join(fixture,'redirect.json');await fs.writeFile(redirect,original)
  await assert.rejects(assertStageShardInventory(entries.map(item=>item===row?{...item,source:redirect}:item),closure),/source path mismatch/)
  await fs.unlink(row.source)
  await assert.rejects(assertStageShardInventory(entries,closure),{code:'ENOENT'})
  await fs.writeFile(row.source,original)
  // Exercise the real package entry point: missing every stage row in a
  // current full inventory must fail before the output directory is created.
  const cliInventory=path.join(fixture,'inventory.json'),cliRemote=path.join(fixture,'remote.json'),cliSeed=path.join(fixture,'seed.json')
  await fs.writeFile(cliInventory,JSON.stringify({schema_version:3,kind:'current-source-inventory',stage_shards:receipt,entries:[],missing:[]}))
  await fs.writeFile(cliRemote,'[]')
  await fs.writeFile(cliSeed,JSON.stringify({schema_version:3,kind:'source-baseline',entries:[]}))
  const cliOutput=path.join(fixture,'must-not-create')
  const cli=spawnSync(process.execPath,[path.join(root,'scripts/prepare-preview-incremental-assets.mjs'),'--inventory',cliInventory,'--remote',cliRemote,'--baseline',cliSeed,'--out',cliOutput],{cwd:root,encoding:'utf8'})
  assert.notEqual(cli.status,0);assert.match(cli.stderr,/Missing stage inventory dependency/)
  await assert.rejects(fs.access(cliOutput),{code:'ENOENT'})
  effects.choreographyIndexSha256='0'.repeat(64);await write(keys[1],JSON.stringify(effects))
  await assert.rejects(loadStageShardClosure(fixture),/canonical source mismatch/)
  if(process.argv.includes('--published-assets')) {
    const actual=await loadStageShardClosure(path.join(root,'public'))
    const actualEntries=[...actual.required].map(([request_key,item])=>({request_key,source:item.source,source_size:item.bytes}))
    console.log(JSON.stringify(await assertStageShardInventory(actualEntries,actual)))
  }
  console.log('Stage shard inventory: runtime catalog contracts, complete/hash/path/size guards, stale rejection and scoped legacy compatibility passed')
} finally {
  assert.equal(path.dirname(path.resolve(fixture)),fixtureParent)
  assert.equal(await fs.realpath(fixture),path.resolve(fixture))
  await fs.rm(fixture,{recursive:true,force:true})
}
