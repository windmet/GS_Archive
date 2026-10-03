import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {encodeStructuredGzip} from './lib/structured-gzip.mjs'

const [origin,manifestFile]=process.argv.slice(2)
assert(/^https:\/\/[^/]+\/?$/.test(origin || '') && manifestFile,'Supply HTTPS preview origin and incremental manifest')
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'))
assert.equal(manifest.kind,'incremental-preview')
const directory=path.dirname(path.resolve(manifestFile)), stage=path.join(directory,manifest.stage)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const raw=(key,method='GET',headers={})=>new Promise((resolve,reject)=>{
  const req=https.request(new URL('/'+key,origin),{method,headers:{'Accept-Encoding':'identity',...headers}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject)
    res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}))
  })
  req.setTimeout(30000,()=>req.destroy(new Error('HTTP timeout')));req.on('error',reject);req.end()
})
const receiptResponse=await raw('preview-receipt.json')
assert.equal(receiptResponse.status,200)
const deployment=JSON.parse(receiptResponse.body)
assert.equal(deployment.dataRevision,manifest.dataRevision,'Wrong R2 snapshot in deployed configuration')
assert.equal(deployment.branch,'gs-architecture-device-test')
const checks=[]
for (const prefix of ['assets/domain-images/event/', 'assets/domain-images/image/image_honor/',
  'assets/domain-images/image/image_item/', 'assets/domain-images/image/image_picturestudio/',
  'assets/terminal/', 'assets/song-chart-sprites/', 'assets/live-chibi/']) {
  const entry=manifest.entries.filter(e=>e.request_key.startsWith(prefix) && e.object_key.endsWith('.webp'))
    .sort((a,b)=>a.deployed_size-b.deployed_size)[0]
  if (!entry) continue
  const response=await raw(entry.request_key)
  assert.equal(response.status,200,entry.request_key)
  assert.equal(response.headers['content-type'].split(';')[0],'image/webp')
  assert.equal(hash(response.body),entry.deployed_sha256,entry.request_key)
  assert.deepEqual(response.body,await fs.readFile(path.join(stage,...entry.object_key.split('/'))))
  assert(response.headers.etag)
  assert.equal((await raw(entry.request_key,'GET',{'If-None-Match':response.headers.etag})).status,304)
  checks.push({key:entry.request_key,check:'WebP bytes, type and ETag/304'})
}
for (const key of ['data/archive_manifest.json','data/terminal/wallpapers.json','data/terminal/backgrounds.json']) {
  const entry=manifest.entries.find(e=>e.request_key===key);assert(entry,key)
  const response=await raw(key);assert.equal(response.status,200,key)
  assert.equal(hash(response.body),entry.deployed_sha256,key)
  const head=await raw(key,'HEAD');assert.equal(head.status,200)
  assert.equal(Number(head.headers['content-length']),entry.deployed_size)
  assert.equal(head.body.length,0)
  checks.push({key,check:'Versioned JSON bytes and HEAD'})
}
let gzip=manifest.entries.find(e=>e.deployed_content_encoding==='gzip' && e.request_key.startsWith('assets/'))
  || manifest.entries.find(e=>e.deployed_content_encoding==='gzip' && !/^data\/compiled\/1_5_/.test(e.request_key))
if (!gzip) {
  // A metadata-only increment can leave every gzip object unchanged. Exercise
  // the existing lipsync route against the same canonical encoding policy.
  const baseline=JSON.parse(await fs.readFile('.deploy/storage-compression/source-baseline.json','utf8'))
  const source=baseline.entries.find(e=>e.request_key.startsWith('assets/lipsync/') && e.request_key.endsWith('.json'))
  assert(source,'No existing gzip probe')
  gzip=encodeStructuredGzip(source,await fs.readFile(source.source)).entry
}
const compressed=await raw(gzip.request_key,'GET',{'Accept-Encoding':'gzip'})
assert.equal(compressed.status,200,gzip.request_key)
assert.equal(compressed.headers['content-encoding'],'gzip')
assert.equal(hash(compressed.body),gzip.deployed_sha256)
assert.equal(hash(gunzipSync(compressed.body)),gzip.source_sha256)
assert.equal((await raw(gzip.request_key)).status,406)
checks.push({key:gzip.request_key,check:'Raw gzip and decoded source hashes, identity 406'})
// The voice64 batch replaced older raw M4As without changing logical URLs.
// Bind Range checks to the active deployment artifact, not the original export.
const voices=JSON.parse(await fs.readFile('.deploy/voice64/manifest.json','utf8'))
assert.equal(voices.kind,'voice64-replacement')
const audio=voices.entries.find(e=>e.request_key.startsWith('assets/voice/') && e.request_key.endsWith('.m4a') && e.deployed_size>32)
assert(audio)
const audioBytes=await fs.readFile(path.join(audio.stage,...audio.object_key.split('/')))
assert.equal(hash(audioBytes),audio.deployed_sha256,'Voice deployment artifact drift')
assert.equal(audioBytes.length,audio.deployed_size)
const range=await raw(audio.request_key,'GET',{Range:'bytes=0-31'})
assert.equal(range.status,206)
assert.equal(range.headers['content-range'],`bytes 0-31/${audio.deployed_size}`)
assert.deepEqual(range.body,audioBytes.subarray(0,32))
assert.equal((await raw(audio.request_key,'GET',{Range:`bytes=${audio.deployed_size}-`})).status,416)
checks.push({key:audio.request_key,check:'Audio Range bytes/206/416'})
const general=await raw('translations/zh-CN/archive-general.json')
assert.equal(general.status,200)
assert.equal(hash(general.body),hash(await fs.readFile('public/translations/zh-CN/archive-general.json')))
checks.push({key:'translations/zh-CN/archive-general.json',check:'Tracked metadata draft source bytes'})
assert.equal((await raw('assets/__preview_probe_missing__.png')).status,404)
assert.equal((await raw(audio.request_key,'POST')).status,405)
const receipt={origin,checked_at:new Date().toISOString(),passed:true,deployment,checks}
await fs.writeFile(path.join(directory,'http-validation.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt,null,2))
