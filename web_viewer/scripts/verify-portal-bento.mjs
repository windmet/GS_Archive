import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {buildPortalDesktopOverview,portalIdolPortrait} from '../src/presentation/ArchivePortalPresentation.js'
import {portalDailyCard,portalTimeline} from '../src/presentation/PortalBento.js'
import {storyGateways,storyGatewayCount} from '../src/presentation/StoryGateways.js'
const root=process.argv[2]
assert.ok(root,'Supply verified read model root')
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const bootstrap=json(path.join(root,'bootstrap.inline.json'))
const read=d=>{const bytes=fs.readFileSync(path.join(root,'pages',d.url.slice(1)));assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sha256);return JSON.parse(bytes).data}
const index=domain=>read(bootstrap.domains[domain])
const rows=domain=>index(domain).pages.flatMap(d=>read(d).rows)
const cards=rows('cards'),songs=rows('songs'),stories=rows('stories'),units=rows('units')
const facets=json('public/data/assets/portal_card_facets.json'),portraits=json('public/data/assets/raw_character_image_promotions.json')
const options={bootstrap,cards,songs,stories,units,cardFacets:facets,portraits}
const overview=buildPortalDesktopOverview(options)
const allStarsSongs=overview.collections.songs.filter(row=>row.performanceKind==='configurable_formation')
assert.equal(allStarsSongs.length,5)
assert.ok(allStarsSongs.every(row=>row.performerLabel==='315 ALL STARS'))
assert.ok(overview.collections.songs.filter(row=>row.performanceKind!=='configurable_formation').every(row=>row.performerLabel===''))
const minoriSongs=buildPortalDesktopOverview({...options,preferredIdol:'011min'}).collections.songs
assert.equal(minoriSongs.length,5)
assert.ok(minoriSongs.every(row=>row.performerLabel===''&&row.performers.length>0))
assert.equal(Object.keys(facets.cards).length,826)
const counts={}
for (const row of cards) {
  const detail=read(row.detail),facet=facets.cards[row.resource_id]
  assert.equal(facet.detailSha256,row.detail.sha256)
  assert.equal(facet.attribute,detail.card.gameplay.attribute.name)
  counts[facet.attribute]=(counts[facet.attribute]||0)+1
  const projected=overview.collections.cards.find(card=>card.id===row.resource_id)
  assert.equal(projected.attribute,facet.attribute)
  assert.equal(Boolean(projected.landscape),row.asset_status.awakened_landscape===true || row.asset_status.normal_landscape===true)
  if(projected.landscape) assert.ok(projected.landscape.url.endsWith(`${row.resource_id}${row.asset_status.awakened_landscape?'p':''}.png`))
}
assert.deepEqual(counts,{Physical:257,Mental:267,Intelligence:302})
assert.ok(buildPortalDesktopOverview({...options,cardFacets:{...facets,release:'wrong'}}).collections.cards.every(row=>!row.attribute),'stale facets cannot classify current cards')
for(const idol of bootstrap.idols){
  const image=portalIdolPortrait(portraits,idol.id)
  assert.equal(image.kind,'story_visual')
  assert.ok(image.url.endsWith(`_${idol.id}.png`))
  const entry=portraits.entries.find(row=>row.kind==='story_visual'&&row.idol_code===idol.id)
  const bytes=fs.readFileSync('public'+entry.asset_url)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.output.sha256)
  assert.equal(entry.unity_object.object_type,'Sprite')
  assert.ok(entry.master_evidence.compiled_files.every(file=>file.startsWith(`1_2_${idol.id}_`)))
  assert.equal(portalIdolPortrait({entries:[{...entry,asset_url:'/assets/wrong.png'}]},idol.id),null)
}
assert.equal(portraits.entries.filter(row=>row.kind==='story_visual').length,49)
for(const unit of overview.units) assert.equal(unit.color,units.find(row=>row.catalog.unit.unit_code===unit.id).catalog.unit.unit_color)
const daily=portalDailyCard(overview.collections.cards,'2026-10-04')
assert.equal(portalDailyCard(overview.collections.cards.slice().reverse(),'2026-10-04').id,daily.id)
assert.notEqual(portalDailyCard(overview.collections.cards,'2026-10-04',1).id,daily.id)
assert.equal(portalDailyCard([],'2026-10-04'),null)
const gatewayCounts={seasonalCount:index('stories').seasonalCount,workCount:index('stories').workCount,idolStoryCount:bootstrap.idols.length}
const gateways=storyGateways.filter(row=>row.action!=='external-resources')
// Card stories (342 phone calls) moved to 通信 in 49c90f2d and are no longer a story gateway.
assert.equal(gateways.length,5)
assert.ok(!gateways.some(row=>row.id==='card_scenarios'))
assert.deepEqual(gateways.map(row=>storyGatewayCount(row,stories,gatewayCounts)),[49,49,152,44,4])
const timeline=portalTimeline([{id:'a',releaseAt:1633046400,subtitle:'date',image:{url:'/assets/a.png'}},{id:'b',releaseAt:1680393600,subtitle:'date',image:{url:'/assets/b.png'}}])
assert.deepEqual(timeline.map(row=>row.id),['a','b'])
assert.deepEqual(timeline.map(row=>row.timelineDate),['2021.10.01','2023.04.02'])
assert.ok(timeline.every(row=>row.seriesLabel==='date'))
assert.deepEqual(portalTimeline([]),[])
console.log('PASS Bento: 49 source-bound single portraits; 826 exact detail attributes; landscape capabilities, stale-release rejection, 16 source colors, daily stability, 6 shared gateway counts and source timeline boundaries')
