import {withStageIndexTransport} from './lib/stage-index-harness.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectChibiGround } from '../src/core/chibiStageCoordinates.js'

import crypto from 'node:crypto'
import { attachNativeSpotlights, spotlightTimelineAt, spotlightPoint } from '../src/core/chibiSpotlightTimeline.js'
const canonical = JSON.parse(fs.readFileSync(new URL('../public/data/stage-spotlight-commands.json', import.meta.url), 'utf8'))
// The published choreography is gitignored. Without it, rebuild only the
// fields attachNativeSpotlights binds against from the tracked command file:
// identity, legacy time/id/hide order and the slot to stage-position map.
const publishedAssets = process.argv.includes('--published-assets')
const raw = publishedAssets
  ? fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json', import.meta.url), 'utf8')
  : JSON.stringify({songs: Object.entries(canonical.songs).map(([id, track]) => ({
    id, source: track.source, songCode: track.songCode,
    spotlightEvents: track.events.map(({time, id, hide}) => ({time, id, hide})),
    stagePositionMap: [...new Map(track.events.filter(e => !e.hide && e.stagePosition !== null)
      .map(e => [e.targetSlot, {performerSlot: e.targetSlot, stagePosition: e.stagePosition}])).values()],
  }))})
const hash = crypto.createHash('sha256').update(raw).digest('hex')
if (!publishedAssets) canonical.choreographyIndexSha256 = hash
const index = attachNativeSpotlights(JSON.parse(raw), canonical, hash)
assert.equal(index.songs.length,118)
assert.throws(()=>attachNativeSpotlights(JSON.parse(raw),canonical,'0'.repeat(64)),/match/)
const invalid=structuredClone(canonical)
invalid.songs.steqmg_live_effect.events[0].sourceRow=0
assert.throws(()=>attachNativeSpotlights(JSON.parse(raw),invalid,hash),/command/)
const study=index.songs.find(s=>s.id==='steqmg_live_effect')
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-timeline.json', import.meta.url), 'utf8'))
for (const [code,song] of Object.entries(fixture.songs)) {
  const fields=Object.fromEntries(song.header.map((name,i)=>[name,i]))
  const track=index.songs.find(s=>s.songCode===code && s.spotlightEvents.length===song.events.length)
  for(const row of song.raw) {
    const event=track.spotlightEvents.find(e=>e.time===Number(row[fields.time])&&e.id===Number(row[fields.value1]))
    assert.ok(event)
    if(event.hide)continue
    assert.equal(event.y,Number(row[fields.value4])||0)
    assert.equal(event.scale,Math.fround((Number(row[fields.value6])||0)/1000))
    assert.equal(event.duration,500)
  }
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)
const event={time:0,id:1,targetSlot:1,stagePosition:2,x:0,y:0,scale:1,beamColor:'#ffffff',duration:500}
const moving=(pos,t)=>({x:t/10,y:200})
const timeline=[event,{...event,time:1000,targetSlot:0,stagePosition:null,x:100,y:360},
 {time:1500,id:1,hide:true,duration:400}]
const sample=t=>spotlightTimelineAt(timeline,t,moving).get(1)
close(sample(500).point.x,50)
close(sample(1000).point.x,100)
const free=spotlightPoint(timeline[1],1000,moving)
close(sample(1250).point.x,100+(free.x-100)*.75)
close(sample(1700).alpha,.25)
close(sample(1900).alpha,0)
close(sample(1200).alpha,1)
const interrupted=spotlightTimelineAt([...timeline,{...event,time:1600}],1600,moving).get(1)
close(interrupted.alpha,1)
close(interrupted.point.x,160)
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const section = source.slice(source.indexOf('function spotlightStatesAt('), source.indexOf('function laserlightStatesAt('))
assert.ok(section.includes('function spotlightTargetAt('))
const ref = value => ({ value })
const selectedSong = ref({ songCode: 'steqmg', spotlightEvents: study.spotlightEvents })
const time = ref(0), enabled = ref(true), ids = ref([]), count = ref(0), unresolved = ref([])
const runtimes = new Map(), calls = []
const store = {
  ensure(id, model) {
    calls.push(id)
    if (!model) return null
    if (!runtimes.has(id)) runtimes.set(id, {
      container: { position: { set(x, y) { this.x = x; this.y = y } }, scale: { set(value) { this.value = value } } },
      sprites: [{}, {}],
    })
    return runtimes.get(id)
  },
  release() { runtimes.clear() },
}
const coordinates = new Map([[2, { x: -350, y: 270 }], [3, { x: 0, y: 140 }], [4, { x: 350, y: 230 }]])
const layout = position => coordinates.get(position)
const resources = ref({ spotlight: { layers: [] }, assets: {} })
const sampler = new Function('selectedSong', 'layoutCoordinatesForStage', 'app', 'cameraContainer',
  'stageTime', 'beamEffectsEnabled', 'visibleSpotlightIds', 'visibleSpotlightCount',
  'unresolvedSpotlightIds', 'spotlightRuntimes', 'spotlightSprites', 'stageEffectIndex',
  'projectChibiGround', 'parseHexColor', 'spotlightTimelineAt', 'spotlightPoint', 'environmentScale', 'freeSpotlightIds', section + '\nreturn { sample: spotlightStatesAt, target: spotlightTargetAt, sync: syncSpotlights, release: releaseSpotlights }')(
  selectedSong, layout, { renderer: { width: 1280, height: 720, resolution: 1 } }, {},
  time, enabled, ids, count, unresolved, runtimes, store, resources, projectChibiGround,
  color => Number.parseInt(color.slice(1), 16),spotlightTimelineAt,spotlightPoint,ref(1),ref([]))
function seek(milliseconds) { time.value = milliseconds; sampler.sync() }
seek(13700)
assert.deepEqual(ids.value, [20, 21, 22])
assert.deepEqual(unresolved.value, [])
assert.equal(count.value, 3)
seek(20500)
assert.deepEqual(ids.value, [1,2])
assert.deepEqual(unresolved.value, [])
seek(32500)
assert.deepEqual(ids.value, [1,2,3])
assert.deepEqual(unresolved.value, [])
assert.equal(runtimes.get(2).container.visible,true)
assert.ok(runtimes.get(1).container.position.y < -10000,'Free lamp is authored offscreen, not unresolved')
assert.ok(runtimes.get(2).container.position.y < -10000,'OutQuad handoff moves the old lamp offscreen')
const right = {x:990,y:490}
assert.equal(runtimes.get(3).container.position.x, right.x)
assert.equal(runtimes.get(3).container.position.y, right.y)
close(runtimes.get(3).container.scale.value,Math.fround(1.2))
assert.equal(runtimes.get(3).sprites[0].tint, 0xf1e83d)
assert.equal(sampler.sample(32500).get(1).environmentOpacity, 400, 'Environment command survives the unresolved geometry')
for (const milliseconds of [13700, 32500, 20500, 32500]) {
  seek(milliseconds)
  assert.deepEqual(ids.value, milliseconds === 13700 ? [20, 21, 22] : milliseconds === 20500 ? [1,2] : [1,2,3])
}
enabled.value = false
seek(32500)
assert.deepEqual(ids.value, [])
assert.deepEqual(unresolved.value, [])
assert.ok([...runtimes.values()].every(runtime => !runtime.container.visible))
enabled.value = true
seek(32500)
assert.deepEqual(ids.value, [1,2,3])
seek(49301)
assert.equal(count.value, 0, 'Actual authored hide duration expires')
assert.deepEqual(unresolved.value, [])
resources.value.spotlight = null
seek(13700)
assert.equal(count.value, 0, 'Unavailable native resources are not counted as rendered sprites')
assert.ok([...runtimes.values()].every(runtime => !runtime.container.visible))
assert.ok(Number.isFinite(sampler.target({ stagePosition: null, x: 350,y:10000 }, 0).y))
assert.equal(sampler.target({ stagePosition: 99 }, 0), null)
coordinates.set(2, { x: NaN, y: 270 })
assert.equal(sampler.target({ stagePosition: 2 }, 0), null)
sampler.release()
assert.deepEqual(ids.value, [])
assert.deepEqual(unresolved.value, [])
assert.equal(runtimes.size, 0)
console.log('Native RAW Spotlight fields, scale, 500ms OutQuad handoff, free position, fade, reseek and real SFC resource counts passed')

// Exercise the real loader: required sidecar, actual-byte digest and cancellation.
const loaderSource=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const loaderSection=loaderSource.slice(loaderSource.indexOf('export async function fetchLiveChibiChoreography('),loaderSource.indexOf('export async function fetchLiveChibiCommandInventory(')).replace(/^export /gm,'')
const makeLoader=transport=>withStageIndexTransport(new Function('indexTransport','LIVE_CHIBI_BASE','crypto','attachNativeSpotlights','attachWholeScreen','attachSearchlights',loaderSection+';return fetchLiveChibiChoreography'))(
 transport,'/assets/live-chibi',crypto.webcrypto,attachNativeSpotlights,index=>index,index=>index)
// Whole-screen and searchlight sidecars have their own verifiers; pass them through.
const transport={load:async path=>path==='/data/stage-spotlight-commands.json'?JSON.stringify(canonical):/stage-(whole-screen|searchlights)/.test(path)?'{}':raw}
assert.equal((await makeLoader(transport)('choreography/index.json')).songs.length,118)
await assert.rejects(makeLoader({load:async path=>{if(path.includes('stage-spotlight'))throw new Error('missing native commands');return raw}})('choreography/index.json'),/missing native/)
const abort=new AbortController();abort.abort()
await assert.rejects(makeLoader(transport)('choreography/index.json',{signal:abort.signal}),{name:'AbortError'})
console.log('Required native Spotlight loader, transport digest and cancellation passed')
