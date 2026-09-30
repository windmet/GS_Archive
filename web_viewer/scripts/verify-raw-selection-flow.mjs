import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {ref} from 'vue'
import {useStoryNavigation} from '../src/core/useStoryNavigation.js'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {createReadingDocument,readingBranchRows} from '../shared/reading/ReadingDocument.js'
import {validateReadingDocument} from '../shared/reading/ReadingContract.js'
import {validatedFiniteForks,finiteBranchNextIndex,finiteChoiceTargetIndex} from '../shared/story/FiniteBranchFlow.js'
import {projectReadingChoiceRows} from '../src/presentation/ReadingChoiceMetadata.js'
const argument=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]}
const auditRoot=argument('--audit-root')
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'))
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex')
const ledger=auditRoot?await read(path.join(auditRoot,'repair-ledger.json')):null
const patched=new Set(ledger?.files.map(f=>f.file)||[])
const manifest=await read('public/data/reading/manifest.json')
const knownIdolIds=new Set((await read('public/data/masterdata/idol_unit_dictionary.json')).idols.map(i=>i.idol_code))
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv)
const validate=ajv.compile(await read('schemas/compiled-scenario-v2-authoritative.schema.json'))
const cache=new Map(),counts={},remaining=[],recovered=[]
let forks=0,markers=0
for(const entry of manifest.entries){
 const file=entry.source_file
 if(!cache.has(file)){
  const bytes=await fs.readFile(auditRoot&&patched.has(file)?path.join(auditRoot,'candidates',file):path.join('public/data/compiled',file))
  cache.set(file,{bytes,data:JSON.parse(bytes)})
 }
 const {bytes,data}=cache.get(file)
 if(data.runtime_contract==='story-runtime-v2')assert.ok(validate(data),JSON.stringify(validate.errors))
 const doc=createReadingDocument(data,{documentId:entry.document_id,logicalId:entry.logical_id,file,sha256:hash(bytes),knownIdolIds})
 validateReadingDocument(doc,{...entry,source_sha256:doc.source.sha256,status:doc.status,row_count:doc.rows.length})
 counts[doc.status]=(counts[doc.status]||0)+1
 if(doc.status==='unsupported')remaining.push({id:entry.document_id,diagnostics:doc.diagnostics.filter(d=>d.severity==='unsupported')})
 if(entry.status==='unsupported'&&doc.status==='ready')recovered.push(entry.document_id)
 if(entry.status==='ready')assert.equal(doc.status,'ready','ready regression '+entry.document_id)
 const projected=projectReadingChoiceRows(doc)
 assert.equal(new Set(projected.map(i=>i.row.anchor.row_id)).size,projected.length,'one reading row per unit')
 assert.equal(projected.length,doc.rows.filter(r=>r.kind!=='choice_metadata').length,'all genuine rows survive '+entry.document_id)
 markers+=doc.rows.filter(r=>r.kind==='choice_metadata').length
 assert.ok(!projected.some(i=>i.row.kind==='choice_metadata'))
 for(const fork of validatedFiniteForks(data)){
  forks++
  for(const [i,b] of fork.branches.entries()){
   const dataRef=ref(data),index=ref(fork.choice_index),history=ref([]),selectedChoices=new Map()
   const navigation=useStoryNavigation({compiledData:dataRef,currentStep:{get value(){return dataRef.value.steps[index.value]}},currentStepIndex:index,historyStack:history,selectedChoices,storyPreferences:ref({}),updateStoryPreferences(){},clearFadeAutoAdvance(){},ensureAudioCtx(){},resetVoiceDedup(){}})
   const selected=data.steps[fork.choice_index].options[i]
   const outcome=navigation.onChoice(selected)
   if(selected.target_kind==='end'){assert.equal(outcome,'finished');assert.equal(index.value,fork.choice_index)}
   else {
    assert.equal(index.value,b.step_indices[0]??fork.join_index)
    const visited=[];let budget=data.steps.length+1
    while(index.value<fork.join_index&&budget-->0){
     visited.push(index.value)
     const current=dataRef.value.steps[index.value]
     if(current.type==='choice')navigation.onChoice(current.options[0])
     else if(!navigation.goNext()){assert.equal(fork.join_index,data.steps.length);break}
    }
    assert.ok(budget>0,'finite navigation')
    assert.ok(visited.every(j=>b.step_indices.includes(j)),'chosen path never enters a sibling alternative')
    if(fork.join_index<data.steps.length)assert.equal(index.value,fork.join_index)
    navigation.goPrev()
    assert.ok(index.value===fork.choice_index||b.step_indices.includes(index.value),'back follows selected history')
   }

   assert.equal(finiteChoiceTargetIndex(data,fork.choice_index,data.steps[fork.choice_index].options[i]),b.step_indices[0]??fork.join_index)
   if(b.exit_index!==null){const next=finiteBranchNextIndex(data,b.exit_index);assert.ok(next<=fork.join_index&&next>b.exit_index)}
  }
  const bad=structuredClone(data);bad.reading_control_flow.forks.find(f=>f.choice_index===fork.choice_index).branches[0].exit_index=-1
  assert.throws(()=>validatedFiniteForks(bad))
 }
}
for(const id of ['1_4_001_03_d','1_4_001_03_e','1_4_001_03_h','1_4_001_10_i','1_4_001_10_j','1_4_001_09_b'])assert.ok(!remaining.some(r=>r.id===id),id+' is readable')
assert.equal(markers,12)
const report={documents:manifest.entries.length,counts,recovered:recovered.length,forks,markers,remaining}
if(auditRoot)await fs.writeFile(path.join(auditRoot,'reading-candidate-acceptance.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
