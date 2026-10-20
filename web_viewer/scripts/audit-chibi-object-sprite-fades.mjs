// Read-only discrepancy census. Successful execution is not fade acceptance.
// Requires the mounted native object/choreography indexes and source receipt.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const objectBytes = read('public/assets/live-chibi/object-layers/index.json')
const choreographyBytes = read('public/assets/live-chibi/choreography/index.json')
const nativeBytes = read('scripts/fixtures/chibi-object-sprite-sources.json')
const native = JSON.parse(nativeBytes), index = JSON.parse(objectBytes)
const choreography = JSON.parse(choreographyBytes)
assert.equal(hash(objectBytes), native.objectIndexSha256, 'Sprite provenance is bound to another index')
for (const [id, sample] of Object.entries(native.commandSamples)) {
  assert.deepEqual(choreography.songs.find(s=>s.id===id)?.objectLayerEvents, sample.objectLayerEvents,
    'Representative RAW command binding changed: ' + id)
}
const source = read('src/components/ChibiStageViewer.vue').toString('utf8')
const block = source.slice(source.indexOf('function sampleObjectLayerAlpha('), source.indexOf('async function loadObjectLayerRuntime('))
assert(block.includes('function objectLayerStatesAt('), 'Runtime sampler moved; update the audit deliberately')
const sample = events => new Function('selectedSong', block + ';return objectLayerStatesAt')({value:{objectLayerEvents:events}})
const tracks = [], firstShowCounterexamples = [], translucentCaps = [], overlaps = [], interruptedErases = []
let overlappingTransitions = 0
for (const song of choreography.songs) {
  const groups = new Map()
  for (const [order,event] of song.objectLayerEvents.entries()) {
    if (!native.assets[event.asset]) continue
    if (!groups.has(event.asset)) groups.set(event.asset, [])
    groups.get(event.asset).push({...event, order})
  }
  for (const [asset, events] of groups) {
    const record = native.assets[asset], entry = index.assets[asset]
    assert.equal(record.sprites.length, entry.instances.length)
    tracks.push({song:song.id, asset, events:events.length})
    for (const [i,event] of events.entries()) {
      if (i && events[i-1].time + events[i-1].duration > event.time) overlappingTransitions++
      for (const previous of events.slice(0,i)) {
        if (previous.time + previous.duration <= event.time) continue
        const pair = {song:song.id, asset, previous, next:event}
        overlaps.push(pair)
        if (previous.hide && !event.hide) interruptedErases.push(pair)
      }
    }
    const first = events[0]
    const nextTime = events[1]?.time ?? Infinity
    if (!first.hide && first.duration > 1 && nextTime > first.time) {
      const at = first.time + Math.min(first.duration / 2, (nextTime-first.time)/2)
      const state = sample(events)(at).get(asset)
      const unit = record.sprites.findIndex(s=>s.color.a===1)
      // A first tween from alpha=1 to alpha=1 stays at 1 regardless of easing,
      // frame alignment or lazy getter startup. This isolates a definite gap.
      if (unit >= 0 && Math.abs(state.alpha-1)>1e-6) firstShowCounterexamples.push({song:song.id,asset,
        commandTime:first.time,duration:first.duration,at,renderer:record.sprites[unit].pathId,
        nativeAlpha:1,webAlpha:state.alpha * entry.instances[unit].alpha})
      if (nextTime > first.time + first.duration + 100) {
        for (const [i,sprite] of record.sprites.entries()) if (sprite.color.a<1) {
          const at = first.time + first.duration + 100, state = sample(events)(at).get(asset)
          translucentCaps.push({song:song.id,asset,at,renderer:sprite.pathId,
            serializedAlpha:sprite.color.a,nativeCompletedTarget:1,webAlpha:state.alpha * entry.instances[i].alpha})
        }
      }
    }
  }
}
const report = {
  status:firstShowCounterexamples.length || translucentCaps.length
    ? 'open-runtime-discrepancies; native-frame-replay-pending'
    : 'no-isolated-counterexamples; full-parity-unverified',
  inputs:{objectIndexSha256:hash(objectBytes), choreographyIndexSha256:hash(choreographyBytes),
    nativeReceiptSha256:hash(nativeBytes), componentSha256:hash(Buffer.from(source))},
  scope:'Only source-bound sprite/mixed entries in the public object index; APK built-in consumers excluded',
  summary:{assets:Object.keys(native.assets).length, renderers:Object.values(native.assets).reduce((n,a)=>n+a.sprites.length,0),
    tracks:tracks.length,events:tracks.reduce((n,t)=>n+t.events,0),overlappingTransitions,overlappingPairs:overlaps.length,
    interruptedErasePairs:interruptedErases.length, firstShowCounterexamples:firstShowCounterexamples.length,
    translucentCompletedCaps:translucentCaps.length},
  firstShowCounterexamples,translucentCaps,interruptedErases,overlaps,
  remainingProof:['Native getter startup relative to script dispatch and TweenManager.Update',
    'Native overlapping write order after active-list compaction and old erase callbacks',
    'Rendered correction, seek/rewind, per-renderer and mixed/CanvasGroup acceptance'],
}
console.log(JSON.stringify(process.argv.includes('--json') ? report : {
  status:report.status,scope:report.scope,...report.summary,
  firstShowExample:firstShowCounterexamples[0],translucentExample:translucentCaps[0],
  interruptedEraseExample:interruptedErases[0],remainingProof:report.remainingProof,
},null,2))
