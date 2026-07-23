import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ReleaseSoakRecorder } from '../src/core/story-runtime/ReleaseSoakRecorder.js'

let now = Date.parse('2026-07-23T00:00:00.000Z')
let intervalCallback = null
const clearedTimers = []
let heap = 100
let spines = 2
const receiverSensitiveSetInterval = function (callback) {
  assert.equal(this, undefined, 'timer function must be called without the recorder as receiver')
  intervalCallback = callback
  return 17
}
const recorder = new ReleaseSoakRecorder({
  sampleIntervalMs: 30_000,
  maxSamples: 3,
  now: () => now,
  setIntervalFn: receiverSensitiveSetInterval,
  clearIntervalFn: timer => clearedTimers.push(timer),
})

const collector = () => ({
  memory: { used_js_heap_size: heap },
  spine: { instances: spines, silhouettes: 0, pending_silhouettes: 0 },
  audio_session: { active_sources: 2 },
  audio_manager: { cleanup_timers: 1 },
  runtime_active_count: 1,
  stage: {
    stage_children: 7,
    spine_container_children: 2,
    debug_markers: 2,
    silhouette_relayout_jobs: 0,
    overlays: { active_count: 1 },
  },
})

recorder.attachCollector(collector)
recorder.start()
assert.equal(recorder.inspect().sample_count, 1)
assert.equal(recorder.inspect().status, 'running')

now += 30_000
heap = 150
spines = 0
intervalCallback()
now += 30_000
heap = 120
intervalCallback()

const report = recorder.export()
assert.equal(report.contract, 'story-release-soak-v1')
assert.equal(report.status, 'stopped')
assert.equal(report.stop_reason, 'capacity')
assert.equal(report.sample_count, 3)
assert.equal(report.elapsed_ms, 60_000)
assert.deepEqual(clearedTimers, [17])
assert.deepEqual(report.summary.heap_used_js_bytes, {
  first: 100,
  last: 120,
  min: 100,
  max: 150,
  net_change: 20,
  decrease_observed: true,
})
assert.equal(report.summary.spine_instances.first, 2)
assert.equal(report.summary.spine_instances.last, 0)
assert.equal(report.summary.stage_children.last, 7)
assert.equal(report.summary.spine_container_children.last, 2)
assert.equal(report.summary.debug_markers.last, 2)
assert.equal(report.samples[0].reason, 'start')
assert.equal(report.samples.at(-1).reason, 'interval')

const manualRecorder = new ReleaseSoakRecorder({
  now: () => now,
  setIntervalFn: () => 23,
  clearIntervalFn: timer => clearedTimers.push(timer),
})
manualRecorder.attachCollector(collector)
manualRecorder.start()
manualRecorder.stop('manual-check')
assert.equal(manualRecorder.inspect().status, 'stopped')
assert.equal(manualRecorder.inspect().stop_reason, 'manual-check')
assert.equal(manualRecorder.export().samples.at(-1).reason, 'stop')

let remountTimer = null
let route = 'episode-a'
const remountRecorder = new ReleaseSoakRecorder({
  now: () => now,
  setIntervalFn: callback => {
    remountTimer = callback
    return 29
  },
})
const firstCollector = () => ({ route })
remountRecorder.attachCollector(firstCollector)
remountRecorder.start()
remountRecorder.detachCollector(firstCollector)
now += 30_000
remountTimer()
assert.equal(remountRecorder.inspect().sample_count, 1, 'detached viewer must not retain its collector')
route = 'episode-b'
remountRecorder.attachCollector(() => ({ route }))
assert.equal(remountRecorder.inspect().sample_count, 2, 'new viewer attaches to the running session')
assert.equal(remountRecorder.export().samples.at(-1).route, 'episode-b')
remountRecorder.stop('remount-check')

let detachedTimer = null
const detachedRecorder = new ReleaseSoakRecorder({
  sampleIntervalMs: 30_000,
  maxSamples: 3,
  now: () => now,
  setIntervalFn: callback => {
    detachedTimer = callback
    return 31
  },
})
const detachedCollector = () => ({ route: 'episode-a' })
detachedRecorder.attachCollector(detachedCollector)
detachedRecorder.start()
detachedRecorder.detachCollector(detachedCollector)
now += 60_000
detachedTimer()
assert.equal(detachedRecorder.inspect().status, 'stopped')
assert.equal(detachedRecorder.inspect().stop_reason, 'duration')
assert.equal(detachedRecorder.inspect().sample_count, 1)

const [viewerSource, stageManagerSource] = await Promise.all([
  readFile(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/PixiStageManager.js', import.meta.url), 'utf8'),
])
assert.match(viewerSource, /releaseSoakRecorder\.attachCollector\(collectReleaseSoakSample\)/)
assert.match(viewerSource, /releaseSoakRecorder\.detachCollector\(collectReleaseSoakSample\)/)
assert.match(viewerSource, /setInterval\(refreshRuntimeDiagnostics,\s*2000\)/)
assert.match(viewerSource, /data-testid="story-soak-start"/)
assert.match(viewerSource, /data-testid="story-soak-stop"/)
assert.match(viewerSource, /data-testid="story-soak-export"/)
assert.match(stageManagerSource, /inspectReleaseState\(\)/)
assert.match(stageManagerSource, /active_count:\s*Object\.values\(overlays\)/)
assert.doesNotMatch(stageManagerSource, /console\.warn\('\[SPAWN_DONE\]'/)
assert.match(stageManagerSource, /if \(this\._debugMode\) \{\s*console\.debug\('\[SPAWN_DONE\]'/)

console.log('Release soak recorder: bounded 30-second sampling, summaries, export and viewer lifecycle verified')
