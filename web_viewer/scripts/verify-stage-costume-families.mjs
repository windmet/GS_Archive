import assert from 'node:assert/strict'
import fs from 'node:fs'
import source from '../src/data/stageCostumeFamilies.json' with {type:'json'}
import {stageCostumeFamilies, stageCostumeOptionsForCharacter, stageFamilyChoices, planStageFamilyCostume} from '../src/presentation/StageCostumeFamilies.js'

// Reconstruct the public manifest boundary from the tracked native projection:
// CI needs no ignored media corpus. The producer separately checks the real manifest.
const characters=source.idols.map(i=>({id:i.id,costumes:source.families.flatMap(f=>f.variants
  .filter(v=>v.members[i.id]).map(v=>({id:v.members[i.id],label:`${v.sourceName} · ${v.members[i.id]}`})))}))
const directory=source.idols.map(i=>({id:i.id,unitCode:i.unitCode}))
const snapshot=JSON.stringify({source,characters,directory})
const families=stageCostumeFamilies(characters,directory)
assert.equal(source.source.decodedPbSha256,'25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1')
assert.deepEqual(source.source.tables,[2,24,27])
assert.equal(characters.length,49)
assert.equal(characters.reduce((n,c)=>n+c.costumes.length,0),549)
assert.equal(new Set(families.map(f=>f.id)).size,165)
assert.deepEqual(Object.fromEntries(['all','unit','attribute','cross','personal'].map(s=>[s,families.filter(f=>f.scope===s).length])),
  {all:2,unit:31,attribute:6,cross:2,personal:124})
assert.equal(families.flatMap(f=>f.variants).filter(v=>v.another).reduce((n,v)=>n+Object.keys(v.members).length,0),160)
for(const character of characters) {
  const options=stageCostumeOptionsForCharacter(families,character).flatMap(g=>g.costumes)
  assert.deepEqual(new Set(options.map(c=>c.id)),new Set(character.costumes.map(c=>c.id)))
  assert.equal(options.length,character.costumes.length,'every individual costume appears once')
}
const slots=[{position:2,characterId:'004ter'},{position:3,characterId:'005kao'},{position:4,characterId:'006tsu'}]
const positions=[2,3,4]
const choices=stageFamilyChoices(families,slots,characters,positions,'unit')
const moon=choices.find(c=>c.version.sourceName==='ムーンリットアステリズム')
assert.deepEqual(moon.plan.matched.map(a=>a.costumeId),['102_00','102_00','101_00'],'same design retains each idol resource ID')
assert.equal(moon.plan.unmatched.length,0)
const mixed=[slots[0],slots[1],{position:4,characterId:'001tom'},{position:5,characterId:'006tsu'}]
const partial=planStageFamilyCostume(mixed,characters,positions,moon.version)
assert.deepEqual(partial.matched.map(a=>a.idolCode),['004ter','005kao'])
assert.deepEqual(partial.unmatched,[{position:4,idolCode:'001tom'}])
assert(!partial.matched.some(a=>a.position===5),'resting members never receive an assignment')
const another=choices.find(c=>c.version.another && c.plan.unmatched.length)
assert(another,'a source-bound partial recolor remains distinct from its normal version')
assert(another.plan.matched.every(a=>another.version.members[a.idolCode]===a.costumeId))
const single=[{position:3,characterId:'004ter'}]
assert.equal(stageFamilyChoices(families,single,characters,[3],'all').length,2,'one member cannot turn personal or unit wear into global wear')
assert(stageFamilyChoices(families,single,characters,[3],'unit').every(c=>c.family.scope==='unit'))
assert.equal(planStageFamilyCostume(slots,characters,[2,2],moon.version),null)
assert.equal(planStageFamilyCostume(slots,characters,[],moon.version),null)
assert.equal(planStageFamilyCostume(slots,characters,positions,{...moon.version,sourceName:'translated label'}),null)
assert.deepEqual(stageCostumeFamilies(null,directory),[])
assert.deepEqual(stageCostumeFamilies(characters,null),[])
const missing=structuredClone(characters)
missing.find(c=>c.id==='049eis').costumes=[]
assert.equal(stageCostumeFamilies(missing,directory).filter(f=>f.scope==='all').length,0,'a missing owner removes global proof')
const ambiguous=structuredClone(characters),person=ambiguous.find(c=>c.id==='004ter')
person.costumes.push({...person.costumes.find(c=>c.id==='102_00')})
const broken=stageCostumeFamilies(ambiguous,directory).find(f=>f.id===moon.family.id).variants.find(v=>v.sourceName===moon.version.sourceName)
assert(!broken.members['004ter'],'ambiguous IDs cannot be applied')
const wrongUnit=structuredClone(directory);wrongUnit.find(i=>i.id==='004ter').unitCode='01jup'
assert(!stageCostumeFamilies(characters,wrongUnit).find(f=>f.id===moon.family.id).variants[0].members['004ter'])
assert.equal(JSON.stringify({source,characters,directory}),snapshot,'planning does not mutate sources or slots')
const viewer=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert(viewer.includes('stageFamilyChoices(') && viewer.includes('applyCostumePlan(selectedCostumeChoice.value?.plan)'))
assert(viewer.includes('stageCostumeOptionsForCharacter('))
console.log('Stage costume families: 549 models /165 families; global, unit, attribute, cross-unit and personal; exact per-idol versions, mixed coverage, missing/ambiguous resources and resting slots passed')
