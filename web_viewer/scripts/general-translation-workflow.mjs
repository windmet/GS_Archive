import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {parseJsonStrict} from './lib/strict-json.mjs'
import {planCompactBatches,compactContexts,renderCompactInput,renderCompactTemplate,parseCompactReturn} from './lib/general-translation-markdown.mjs'
import {sourceUnits,corpusHash,planBatches,hash,validateGeneralReturn,loadGeneralRevisions} from './lib/general-translation-batches.mjs'

const root=process.cwd(), [command,...args]=process.argv.slice(2)
const read=file=>parseJsonStrict(fs.readFileSync(file,'utf8'),file)
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const units=sourceUnits(root)
const readReturn=(file,batch)=>{const raw=fs.readFileSync(file,'utf8');return raw.trimStart().startsWith('{')?parseJsonStrict(raw,file):parseCompactReturn(batch,raw)}
if(command==='export') {
  const out=path.resolve(args[0]||'.analysis/general-translation-batches')
  assert(!fs.existsSync(out),'Output exists; use a new export directory to preserve source snapshots')
  const options=args.slice(1), legacy=options.includes('--legacy-json')
  const numberOption=(name,fallback)=>options.includes(name)?Number(options[options.indexOf(name)+1]):fallback
  for(let i=0;i<options.length;i++){if(options[i]==='--legacy-json')continue;assert(['--max-rows','--max-chars','--domains'].includes(options[i]),`Unknown export option ${options[i]}`);i++}
  // --domains card-lines: export only those shards (a later wave), numbering unchanged per shard.
  const domains=options.includes('--domains')?options[options.indexOf('--domains')+1].split(','):null
  const compact=legacy?null:planCompactBatches(units,{maxRows:numberOption('--max-rows',400),maxChars:numberOption('--max-chars',16000)})
  const existing=read('public/translations/zh-CN/archive-general.json').entries, batches=(legacy?planBatches(units):compact.batches).filter(batch=>!domains||domains.some(domain=>batch.batch_id.startsWith(`G-${domain}-`)))
  assert(batches.length,'No batches for the requested domains')
  fs.mkdirSync(out,{recursive:true})
  const local=path.join(out,'local');fs.mkdirSync(local)
  const plan={schema:'GS-GENERAL-PLAN-V2',format:legacy?'json-v1':'compact-markdown-v1',source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_digest:corpusHash(units),unique_units:units.length,source_references:units.reduce((n,u)=>n+u.references.length,0),max_rows:compact?.maxRows||100,max_input_characters:compact?.maxChars||null,batches:[]}
  for(const batch of batches) {
    const folder=path.join(out,batch.batch_id);fs.mkdirSync(folder)
    const localFolder=path.join(folder,'local');fs.mkdirSync(localFolder)
    const template={schema:'GS-GENERAL-RETURN-V1',batch_id:batch.batch_id,source_digest:batch.source_digest,entries:batch.rows.map(r=>({key:r.key,source_hash:r.sourceHash,source:r.source,translation:'',decision:'translated',notes:[]}))}
    const input=legacy?`# SideM GS 通用资料翻译 ${batch.batch_id}\n将日文资料译成自然简体中文，保护数字和占位符。仅修改 translation、decision、notes；疑义标 uncertain 并说明；纯资源键用 keep-source。严格返回以下 JSON，不要改身份或原文，不输出围栏。\n${JSON.stringify(template,null,2)}\n`:renderCompactInput(batch,compact.contexts)
    fs.writeFileSync(path.join(folder,'input.md'),input)
    write(path.join(localFolder,'batch-map.json'),{...batch,input_sha256:hash(input),return_format:plan.format})
    if(legacy)write(path.join(folder,'return-template.json'),template)
    else fs.writeFileSync(path.join(folder,'output-template.md'),renderCompactTemplate(batch))
    write(path.join(localFolder,'previous-draft.json'),batch.rows.map(r=>({key:r.key,source:r.source,previous_draft:existing[r.kind]?.[r.field]?.[r.source]||null,status:'draft'})))
    plan.batches.push({batch_id:batch.batch_id,units:batch.rows.length,source_digest:batch.source_digest,input_characters:input.length,input_bytes:Buffer.byteLength(input),source_characters:batch.rows.reduce((n,r)=>n+r.source.length,0)})
  }
  write(path.join(local,'plan.json'),plan)
  const idols=read('public/translations/zh-CN/entities/idols.json').entries
  const sourceNames=new Map(read('public/data/masterdata/idol_unit_dictionary.json').idols.map(row=>[row.idol_code,row.display_name]))
  // The full lookup stays local; the model receives only the existing display spellings.
  write(path.join(local,'glossary-reference.json'),{status:'draft-reference',idols:Object.fromEntries(Object.entries(idols).map(([id,e])=>[id,e.name]))})
  fs.writeFileSync(path.join(out,'glossary.md'),'# 项目姓名参考（暂用显示名，非官方中文译名）\n\n这份表只供姓名一致性参考；不要照搬旧译文口吻。疑义请在对应回传条目标记 ? 并说明。\n\n'+Object.entries(idols).map(([id,e])=>`${sourceNames.get(id)||id} → ${e.name}`).join('\n')+'\n')
  fs.writeFileSync(path.join(out,'README.md'),`# GS 通用资料 Gemini 翻译包 · 紧凑版\n\n${units.length} 个独立字段、${plan.source_references} 次使用，${batches.length} 批。每批最多 ${plan.max_rows} 条；紧凑版按完整 input.md 的实际字符量控制在 ${plan.max_input_characters||'旧模式'} 字符以内（包含指引和上下文）。\n\n## 给 AI Studio 的只有这些\n\n1. 新建会话，先粘贴 glossary.md（项目姓名参考）。\n2. 一次粘贴一个批次的 input.md。每份输入自带完整翻译指引；不要上传 local 文件夹。\n3. 将回答原样保存为该批次 output.md，不必手工改键值或转换 JSON。output-template.md 仅供核对格式，无需上传。\n4. 正常译文用 [001]，疑义用 [001?] 后加 ! 说明；纯资源键用 [001=]。多行译文可直接换行。编号不能遗漏或重排为新编号。\n\n## 留在本地的校验文件\n\n每批 local/batch-map.json 保存完整键值、原文、哈希和所有使用位置；local/previous-draft.json 只供本地对照。包根 local/plan.json 保存分批与版本审计。均无需提供给模型。\n\n## 本地检查与导入\n\n在仓库 web_viewer 目录执行，$batchDir 指向本批文件夹：\n\n\`\`\`powershell\n$batchDir = '这份包的绝对路径/G-items-001'\nnode scripts/general-translation-workflow.mjs check "$batchDir/local/batch-map.json" "$batchDir/output.md"\nnode scripts/general-translation-workflow.mjs import "$batchDir/local/batch-map.json" "$batchDir/output.md" 'Gemini / 实际模型名称'\nnode scripts/generate-archive-general-translations.mjs\nnode scripts/generate-translation-audit.mjs\n\`\`\`\n\n检查会在本地补回全部身份并验证漏项、重复、串批、来源变化、数值/占位符及危险 HTML。导入仅为 draft；人工逐批确认确切版本之后才可 reviewed，仍为 not_final。不要把结构通过当作译文质量已确认。\n\n旧 60 批 JSON 包仍可导入，但不能与本包交叉混用或重复导入重叠字段；旧包保持原样。详见仓库 docs/GS_ARCHIVE_GENERAL_TRANSLATION_WORKFLOW.md。\n`)
  console.log(JSON.stringify({output:out,batches:batches.length,unique_units:units.length,input_characters:plan.batches.reduce((n,b)=>n+b.input_characters,0),format:plan.format}))
} else if(command==='reinput') {
  // Re-render input.md for exported batches that have no returned translation yet (e.g. after the prompt policy changed).
  // Sources, keys and hashes are untouched; only the instructions change, so the batch map keeps validating returns.
  assert(args.length,'Usage: reinput <batch-folder>...')
  const revisions=loadGeneralRevisions(root,units), contexts=compactContexts(units)
  for(const arg of args) {
    const folder=path.resolve(arg), mapFile=path.join(folder,'local','batch-map.json'), batch=read(mapFile)
    assert(!fs.existsSync(path.join(folder,'output.md')),`${batch.batch_id} already has output.md; refusing to change its input`)
    assert(batch.rows.every(row=>!revisions.has(row.key)),`${batch.batch_id} is already imported; refusing to change its input`)
    const input=renderCompactInput(batch,contexts)
    fs.writeFileSync(path.join(folder,'input.md'),input)
    write(mapFile,{...batch,input_sha256:hash(input)})
    const planFile=path.join(path.dirname(folder),'local','plan.json')
    if(fs.existsSync(planFile)) {
      const plan=read(planFile), entry=plan.batches.find(b=>b.batch_id===batch.batch_id)
      if(entry){entry.input_characters=input.length;entry.input_bytes=Buffer.byteLength(input);write(planFile,plan)}
    }
    console.log(JSON.stringify({batch_id:batch.batch_id,input_characters:input.length,units:batch.rows.length}))
  }
} else if(command==='check' || command==='import') {
  assert(args[0]&&args[1],'Usage: check|import <batch-map.json> <output.md|return.json> [translator]')
  const batch=read(args[0]), returned=readReturn(args[1],batch), entries=validateGeneralReturn(batch,returned,units)
  if(command==='import') {
    assert(args[2]?.trim(),'Provide translator/model identity')
    assert(/^G-(photos|costumes|cards|skills|items|honors|card-lines)-\d{3}$/.test(batch.batch_id),'Unsafe batch ID')
    const existing=loadGeneralRevisions(root,units)
    assert(entries.every(e=>!existing.has(e.key)),'Batch overlaps an existing revision')
    const folder=path.join(root,'translation/studio/general/revisions');fs.mkdirSync(folder,{recursive:true})
    const target=path.join(folder,`${batch.batch_id}.json`)
    assert(!fs.existsSync(target),'Revision already exists; preserve it and explicitly supersede before reimporting')
    fs.writeFileSync(target,JSON.stringify({schema:'GS-GENERAL-REVISION-V1',status:'draft',not_final:true,translator:args[2],batch,return:returned,return_sha256:hash(JSON.stringify(returned))},null,2)+'\n',{flag:'wx'})
  }
  console.log(JSON.stringify({structure:'PASS',batch_id:batch.batch_id,units:entries.length,uncertain:entries.filter(e=>e.decision==='uncertain').length,status:'draft',published:false}))
} else if(command==='normalize') {
  assert(args.length===3,'Usage: normalize <batch-map.json> <output.md> <new-return.json>')
  const batch=read(args[0]),returned=readReturn(args[1],batch);validateGeneralReturn(batch,returned,units)
  fs.writeFileSync(args[2],JSON.stringify(returned,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({structure:'PASS',output:path.resolve(args[2]),published:false}))
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
} else throw Error('Usage: general-translation-workflow.mjs export <new-out-dir> [--max-rows 400 --max-chars 16000 --legacy-json] | normalize <map> <output.md> <new-json> | check|import <map> <return> [translator] | review <revision> <approval>')
