import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { STAGE_COMMAND_BINDINGS, validateStageCommandInventory, stageCommandCoverage } from '../src/core/stageCommandCoverage.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const sha = 'a'.repeat(64)
const song = {id:'test',songCode:'test',source:'test.csv'}
const commands = {Penlight:2,Livechara_mouth_shape_fix:1,Livechara_Offset:3,Unknown_Command:4,Suspensionlight:5,Camera:6}
const inventory = {schemaVersion:1,choreographyIndexSha256:sha,arrangements:1,commands,
  songs:{test:{source:'test',songCode:'test',raw:{textSha256:sha},commands}}}
assert.equal(validateStageCommandInventory(inventory,sha),inventory)
assert.throws(()=>validateStageCommandInventory(inventory,'b'.repeat(64)),/does not match/)
const corrupt = structuredClone(inventory);corrupt.commands={...corrupt.commands,Penlight:3}
assert.throws(()=>validateStageCommandInventory(corrupt,sha),/aggregate mismatch/)
const invalid = structuredClone(inventory);invalid.songs.test.commands={...invalid.songs.test.commands,Camera:-1}
assert.throws(()=>validateStageCommandInventory(invalid,sha),/identity\/counts/)
assert.equal(stageCommandCoverage(song,null).total,null)
assert.equal(stageCommandCoverage({...song,source:'different.csv'},inventory).status,'identity_mismatch')
const coverage=stageCommandCoverage(song,inventory)
assert.equal(coverage.total,21)
assert.deepEqual(coverage.missing.map(row=>row.command),[])
assert.equal(coverage.rows.find(row=>row.command==='Livechara_Offset').status,'partial')
assert.equal(coverage.rows.find(row=>row.command==='Livechara_mouth_shape_fix').status,'partial')
assert.equal(coverage.rows.find(row=>row.command==='Penlight').status,'partial')
assert.deepEqual(coverage.unknown.map(row=>row.command),['Unknown_Command'])
assert.equal(coverage.guarded[0].guard,'not_loaded')
assert.equal(stageCommandCoverage(song,inventory,{stageEffects:{}}).guarded[0].guard,'disabled')
const enabled=stageCommandCoverage(song,inventory,{stageEffects:{oldSuspensionlightSongs:{test:{previewEnabled:true}}}})
assert.equal(enabled.guarded[0].guard,'enabled')
assert.equal(buildStageVfxCoverage(song,{commandInventory:inventory}).status,'partial')
const future={...inventory,songs:{test:{...inventory.songs.test,commands:{NewSuspensionlight_future:1,Penlight_future:1}}}}
assert.equal(stageCommandCoverage(song,future).unknown.length,2,'Unknown suffixes never inherit support')
const inherited={...inventory,songs:{test:{...inventory.songs.test,commands:{constructor:1}}}}
assert.equal(stageCommandCoverage(song,inherited).unknown.length,1,'Prototype names cannot inherit a consumer')
const annotation={...inventory,songs:{test:{...inventory.songs.test,commands:{Annotation:1},nonTimedCommands:{Annotation:1}}}}
assert.equal(stageCommandCoverage(song,annotation).rows[0].status,'non_timed')
assert.equal(stageCommandCoverage(song,annotation).unknown.length,0,'Non-timed source examples are not executable command gaps')
for(const binding of Object.values(STAGE_COMMAND_BINDINGS)){
  assert.equal(typeof binding.fields,'string')
  if(binding.consumer)assert.equal(binding.status==='partial'||binding.status==='guarded',true)
  else assert.equal(binding.status,'missing')
  if(binding.verification?.startsWith('verify-'))assert.ok(existsSync(new URL(binding.verification,import.meta.url)),binding.verification)
}
// Verify the real loader with an injected bounded transport: version mismatch,
// cancellation, malformed inventory and failures cannot become a success.
const source=readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const fn=source.match(/export async function fetchLiveChibiCommandInventory\([^]*?\n\}/)[0]
const indexText='{"songs":[]}', indexHash=createHash('sha256').update(indexText).digest('hex')
const realInventory={...inventory,choreographyIndexSha256:indexHash}
const load=new Function('indexTransport','LIVE_CHIBI_BASE','validateStageCommandInventory','crypto',
  fn.replace('export async function','async function')+';return fetchLiveChibiCommandInventory')
const requests=[]
const loader=load({async load(url,{signal}){requests.push(url);if(signal?.aborted)throw new DOMException('cancel','AbortError');
  return url.startsWith('/data/')?JSON.stringify(realInventory):indexText}},'/assets/live-chibi',validateStageCommandInventory,globalThis.crypto)
assert.equal((await loader('choreography/index.json')).choreographyIndexSha256,indexHash)
assert.deepEqual(requests,['/data/stage-command-inventory.json','/assets/live-chibi/choreography/index.json'])
const abort=new AbortController();abort.abort();await assert.rejects(loader('index.json',{signal:abort.signal}),{name:'AbortError'})
const stale=load({async load(url){return url.startsWith('/data/')?JSON.stringify(inventory):indexText}},'/assets/live-chibi',validateStageCommandInventory,globalThis.crypto)
await assert.rejects(stale('index.json'),/does not match/)
const failed=load({async load(){throw Error('HTTP 404')}},'/assets/live-chibi',validateStageCommandInventory,globalThis.crypto)
await assert.rejects(failed('index.json'),/404/)
if(process.argv.includes('--published-assets')){
  const text=readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')
  const raw=JSON.parse(readFileSync(new URL('../public/data/stage-command-inventory.json',import.meta.url),'utf8'))
  const hash=createHash('sha256').update(text).digest('hex')
  validateStageCommandInventory(raw,hash)
  const songs=JSON.parse(text).songs
  assert.equal(songs.length,raw.arrangements)
  const matrices=songs.map(song=>stageCommandCoverage(song,raw))
  assert.ok(matrices.every(matrix=>matrix.status==='source_inventory'))
  assert.equal(matrices.reduce((n,m)=>n+m.total,0),Object.values(raw.commands).reduce((a,b)=>a+b,0))
  assert.equal(raw.commands.Penlight+raw.commands.Penlight_unit+raw.commands.Penlight_unit_color,6697)
  assert.equal(matrices.filter(m=>m.rows.some(row=>row.family==='应援棒' && row.status==='partial')).length,118)
  assert.equal(raw.commands.Livechara_mouth_shape_fix,29)
  assert.equal(raw.commands.Livechara_foot_color_solo,241)
  assert.equal(raw.commands.Livechara_Offset,98)
  assert.equal(matrices.reduce((n,m)=>n+m.nonTimedCount,0),1)
  console.log(`RAW corpus: ${songs.length} arrangements, ${Object.keys(raw.commands).length} command types, ${Object.values(raw.commands).reduce((a,b)=>a+b,0)} rows`)
}
console.log('PASS RAW command coverage: missing exporters, exact suffixes, preview guards, identity/hash binding, counts and loader failures')
