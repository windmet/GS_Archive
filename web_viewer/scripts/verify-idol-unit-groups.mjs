import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {groupIdolsByUnit} from '../src/presentation/IdolUnitGroups.mjs'
const bootstrap=JSON.parse(readFileSync(new URL('../readmodels/bootstrap.inline.json',import.meta.url),'utf8'))
const idols=bootstrap.idols
const units=[...new Map(idols.map(idol=>[idol.unitId,{id:idol.unitId,code:idol.unitCode,name:idol.unitName}])).values()]
const before=JSON.stringify(idols)
const groups=groupIdolsByUnit(idols,units)
assert.equal(groups.length,16)
assert.equal(groups.flatMap(group=>group.members).length,49)
assert.equal(new Set(groups.flatMap(group=>group.members.map(member=>member.id))).size,49)
for(const unit of units){
  const expected=idols.filter(idol=>idol.unitId===unit.id)
  assert.deepEqual(groupIdolsByUnit(expected,units).flatMap(group=>group.members),expected)
  assert.deepEqual(groups.find(group=>group.id===unit.id).members,expected)
}
const renamed=idols.map(idol=>({...idol,name:'同名',unitName:'同名组合'}))
assert.deepEqual(groupIdolsByUnit(renamed,units).map(group=>group.members.map(member=>member.id)),groups.map(group=>group.members.map(member=>member.id)))
const unknown={id:'unresolved',unitId:'unknown',name:'未确认'}
assert.equal(groupIdolsByUnit([...idols,unknown],units).at(-1).members[0],unknown,'unknown membership cannot drop an entry')
assert.deepEqual(groupIdolsByUnit([],units),[])
assert.equal(JSON.stringify(idols),before)
assert.equal(groups[0].members[0],idols[0],'grouping retains source object identity')
console.log('Idol grouping: 49 stable identities, 16 units, all unit subsets, name collisions and unknown membership passed')
