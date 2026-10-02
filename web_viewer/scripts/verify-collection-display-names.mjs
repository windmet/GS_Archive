import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {collectionAttributeName} from '../src/presentation/CollectionAttributeName.mjs'
import {uiLocale} from '../src/localization/ui/UiLocaleStore.js'
import {archiveText,archiveSearchText} from '../src/components/archive/useArchiveCollectionText.js'
const entries=JSON.parse(readFileSync(new URL('../public/translations/zh-CN/archive-general/items.json',import.meta.url),'utf8')).entries.item.name
const materials=Object.entries(entries).filter(([,text])=>/^(Physical|Intelli|Mental)(戒指|脚链|徽章)$/.test(text))
assert.equal(materials.length,9)
for(const locale of ['zh-CN','ja-JP']) {
  uiLocale.value=locale
  for(const [source,translated] of materials){
    const alias=collectionAttributeName(translated)
    assert.equal(archiveText('item',source),locale==='zh-CN'?alias:source)
    assert.ok(archiveSearchText('item',source).includes(alias),'short Chinese alias remains searchable in either locale')
    assert.ok(archiveSearchText('item',source).includes(source))
    assert.ok(archiveSearchText('item',source).includes(translated))
    assert.equal(archiveText('item',source,'description'),source,'descriptions are never rewritten')
    assert.equal(archiveText('honor',source),source,'honors are not rewritten')
  }
}
assert.equal(collectionAttributeName('Physical戒指招募券'),'Physical戒指招募券')
assert.equal(collectionAttributeName('Physical'),'Physical')
assert.equal(collectionAttributeName('Intelligent脚链'),'知性脚链')
assert.equal(collectionAttributeName('Mental徽章'),'心理徽章')
console.log('Collection display: 9 exact material aliases, both locales, original/approved/short-name searches and unrelated field preservation passed')
