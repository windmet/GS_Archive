import assert from 'node:assert/strict'
import fs from 'node:fs'
import { hash, shards, CARD_LINE_KINDS, CHAT_KINDS } from './general-translation-batches.mjs'
import { protectProducerAddressingForTranslation, restoreProducerAddressingAfterTranslation } from '../../src/localization/story/ProducerAddressing.js'

const kinds = { 'chat-line':'对白','chat-choice':'制作人回复','card-line':'卡面台词','card-touch':'首页触摸语音','call-title':'电话标题',card:'卡面',costume:'衣装',item:'道具',honor:'称号',skill:'技能','center-skill':'中心效果','skill-category':'技能类别',background:'背景','background-variant':'背景时段','photo-filters':'摄影滤镜','photo-stickers':'摄影贴纸','photo-spots':'摄影场景','photo-scenes':'摄影背景','photo-frames':'摄影相框' }
const fields = { name:'名称',title:'标题',description:'说明',normal:'普通',awakened:'特训',extra:'额外',text:'台词' }
const isCharacterLine = row => CARD_LINE_KINDS.includes(row.kind)
const isChat = row => CHAT_KINDS.includes(row.kind)
const firstReference = row => row.references[0]
const conversationOf = row => firstReference(row).id.split(':')[0]
const speakerOf = row => row.references.find(ref => ref.speaker)?.speaker || ''
let speakerNames
// 中文名（日文名）, from the project idol names the model also sees in glossary.md.
function speakerLabel(code) {
  if (!speakerNames) {
    const read = file => JSON.parse(fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
    const zh = read('public/translations/zh-CN/entities/idols.json').entries
    speakerNames = new Map(read('public/data/masterdata/idol_unit_dictionary.json').idols.map(idol => [idol.idol_code, `${zh[idol.idol_code]?.name || idol.display_name}（${idol.display_name}）`]))
  }
  return speakerNames.get(code) || code
}
let unitNames
function ownerLabel(code) {
  if (/^\d{3}[a-z]{3}$/.test(code)) return speakerLabel(code)
  unitNames ||= new Map(JSON.parse(fs.readFileSync(new URL('../../public/data/masterdata/idol_unit_dictionary.json', import.meta.url), 'utf8')).units.map(unit => [unit.unit_code, unit.unit_name]))
  return unitNames.get(code) || code || '未知'
}
// Project-wide constraints (R3.3 policy, term decisions, per-speaker voice notes) injected into character-line and chat inputs.
let promptPolicy
const promptRules = () => promptPolicy ||= JSON.parse(fs.readFileSync(new URL('../../translation/studio/policy/card-line-prompt.v1.json', import.meta.url), 'utf8'))
const relevantTerms = rows => {
  const text = rows.map(row => row.source).join('\n')
  return promptRules().terms.filter(term => text.includes(term.src)).map(term => `- ${term.src} → ${term.zh}${term.note ? `（${term.note}）` : ''}`)
}
// Producer macros reach the model only as story-style markers and come back to the source macro
// (restoreAddress), so an overlay never holds a translated slot such as ●●●●制作人.
const ADDRESS_RULE = '{{GS_ADDRESS:编号:类型}} 是程序替换的制作人称呼（玩家设定的名字，未设定时显示“制作人”），整体是不可改动的占位符：可以随中文语序移动，但不能翻译、改写、删除或重复，也不要在它后面再补“制作人”。producer_name_with_p 本身已含“制作人”；后面原文的さん不译，ちゃん→酱、くん→君照常。producer_name 后面跟着的称呼（監督、ぴぃちゃん、番長さん、ボス等）照常翻译。'
const sourceForModel = source => protectProducerAddressingForTranslation(source).text
const restoreAddress = (translation, source) => translation.includes('{{GS_ADDRESS:')
  ? restoreProducerAddressingAfterTranslation(translation, protectProducerAddressingForTranslation(source)) : translation
const CHAT_RULES = [
  '你是日中游戏本地化译者。下面是偶像与制作人的手机聊天（个人聊天、组合聊天、随机话题）。每个小标题是一段对话，条目按对话顺序排列；每条前的【说话人】只供理解，不要翻译或输出。',
  '用符合角色性格的自然口语译成简体中文，聊天语气轻松简短；同一位偶像的口吻、自称和对制作人的称呼要一致。「制作人回复」是玩家可选的回复：选项短句与回复全文分别成条，意思保持一致。',
  '同一句原文只出现一次（在第一次出现的对话里），译文会用于所有出现位置，所以不要依赖只在这一段对话里才成立的特殊含义。',
  '称呼规则：「プロデューサーさん」「プロデューサー」译为“制作人”，不加“先生”；人名+さん 译为“先生”（女性用“小姐/女士”）；くん→君，ちゃん→酱，先生（せんせい）→老师；直呼就直呼。',
  ADDRESS_RULE,
  '原样保留数字、表情标记（如 <emoji>…</emoji>）和其他程序标记；换行可按中文调整。姓名参照 glossary.md，不确定时标记疑义。',
]
const CHARACTER_LINE_RULES = [
  '你是日中游戏本地化译者。下面是偶像角色自己说的台词：卡面台词（普通/特训/额外）、首页点触立绘时的语音和电话标题。按小标题标明的说话人，用符合该角色性格的自然口语译成简体中文。',
  '每条是独立的一句或一段，没有上下文；同一位偶像的口吻、自称和对制作人的称呼要前后一致。不要添加原文没有的内容，也不要把多条合并。',
  '称呼规则：「プロデューサーさん」「プロデューサー」译为“制作人”，不加“先生”；人名+さん 译为“先生”（女性用“小姐/女士”）；くん→君，ちゃん→酱，先生（せんせい）→老师；直呼就直呼。',
  ADDRESS_RULE,
  '原样保留数字、程序标记和表情标记；换行可按中文调整。姓名参照 glossary.md 的项目姓名表，不确定时标记疑义。',
  '个别条目是数据内部标签而不是台词（如「2023年プロミ_限定_SR_天ヶ瀬 冬馬」），用 [编号=] 保留原文。',
]
const rid = index => String(index + 1).padStart(3, '0')
export const returnHeading = batch => `# ${batch.batch_id} @${batch.source_digest.slice(0,12)}`

export function compactContexts(units) {
  const names = new Map()
  for (const row of units.filter(u=>['name','title'].includes(u.field))) for (const ref of row.references) {
    const key = `${ref.kind}:${ref.id}`, values = names.get(key) || new Set()
    values.add(row.source); names.set(key,values)
  }
  return new Map(units.map(row=>[row.key,row.field==='description'
    ? [...new Set(row.references.flatMap(ref=>[...(names.get(`${ref.kind}:${ref.id}`) || names.get(`${ref.kind}:${ref.id.split(':')[0]}`) || [])]))].slice(0,3).join(' / ')
    : '']))
}

export function renderCompactInput(batch, contexts = new Map()) {
  const characterLines = batch.rows.length > 0 && batch.rows.every(isCharacterLine)
  const chat = batch.rows.length > 0 && batch.rows.every(isChat)
  const lines = [
    `# SideM GS ${chat ? '聊天' : characterLines ? '角色台词' : '资料'}翻译 · ${batch.batch_id}`, '',
    ...(chat ? [...CHAT_RULES, ...promptRules().chat_rules] : characterLines ? [...CHARACTER_LINE_RULES, ...promptRules().global_rules] : [
    '你是日中游戏本地化译者。将下面每条日文译成自然、准确的简体中文，供资料馆的名称、图鉴说明和技能说明使用。',
    '本批只含通用资料，不含剧情台词、首页对话或工作通讯。名称简洁有辨识度，说明按中文自然组织；技能严格保留触发条件、概率、时长、对象和效果。不要机械逐词直译，也不要擅自润色成角色对白。',
    '每个短编号独立翻译，不能漏条、合并、拆分或把含义搬到相邻条目。名称可有创意，但不能添加原文没有的事实、获取来源、衣装关联或解锁条件。同一专名保持一致；英文专名保留，普通日语语法译成中文。',
    '原样保留数字、小数、参数 <value>、图标 [stamina]、占位符及其他程序标记；数值不能变，技能中数值顺序也不能变。换行可按中文调整。可参考 glossary.md 的项目姓名表；它不是官方中文译名，不确定时必须标记疑义。']), '',
    ...((chat || characterLines) && relevantTerms(batch.rows).length ? ['## 本批相关定译（原文出现这些词时按此处理）', ...relevantTerms(batch.rows), ''] : []),
    '## 回传格式（只输出标记行和译文，不复制原文、上下文、章节标题或检查过程）',
    '第一行原样输出下面这行，然后每个编号恰好一次：',
    returnHeading(batch),
    '正常条目：[001]中文译文',
    '待确认条目：[002?]中文候选译文，下一行写 ! 疑义及理由。不能把译注写进译文。',
    '纯资源键或无可靠语义的标记：[003=]（不写内容，本地自动保留该条原文）。这不能用来跳过普通日文。',
    '多行译文直接换行接续；下一条以 [编号] 开始。只用三位编号，保留前导零，不输出 JSON、表格或代码围栏。',
    `本批共 ${batch.rows.length} 条。提交前对照编号集合，检查漏条、重复、数值、占位符和专名一致性；不输出检查过程。`, '',
    '## 待译原文（【名称上下文】只供理解，不是另一条待译文本）', '',
  ]
  let group = '', noteSpeaker = ''
  batch.rows.forEach((row,index)=>{
    if (isChat(row)) {
      const conversation = conversationOf(row)
      if (conversation !== group) { lines.push(`### 对话：${ownerLabel(firstReference(row).owner)} · ${conversation.replace(/\.json$/, '')}`); group = conversation }
      const speaker = speakerOf(row)
      lines.push(`【说话人：${speaker === 'producer' ? `制作人（${row.field === 'detail' ? '回复全文' : '回复选项'}）` : speakerLabel(speaker)}】`, `[${rid(index)}]${sourceForModel(row.source)}`, '')
      return
    }
    const speaker = isCharacterLine(row) ? speakerOf(row) : ''
    const next = `${speaker}:${row.kind}:${row.field}`
    if (next !== group) {
      lines.push(`### ${speaker ? `说话人：${speakerLabel(speaker)} · ` : ''}${kinds[row.kind] || row.kind} · ${fields[row.field] || row.field}`); group = next
      const note = speaker && speaker !== noteSpeaker ? promptRules().speakers[speaker] : ''
      if (speaker) noteSpeaker = speaker
      if (note) lines.push(`【角色备注：${note}】`)
    }
    const context = contexts.get(row.key)
    if (context && context !== row.source) lines.push(`【名称上下文：${context.replace(/[\r\n]+/g,' ')}】`)
    lines.push(`[${rid(index)}]${sourceForModel(row.source)}`, '')
  })
  return lines.join('\n') + '\n'
}

export function planCompactBatches(units, {maxRows=400,maxChars=16000} = {}) {
  assert(Number.isInteger(maxRows) && maxRows>0 && maxRows<=999,'maxRows must be 1–999')
  assert(Number.isInteger(maxChars) && maxChars>=2000,'maxChars must be at least 2000')
  const contexts = compactContexts(units), batches = []
  for (const [domain,select] of Object.entries(shards)) {
    let rows=[], number=1
    const make = () => ({schema:'GS-GENERAL-BATCH-V1',batch_id:`G-${domain}-${String(number).padStart(3,'0')}`,locale:'zh-CN',rows:[...rows],source_digest:hash(JSON.stringify(rows))})
    const finish = () => { if (rows.length) { batches.push(make()); number++; rows=[] } }
    // Character lines go speaker by speaker, so one idol's lines share a batch and one voice.
    const kindOrder = kind => CARD_LINE_KINDS.indexOf(kind), fieldOrder = ['normal','awakened','extra','text','title']
    const selected = units.filter(u=>select(u.kind))
    // Chats keep each conversation's own order (owner, file, step), first occurrence of a line.
    if (selected.length && selected.every(isChat)) selected.sort((a,b)=>(firstReference(a).owner||'').localeCompare(firstReference(b).owner||'') || firstReference(a).id.localeCompare(firstReference(b).id))
    else if (selected.every(isCharacterLine)) selected.sort((a,b)=>speakerOf(a).localeCompare(speakerOf(b)) || kindOrder(a.kind)-kindOrder(b.kind) ||
      fieldOrder.indexOf(a.field)-fieldOrder.indexOf(b.field) || a.key.localeCompare(b.key))
    for (const row of selected) {
      rows.push(row)
      if (rows.length>1 && (rows.length>maxRows || renderCompactInput(make(),contexts).length>maxChars)) {
        rows.pop(); finish(); rows.push(row)
      }
      assert(renderCompactInput(make(),contexts).length<=maxChars,`Single source exceeds input budget: ${row.key}; increase --max-chars explicitly`)
    }
    finish()
  }
  return {batches,contexts,maxRows,maxChars}
}

export function renderCompactTemplate(batch) {
  return `${returnHeading(batch)}\n${batch.rows.map((_,index)=>`[${rid(index)}]`).join('\n')}\n`
}

// Reconstruct all long identities from the local map; the model never returns them.
export function parseCompactReturn(batch, markdown) {
  assert.equal(hash(JSON.stringify(batch.rows)),batch.source_digest,'Batch map drift')
  const lines = String(markdown).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split('\n')
  assert.equal(lines.shift(),returnHeading(batch),'Wrong batch/source marker')
  const records=new Map(); let current
  for (const line of lines) {
    if (!line.trim()) { if(current)current.text.push(''); continue }
    assert(!/^```|^#{1,6}\s|^\|/.test(line),'Unexpected wrapper, heading or table')
    const marker=line.match(/^\[(\d{3})([?=]?)\](.*)$/)
    if (marker) {
      const [,id,flag,text]=marker, index=Number(id)-1
      assert(index>=0 && index<batch.rows.length,`Unknown ID ${id}`)
      assert(!records.has(id),`Duplicate ID ${id}`)
      current={index,flag,text:[text],notes:[]}; records.set(id,current)
    } else {
      assert(current,'Unexpected content before first translation')
      assert(!/^\[\d/.test(line),'Malformed three-digit ID')
      if (line.startsWith('! ')) { assert(line.slice(2).trim(),'Empty note'); current.notes.push(line.slice(2).trim()) }
      else current.text.push(line)
    }
  }
  assert.equal(records.size,batch.rows.length,'Missing rows')
  return {schema:'GS-GENERAL-RETURN-V1',batch_id:batch.batch_id,source_digest:batch.source_digest,entries:batch.rows.map((row,index)=>{
    const record=records.get(rid(index)), translation=record.text.join('\n').trim()
    const decision=record.flag==='='?'keep-source':record.flag==='?'?'uncertain':'translated'
    if (decision==='keep-source') assert(!translation,'Keep-source marker must have no text')
    else assert(translation,`Empty translation ${rid(index)}`)
    if(decision==='uncertain')assert(record.notes.length,`Uncertainty needs a note ${rid(index)}`)
    return {key:row.key,source_hash:row.sourceHash,source:row.source,translation:decision==='keep-source'?row.source:restoreAddress(translation,row.source),decision,notes:record.notes}
  })}
}
