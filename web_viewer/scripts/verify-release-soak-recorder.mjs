import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ReleaseSoakRecorder } from '../src/core/story-runtime/ReleaseSoakRecorder.js'
import { StoryAudioSession } from '../src/core/story-runtime/StoryAudioSession.js'
import { StoryReleaseProbe, storyReleaseProbe } from '../src/core/story-runtime/StoryReleaseProbe.js'

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
  maxDurationMs: 60_000,
  now: () => now,
  setIntervalFn: receiverSensitiveSetInterval,
  clearIntervalFn: timer => clearedTimers.push(timer),
})

const collector = () => ({
  memory: { used_js_heap_size: heap },
  spine: { instances: spines, silhouettes: 0, pending_silhouettes: 0 },
  audio_session: { active_sources: 2 },
  audio_manager: { cleanup_timers: 1 },
  playback: { timer_pending: 1 },
  step_effects: { timer_pending: 0 },
  runtime_frame_pending: 1,
  runtime_active_count: 1,
  lifecycle: {
    story_viewers_live: 1,
    pixi_stage_managers_live: 1,
    story_audio_sessions_live: 1,
    audio_contexts_live: 1,
    audio_context_close_failures: 0,
  },
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
assert.equal(report.contract, 'story-release-soak-v2')
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
assert.equal(report.summary.playback_timer_pending.last, 1)
assert.equal(report.summary.step_effect_timer_pending.last, 0)
assert.equal(report.summary.runtime_frame_pending.last, 1)
assert.equal(report.summary.story_viewers_live.last, 1)
assert.equal(report.summary.audio_contexts_live.last, 1)
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
  maxDurationMs: 60_000,
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

const isolatedProbe = new StoryReleaseProbe()
const releaseViewer = isolatedProbe.registerViewer(() => ({ route: 'story-a' }))
const releaseStage = isolatedProbe.registerStageManager({ id: 'stage-a' })
assert.equal(isolatedProbe.collectSnapshot().endpoint.viewer_attached, true)
assert.equal(isolatedProbe.inspect().story_viewers_live, 1)
assert.equal(isolatedProbe.inspect().pixi_stage_managers_live, 1)
releaseStage()
releaseViewer()
assert.equal(isolatedProbe.collectSnapshot().endpoint.viewer_attached, false)
assert.equal(isolatedProbe.collectSnapshot().stage.stage_children, 0)

const lifecycleBefore = storyReleaseProbe.inspect()
const fakeContext = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
  async close() { this.state = 'closed' },
}
const lifecycleSession = new StoryAudioSession({
  contextFactory: () => fakeContext,
  releaseOwner: 'story-player',
})
assert.equal(storyReleaseProbe.inspect().story_audio_sessions_live, lifecycleBefore.story_audio_sessions_live + 1)
lifecycleSession.ensureContext()
assert.equal(storyReleaseProbe.inspect().audio_contexts_created, lifecycleBefore.audio_contexts_created + 1)
await lifecycleSession.dispose()
assert.equal(storyReleaseProbe.inspect().story_audio_sessions_live, lifecycleBefore.story_audio_sessions_live)
assert.equal(storyReleaseProbe.inspect().audio_contexts_live, lifecycleBefore.audio_contexts_live)

const [viewerSource, stageSource, appSource, panelSource, stageManagerSource] = await Promise.all([
  readFile(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/SpineStage.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/player/StoryReleaseSoakPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/PixiStageManager.js', import.meta.url), 'utf8'),
])
assert.match(appSource, /<StoryReleaseSoakPanel v-if="RUNTIME_DEBUG"/)
assert.match(panelSource, /releaseSoakRecorder\.attachCollector\(\(\) => storyReleaseProbe\.collectSnapshot\(\)\)/)
assert.match(panelSource, /story-soak-quiet/)
assert.match(viewerSource, /storyReleaseProbe\.registerViewer\(collectReleaseSoakSample\)/)
assert.match(viewerSource, /releaseSoakRecorder\.record\('viewer-detached'\)/)
assert.match(stageSource, /storyReleaseProbe\.registerStageManager\(manager\)/)
assert.match(viewerSource, /setInterval\(refreshRuntimeDiagnostics,\s*2000\)/)
assert.doesNotMatch(viewerSource, /data-testid="story-soak-start"/)
assert.match(panelSource, /data-testid="story-soak-start"/)
assert.match(panelSource, /data-testid="story-soak-stop"/)
assert.match(panelSource, /data-testid="story-soak-export"/)
assert.doesNotMatch(viewerSource, /console\.warn\('\[Lifecycle\]/)
assert.match(viewerSource, /if \(RUNTIME_DEBUG\) console\.debug\('\[Lifecycle\] StoryViewer onBeforeUnmount'\)/)
assert.match(stageManagerSource, /inspectReleaseState\(\)/)
assert.match(stageManagerSource, /active_count:\s*Object\.values\(overlays\)/)
assert.doesNotMatch(stageManagerSource, /console\.warn\('\[SPAWN_DONE\]'/)
assert.match(stageManagerSource, /if \(this\._debugMode\) \{\s*console\.debug\('\[SPAWN_DONE\]'/)

console.log('Release soak recorder: persistent v2 collector, bounded sampling, Story lifecycle and quiet endpoint controls verified')
