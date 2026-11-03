import assert from 'node:assert/strict'
import fs from 'node:fs'
import {removeChineseInlineSpaces,beforeSpacingAmendment} from './lib/story-spacing-amendment.mjs'
assert.equal(removeChineseInlineSpaces('巧克力 甜香， 想到你。'), '巧克力甜香，想到你。')
const preserved='315 Production / Cafe Parade\n第1章　舞台　完\nA B\n\n{{GS_ADDRESS:0:producer_name}}'
assert.equal(removeChineseInlineSpaces(preserved),preserved)
const data=JSON.parse(fs.readFileSync('translation/studio/amendments/20261031-b036-spacing.json'))
let units=0
for(const item of data.catalogues) {
  const bytes=fs.readFileSync(`public/translations/zh-CN/scenarios/${item.scenario_id}.json`)
  beforeSpacingAmendment(bytes,item)
  const forged=structuredClone(item)
  forged.edits[0].before+='别的文字'
  assert.throws(()=>beforeSpacingAmendment(bytes,forged),'a semantic change cannot masquerade as formatting')
  assert.throws(()=>beforeSpacingAmendment(Buffer.from(bytes.toString()+' '),item),'amended public bytes cannot drift')
  units+=item.edits.length
}
assert.equal(units,265)
assert.equal(data.catalogues.length,26)
console.log(`Spacing amendments: ${units} source-bound formatting fixes; original receipts reconstruct exactly; English, macros, paragraphs and chapter separators preserved`)
