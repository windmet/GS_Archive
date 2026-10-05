import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {uiLocale} from '../src/localization/ui/UiLocaleStore.js'
import {archiveText,archiveSearchText} from '../src/components/archive/useArchiveCollectionText.js'
// Attribute materials keep the game's Latin attribute label (Physical/Intelli/Mental), as the
// reviewed item and honor translations do; the collection must not swap in a Chinese alias.
const entries=JSON.parse(readFileSync(new URL('../public/translations/zh-CN/archive-general/items.json',import.meta.url),'utf8')).entries.item.name
const materials=Object.entries(entries).filter(([,text])=>/^(Physical|Intelli|Mental)(戒指|脚链|徽章)$/.test(text))
assert.equal(materials.length,9)
for(const locale of ['zh-CN','ja-JP']) {
  uiLocale.value=locale
  for(const [source,translated] of materials){
    assert.equal(archiveText('item',source),locale==='zh-CN'?translated:source)
    assert.ok(archiveSearchText('item',source).includes(source))
    assert.ok(archiveSearchText('item',source).includes(translated))
  }
}
assert.ok(!existsSync(new URL('../src/presentation/CollectionAttributeName.mjs',import.meta.url)),'the Chinese attribute alias is retired')
console.log('Collection display: 9 attribute materials keep their Latin attribute label in both locales and stay searchable')
