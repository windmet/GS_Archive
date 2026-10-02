import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const index=JSON.parse(fs.readFileSync('public/data/editorial/story-search-localization.json'))
for(const [file,hash] of Object.entries(index.sources))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,`Stale search localization: ${file}`)
const manifest=JSON.parse(fs.readFileSync('public/data/reading/manifest.json')).entries
const audit=new Map(JSON.parse(fs.readFileSync('config/translation-audit/stories.json')).map(row=>[row.id,row]))
for(const [file,status] of Object.entries(index.rows)){
 assert(['translated','partial','original','unknown'].includes(status))
 const docs=manifest.filter(doc=>doc.parent_file===file&&doc.status==='ready')
 const rows=docs.map(doc=>audit.get(doc.document_id)).filter((row,i)=>row?.sourceHash===docs[i].sha256)
 if(status==='translated')assert(docs.length&&rows.length===docs.length&&rows.every(row=>!row.missing&&!row.stale)&&rows.some(row=>row.draft+row.reviewed+row.final>0),file)
 if(status==='partial')assert(rows.some(row=>row.draft+row.reviewed+row.final>0),file)
 if(status==='original')assert(docs.length&&rows.length===docs.length&&rows.every(row=>row.draft+row.reviewed+row.final===0),file)
}
console.log(`Search localization: ${Object.keys(index.rows).length} file identities; exact Reader hashes, partial and unknown kept distinct`)
