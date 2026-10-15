import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {shards,sourceUnits,loadGeneralRevisions,corpusHash} from './lib/general-translation-batches.mjs'
import {memoryReport} from './lib/translation-memory.mjs'
import {KINDS} from './lib/translation-domains.mjs'
import {loadStudioIndexes,loadStudioDocument,sha256} from './lib/ai-studio-source.mjs'
import {validateStoryTranslationOverlay} from '../src/localization/story/TranslationRepository.js'
import {normalizeEntitySourceText,validateEntityTranslationOverlay} from '../src/localization/story/EntityTranslationRepository.js'
import {IDOL_ID_TO_NAME} from '../src/utils/IdolNameMap.js'
import {sourceHash} from './lib/gasha-ticket-evidence.mjs'
import zh from '../src/localization/ui/locales/zh-CN.js'
import ja from '../src/localization/ui/locales/ja-JP.js'

const root=process.cwd(), read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
// Card-line and chat kinds live only in lazy shards, not the root overlay.
const generalDrafts=()=>{
 const entries={...read('public/translations/zh-CN/archive-general.json').entries}
 for(const name of Object.keys(shards))Object.assign(entries,read(`public/translations/zh-CN/archive-general/${name}.json`).entries)
 return entries
}
// The audit reports drift instead of failing on it: the build reads this audit, and a corpus or
// memory change must not stop the build. The strict check is `general-translation-workflow.mjs verify`.
const units=sourceUnits(root), drafts=generalDrafts(), report=memoryReport(root,units), revisions=report.live
let unpublished=0
const tally=()=>({total:0,draft:0,reviewed:0,final:0,missing:0,stale:0,uncertain:0,keptSource:0})
const groups=new Map(), group=(id,label)=>{if(!groups.has(id))groups.set(id,{id,label,...tally()});return groups.get(id)}
const labels=Object.fromEntries(Object.entries(KINDS).map(([kind,info])=>[kind,info.label]))
const details=units.map(u=>{
 const revision=revisions.get(u.key), translation=drafts[u.kind]?.[u.field]?.[u.source]||''
 if(revision&&translation!==revision.translation)unpublished++
 const status=translation ? revision?.status || 'draft':'missing', g=group(u.kind,labels[u.kind]||u.kind)
 g.total++;g[status]++;if(revision?.decision==='uncertain')g.uncertain++;if(revision?.decision==='keep-source')g.keptSource++
 return {key:u.key,kind:u.kind,field:u.field,source:u.source,sourceHash:u.sourceHash,translation,status,batch:revision?.batch_id||null,references:u.references,notes:revision?.notes||[],translator:revision?.translator||'项目初译',decision:revision?.decision||null}
})
const indexes=await loadStudioIndexes(), overlays=new Map(), documents=[], allUnits=new Set()
const domainLabels={event:'活动剧情',main:'主线剧情',unit:'组合剧情',work:'工作剧情',birthday:'生日剧情',extra:'额外剧情',card:'卡片剧情',idol:'偶像剧情',mobile:'工作通讯',main_story:'主线剧情',unit_story:'组合剧情',card_scenarios:'卡片剧情',idol_story:'偶像剧情',work_story:'工作剧情',mobile_archive:'工作通讯',event_story:'活动剧情',seasonal:'季节企划'}
for(const entry of indexes.reading.entries) {
 const loaded=await loadStudioDocument(entry,indexes), catalog=loaded.evidence.scenario_id
 let overlay=overlays.get(catalog)
 if(overlay===undefined) {
  const file=path.join(root,'public/translations/zh-CN/scenarios',`${catalog}.json`)
  overlay=fs.existsSync(file)?read(path.relative(root,file)):null
  if(overlay && !validateStoryTranslationOverlay(overlay,{scenarioId:catalog,locale:'zh-CN'}).valid)overlay={invalid:true,entries:{}}
  overlays.set(catalog,overlay)
 }
 const stats=tally(), domain=`story:${entry.domain}`, g=group(domain,domainLabels[entry.domain]||`剧情 · ${entry.domain}`)
 for(const unit of loaded.evidence.text_units) {
  const target=overlay?.entries[unit.unit_id]
  const status=overlay?.invalid || target && (overlay.source_raw_hash!==loaded.evidence.source_raw_hash || target.source_hash!==unit.source_hash) ? 'stale' : target?.text?.trim() ? target.status : 'missing'
  stats.total++;stats[status]++
  if(!allUnits.has(unit.unit_id)){allUnits.add(unit.unit_id);g.total++;g[status]++}
 }
 documents.push({id:entry.document_id,domain,catalog,title:entry.title||entry.document_id,...stats,sourceHash:loaded.readerHash,rawHash:loaded.evidence.source_raw_hash,url:`?view=reader&reading=${encodeURIComponent(entry.document_id)}`})
}
const ui=group('ui','播放器界面词条（已提取部分）')
for(const key of Object.keys(zh)){
 const status=ja[key]?'draft':'missing';ui.total++;ui[status]++
 details.push({key,kind:'ui',field:'label',source:ja[key]||'未提供日文词条',translation:zh[key],status,batch:null,references:[{kind:'ui',id:key,field:'label'}],notes:[],translator:'项目界面词条',decision:null})
}
for(const type of ['idol','npc']) {
 const overlay=read(`public/translations/zh-CN/entities/${type}s.json`), id=`entity-${type}`, g=group(id,type==='idol'?'偶像显示名':'NPC 显示名')
 assert(validateEntityTranslationOverlay(overlay,{entityType:type,locale:'zh-CN'}).valid,'Invalid entity overlay')
 for(const [key,entry]of Object.entries(overlay.entries)) {
  const source=IDOL_ID_TO_NAME[key]||'', status=sha256(normalizeEntitySourceText(source))===entry.source_hash?entry.status:'stale'
  g.total++;g[status]++
  details.push({key:`${id}:${key}`,kind:id,field:'name',source,translation:entry.name,status,batch:null,references:[{kind:id,id:key,field:'name'}],notes:entry.notes||[],translator:entry.translator||'项目暂用显示名',decision:null})
 }
}
// Audio-only lines are counted from the same files the pages read, so these totals move with the data.
const operational=Object.values(read('public/data/masterdata/card_detail_index.json').cards_by_resource_id).flatMap(card=>card.operational_voice_cues||[])
const unusedCues=read('src/data/unusedVoiceArchive.json').families.flatMap(f=>f.speakers.flatMap(s=>s.cues))
const pending=[
 {id:'card-voice-audio-only',label:'卡面演出语音（仅有音频）',total:operational.filter(c=>c.text_source==='audio_only').length,status:'audio-only',note:'主数据与已抓取的 wiki 卡页都没有文字；剩余 wiki 卡页继续转录后会进入「卡面文本·演出语音」。'},
 {id:'home-live-result',label:'首页 LiveResult 语音',total:null,status:'audio-only',note:'主数据 343 行指向 3_2_NNN 脚本，脚本只有语音指令没有文字；需先听写音频，未计入首页语音·通用。'},
 {id:'unused-audio-only',label:'其他语音（仅有音频）',total:unusedCues.filter(c=>!c.text).length,status:'audio-only',note:'其他语音存档中没有脚本文字的条目（含标题呼号）；只有齋藤 3_1_102 的有文字条目计入「未使用语音」。'},
 {id:'hardcoded-ui',label:'尚未提取的界面文案 / 活动与歌曲专名',total:null,status:'unmeasured',note:'语言开关切换已接入的名称与说明；硬编码导航、偶像详细资料和文案尚未全量本地化，不计作已翻译。'},
 {id:'image-text',label:'图片内文字、歌词与未进入 Reader 的原始文本',total:null,status:'unmeasured',note:'本审计不覆盖这些原始资源；不能由已有目录数量推断翻译完成。'},
]
const gashaEvidence=read('public/data/editorial/gasha-ticket-evidence.json'),gashaGroup=group('gasha','卡池名称（含道具补录）')
for(const row of gashaEvidence.rows){
 assert.equal(row.source_hash,sourceHash(row.source_name),'Gasha name source changed')
 const ticket=row.tickets.find(t=>t.id===row.translation_item_id),revision=ticket?revisions.get(`metadata:v1:item:name:${sourceHash(ticket.source_name)}`):null
 gashaGroup.total++;gashaGroup[row.status]++
 details.push({key:`metadata:v1:gasha:name:${row.source_hash}`,kind:'gasha',field:'name',source:row.source_name,sourceHash:row.source_hash,translation:row.translation,status:row.status,batch:revision?.batch_id||null,references:[...row.matched_ids.map(id=>({kind:'gasha',id,field:'display_name'})),...row.tickets.map(t=>({kind:'item',id:t.id,field:'nameJa'}))],notes:[row.matched_ids.length?'已有公告名称与道具名称对应。':'道具主数据补录名称；日期和卡片范围未确认。',...(row.matched_ids.length>1?['同名 STAGE 券无法区分两次公告。']:[])],translator:row.status==='reviewed'?'从用户已校对道具译文提取':'从用户道具译文提取（待校对）',decision:'translated'})
}
const summary={schemaVersion:1,sourceDigest:corpusHash(units),scope:'当前通用资料字段 + 卡池名称与道具关联补录 + 当前 Reader 可审计文本单元；不是所有 RAW 或图片内嵌文字',general:{unique:units.length,references:units.reduce((n,u)=>n+u.references.length,0),memory:report.memory.size,orphans:report.orphans.length,invalid:report.invalid.length,unpublished},gasha:{...gashaEvidence.summary,catalog_records:gashaEvidence.summary.existing_primary+gashaEvidence.summary.supplemental_groups,translation_names:gashaEvidence.rows.length},reader:{documents:documents.length,units:allUnits.size,overlays:[...overlays.values()].filter(Boolean).length},groups:[...groups.values()],pending}
const out=path.join(root,'config/translation-audit');fs.mkdirSync(out,{recursive:true})
for(const kind of new Set(details.map(d=>d.kind)))fs.writeFileSync(path.join(out,`general-${kind}.json`),JSON.stringify(details.filter(d=>d.kind===kind))+'\n')
for(const [file,value]of [['summary',summary],['stories',documents]])fs.writeFileSync(path.join(out,`${file}.json`),JSON.stringify(value)+'\n')
if(unpublished)console.warn(`translation audit: ${unpublished} memory entries are not in the published files; run node scripts/generate-archive-general-translations.mjs`)
console.log(JSON.stringify(summary,null,2))
