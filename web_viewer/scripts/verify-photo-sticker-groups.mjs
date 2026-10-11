import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHOTO_STICKER_GROUPS, photoStickerGroup } from '../src/presentation/photoStickerGroups.js'

// One sticker grouping for the photo catalogue and the studio: every sticker in exactly one known
// group, the 16 unit logos as the unit group, every SideMini chibi together.
const materials = JSON.parse(readFileSync(new URL('../public/data/masterdata/domains/photo_materials.json', import.meta.url), 'utf8'))
const ids = new Set(PHOTO_STICKER_GROUPS.map(group => group.id))
const count = {}
for (const sticker of materials.stickers) {
  const group = photoStickerGroup(sticker)
  assert.ok(ids.has(group), `sticker ${sticker.id} falls in a known group`)
  count[group] = (count[group] || 0) + 1
}
assert.equal(Object.values(count).reduce((a, b) => a + b, 0), materials.stickers.length, 'every sticker is grouped once')
assert.equal(count.unit, 16, 'the unit group holds the 16 unit logos')
assert.equal(count.sidemini, materials.stickers.filter(s => /SideMini/.test(s.name)).length, 'every SideMini sticker is together')
const catalog = readFileSync(new URL('../src/components/archive/ArchivePhotoCatalog.vue', import.meta.url), 'utf8')
assert.match(catalog, /import \{ PHOTO_STICKER_GROUPS, photoStickerGroup \} from '\.\.\/\.\.\/presentation\/photoStickerGroups\.js'/, 'the photo catalogue uses the shared grouping')
console.log(`Photo sticker groups: ${materials.stickers.length} stickers in ${Object.keys(count).length} groups`, count)
