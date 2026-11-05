import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadTermRegistry } from './term-registry.mjs'
const policy=JSON.parse(fs.readFileSync(new URL('../../translation/studio/policy/idol-names.v1.json',import.meta.url),'utf8'))
// Forbidden name renderings (タケル is not 大河猛, キリオ is not 桐绪) come from the term registry.
const nameTerms=loadTermRegistry().terms.filter(term=>term.kind==='person-address'&&term.forbidden_zh?.length)

export function validateItemIdolNames(source,translation,decision='translated') {
 if(decision==='keep-source')return
 for(const idol of policy.entries){
  if(source.replaceAll(' ','').includes(idol.source_name.replaceAll(' ','')))
   assert(translation.includes(idol.name),`Item idol name must use ${idol.name}: ${source}`)
 }
 for(const term of nameTerms)if(term.src.some(src=>source.includes(src)))
  for(const bad of term.forbidden_zh)assert(!translation.includes(bad),`Use ${term.zh} for ${term.src[0]}`)
}
