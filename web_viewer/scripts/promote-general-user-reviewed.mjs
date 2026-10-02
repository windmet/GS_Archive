import fs from 'node:fs'
import {sourceUnits,validateGeneralReturn,hash} from './lib/general-translation-batches.mjs'

// This receipt applies only to the exact supplied batches, never the whole corpus.
const batches=['costumes-001','costumes-002','cards-001','cards-002','items-001','items-002','items-003','items-004','honors-001','honors-002','honors-003','honors-004','honors-005']
const units=sourceUnits(process.cwd())
let count=0
for(const suffix of batches){
  const id=`G-${suffix}`,file=`translation/studio/general/revisions/${id}.json`
  const record=JSON.parse(fs.readFileSync(file,'utf8'))
  const rows=validateGeneralReturn(record.batch,record.return,units)
  if(rows.some(row=>row.decision==='uncertain'))throw Error(`Unresolved uncertainty: ${id}`)
  if(hash(JSON.stringify(record.return))!==record.return_sha256)throw Error(`Return changed: ${id}`)
  if(record.status==='reviewed'){count+=rows.length;continue}
  const approval={approved:true,batch_id:id,return_sha256:record.return_sha256,reviewer:'用户 windm',
    statement:'另外我们前面给你回填的翻译字段记得在审计内标记为已校对 ，我看过了整体没什么太大问题',
    approved_at:'2026-10-02',scope:'本批用户回填版本，含按用户要求统一偶像译名及脚炼改为脚链；仍非最终定稿。'}
  fs.writeFileSync(file,JSON.stringify({...record,status:'reviewed',not_final:true,approval},null,2)+'\n')
  count+=rows.length
}
console.log(JSON.stringify({batches:batches.length,reviewed:count,not_final:true}))
