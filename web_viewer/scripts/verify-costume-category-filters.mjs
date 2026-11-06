import assert from 'node:assert/strict'
import fs from 'node:fs'
import source from '../src/data/costumeCategories.json' with {type:'json'}
import {costumeCategoryId,costumeCategoryCounts,costumeFilterView} from '../src/presentation/CostumeCategories.js'

const rows=Object.values(source.groups).flat().map(modelId=>({modelId,name:modelId}))
assert.equal(rows.length,690)
assert.equal(new Set(rows.map(row=>row.modelId)).size,690)
assert.equal(source.groups.story.length,141)
assert.equal(rows.filter(row=>costumeCategoryId(row)!=='story').length,549)
assert.equal(source.source.decodedPbSha256,'25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1')
assert.deepEqual(source.source.tables,[2,24,27,28])
for(const [category,models] of Object.entries(source.groups)) {
  assert.deepEqual(costumeFilterView(rows,category).rows.map(row=>row.modelId).sort(),[...models].sort())
  assert(models.every(modelId=>costumeCategoryId({modelId})===category))
}
assert.equal(costumeCategoryId({modelId:'001tom_002_00'}),'story','basic casual wear remains available outside Live categories')
assert.equal(costumeCategoryId({modelId:'001tom_004_00'}),'story','sportswear is not dropped')
assert.equal(costumeCategoryId({modelId:'004ter_102_00'}),'unit')
assert.equal(costumeCategoryId({modelId:'005kao_102_00'}),'unit')
assert.equal(costumeCategoryId({modelId:'006tsu_101_00'}),'unit','same unit design can use different idol-local IDs')
assert.equal(costumeCategoryId({modelId:'002sht_104_01'}),'unit','another version inherits its native family scope')
assert.equal(costumeCategoryId({modelId:'004ter_102_00',name:'任意译名'}),'unit','translation never determines scope')
assert.equal(costumeCategoryId({modelId:'new_unclassified'}),'other')
assert.equal(costumeCategoryId(null),'other')
const costume=Object.freeze({modelId:'001tom_002_00',name:'常服'})
const model=Object.freeze({modelId:'001tom_005_00',name:'共通服'})
const options=Object.freeze([costume,model])
const filtered=costumeFilterView(options,'all',costume.modelId)
assert.deepEqual(filtered.rows,[model]);assert.equal(filtered.pinned,costume)
assert.equal(options[0],costume,'filtering never mutates or substitutes a selected costume')
assert.equal(costumeFilterView(options,'story',costume.modelId).pinned,null)
assert.equal(costumeFilterView(options,'',costume.modelId).rows,options)
assert.equal(costumeFilterView(options,'unknown',costume.modelId).pinned,costume)
assert.equal(costumeFilterView(options,'all','missing').pinned,null)
assert.deepEqual(costumeFilterView().rows,[])
assert.deepEqual(costumeCategoryCounts(),[])
assert.deepEqual(costumeCategoryCounts(options).map(row=>[row.id,row.count]),[['all',1],['story',1]])
assert.deepEqual(costumeCategoryCounts([{modelId:'unknown'}]).map(row=>row.id),['other'])
const home=fs.readFileSync(new URL('../src/components/archive/ArchiveImmersiveHome.vue',import.meta.url),'utf8')
const studio=fs.readFileSync(new URL('../src/components/archive/PictureStudio.vue',import.meta.url),'utf8')
const consolePanel=fs.readFileSync(new URL('../src/components/archive/ArchiveHomeConsole.vue',import.meta.url),'utf8')
// The 事务所 console (desktop panel and phone sheet are one component) draws the same exact-model categories as chips;
// the scene settings keep the select. Both read the shared helpers, and both keep the current model visibly pinned.
assert.equal((home.match(/<CostumeCategoryFilter /g)||[]).length,1,'scene settings keep the shared filter')
assert.match(consolePanel,/costumeCategoryCounts\(props\.activeIdol\.costumes\)/,'console chips use the shared category counts')
assert.match(consolePanel,/@click="emit\('update:costumeCategory', group\.id\)"/)
assert.match(home,/:filtered-costumes="filteredCostumes"/,'console rows come from the shared filter view')
assert.equal((home.match(/v-if="filteredCostumes.pinned"/g)||[]).length,1,'current model remains visibly pinned in the settings picker')
assert.match(consolePanel,/v-if="filteredCostumes\.pinned"/,'current model remains visibly pinned in the console')
assert(studio.includes('label="摄影服装类别"') && studio.includes('v-if="filteredCostumes.pinned"'))
// The phone sheet stands on the shell's mobile nav (it used to sit under it, hiding the last rows); the inset
// is the nav row's own height and drops to 0 where the nav is hidden.
{
  const shell=fs.readFileSync(new URL('../src/components/archive/ArchiveShell.vue',import.meta.url),'utf8')
  const navRow=shell.match(/grid-template-rows: var\(--archive-topbar\) minmax\(0, 1fr\) (calc\(74px \+ env\(safe-area-inset-bottom, 0px\)\));/)?.[1]
  assert(navRow,'the mobile shell keeps its nav row')
  assert(shell.includes(`--archive-mobile-nav-inset: ${navRow};`),'the sheet inset equals the nav row height')
  assert.match(shell,/\.archive-shell\.is-home-focus, \.archive-shell\.is-reader, \.archive-shell\.is-tool \{ --archive-mobile-nav-inset: 0px;/)
  assert.match(consolePanel,/\.console-panel \{ position: fixed;[^}]*bottom: var\(--archive-mobile-nav-inset, 0px\);/,'the phone sheet stands on the nav')
}
// The console's costume thumbnails are the collection's pictures: the costumes catalogue's image per model,
// through the same costumeImage rule (site render where the game has none or a wrong one), never renders only.
{
  const app=fs.readFileSync(new URL('../src/App.vue',import.meta.url),'utf8')
  assert.match(consolePanel,/costumeImage\(costume\.modelId, props\.costumeImages\?\.get\(costume\.modelId\) \|\| null\)/,'console thumbnails use the collection image')
  assert.doesNotMatch(consolePanel,/costumeImage\([^)]*, null\)/,'no renders-only lookup is left')
  assert.match(home,/:costume-images="costumeImages"/)
  assert.match(app,/:costume-images="homeCostumeImages"/)
  assert.match(app,/catalog\('costumes', \{ priority: 'background' \}\)\s*\.then\(rows => \{ homeCostumeImages\.value = new Map\(rows\.map\(row => \[row\.id, row\.image \|\| null\]\)\) \}\)/)
}
console.log('Costume filters: 690 native models, 549 Live +141 story-only, exact-model categories, pinned selection and all home/photo entry points passed')
