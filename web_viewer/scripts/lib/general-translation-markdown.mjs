import assert from 'node:assert/strict'
import { hash, shards } from './general-translation-batches.mjs'

const kinds = { card:'卡面',costume:'衣装',item:'道具',honor:'称号',skill:'技能','center-skill':'中心效果','skill-category':'技能类别',background:'背景','background-variant':'背景时段','photo-filters':'摄影滤镜','photo-stickers':'摄影贴纸','photo-spots':'摄影场景','photo-scenes':'摄影背景','photo-frames':'摄影相框' }
const fields = { name:'名称',title:'标题',description:'说明' }
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
  const lines = [
    `# SideM GS 资料翻译 · ${batch.batch_id}`, '',
    '你是日中游戏本地化译者。将下面每条日文译成自然、准确的简体中文，供资料馆的名称、图鉴说明和技能说明使用。',
    '本批只含通用资料，不含剧情台词、首页对话或工作通讯。名称简洁有辨识度，说明按中文自然组织；技能严格保留触发条件、概率、时长、对象和效果。不要机械逐词直译，也不要擅自润色成角色对白。',
    '每个短编号独立翻译，不能漏条、合并、拆分或把含义搬到相邻条目。名称可有创意，但不能添加原文没有的事实、获取来源、衣装关联或解锁条件。同一专名保持一致；英文专名保留，普通日语语法译成中文。',
    '原样保留数字、小数、参数 <value>、图标 [stamina]、占位符及其他程序标记；数值不能变，技能中数值顺序也不能变。换行可按中文调整。可参考 glossary.md 的项目姓名表；它不是官方中文译名，不确定时必须标记疑义。', '',
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
  let group = ''
  batch.rows.forEach((row,index)=>{
    const next = `${row.kind}:${row.field}`
    if (next !== group) { lines.push(`### ${kinds[row.kind] || row.kind} · ${fields[row.field] || row.field}`); group = next }
    const context = contexts.get(row.key)
    if (context && context !== row.source) lines.push(`【名称上下文：${context.replace(/[\r\n]+/g,' ')}】`)
    lines.push(`[${rid(index)}]${row.source}`, '')
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
    for (const row of units.filter(u=>select(u.kind))) {
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
    return {key:row.key,source_hash:row.sourceHash,source:row.source,translation:decision==='keep-source'?row.source:translation,decision,notes:record.notes}
  })}
}
