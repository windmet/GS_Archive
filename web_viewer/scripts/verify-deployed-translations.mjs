import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'

// Proves a deployment serves the translation release this checkout binds: the deployed manifest
// equals the committed one, and every pack under ?rev=<release> has the manifest's bytes.
// A self-consistent local manifest says nothing about what R2 or Pages actually returns.
//   node scripts/verify-deployed-translations.mjs https://preview.gs-archive.com
const [origin]=process.argv.slice(2)
assert(/^https:\/\/[^/]+\/?$/.test(origin || ''),'Supply an HTTPS origin')
const root=path.resolve(import.meta.dirname,'..')
const local=JSON.parse(await fs.readFile(path.join(root,'public/translations/manifest.json'),'utf8'))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const get=key=>new Promise((resolve,reject)=>{
  const req=https.get(new URL(key,origin),{headers:{'Accept-Encoding':'identity'}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject)
    res.on('end',()=>{
      let body=Buffer.concat(chunks)
      if(res.headers['content-encoding']==='gzip') body=gunzipSync(body)
      resolve({status:res.statusCode,type:res.headers['content-type']||'',body})
    })
  })
  req.setTimeout(30000,()=>req.destroy(new Error(`HTTP timeout: ${key}`)));req.on('error',reject)
})
const json=response=>{
  // The SPA fallback answers missing keys with HTML 200; that is a missing pack, not a pack.
  assert.equal(response.status,200)
  assert.doesNotMatch(response.type,/text\/html/)
  return JSON.parse(response.body.toString('utf8'))
}
const deployed=json(await get(`/translations/manifest.json?rev=${local.release}`))
assert.equal(deployed.release,local.release,`deployed translation release ${deployed.release} is not this checkout's ${local.release}`)
assert.deepEqual(deployed.entries,local.entries,'deployed manifest entries differ from the committed manifest')

const failures=[]
let next=0
await Promise.all(Array.from({length:8},async()=>{
  while(next<local.entries.length) {
    const entry=local.entries[next++]
    try {
      const response=await get(`/translations/${entry.file}?rev=${local.release}`)
      if(response.status!==200 || /text\/html/.test(response.type)) failures.push(`${entry.file}: HTTP ${response.status} ${response.type}`)
      else if(hash(response.body)!==entry.sha256 || response.body.length!==entry.bytes) failures.push(`${entry.file}: bytes differ from manifest`)
    } catch(error) { failures.push(`${entry.file}: ${error.message}`) }
  }
}))
assert.deepEqual(failures.slice(0,20),[],`${failures.length} of ${local.entries.length} deployed packs fail`)
console.log(`Deployed translations: ${origin} serves release ${local.release.slice(0,12)}; ${local.entries.length} packs match the manifest byte for byte`)
