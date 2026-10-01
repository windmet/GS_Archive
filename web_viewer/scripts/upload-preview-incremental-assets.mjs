import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {hashFile} from './lib/preview-source-baseline.mjs'
import {runPool} from './lib/lossless-webp.mjs'
import {checkStorageBudget, readLiveStorageUsage, projectIncrementalUsage} from './lib/upload-storage-budget.mjs'
import {isPreviewGzipCandidate, resolvePreviewObjectKey, previewTransformKind, LOSSLESS_WEBP_TRANSFORM} from '../shared/deploy/PreviewAssetTransform.js'

// Copy an explicitly validated incremental batch. Never sync or delete objects.
const [manifestFile, remote, mode='--plan']=process.argv.slice(2)
assert(manifestFile && /^[\w-]+:[^/\s]+$/.test(remote || ''),'Supply manifest.json remote:bucket [--plan|--upload]')
assert(['--plan','--upload'].includes(mode))
const root=path.resolve(process.cwd()), directory=path.dirname(path.resolve(manifestFile))
const relative=path.relative(path.join(root,'.deploy'),directory)
assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative),'Batch must stay inside .deploy')
assert.equal(await fs.realpath(directory),directory,'Linked batch directory')
const raw=await fs.readFile(manifestFile), manifest=JSON.parse(raw)
assert.equal(manifest.kind,'incremental-preview')
const images=JSON.parse(await fs.readFile(path.join(directory,'image-validation.json'),'utf8'))
assert.equal(images.manifest_sha256,createHash('sha256').update(raw).digest('hex'),'Stale image verification')
assert.equal(images.dimensions_and_visible_pixels_preserved,true)
assert.equal(images.converted_pngs,manifest.entries.filter(e=>e.transform===LOSSLESS_WEBP_TRANSFORM).length)
assert.equal(images.lossless_terminal_derivatives,manifest.entries.filter(e=>e.request_key.startsWith('assets/terminal/') && e.object_key.endsWith('.webp')).length)
const stage=path.join(directory,manifest.stage)
assert.equal(await fs.realpath(stage),stage)
const keys=new Set(), groups=new Map()
let checked=0
await runPool(manifest.entries,4,async entry=>{
  assert(entry.object_key.split('/').every(part=>part && part!=='.' && part!=='..' && !part.includes('\\')))
  assert(!keys.has(entry.object_key),'Duplicate destination key'); keys.add(entry.object_key)
  assert.equal(entry.object_key,resolvePreviewObjectKey(entry.request_key,
    {gzip:isPreviewGzipCandidate(entry.request_key),dataRevision:manifest.dataRevision}))
  assert.equal(entry.transform,previewTransformKind(entry.request_key,{gzip:isPreviewGzipCandidate(entry.request_key)}))
  const target=path.join(stage,...entry.object_key.split('/')), staged=await hashFile(target)
  assert.equal(staged.sha256,entry.deployed_sha256,`Staged bytes changed: ${entry.object_key}`)
  assert.equal(staged.size,entry.deployed_size)
  assert.equal((await hashFile(entry.source)).sha256,entry.source_sha256,`Source changed: ${entry.request_key}`)
  if (entry.deployed_content_encoding==='gzip') {
    assert(isPreviewGzipCandidate(entry.request_key))
    const unpacked=gunzipSync(await fs.readFile(target))
    assert.equal(createHash('sha256').update(unpacked).digest('hex'),entry.source_sha256)
  }
  const immutable=entry.object_key.startsWith('versions/') || entry.object_key.startsWith('assets/terminal/')
  const groupKey=JSON.stringify([entry.deployed_content_type,entry.deployed_content_encoding || '',immutable])
  if (!groups.has(groupKey)) groups.set(groupKey,[])
  groups.get(groupKey).push(entry.object_key)
  if (++checked%2000===0) console.log(`Verified staged objects: ${checked}/${manifest.entries.length}`)
})
const run=args=>{
  const result=spawnSync('rclone',args,{encoding:'utf8',windowsHide:true,maxBuffer:80*1024*1024})
  if (result.error) throw result.error
  assert.equal(result.status,0,`rclone failed: ${result.stderr}`)
  return result.stdout
}
// Refresh immediately before copying: old inventory is planning evidence only.
const liveRaw=run(['lsjson',remote,'--recursive','--files-only','--no-mimetype','--no-modtime'])
await fs.writeFile(path.join(directory,'pre-upload-remote.json'),liveRaw)
const live=JSON.parse(liveRaw)
const {targetBytes,positiveDelta,projectedBytes}=projectIncrementalUsage(manifest.entries,live)
const usage=readLiveStorageUsage(remote)
assert.equal(usage.targetBytes,targetBytes,'Bucket changed during storage check; rerun before uploading')
const budget=checkStorageBudget({...usage,uploadBytes:positiveDelta})
const receipt={mode,checked_at:new Date().toISOString(),manifest_sha256:images.manifest_sha256,
  remote,objects:manifest.entries.length,projected_bytes:projectedBytes,conservative_peak_bytes:budget.projectedTarget,budget}
await fs.writeFile(path.join(directory,'upload-budget.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt))
if (mode==='--upload') {
  let index=0
  for (const [groupKey,objects] of groups) {
    const [contentType,encoding,immutable]=JSON.parse(groupKey)
    assert(contentType && !/[\r\n]/.test(contentType))
    const list=path.join(directory,`upload-keys-${++index}.txt`)
    await fs.writeFile(list,objects.sort().join('\n')+'\n')
    const args=['copy',stage,remote,'--files-from-raw',list,'--checksum','--metadata',
      '--metadata-set',`content-type=${contentType}`,'--transfers','4','--checkers','8','--stats','1m']
    if (encoding) args.push('--metadata-set',`content-encoding=${encoding}`)
    if (immutable) args.push('--immutable')
    console.log(`Uploading group ${index}/${groups.size}: ${objects.length} objects (${contentType}${encoding ? ', '+encoding : ''})`)
    const result=spawnSync('rclone',args,{stdio:'inherit',windowsHide:true})
    if (result.error) throw result.error
    assert.equal(result.status,0,'Incremental object upload failed; test-page deployment must stop')
  }
  const after=readLiveStorageUsage(remote)
  assert.equal(after.targetBytes,receipt.projected_bytes,'Unexpected bucket size after upload')
  checkStorageBudget({...after,uploadBytes:0})
  await fs.writeFile(path.join(directory,'upload-receipt.json'),JSON.stringify({...receipt,
    completed_at:new Date().toISOString(),actual_bucket_bytes:after.targetBytes,other_bucket_bytes:after.otherBytes},null,2)+'\n')
  console.log(JSON.stringify({uploaded:true,...after}))
}
