import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {sourceUnits,planBatches,validateGeneralReturn,loadGeneralRevisions,hash,protectedTokens} from './lib/general-translation-batches.mjs'
import {collectionItemVariant} from '../src/presentation/CollectionItemVariant.mjs'
import {PlayerPreferencesRepository} from '../src/core/story-runtime/PlayerPreferencesRepository.js'
const units=sourceUnits(process.cwd()),batches=planBatches(units),all=batches.flatMap(b=>b.rows)
assert.equal(all.length,units.length);assert.equal(new Set(all.map(r=>r.key)).size,units.length)
assert(batches.every(b=>b.rows.length<=100));assert(units.every(u=>u.references.length>0))
const batch=batches.find(b=>b.batch_id==='G-skills-001')
const returned={schema:'GS-GENERAL-RETURN-V1',batch_id:batch.batch_id,source_digest:batch.source_digest,entries:batch.rows.map(r=>({key:r.key,source_hash:r.sourceHash,source:r.source,translation:r.source,decision:'keep-source',notes:[]}))}
assert.equal(validateGeneralReturn(batch,returned,units).length,batch.rows.length)
const bad=mutate=>{const input=structuredClone(returned);mutate(input);assert.throws(()=>validateGeneralReturn(batch,input,units))}
bad(v=>v.entries.pop());bad(v=>v.entries[1]=v.entries[0]);bad(v=>v.batch_id='wrong');bad(v=>v.entries[0].source+='!');bad(v=>v.entries[0].source_hash='0'.repeat(64));bad(v=>v.entries[0].translation='');bad(v=>v.entries[0].decision='reviewed')
bad(v=>{const e=v.entries.find(e=>/\d/.test(e.source));e.translation=e.source.replace(/\d/,n=>String((Number(n)+1)%10));e.decision='translated'})
bad(v=>{v.entries[0].decision='uncertain';v.entries[0].notes=[]})
assert.throws(()=>validateGeneralReturn(batch,returned,units.filter(u=>u.key!==batch.rows[0].key)))
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
// (999 -> 1990 after the 2026-10-07 R3.3 drafts) and must be updated together with the regenerated audit.
assert.equal(audit.groups.find(g=>g.id==='story:main').reviewed,993);assert.equal(audit.groups.find(g=>g.id==='story:main').draft,1990)
assert(stories.every(d=>d.url.startsWith('?view=reader&reading=')))
const liveRevisions=loadGeneralRevisions(process.cwd(),units)
for(const row of details) {
 const revision=liveRevisions.get(row.key)
 if(revision)assert.equal(row.batch,revision.batch_id,'Audit must identify the imported revision batch, including compact batches')
}
// Tiny, isolated source-bound revision fixture; never write fake approvals into the live overlay.
fs.mkdirSync(path.resolve('.analysis'),{recursive:true})
const fixture=fs.mkdtempSync(path.resolve('.analysis/general-revision-fixture-'))
const folder=path.join(fixture,'translation/studio/general/revisions');fs.mkdirSync(folder,{recursive:true})
const file=path.join(folder,'sample.json')
const record={schema:'GS-GENERAL-REVISION-V1',status:'draft',not_final:true,translator:'fixture',batch,return:returned,return_sha256:hash(JSON.stringify(returned))}
const save=()=>fs.writeFileSync(file,JSON.stringify(record))
save();assert.equal(loadGeneralRevisions(fixture,units).size,batch.rows.length)
record.status='reviewed';record.approval={approved:true,batch_id:batch.batch_id,return_sha256:record.return_sha256,reviewer:'fixture',statement:'Fixture only'}
save();assert([...loadGeneralRevisions(fixture,units).values()].every(e=>e.status==='reviewed'))
record.approval.batch_id='wrong';save();assert.throws(()=>loadGeneralRevisions(fixture,units))
record.approval.batch_id=batch.batch_id;record.approval.return_sha256='0'.repeat(64);save();assert.throws(()=>loadGeneralRevisions(fixture,units))
record.approval.return_sha256=record.return_sha256;record.not_final=false;save();assert.throws(()=>loadGeneralRevisions(fixture,units))
fs.rmSync(fixture,{recursive:true})
console.log(`PASS: ${units.length} source-bound units / ${batches.length} batches; return identity, missing/duplicate/stale rows, protected tokens, item variants, persisted locale isolation, audit denominators and B001/B002 status separation.`)
