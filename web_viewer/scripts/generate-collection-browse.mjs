import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const at=process.argv.indexOf('--models')
assert(at>=0,'Supply the verified --models directory')
const root=path.resolve(process.argv[at+1],'pages')
const bootstrap=JSON.parse(await fs.readFile(path.join(root,'_catalog/bootstrap.json'),'utf8'))
const read=async binding=>{
  const bytes=await fs.readFile(path.join(root,binding.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'),binding.sha256)
  assert.equal(bytes.length,binding.bytes)
  return JSON.parse(bytes).data
}
const entries={}
const inputs=new Map()
for(const domain of ['items','honors']) {
  const index=await read(bootstrap.domains[domain])
  for(const binding of index.pages) {
    const page=await read(binding)
    for(const row of page.rows) {
      let payload=inputs.get(row.detail.url)
      if(!payload){
        const bytes=await fs.readFile(path.join(root,row.detail.url))
        assert.equal(createHash('sha256').update(bytes).digest('hex'),row.detail.sha256)
        assert.equal(bytes.length,row.detail.bytes)
        payload=JSON.parse(bytes).data;inputs.set(row.detail.url,payload)
      }
      const view=payload.rows.find(record=>String(record.id)===String(row.id))?.view
      assert(view?.entry && String(view.entry.id)===String(row.id))
      assert.equal(view.entry.nameJa,row.nameJa)
      assert.equal(view.entry.resourceId,row.resourceId)
      const key=`${domain==='items'?'item':'honor'}:${row.id}`
      assert.equal(view.entry.key,key)
      entries[key]={nameJa:row.nameJa,resourceId:row.resourceId,
        ...(domain==='items'?{description:view.entry.descriptionText?.plain || ''}:{}),
        sourceCount:(view.sources || []).length,
        sources:(view.sources || []).slice(0,1).map(({event,scope,relation,sourceTable,level,totalPoint,upperRank,lowerRank,totalCount,dayCount,sumFanAmount})=>Object.fromEntries(Object.entries({event,scope,relation,sourceTable,level,totalPoint,upperRank,lowerRank,totalCount,dayCount,sumFanAmount}).filter(([,v])=>v!==undefined)))}
    }
  }
}
const result={schemaVersion:1,release:bootstrap.release,entries}
const content=JSON.stringify(result)+'\n'
await fs.writeFile('config/collection-browse.v1.json',content)
console.log(`${Object.keys(entries).length} source-bound collection summaries; ${Buffer.byteLength(content)} B; release ${bootstrap.release}`)
