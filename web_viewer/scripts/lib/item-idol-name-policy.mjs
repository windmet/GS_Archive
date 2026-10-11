import assert from 'node:assert/strict'
import fs from 'node:fs'
const policy=JSON.parse(fs.readFileSync(new URL('../../translation/studio/policy/idol-names.v1.json',import.meta.url),'utf8'))

export function validateItemIdolNames(source,translation,decision='translated') {
 if(decision==='keep-source')return
 for(const idol of policy.entries){
  if(source.replaceAll(' ','').includes(idol.source_name.replaceAll(' ','')))
   assert(translation.includes(idol.name),`Item idol name must use ${idol.name}: ${source}`)
 }
 if(source.includes('タケル'))assert(!/大河猛|猛同款/u.test(translation),'Use 大河武 / 武 for タケル')
 if(source.includes('キリオ'))assert(!translation.includes('桐绪'),'Use 桐生 for キリオ')
}
