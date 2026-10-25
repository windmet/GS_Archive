import source from '../data/stageCostumeFamilies.json' with {type:'json'}
import {planStageCostumeSync, stageCostumeLabel} from './ChibiPanelPresentation.js'

export const STAGE_COSTUME_SCOPES = Object.freeze([
  {id:'all', label:'全员套服'}, {id:'unit', label:'组合套服'},
  {id:'attribute', label:'属性套服'}, {id:'cross', label:'跨组合套服'},
  {id:'personal', label:'个人服装'},
])

// Scope belongs to the full native family, never to a one-person intersection.
// Each version retains its own exact source name and per-idol resource IDs.
export function stageCostumeFamilies(characters, directory) {
  if (!Array.isArray(characters) || !Array.isArray(directory)) return []
  const result=[]
  for (const family of source.families) {
    const variants=family.variants.map((version,index)=>{
      const members={}
      for (const [id,costumeId] of Object.entries(version.members)) {
        const native=source.idols.find(i=>i.id===id), people=characters.filter(c=>c.id===id)
        const formal=directory.filter(i=>i.id===id)
        if (formal.length!==1 || formal[0].unitCode!==native.unitCode || people.length!==1) continue
        const options=people[0].costumes || []
        const candidates=options.filter(c=>c.id===costumeId)
        if (candidates.length===1 && stageCostumeLabel(candidates[0])===version.sourceName
          && options.filter(c=>stageCostumeLabel(c)===version.sourceName).length===1) members[id]=costumeId
      }
      return {...version, members, key:`${family.id}:${index}`}
    }).filter(v=>Object.keys(v.members).length)
    if (family.scope==='all' && (directory.length!==source.idols.length
      || new Set(directory.map(i=>i.id)).size!==source.idols.length
      || !variants.some(v=>!v.another && Object.keys(v.members).length===source.idols.length))) continue
    if (variants.length) result.push({...family,variants})
  }
  return result
}

export function stageCostumeOptionsForCharacter(families, character) {
  return STAGE_COSTUME_SCOPES.map(scope=>({ ...scope, costumes:(character?.costumes || []).filter(costume=>{
    const family=families.find(f=>f.variants.some(v=>v.members[character.id]===costume.id))
    return (family?.scope || 'personal')===scope.id
  })})).filter(group=>group.costumes.length)
}

export function planStageFamilyCostume(lineup, characters, positions, version) {
  if (!version?.members || !Array.isArray(lineup) || !Array.isArray(positions)) return null
  const reference=lineup.find(slot=>positions.includes(slot.position) && version.members[slot.characterId])
  if (!reference) return null
  const plan=planStageCostumeSync(lineup,characters,positions,reference.characterId,version.members[reference.characterId])
  if (!plan || plan.sourceName!==version.sourceName) return null
  const matched=plan.matched.filter(a=>version.members[a.idolCode]===a.costumeId)
  const rejected=plan.matched.filter(a=>version.members[a.idolCode]!==a.costumeId)
    .map(({position,idolCode})=>({position,idolCode}))
  return {...plan,matched,unmatched:[...plan.unmatched,...rejected].sort((a,b)=>a.position-b.position)}
}

// Selection availability is a separate layer from the family classification.
// Resting slots never affect coverage and unmatched active slots stay unchanged.
export function stageFamilyChoices(families, lineup, characters, positions, scope) {
  return families.filter(f=>f.scope===scope).flatMap(family=>family.variants.map(version=>{
    const plan=planStageFamilyCostume(lineup,characters,positions,version)
    return {family,version,plan,key:version.key}
  })).filter(choice=>choice.plan?.matched.length)
}
