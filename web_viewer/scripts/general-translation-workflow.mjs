import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {parseJsonStrict} from './lib/strict-json.mjs'
import {sourceUnits,corpusHash,planBatches,hash,validateGeneralReturn,loadGeneralRevisions} from './lib/general-translation-batches.mjs'

const root=process.cwd(), [command,...args]=process.argv.slice(2)
const read=file=>parseJsonStrict(fs.readFileSync(file,'utf8'),file)
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const units=sourceUnits(root)
if(command==='export') {
  const out=path.resolve(args[0]||'.analysis/general-translation-batches')
  assert(!fs.existsSync(out),'Output exists; use a new export directory to preserve source snapshots')
  const existing=read('public/translations/zh-CN/archive-general.json').entries, batches=planBatches(units)
  fs.mkdirSync(out,{recursive:true})
  write(path.join(out,'plan.json'),{schema:'GS-GENERAL-PLAN-V1',source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_digest:corpusHash(units),unique_units:units.length,source_references:units.reduce((n,u)=>n+u.references.length,0),batches:batches.map(b=>({batch_id:b.batch_id,units:b.rows.length,source_digest:b.source_digest}))})
  const byReference=new Map()
  for(const unit of units)for(const ref of unit.references){const id=`${ref.kind}:${ref.id}`;const list=byReference.get(id)||[];list.push({field:unit.field,source:unit.source});byReference.set(id,list)}
  for(const batch of batches) {
    const folder=path.join(out,batch.batch_id);fs.mkdirSync(folder)
    write(path.join(folder,'batch-map.json'),batch)
    const template={schema:'GS-GENERAL-RETURN-V1',batch_id:batch.batch_id,source_digest:batch.source_digest,entries:batch.rows.map(r=>({key:r.key,source_hash:r.sourceHash,source:r.source,translation:'',decision:'translated',notes:[]}))}
    write(path.join(folder,'return-template.json'),template)
    fs.writeFileSync(path.join(folder,'input.md'),`# SideM GS 通用资料翻译 ${batch.batch_id}\n\n将以下日文游戏资料翻译成自然简洁的简体中文。只涉及名称与说明，不包含剧情台词、首页对话或工作通讯。references 是使用位置，不能当成文本；相同键在多个页面共享，译名保持一致。\n\n保护所有数字、参数 <value>、图标 [stamina]、占位符和英文专名。换行可以调整，但不可编造来源、衣装关联或解锁条件。不能确认的术语用 decision=uncertain 并在 notes 说明；纯资源键、没有可靠语义的标记用 keep-source 原样保留。不要仿照旧初译的生硬句式。人物称呼可参考项目 glossary，未经确认的译名须标注。\n\n严格输出一个 JSON 对象，结构与下面相同，不能改 schema、batch_id、source_digest、key、source_hash、source，不能漏行、增行、合并或排序改键。只填写 translation、decision、notes。不要输出额外解释或代码围栏。\n\n${JSON.stringify(template,null,2)}\n\n## 来源位置（仅供上下文）\n${JSON.stringify(batch.rows.map(({key,kind,field,references})=>({key,kind,field,references,related_source_fields:references.slice(0,3).map(ref=>({id:ref.id,fields:(byReference.get(`${ref.kind}:${ref.id}`)||byReference.get(`${ref.kind}:${ref.id.split(':')[0]}`)||[]).filter(item=>item.field!==field)}))})),null,2)}\n`)
    write(path.join(folder,'previous-draft.json'),batch.rows.map(r=>({key:r.key,source:r.source,previous_draft:existing[r.kind]?.[r.field]?.[r.source]||null,status:'draft'})))
  }
  const idols=read('public/translations/zh-CN/entities/idols.json').entries
  write(path.join(out,'glossary-reference.json'),{status:'draft-reference',note:'项目暂用显示名，非官方中文；疑义在回传 notes 标记。',idols:Object.fromEntries(Object.entries(idols).map(([id,e])=>[id,e.name]))})
  fs.writeFileSync(path.join(out,'README.md'),'先上传 glossary-reference.json，再逐批使用 input.md。旧译 previous-draft.json 独立保存，可选择不给 Gemini，以免旧译影响新译。保存回传为 return.json。完整命令及人工校对状态规则见仓库 docs/GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md。\n')
  console.log(JSON.stringify({output:out,batches:batches.length,unique_units:units.length}))
} else if(command==='check' || command==='import') {
  assert(args[0]&&args[1],'Usage: check|import <batch-map.json> <return.json> [translator]')
  const batch=read(args[0]), returned=read(args[1]), entries=validateGeneralReturn(batch,returned,units)
  if(command==='import') {
    assert(args[2]?.trim(),'Provide translator/model identity')
    assert(/^G-(photos|costumes|cards|skills|items|honors)-\d{3}$/.test(batch.batch_id),'Unsafe batch ID')
    const existing=loadGeneralRevisions(root,units)
    assert(entries.every(e=>!existing.has(e.key)),'Batch overlaps an existing revision')
    const folder=path.join(root,'translation/studio/general/revisions');fs.mkdirSync(folder,{recursive:true})
    const target=path.join(folder,`${batch.batch_id}.json`)
    assert(!fs.existsSync(target),'Revision already exists; preserve it and explicitly supersede before reimporting')
    fs.writeFileSync(target,JSON.stringify({schema:'GS-GENERAL-REVISION-V1',status:'draft',not_final:true,translator:args[2],batch,return:returned,return_sha256:hash(JSON.stringify(returned))},null,2)+'\n',{flag:'wx'})
  }
  console.log(JSON.stringify({structure:'PASS',batch_id:batch.batch_id,units:entries.length,uncertain:entries.filter(e=>e.decision==='uncertain').length,status:'draft',published:false}))
} else if(command==='review') {
  assert(args[0]&&args[1],'Usage: review <revision.json> <human-approval.json>')
  const target=path.resolve(args[0]), base=path.join(root,'translation/studio/general/revisions')+path.sep
  assert(target.startsWith(base),'Review only repository revisions')
  const record=read(target), approval=read(args[1])
  const entries=validateGeneralReturn(record.batch,record.return,units)
  assert.equal(approval.approved,true);assert.equal(approval.return_sha256,hash(JSON.stringify(record.return)))
  assert.equal(approval.batch_id,record.batch.batch_id);assert(approval.reviewer?.trim()&&approval.statement?.trim(),'Human reviewer and exact approval statement required')
  assert(entries.every(e=>e.decision!=='uncertain'),'Resolve uncertainty before review')
  write(target,{...record,status:'reviewed',not_final:true,approval})
  console.log(JSON.stringify({batch_id:approval.batch_id,status:'reviewed',units:entries.length,published:false}))
} else throw Error('Usage: general-translation-workflow.mjs export <new-out-dir> | check|import <map> <return> [translator] | review <revision> <approval>')
