import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {sourceUnits,validateGeneralReturn,loadGeneralRevisions,hash,protectedTokens} from './lib/general-translation-batches.mjs'
import {planCompactBatches} from './lib/general-translation-markdown.mjs'
import {writeMemory,memoryReport} from './lib/translation-memory.mjs'
import {collectionItemVariant} from '../src/presentation/CollectionItemVariant.mjs'
import {PlayerPreferencesRepository} from '../src/core/story-runtime/PlayerPreferencesRepository.js'
const units=sourceUnits(process.cwd()),{batches}=planCompactBatches(units),all=batches.flatMap(b=>b.rows)
assert.equal(all.length,units.length);assert.equal(new Set(all.map(r=>r.key)).size,units.length)
assert(units.every(u=>u.references.length>0))
const batch=batches.find(b=>b.batch_id==='G-skills-001')
const returned={schema:'GS-GENERAL-RETURN-V1',batch_id:batch.batch_id,source_digest:batch.source_digest,entries:batch.rows.map(r=>({key:r.key,source_hash:r.sourceHash,source:r.source,translation:r.source,decision:'keep-source',notes:[]}))}
assert.equal(validateGeneralReturn(batch,returned,units).length,batch.rows.length)
const bad=mutate=>{const input=structuredClone(returned);mutate(input);assert.throws(()=>validateGeneralReturn(batch,input,units))}
bad(v=>v.entries.pop());bad(v=>v.entries[1]=v.entries[0]);bad(v=>v.batch_id='wrong');bad(v=>v.entries[0].source+='!');bad(v=>v.entries[0].source_hash='0'.repeat(64));bad(v=>v.entries[0].translation='');bad(v=>v.entries[0].decision='reviewed')
bad(v=>{const e=v.entries.find(e=>/\d/.test(e.source));e.translation=e.source.replace(/\d/,n=>String((Number(n)+1)%10));e.decision='translated'})
bad(v=>{v.entries[0].decision='uncertain';v.entries[0].notes=[]})
// A source that left the corpus since export is an orphan, not an error; changed references never matter.
assert.equal(validateGeneralReturn(batch,returned,units.filter(u=>u.key!==batch.rows[0].key))[0].orphan,true)
assert.equal(validateGeneralReturn(batch,returned,units.map(u=>({...u,references:[]}))).length,batch.rows.length)
assert.deepEqual(protectedTokens('8秒 <value> [stamina]'),protectedTokens('每 8 秒 <value> [stamina]'))
// Honor imports must obey the same canonical idol names as item imports.
const honorRow=units.find(u=>u.kind==='honor'&&u.source.replaceAll(' ','')==='天ヶ瀬冬馬担当')
assert(honorRow)
const honorBatch={schema:'GS-GENERAL-BATCH-V1',batch_id:'G-honors-001',locale:'zh-CN',rows:[honorRow],source_digest:hash(JSON.stringify([honorRow]))}
const honorReturn={schema:'GS-GENERAL-RETURN-V1',batch_id:honorBatch.batch_id,source_digest:honorBatch.source_digest,entries:[{key:honorRow.key,source_hash:honorRow.sourceHash,source:honorRow.source,translation:'天濑冬马担当',decision:'translated',notes:[]}]}
assert.equal(validateGeneralReturn(honorBatch,honorReturn,units).length,1)
honorReturn.entries[0].translation='天之濑冬马担当'
assert.throws(()=>validateGeneralReturn(honorBatch,honorReturn,units),/must use 天濑冬马/)
for(const [name,badge]of [['ゴーゴーゼリー',''],['ゴーゴーゼリーSP','SP'],['ゴーゴーゼリーDX','DX'],['彩光の欠片 N','N'],['彩光の欠片 SR','SR'],['プラチナガシャ10回チケット','10×'],['プラチナガシャ1回チケット','1×'],['未知 SP 名称','']])assert.equal(collectionItemVariant(name),badge)
let value=null;const preferences=new PlayerPreferencesRepository({storage:{getItem:()=>value,setItem:(_,v)=>{value=v}}})
const prior=preferences.update({producer_name:'windmet',story_content_mode:'bilingual',auto_enabled:true,volumes:{voice:0.4}})
const saved=preferences.update({ui_locale:'ja-JP'});assert.deepEqual({...saved,ui_locale:prior.ui_locale},prior);assert.equal(preferences.load().ui_locale,'ja-JP')
const audit=JSON.parse(fs.readFileSync('config/translation-audit/summary.json','utf8')),details=fs.readdirSync('config/translation-audit').filter(f=>/^general-.+\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(`config/translation-audit/${f}`,'utf8'))),stories=JSON.parse(fs.readFileSync('config/translation-audit/stories.json','utf8'))
assert.equal(audit.general.unique,units.length);assert.equal(audit.reader.documents,stories.length)
for(const g of audit.groups){assert.equal(g.total,g.draft+g.reviewed+g.final+g.missing+g.stale);if(!g.id.startsWith('story:'))assert.equal(g.total,details.filter(r=>r.kind===g.id).length)}
assert.equal(audit.groups.filter(g=>g.id.startsWith('story:')).reduce((n,g)=>n+g.total,0),audit.reader.units)
// Snapshot of the committed audit: reviewed is the B001 baseline; draft moves with each draft release
// (999 -> 1990 -> 2490 after the 2026-10-07 R3.3 drafts B003, B004) and must be updated together with the regenerated audit.
assert.equal(audit.groups.find(g=>g.id==='story:main').reviewed,993);assert.equal(audit.groups.find(g=>g.id==='story:main').draft,2490)
assert(stories.every(d=>d.url.startsWith('?view=reader&reading=')))
const liveRevisions=loadGeneralRevisions(process.cwd(),units)
for(const row of details) {
 const revision=liveRevisions.get(row.key)
 if(revision)assert.equal(row.batch,revision.batch_id,'Audit must identify the imported revision batch, including compact batches')
}
// Isolated translation-memory fixture; never write fake entries or approvals into the live memory.
fs.mkdirSync(path.resolve('.analysis'),{recursive:true})
const fixture=fs.mkdtempSync(path.resolve('.analysis/general-memory-fixture-'))
const sample=batch.rows.slice(0,3), entry=(row,extra={})=>({kind:row.kind,field:row.field,source:row.source,translation:row.source,status:'draft',decision:'keep-source',translator:'fixture',batch:'G-skills-fixture-001',...extra})
const save=entries=>writeMemory(fixture,new Map(entries))
save(sample.map(row=>[row.key,entry(row)]));assert.equal(loadGeneralRevisions(fixture,units).size,sample.length)
save(sample.map(row=>[row.key,entry(row,{status:'reviewed',reviewer:'fixture'})]));assert([...loadGeneralRevisions(fixture,units).values()].every(e=>e.status==='reviewed'))
// Broken entries are skipped by the loader (the build keeps going) and fail the strict check.
for(const broken of [{status:'reviewed'},{translation:''},{source:'changed'},{decision:'uncertain',status:'reviewed',reviewer:'fixture'},{status:'final-ish'}]) {
  save([[sample[0].key,entry(sample[0],broken)],...sample.slice(1).map(row=>[row.key,entry(row)])])
  const report=memoryReport(fixture,units)
  assert.equal(report.live.size,sample.length-1);assert.equal(report.invalid.length,1)
  assert.throws(()=>memoryReport(fixture,units,{strict:true}))
}
// An entry whose source left the corpus is an orphan: kept, not published, not an error.
save([['metadata:v1:skill:name:'+'0'.repeat(64),entry(sample[0])]])
const orphaned=memoryReport(fixture,units);assert.equal(orphaned.live.size,0);assert.equal(orphaned.orphans.length,1)
fs.rmSync(fixture,{recursive:true})
console.log(`PASS: ${units.length} source-bound units / ${batches.length} batches; return identity, missing/duplicate rows, orphans, translation memory loading, protected tokens, item variants, persisted locale isolation, audit denominators and B001/B002 status separation.`)
