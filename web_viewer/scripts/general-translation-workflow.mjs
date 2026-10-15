import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {parseJsonStrict} from './lib/strict-json.mjs'
import {planCompactBatches,compactContexts,renderCompactInput,renderCompactTemplate,parseCompactReturn} from './lib/general-translation-markdown.mjs'
import {sourceUnits,corpusHash,hash,validateGeneralReturn,GENERAL_REPAIRS} from './lib/general-translation-batches.mjs'
import {readMemory,writeMemory,memoryReport,checkEntry} from './lib/translation-memory.mjs'
import {KINDS,SHARD_NAMES} from './lib/translation-domains.mjs'

// General (source-text) translation: export the units the translation memory lacks, check and
// import a returned batch entry by entry, record a human review, verify. See
// docs/GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md.
const root=process.cwd(), [command,...args]=process.argv.slice(2)
const read=file=>parseJsonStrict(fs.readFileSync(file,'utf8'),file)
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const option=(name,fallback=null)=>{const at=args.indexOf(name);return at>=0?args[at+1]:fallback}
const flag=name=>args.includes(name)
const units=sourceUnits(root)
const readReturn=(file,batch)=>{const raw=fs.readFileSync(file,'utf8');return raw.trimStart().startsWith('{')?parseJsonStrict(raw,file):parseCompactReturn(batch,raw)}
const REVIEWS='translation/tm/reviews.json'
const publishedEntries=()=>{
  const entries={...read('public/translations/zh-CN/archive-general.json').entries}
  for(const name of SHARD_NAMES){const file=`public/translations/zh-CN/archive-general/${name}.json`;if(fs.existsSync(file))Object.assign(entries,read(file).entries)}
  return entries
}
const today=()=>new Date().toISOString().slice(0,10)
const USAGE=`Usage: general-translation-workflow.mjs
  export <new-out-dir> [--domains chats,card-lines] [--wave 20261015] [--with-drafts|--all] [--max-rows 400] [--max-chars 16000]
  check  <batch-map.json> <output.md>
  import <batch-map.json> <output.md> <translator> [--replace]
  review <batch-id> --reviewer <name> --statement <the reviewer's words> [--date YYYY-MM-DD]
  amend  <${Object.keys(GENERAL_REPAIRS).join('|')}> [--batch <batch-id>]
  status | verify | prune --confirm | reinput <batch-folder>...`

if(command==='export') {
  assert(args[0]&&!args[0].startsWith('--'),USAGE)
  const out=path.resolve(args[0])
  assert(!fs.existsSync(out),'Output exists; use a new export directory')
  const domains=option('--domains')?.split(',')||null
  if(domains)for(const domain of domains)assert(SHARD_NAMES.includes(domain),`Unknown domain ${domain}; one of ${SHARD_NAMES.join(', ')}`)
  const wave=option('--wave',today().replaceAll('-',''))
  // Default: units with no translation at all. --with-drafts adds those that only have a generated
  // (rule-based) draft; --all re-exports translated units too, for a revision pass.
  const memory=readMemory(root), published=publishedEntries()
  const include=unit=>flag('--all')||!memory.has(unit.key)&&(flag('--with-drafts')||!published[unit.kind]?.[unit.field]?.[unit.source])
  const compact=planCompactBatches(units,{maxRows:Number(option('--max-rows',400)),maxChars:Number(option('--max-chars',16000)),wave,include})
  const batches=compact.batches.filter(batch=>!domains||domains.some(domain=>batch.batch_id.startsWith(`G-${domain}-`)))
  assert(batches.length,'Nothing to export for the requested domains')
  const used=new Set([...memory.values()].map(entry=>entry.batch))
  for(const batch of batches)assert(!used.has(batch.batch_id),`Batch ID ${batch.batch_id} is already in the memory; pass another --wave`)
  fs.mkdirSync(path.join(out,'local'),{recursive:true})
  const plan={schema:'GS-GENERAL-PLAN-V3',format:'compact-markdown-v1',source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_digest:corpusHash(units),wave,unique_units:batches.reduce((n,b)=>n+b.rows.length,0),max_rows:compact.maxRows,max_input_characters:compact.maxChars,batches:[]}
  for(const batch of batches) {
    const folder=path.join(out,batch.batch_id);fs.mkdirSync(path.join(folder,'local'),{recursive:true})
    const input=renderCompactInput(batch,compact.contexts)
    fs.writeFileSync(path.join(folder,'input.md'),input)
    write(path.join(folder,'local','batch-map.json'),{...batch,input_sha256:hash(input),return_format:plan.format})
    fs.writeFileSync(path.join(folder,'output-template.md'),renderCompactTemplate(batch))
    // A --all re-export shows the current translation for comparison.
    const previous=batch.rows.filter(r=>memory.has(r.key)).map(r=>({key:r.key,source:r.source,current:memory.get(r.key).translation,status:memory.get(r.key).status}))
    if(previous.length)write(path.join(folder,'local','current-translations.json'),previous)
    plan.batches.push({batch_id:batch.batch_id,units:batch.rows.length,source_digest:batch.source_digest,input_characters:input.length,source_characters:batch.rows.reduce((n,r)=>n+r.source.length,0)})
  }
  write(path.join(out,'local','plan.json'),plan)
  const idols=read('public/translations/zh-CN/entities/idols.json').entries
  const sourceNames=new Map(read('public/data/masterdata/idol_unit_dictionary.json').idols.map(row=>[row.idol_code,row.display_name]))
  fs.writeFileSync(path.join(out,'glossary.md'),'# 项目姓名参考（暂用显示名，非官方中文译名）\n\n这份表只供姓名一致性参考；不要照搬旧译文口吻。疑义请在对应回传条目标记 ? 并说明。\n\n'+Object.entries(idols).map(([id,e])=>`${sourceNames.get(id)||id} → ${e.name}`).join('\n')+'\n')
  fs.writeFileSync(path.join(out,'README.md'),`# GS 通用翻译包 ${wave}\n\n${plan.unique_units} 条，${batches.length} 批。\n\n1. 新建 AI Studio 会话，先粘贴 glossary.md。\n2. 一次粘贴一个批次的 input.md；不要上传 local 文件夹。\n3. 回答原样存为该批次的 output.md。\n4. 在仓库 web_viewer 下：\n\n\`\`\`powershell\n$b = '<本包路径>/<批次>'\nnode scripts/general-translation-workflow.mjs check "$b/local/batch-map.json" "$b/output.md"\nnode scripts/general-translation-workflow.mjs import "$b/local/batch-map.json" "$b/output.md" 'Gemini / 模型名'\nnode scripts/generate-archive-general-translations.mjs\n\`\`\`\n\n导入写入 translation/tm/zh-CN，状态为 draft；人工校对后运行 review。详见 docs/GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md。\n`)
  console.log(JSON.stringify({output:out,wave,batches:batches.length,units:plan.unique_units,input_characters:plan.batches.reduce((n,b)=>n+b.input_characters,0)}))
} else if(command==='reinput') {
  // Re-render input.md for batches with no returned translation yet (e.g. after a prompt change).
  assert(args.length,USAGE)
  const memory=readMemory(root), contexts=compactContexts(units)
  for(const arg of args) {
    const folder=path.resolve(arg), mapFile=path.join(folder,'local','batch-map.json'), batch=read(mapFile)
    assert(!fs.existsSync(path.join(folder,'output.md')),`${batch.batch_id} already has output.md; refusing to change its input`)
    assert(![...memory.values()].some(entry=>entry.batch===batch.batch_id),`${batch.batch_id} is already imported; refusing to change its input`)
    const input=renderCompactInput(batch,contexts)
    fs.writeFileSync(path.join(folder,'input.md'),input)
    write(mapFile,{...batch,input_sha256:hash(input)})
    console.log(JSON.stringify({batch_id:batch.batch_id,input_characters:input.length,units:batch.rows.length}))
  }
} else if(command==='check' || command==='import') {
  assert(args[0]&&args[1],USAGE)
  const batch=read(args[0]), returned=readReturn(args[1],batch), entries=validateGeneralReturn(batch,returned,units)
  const memory=readMemory(root), replace=flag('--replace')
  const same=new Set(), conflicts=[]
  for(const entry of entries) {
    const old=memory.get(entry.key)
    if(!old)continue
    if(old.translation===entry.translation&&old.decision===entry.decision)same.add(entry.key)
    else conflicts.push({key:entry.key,status:old.status,batch:old.batch})
  }
  const summary={structure:'PASS',batch_id:batch.batch_id,units:entries.length,uncertain:entries.filter(e=>e.decision==='uncertain').length,
    orphans:entries.filter(e=>e.orphan).length,unchanged:same.size,conflicts:conflicts.length}
  if(command==='import') {
    const translator=args[2]
    assert(translator?.trim()&&!translator.startsWith('--'),'Provide translator/model identity')
    // A different translation replaces an existing one only on request; git keeps the old text.
    assert(!conflicts.length||replace,`${conflicts.length} entries already have another translation (first: ${conflicts[0]?.key} from ${conflicts[0]?.batch}, ${conflicts[0]?.status}); pass --replace to overwrite them as draft`)
    let written=0
    for(const entry of entries) {
      if(same.has(entry.key))continue
      memory.set(entry.key,{kind:entry.kind,field:entry.field,source:entry.source,translation:entry.translation,status:'draft',decision:entry.decision,notes:entry.notes,translator,batch:batch.batch_id})
      written++
    }
    writeMemory(root,memory)
    Object.assign(summary,{written,status:'draft'})
  }
  console.log(JSON.stringify(summary))
} else if(command==='review') {
  // A human approval for one batch as it now stands in the memory. Promotes its entries.
  const batchId=args[0], reviewer=option('--reviewer'), statement=option('--statement'), date=option('--date',today())
  assert(batchId&&!batchId.startsWith('--')&&reviewer?.trim()&&statement?.trim(),USAGE)
  const memory=readMemory(root), entries=[...memory].filter(([,entry])=>entry.batch===batchId)
  assert(entries.length,`No memory entries from ${batchId}`)
  const uncertain=entries.filter(([,entry])=>entry.decision==='uncertain')
  assert(!uncertain.length,`Resolve ${uncertain.length} uncertain entries first (first: ${uncertain[0]?.[0]})`)
  for(const [key,entry] of entries){const next={...entry,status:'reviewed',reviewer};checkEntry(key,next);memory.set(key,next)}
  writeMemory(root,memory)
  const log=fs.existsSync(REVIEWS)?read(REVIEWS):{schema:'GS-TM-REVIEWS-V1',reviews:[]}
  log.reviews.push({batch:batchId,entries:entries.length,reviewer,statement,date})
  fs.writeFileSync(REVIEWS,JSON.stringify(log,null,1)+'\n')
  console.log(JSON.stringify({batch_id:batchId,status:'reviewed',units:entries.length}))
} else if(command==='amend') {
  // A named mechanical repair over memory entries; wording and status otherwise stay.
  const repair=GENERAL_REPAIRS[args[0]], batchId=option('--batch')
  assert(repair,USAGE)
  const memory=readMemory(root); let changes=0
  for(const [key,entry] of memory) {
    if(batchId&&entry.batch!==batchId)continue
    const after=repair(entry.translation)
    if(after===entry.translation)continue
    const next={...entry,translation:after};checkEntry(key,next);memory.set(key,next);changes++
  }
  writeMemory(root,memory)
  console.log(JSON.stringify({repair:args[0],batch:batchId,changes}))
} else if(command==='status' || command==='verify') {
  // verify is strict: every memory entry matches its source and passes the content rules.
  const report=memoryReport(root,units,{strict:command==='verify'})
  const kinds={}
  for(const unit of units){const k=kinds[unit.kind]||={label:KINDS[unit.kind].label,total:0,draft:0,reviewed:0,final:0,missing:0};k.total++;k[report.live.get(unit.key)?.status||'missing']++}
  if(command==='status')console.log(JSON.stringify({memory:report.memory.size,live:report.live.size,orphans:report.orphans.length,invalid:report.invalid,kinds},null,2))
  else console.log(`PASS: ${report.live.size} translation memory entries valid for their sources; ${report.orphans.length} orphaned`)
} else if(command==='prune') {
  // Orphans are entries whose source left the corpus. They stay until removed on purpose.
  assert(flag('--confirm'),'prune removes orphaned memory entries; pass --confirm')
  const report=memoryReport(root,units)
  for(const key of report.orphans)report.memory.delete(key)
  writeMemory(root,report.memory)
  console.log(JSON.stringify({removed:report.orphans.length}))
} else throw Error(USAGE)
