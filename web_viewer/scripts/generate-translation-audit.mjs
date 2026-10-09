import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {sourceUnits,planBatches,loadGeneralRevisions,corpusHash} from './lib/general-translation-batches.mjs'
import {loadStudioIndexes,loadStudioDocument,sha256} from './lib/ai-studio-source.mjs'
import {validateStoryTranslationOverlay} from '../src/localization/story/TranslationRepository.js'
import {normalizeEntitySourceText,validateEntityTranslationOverlay} from '../src/localization/story/EntityTranslationRepository.js'
import {IDOL_ID_TO_NAME} from '../src/utils/IdolNameMap.js'
import {sourceHash} from './lib/gasha-ticket-evidence.mjs'
import zh from '../src/localization/ui/locales/zh-CN.js'
import ja from '../src/localization/ui/locales/ja-JP.js'

const root=process.cwd(), read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
const units=sourceUnits(root), drafts=read('public/translations/zh-CN/archive-general.json').entries, revisions=loadGeneralRevisions(root,units)
const batches=planBatches(units), batchByKey=new Map(batches.flatMap(b=>b.rows.map(r=>[r.key,b.batch_id])))
const tally=()=>({total:0,draft:0,reviewed:0,final:0,missing:0,stale:0,uncertain:0,keptSource:0})
const groups=new Map(), group=(id,label)=>{if(!groups.has(id))groups.set(id,{id,label,...tally()});return groups.get(id)}
const labels={card:'卡面标题',costume:'衣装名称与说明',item:'道具',honor:'称号',skill:'技能','skill-category':'技能分类','center-skill':'中心技能',background:'背景','background-variant':'背景差分','photo-filters':'摄影滤镜','photo-stickers':'摄影贴纸','photo-spots':'摄影地点','photo-scenes':'摄影场景','photo-frames':'摄影相框','idol-profile':'偶像资料','unit-profile':'组合简介','mobile-status':'通信签名','work':'工作剧情名称','card-line':'卡面文本·台词','card-touch':'卡面文本·触摸语音','call-title':'卡面文本·电话标题','chat-line':'通信·聊天对白','chat-choice':'通信·制作人回复'}
const details=units.map(u=>{
 const revision=revisions.get(u.key), translation=drafts[u.kind]?.[u.field]?.[u.source]||''
 if(revision)assert.equal(translation,revision.translation,'Revisions not generated into published metadata')
 const status=translation ? revision?.status || 'draft':'missing', g=group(u.kind,labels[u.kind]||u.kind)
 g.total++;g[status]++;if(revision?.decision==='uncertain')g.uncertain++;if(revision?.decision==='keep-source')g.keptSource++
 return {key:u.key,kind:u.kind,field:u.field,source:u.source,sourceHash:u.sourceHash,translation,status,batch:revision?.batch_id||batchByKey.get(u.key),references:u.references,notes:revision?.notes||[],translator:revision?.translator||'项目初译',decision:revision?.decision||null}
})
const indexes=await loadStudioIndexes(), overlays=new Map(), documents=[], allUnits=new Set()
const domainLabels={event:'活动剧情',main:'主线剧情',unit:'组合剧情',work:'工作剧情',birthday:'生日剧情',extra:'额外剧情',card:'卡片剧情',idol:'偶像剧情',mobile:'工作通讯',main_story:'主线剧情',unit_story:'组合剧情',card_scenarios:'卡片剧情',idol_story:'偶像剧情',work_story:'工作剧情',mobile_archive:'工作通讯',event_story:'活动剧情'}
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
const pending=[{id:'home-dialogue',label:'首页对话',total:null,status:'excluded',note:'需按人物语气和上下文细翻，未纳入通用初译且未单独计数；P 名字替换不计翻译。'},{id:'hardcoded-ui',label:'尚未提取的界面文案 / 活动与歌曲专名',total:null,status:'unmeasured',note:'语言开关切换已接入的名称与说明；硬编码导航、偶像详细资料和文案尚未全量本地化，不计作已翻译。'},{id:'image-text',label:'图片内文字、歌词与未进入 Reader 的原始文本',total:null,status:'unmeasured',note:'本审计不覆盖这些原始资源；不能由已有目录数量推断翻译完成。'}]
const gashaEvidence=read('public/data/editorial/gasha-ticket-evidence.json'),gashaGroup=group('gasha','卡池名称（含道具补录）')
for(const row of gashaEvidence.rows){
 assert.equal(row.source_hash,sourceHash(row.source_name),'Gasha name source changed')
 const ticket=row.tickets.find(t=>t.id===row.translation_item_id),revision=ticket?revisions.get(`metadata:v1:item:name:${sourceHash(ticket.source_name)}`):null
 gashaGroup.total++;gashaGroup[row.status]++
 details.push({key:`metadata:v1:gasha:name:${row.source_hash}`,kind:'gasha',field:'name',source:row.source_name,sourceHash:row.source_hash,translation:row.translation,status:row.status,batch:revision?.batch_id||null,references:[...row.matched_ids.map(id=>({kind:'gasha',id,field:'display_name'})),...row.tickets.map(t=>({kind:'item',id:t.id,field:'nameJa'}))],notes:[row.matched_ids.length?'已有公告名称与道具名称对应。':'道具主数据补录名称；日期和卡片范围未确认。',...(row.matched_ids.length>1?['同名 STAGE 券无法区分两次公告。']:[])],translator:row.status==='reviewed'?'从用户已校对道具译文提取':'从用户道具译文提取（待校对）',decision:'translated'})
}
const summary={schemaVersion:1,sourceDigest:corpusHash(units),scope:'当前通用资料字段 + 卡池名称与道具关联补录 + 当前 Reader 可审计文本单元；不是所有 RAW 或图片内嵌文字',general:{unique:units.length,references:units.reduce((n,u)=>n+u.references.length,0),batches:batches.length},gasha:{...gashaEvidence.summary,catalog_records:gashaEvidence.summary.existing_primary+gashaEvidence.summary.supplemental_groups,translation_names:gashaEvidence.rows.length},reader:{documents:documents.length,units:allUnits.size,overlays:[...overlays.values()].filter(Boolean).length},groups:[...groups.values()],pending}
const out=path.join(root,'config/translation-audit');fs.mkdirSync(out,{recursive:true})
for(const kind of new Set(details.map(d=>d.kind)))fs.writeFileSync(path.join(out,`general-${kind}.json`),JSON.stringify(details.filter(d=>d.kind===kind))+'\n')
for(const [file,value]of [['summary',summary],['stories',documents]])fs.writeFileSync(path.join(out,`${file}.json`),JSON.stringify(value)+'\n')
console.log(JSON.stringify(summary,null,2))
