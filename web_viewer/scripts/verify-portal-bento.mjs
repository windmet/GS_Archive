import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {buildPortalDesktopOverview,portalIdolPortrait} from '../src/presentation/ArchivePortalPresentation.js'
import {portalDailyCard,portalTimeline} from '../src/presentation/PortalBento.js'
import {portalDisplayOverview} from '../src/data/PortalRepository.js'
import {storyGateways,storyGatewayCount} from '../src/presentation/StoryGateways.js'
import {cardArtThumbKey,cardArtThumbSourceKey,cardArtThumbSpec,CARD_ART_THUMB_QUALITY,CARD_ART_THUMB_SIZES} from '../shared/portal/CardArtThumbnails.js'
import {COPY_TRANSFORM,previewTransformKind,resolvePreviewObjectKey} from '../shared/deploy/PreviewAssetTransform.js'
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
  if(projected.landscape){
    const suffix=`${row.resource_id}${row.asset_status.awakened_landscape?'p':''}`
    assert.ok(projected.landscape.url.endsWith(`/thumb/landscape/image_card_landscape_${suffix}.webp`),'portal landscape art is the derived thumbnail')
    assert.ok(projected.landscape.full.endsWith(`/landscape/image_card_landscape_${suffix}.png`),'the detail page keeps the original landscape PNG')
  }
}
// Every Portal card draws a thumbnail; the full PNG stays for the detail page.
const thumbed=overview.collections.cards.filter(card=>card.image?.url.startsWith('/assets/card-art/thumb/portrait/'))
assert.equal(thumbed.length,overview.collections.cards.filter(card=>card.image).length,'every Portal card portrait is a thumbnail')
assert.ok(overview.collections.cards.every(card=>!card.image||card.image.full.endsWith('.png')),'full-resolution URLs remain available')
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
// Thumbnail URL contract: one derived .webp family, fixed sizes, copied verbatim
// by the deployment (never losslessly re-encoded, which would throw the bytes away).
assert.equal(cardArtThumbKey('assets/card-art/portrait/image_card_portrait_hide_003hok_ssr02p.png'),'assets/card-art/thumb/portrait/image_card_portrait_hide_003hok_ssr02p.webp')
assert.equal(cardArtThumbKey('assets/card-art/portrait/image_card_portrait_show_003hok_ssr02p.png'),null,'the framed detail portrait is not thumbnailed')
assert.equal(cardArtThumbKey('assets/card-art/landscape/image_card_landscape_003hok_ssr01p.png'),'assets/card-art/thumb/landscape/image_card_landscape_003hok_ssr01p.webp')
assert.equal(cardArtThumbKey('assets/cards/icons/image_card_icon_001tom.png'),null,'icons have their own size class')
assert.equal(cardArtThumbSourceKey('assets/card-art/thumb/landscape/image_card_landscape_003hok_ssr01p.webp'),'assets/card-art/landscape/image_card_landscape_003hok_ssr01p.png')
assert.equal(cardArtThumbSourceKey('assets/card-art/thumb/portrait/image_card_portrait_hide_001tom_n01p.webp'),'assets/card-art/portrait/image_card_portrait_hide_001tom_n01p.png')
const portraitThumb=cardArtThumbSpec('assets/card-art/thumb/portrait/image_card_portrait_hide_001tom_n01p.webp')
const landscapeThumb=cardArtThumbSpec('assets/card-art/thumb/landscape/image_card_landscape_003hok_ssr01p.webp')
assert.deepEqual(portraitThumb,CARD_ART_THUMB_SIZES.portrait)
assert.deepEqual(landscapeThumb,CARD_ART_THUMB_SIZES.landscape)
assert.equal(portraitThumb.width/portraitThumb.height,4/5,'the portrait thumbnail keeps the 4:5 art ratio')
assert.equal(landscapeThumb.width/landscapeThumb.height,15/8,'the landscape thumbnail keeps the 15:8 art ratio')
assert.ok(CARD_ART_THUMB_QUALITY>=75&&CARD_ART_THUMB_QUALITY<=85,'thumbnails stay clearly lossy')
const thumbKey='assets/card-art/thumb/portrait/image_card_portrait_hide_001tom_n01p.webp'
assert.equal(resolvePreviewObjectKey(thumbKey),thumbKey,'a thumbnail is its own physical object')
assert.equal(previewTransformKind(thumbKey),COPY_TRANSFORM,'the deployment copies encoded thumbnails instead of re-encoding them')
// A release-pinned scope bakes full-size URLs; the Portal display maps them to the
// thumbnail family without touching the pinned projection, and does so idempotently.
const baked={scopeId:'',units:[],collections:{cards:[{id:'001tom_ssr01',idolCode:'001tom',idolName:'天ヶ瀬 冬馬',title:'t',
  image:{url:'/assets/card-art/portrait/image_card_portrait_hide_001tom_ssr01p.png',kind:'card_portrait',variant:'p',status:'available'},
  landscape:{url:'/assets/card-art/landscape/image_card_landscape_001tom_ssr01p.png',kind:'card_landscape',variant:'p',status:'available'}}],
  songs:[],stories:[],events:[]}}
const displayed=portalDisplayOverview(baked,{})
assert.equal(displayed.collections.cards[0].image.url,'/assets/card-art/thumb/portrait/image_card_portrait_hide_001tom_ssr01p.webp','a pinned full-size portrait becomes the thumbnail')
assert.equal(displayed.collections.cards[0].image.full,'/assets/card-art/portrait/image_card_portrait_hide_001tom_ssr01p.png','the pinned full-size URL survives for the detail page')
assert.equal(displayed.collections.cards[0].landscape.url,'/assets/card-art/thumb/landscape/image_card_landscape_001tom_ssr01p.webp')
assert.equal(displayed.collections.cards[0].landscape.full,'/assets/card-art/landscape/image_card_landscape_001tom_ssr01p.png')
assert.equal(displayed.cards[0],displayed.collections.cards[0],'the first-three preview shares the mapped rows')
const remapped=portalDisplayOverview({...baked,collections:{...baked.collections,cards:[{...baked.collections.cards[0],image:displayed.collections.cards[0].image}]}},{})
assert.equal(remapped.collections.cards[0].image.url,displayed.collections.cards[0].image.url,'mapping an already-thumbnailed row is stable')
const noArt=portalDisplayOverview({...baked,collections:{...baked.collections,cards:[{...baked.collections.cards[0],image:null,landscape:null}]}},{})
assert.equal(noArt.collections.cards[0].image,null,'cards without art stay null')
console.log('PASS Bento: 49 source-bound single portraits; 826 exact detail attributes; 826 Portal thumbnails with full-size fallbacks; pinned-scope thumbnail mapping; daily stability, 5 shared gateway counts and source timeline boundaries')
