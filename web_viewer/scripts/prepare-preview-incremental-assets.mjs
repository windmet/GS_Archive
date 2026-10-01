import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {hashFile} from './lib/preview-source-baseline.mjs'
import {encodeStructuredGzip} from './lib/structured-gzip.mjs'
import {encodeLosslessWebp, runPool, shutdownEncoderPool} from './lib/lossless-webp.mjs'
import {isPreviewDataSnapshotKey, isPreviewGzipCandidate, resolvePreviewObjectKey,
  previewTransformKind, LOSSLESS_WEBP_TRANSFORM} from '../shared/deploy/PreviewAssetTransform.js'
import {PREVIEW_BUCKET_LIMIT_BYTES, projectIncrementalUsage} from './lib/upload-storage-budget.mjs'

// Local staging only. No network mutations and no removal of prior packages.
const root=path.resolve(process.cwd())
const args=process.argv.slice(2)
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:''
assert(option('--inventory') && option('--remote') && option('--out'),
  'Use --inventory <source inventory> --remote <live lsjson> --out <new .deploy directory>')
const read=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''))
const inventory=await read(option('--inventory')), remote=await read(option('--remote'))
assert.equal(inventory.kind,'current-source-inventory')
assert(remote.every(row=>!row.IsDir && Number.isSafeInteger(row.Size) && row.Size>=0))
const remoteKeys=new Map(remote.map(row=>[row.Path,row]))
assert.equal(remoteKeys.size,remote.length,'Duplicate remote object keys')
const previous=await read('.deploy/storage-compression/source-baseline.json')
const oldSources=new Map(previous.entries.map(entry=>[entry.request_key,entry.source_sha256]))
const output=path.resolve(option('--out')), relative=path.relative(path.join(root,'.deploy'),output)
assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative),'Output must stay inside .deploy')
assert.equal(await fs.realpath(path.join(root,'.deploy')),path.join(root,'.deploy'),'Linked staging parent')
await fs.mkdir(output) // Exclusive batch creation; never erase another run.
assert.equal(await fs.realpath(output),output)
const requestKeys=new Set()
let hashed=0
await runPool(inventory.entries,4,async entry=>{
  assert(!requestKeys.has(entry.request_key),'Duplicate source request')
  requestKeys.add(entry.request_key)
  const source=path.resolve(entry.source), before=await fs.stat(source), hash=await hashFile(source), after=await fs.stat(source)
  assert.equal(hash.size,entry.source_size,`Source size changed: ${entry.request_key}`)
  assert.equal(before.mtimeMs,after.mtimeMs,`Source changed during hash: ${entry.request_key}`)
  entry.source_sha256=hash.sha256
  if (++hashed%10000===0) console.log(`Hashed ${hashed}/${inventory.entries.length}`)
})
const dataRevision=createHash('sha256').update(JSON.stringify(inventory.entries
  .filter(entry=>isPreviewDataSnapshotKey(entry.request_key))
  .map(entry=>[entry.request_key,entry.source_sha256]))).digest('hex')
const selected=[]
for (const entry of inventory.entries) {
  const gzip=isPreviewGzipCandidate(entry.request_key)
  const objectKey=resolvePreviewObjectKey(entry.request_key,{gzip,dataRevision})
  if (!remoteKeys.has(objectKey) || oldSources.get(entry.request_key)!==entry.source_sha256) {
    selected.push({...entry,object_key:objectKey,transform:previewTransformKind(entry.request_key,{gzip})})
  }
}
console.log(JSON.stringify({selected:selected.length,dataRevision,missing:inventory.missing.length}))
const stage=path.join(output,'objects')
let staged=0
try {
  await runPool(selected,4,async entry=>{
    const target=path.join(stage,...entry.object_key.split('/'))
    assert(entry.object_key.split('/').every(part=>part && part!=='.' && part!=='..' && !part.includes('\\')))
    await fs.mkdir(path.dirname(target),{recursive:true})
    if (entry.transform===LOSSLESS_WEBP_TRANSFORM) {
      await encodeLosslessWebp({source:entry.source,target})
      assert.equal((await hashFile(entry.source)).sha256,entry.source_sha256,'PNG source changed during encoding')
      entry.deployed_content_type='image/webp'
    } else {
      const source=await fs.readFile(entry.source)
      assert.equal(createHash('sha256').update(source).digest('hex'),entry.source_sha256,'Source drift before staging')
      if (isPreviewGzipCandidate(entry.request_key)) {
        const encoded=encodeStructuredGzip(entry,source)
        await fs.writeFile(target,encoded.encoded,{flag:'wx'})
        Object.assign(entry,encoded.entry)
      } else {
        await fs.writeFile(target,source,{flag:'wx'})
        entry.deployed_content_type=entry.source_content_type
      }
    }
    const placed=await hashFile(target)
    entry.deployed_size=placed.size;entry.deployed_sha256=placed.sha256
    if (++staged%500===0) console.log(`Staged ${staged}/${selected.length}`)
  })
} finally {shutdownEncoderPool()}
const {targetBytes,positiveDelta,netDelta,projectedBytes,conservativePeakBytes}=projectIncrementalUsage(selected,remote)
const manifest={schema_version:3,kind:'incremental-preview',created_at:new Date().toISOString(),
  source_head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  inventory_sha256:(await hashFile(option('--inventory'))).sha256,
  remote_inventory_sha256:(await hashFile(option('--remote'))).sha256,
  remote_inventory_created_at:(await fs.stat(option('--remote'))).mtime.toISOString(),
  dataRevision,stage:'objects',missing:inventory.missing,entries:selected,
  totals:{files:selected.length,source_bytes:selected.reduce((sum,e)=>sum+e.source_size,0),
    deployed_bytes:selected.reduce((sum,e)=>sum+e.deployed_size,0),
    targetBytes,netDelta,positiveDelta,projectedBytes,conservativePeakBytes,
    limitBytes:PREVIEW_BUCKET_LIMIT_BYTES,uploadAllowed:conservativePeakBytes<PREVIEW_BUCKET_LIMIT_BYTES}}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(manifest.totals))
if (!manifest.totals.uploadAllowed) console.log('Do not upload: user approval is required at or above the limit.')
