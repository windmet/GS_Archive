import assert from 'node:assert/strict'
import {sourceUnits,hash,validateGeneralReturn} from './lib/general-translation-batches.mjs'
import {planCompactBatches,parseCompactReturn,renderCompactInput,returnHeading} from './lib/general-translation-markdown.mjs'

const units=sourceUnits(process.cwd()),plan=planCompactBatches(units)
assert.equal(plan.batches.flatMap(b=>b.rows).length,units.length)
assert.equal(new Set(plan.batches.flatMap(b=>b.rows.map(r=>r.key))).size,units.length)
for (const batch of plan.batches) {
  const input=renderCompactInput(batch,plan.contexts)
  assert(input.length<=plan.maxChars)
  assert(batch.rows.length<=plan.maxRows)
  assert(!input.includes('metadata:v1:') && !input.includes('source_hash') && !input.includes('references'))
  assert(!input.includes(batch.source_digest),'Full digest must stay local')
  const result=returnHeading(batch)+'\n'+batch.rows.map((_,i)=>`[${String(i+1).padStart(3,'0')}=]`).join('\n')
  assert.equal(validateGeneralReturn(batch,parseCompactReturn(batch,result),units).length,batch.rows.length)
}

const rows=['斜線 | サイン','12.5秒ごとに <value> [stamina]','resource_001'].map((source,i)=>({kind:'item',field:'description',key:`fixture:${i}`,source,sourceHash:hash(source),references:[{kind:'item',id:String(i),field:'description'}]}))
const batch={schema:'GS-GENERAL-BATCH-V1',locale:'zh-CN',batch_id:'G-items-001',rows,source_digest:hash(JSON.stringify(rows))}
const good=`${returnHeading(batch)}\n[001]斜线 | 标记\n第二行\n[002?]每 12.5 秒 <value> [stamina]\n! 特殊技能名需要确认\n[003=]\n`
const parsed=parseCompactReturn(batch,'\uFEFF'+good.replaceAll('\n','\r\n'))
assert.equal(parsed.entries[0].translation,'斜线 | 标记\n第二行')
assert.equal(parsed.entries[1].decision,'uncertain')
assert.deepEqual(parsed.entries[1].notes,['特殊技能名需要确认'])
assert.equal(parsed.entries[2].translation,rows[2].source)
validateGeneralReturn(batch,parsed,rows)
const bad=text=>assert.throws(()=>validateGeneralReturn(batch,parseCompactReturn(batch,text),rows))
bad(good.replace('@'+batch.source_digest.slice(0,12),'@000000000000'))
bad(good.replace('G-items-001','G-items-002'))
bad(good.replace('[003=]',''))
bad(good.replace('[003=]','[001=]'))
bad(good.replace('[003=]','[004=]'))
bad(good.replace('[003=]','[3=]'))
bad(good.replace('[003=]','[003]'))
bad(good.replace('! 特殊技能名需要确认\n',''))
bad(good.replace('[003=]','[003=]资源_001'))
bad(good.replace('每 12.5','每 12.6'))
bad(good.replace(' <value>',' <other>'))
bad('```\n'+good+'```')
bad(good.replace('斜线 | 标记','<script>alert(1)</script>'))
const mapDrift=structuredClone(batch);mapDrift.rows.reverse()
assert.throws(()=>parseCompactReturn(mapDrift,good))
const stale=rows.map(r=>({...r,references:[{kind:'item',id:'changed',field:'description'}]}))
assert.throws(()=>validateGeneralReturn(batch,parsed,stale))
assert.throws(()=>planCompactBatches(units,{maxRows:1000}))
assert.throws(()=>planCompactBatches(rows.map(r=>({...r,source:'文'.repeat(20000)})),{maxChars:2000}))
console.log(`PASS: compact ${units.length} fields / ${plan.batches.length} batches; complete input budgets, local identity reconstruction, multiline/CRLF/BOM, unknown/missing/duplicate IDs, wrong source/batch, uncertainty and protected tokens.`)
