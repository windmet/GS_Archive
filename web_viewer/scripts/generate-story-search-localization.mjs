import fs from 'node:fs'
import {createHash} from 'node:crypto'
const files=['public/data/reading/manifest.json','config/translation-audit/stories.json','public/data/masterdata/story_catalog.json']
const bytes=files.map(file=>fs.readFileSync(file))
const [manifest,audit,catalog]=bytes.map(value=>JSON.parse(value))
const audited=new Map(audit.map(row=>[row.id,row]))
const rows={}
for(const entry of catalog.entries){
 const docs=manifest.entries.filter(row=>row.parent_file===entry.file&&row.status==='ready')
 const valid=docs.map(doc=>audited.get(doc.document_id)).filter((row,index)=>row?.sourceHash===docs[index].sha256)
 const translated=valid.reduce((n,row)=>n+row.draft+row.reviewed+row.final,0)
 const complete=translated>0&&docs.length>0&&valid.length===docs.length&&valid.every(row=>!row.missing&&!row.stale)
 rows[entry.file]=complete?'translated':translated?'partial':docs.length&&valid.length===docs.length?'original':'unknown'
}
const value={sources:Object.fromEntries(files.map((file,i)=>[file,createHash('sha256').update(bytes[i]).digest('hex')])),rows}
fs.writeFileSync('public/data/editorial/story-search-localization.json',JSON.stringify(value)+'\n')
console.log(Object.values(rows).reduce((counts,status)=>(counts[status]=(counts[status]||0)+1,counts),{}))
