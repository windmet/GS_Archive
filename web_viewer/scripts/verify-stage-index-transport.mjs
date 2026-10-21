import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash,webcrypto} from 'node:crypto'
import {createStageIndexTransport,createStageIndexDocument} from '../src/utils/StageIndexTransport.js'
import {createBoundedTextTransport} from '../src/utils/BoundedTextTransport.js'
const hash=text=>createHash('sha256').update(text).digest('hex')
const response=text=>({ok:true,status:200,text:async()=>text})
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
let fetches=0,parses=0,digests=0
const body='{"songs":[{"id":"日本語"}]}'
let activeBody=body
const transport=createStageIndexTransport({fetchImpl:async()=>{fetches++;return response(activeBody)},
  parse:text=>{parses++;return JSON.parse(text)},digest:bytes=>{digests++;return webcrypto.subtle.digest('SHA-256',bytes)}})
const [one,two]=await Promise.all([transport.load('shared'),transport.load('shared')])
assert.equal(one,two)
assert.equal(await transport.load('shared'),one)
assert.equal(digests,0,'Unused source documents do not compute digests')
assert.deepEqual(await Promise.all([one.hash(),two.hash(),one.hash()]),Array(3).fill(hash(body)))
assert.deepEqual([fetches,parses,digests],[1,1,1])
transport.invalidate('shared')
activeBody='{"songs":[{"id":"new-generation"}]}'
const replacement=await transport.load('shared')
assert.notEqual(replacement,one)
assert.deepEqual([fetches,parses,digests],[2,2,1])
assert.equal(await replacement.hash(),hash(activeBody),'Same URL after invalidation binds the new bytes')
assert.equal(await one.hash(),hash(body),'Existing consumers retain their exact source generation')
assert.equal(digests,2)
// A digest failure must remain retryable on the same exact source document.
let attempts=0
const retry=createStageIndexDocument(body,{digest:bytes=>++attempts===1?Promise.reject(Error('digest failed')):webcrypto.subtle.digest('SHA-256',bytes)})
await assert.rejects(retry.hash(),/digest failed/)
assert.equal(await retry.hash(),hash(body))
assert.equal(await retry.hash(),hash(body));assert.equal(attempts,2)
// Aborting one subscriber cannot discard another subscriber's decode/hash.
const gate=deferred(),cancel=new AbortController()
const shared=createStageIndexTransport({fetchImpl:()=>gate.promise})
const a=shared.load('a',{signal:cancel.signal}),b=shared.load('a')
cancel.abort();await assert.rejects(a,{name:'AbortError'})
gate.resolve(response(body));assert.equal(await (await b).hash(),hash(body))
// Parse failures and all-subscriber cancellation never enter the cache.
let requests=0
const broken=createStageIndexTransport({fetchImpl:async()=>response(++requests===1?'bad':body)})
await assert.rejects(broken.load('bad'),SyntaxError)
assert.equal(broken.stats().entries,0)
assert.equal(await (await broken.load('bad')).hash(),hash(body))
const late=deferred(),aborted=new AbortController()
const stale=createStageIndexTransport({fetchImpl:()=>late.promise})
const pending=stale.load('stale',{signal:aborted.signal});aborted.abort()
await assert.rejects(pending,{name:'AbortError'});late.resolve(response(body))
await new Promise(resolve=>setImmediate(resolve));assert.equal(stale.stats().entries,0)
// Decoding itself can be asynchronous. Cancellation/invalidation during decode
// must not install a result after the owning request has been discarded.
for(const invalidate of [false,true]) {
  const decoded=deferred(),started=deferred(),controller=new AbortController()
  const slow=createBoundedTextTransport({fetchImpl:async()=>response(body),decode:()=>{started.resolve();return decoded.promise}})
  const request=slow.load('decode',{signal:controller.signal})
  await started.promise
  if(invalidate)slow.invalidate('decode');else controller.abort()
  await assert.rejects(request,{name:'AbortError'})
  decoded.resolve({data:'late'});await new Promise(resolve=>setImmediate(resolve))
  assert.equal(slow.stats().entries,0)
}
// Cache bounds remain source UTF-8 bytes, not character length or entry count alone.
const budget=createStageIndexTransport({maxBytes:100,cacheBytes:Buffer.byteLength(body),maxEntries:1,fetchImpl:async()=>response(body)})
await budget.load('one');await budget.load('two')
assert.deepEqual(budget.stats(),{entries:1,bytes:Buffer.byteLength(body),flights:0})
await assert.rejects(createStageIndexTransport({maxBytes:4,fetchImpl:async()=>response(body)}).load('large'),/budget/)
await assert.rejects(createStageIndexTransport({fetchImpl:async()=>({ok:true,headers:{get:()=> 'text/html'}})}).load('html'),/HTML/)

// Load the actual production entry points without Pixi or a mirrored loader.
const source=await fs.readFile(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const section=source.slice(source.indexOf('async function liveJson('),source.indexOf('export function sampleLiveChibiLipSync(')).replaceAll('export ','')
const dependencies={indexTransport:transport,LIVE_CHIBI_BASE:'/assets/live-chibi'}
for(const match of source.matchAll(/import \{([^}]+)\} from '(\.\.\/core\/[^']+)'/g)) {
  const module=await import(new URL('../src/utils/'+match[2],import.meta.url))
  for(const name of match[1].split(',').map(n=>n.trim()).filter(Boolean)) dependencies[name]=module[name]
}
const names=['fetchLiveChibiChoreography','fetchLiveChibiCommandInventory','fetchLiveChibiPenlights','fetchLiveChibiMouthFix','fetchLiveChibiMotionOffset','fetchLiveChibiMotionClock','fetchLiveChibiStagelights','fetchLiveChibiStageEffectIndex','fetchLiveChibiObjectLayerIndex']
const make=indexTransport=>new Function(...Object.keys(dependencies),section+';return {'+names.join(',')+'}')(...Object.values({...dependencies,indexTransport}))
if(process.argv.includes('--published-assets')) {
  const reads=new Map(),parseCounts=new Map(),hashCounts=new Map(),snapshots=new Map()
  const corpus=createStageIndexTransport({fetchImpl:async url=>{
    reads.set(url,(reads.get(url)||0)+1)
    try {return response(await fs.readFile(new URL('../public'+url,import.meta.url),'utf8'))}
    catch(error){if(error.code==='ENOENT')return {ok:false,status:404};throw error}
  },parse:text=>{
    const key=hash(text);parseCounts.set(key,(parseCounts.get(key)||0)+1)
    const data=JSON.parse(text);snapshots.set(data,text);return data
  },digest:bytes=>{const key=hash(bytes);hashCounts.set(key,(hashCounts.get(key)||0)+1);return webcrypto.subtle.digest('SHA-256',bytes)}})
  const loaders=make(corpus),file='choreography/index.json'
  const choreography=await loaders.fetchLiveChibiChoreography(file)
  await Promise.all(names.slice(1,7).map(name=>loaders[name](file)))
  await loaders.fetchLiveChibiStageEffectIndex()
  let complete
  const done=new Promise(resolve=>{complete=resolve}),refinements=[]
  const index=await loaders.fetchLiveChibiObjectLayerIndex({onOptional:result=>{refinements.push(result);if(refinements.length===4)complete()}})
  await Promise.race([done,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Optional refinements did not settle')),3000);timer.unref()})])
  assert.equal(choreography.songs.length,118)
  assert.ok(index.assets.fx_in_tibeti_water_1)
  assert.ok(refinements.every(result=>result.assets.fx_in_tibeti_water_1))
  assert.equal(reads.get('/assets/live-chibi/object-layers/index.json'),1,'One source read through required and four optional object refinements')
  const objectText=await fs.readFile(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url),'utf8')
  assert.equal(parseCounts.get(hash(objectText)),1)
  assert.equal(hashCounts.get(hash(objectText)),1)
  for(const [data,text] of snapshots)assert.deepEqual(data,JSON.parse(text),'Consumers must not mutate shared source documents')
  console.log(JSON.stringify({reads:Object.fromEntries(reads),parses:[...parseCounts.values()].reduce((a,b)=>a+b,0),digests:[...hashCounts.values()].reduce((a,b)=>a+b,0),cache:corpus.stats()}))
}
console.log('Stage index documents: shared parse/digest, lazy hash retry, bounds, source identity, cancellation and production loader coverage passed')
