import assert from 'node:assert/strict'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'

const saved = [globalThis.window, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
const frames = new Map()
let sequence = 0
globalThis.window = {}
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const tick = async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); await flush() }
try {
  for (const outcome of ['ready', 'paused', 'superseded', 'disposed', 'actor-blocked', 'background-failed']) {
    const stage = { value: null }, index = { value: 0 }, calls = [], readinessEvents = []
    let projectedStep = null
    const source = { schema_version: 2, steps: [1, 2].map(id => ({
      step_id: id, type: 'stage', entry_snapshot: { bg: `entry-${id}` },
      cues: [{ cue_id: `background-${id}`, action: 'background.change', channel: 'background', at: 0, duration: 4,
        payload: { bg: `destination-${id}`, type: 'dissolve' }, lifecycle: { skippable: true, blocks_auto: true } }],
    })) }
    let paused = false
    const runtime = useStoryRuntimeCues({
      compiledData: { value: source }, currentStepIndex: index, spineStageRef: stage, audioManager: {}, isPaused: () => paused,
      onReadinessChange: readiness => readinessEvents.push(readiness),
    })
    runtime.handleStepChange()
    assert.equal(readinessEvents.at(-1).status, 'waiting')
    assert.equal(readinessEvents.at(-1).stepIndex, 0)
    assert.equal(runtime.hasBlockingAuto(), true, 'stage readiness must block automatic advance')
    assert.equal(runtime.inspect().entries.length, 0, 'no cue can start before its stage exists')
    assert.equal(frames.size, 1)
    if (outcome === 'paused') { paused = true; await runtime.pause() }
    let finishBackground
    const backgroundFinished = new Promise(resolve => { finishBackground = resolve })
    stage.value = {
      manager: { setBackground: (bg, transition) => { calls.push([bg, transition.duration]); return backgroundFinished } },
      getSceneReadiness: expected => expected !== projectedStep
        ? { status: 'waiting', reason: 'actor-projection' }
        : outcome === 'actor-blocked'
          ? { status: 'blocked', reason: 'actor-renderable', ids: ['002sht'] }
          : { status: 'ready' },
    }
    await tick()
    assert.deepEqual(calls, [], 'manager construction must not start snapshots or cues during actor loading')
    assert.equal(runtime.hasBlockingAuto(), true)
    assert.equal(runtime.inspect().entries.length, 0, 'common cue clock must not consume loading time')
    if (outcome === 'superseded') {
      index.value = 1; runtime.handleStepChange()
      projectedStep = source.steps[0]
      await tick()
      assert.deepEqual(calls, [], 'old projection cannot release the new step')
    }
    if (outcome === 'disposed') runtime.cleanup()
    projectedStep = source.steps[index.value]
    await tick()
    if (outcome === 'disposed') assert.deepEqual(calls, [])
    else if (outcome === 'actor-blocked') {
      assert.deepEqual(calls, [], 'missing current-step actors cannot apply the entry snapshot')
      assert.equal(runtime.inspect().readiness.status, 'blocked')
      assert.equal(readinessEvents.at(-1).reason, 'actor-renderable')
      assert.deepEqual(readinessEvents.at(-1).ids, ['002sht'])
      runtime.cleanup()
    }
    else {
      const id = outcome === 'superseded' ? 2 : 1
      assert.deepEqual(calls[0], [`entry-${id}`, 0])
      assert.equal(runtime.inspect().readiness.status, 'waiting')
      assert.equal(calls.length, 1, 'cues cannot start while the entry background is unresolved')
      finishBackground({ status: outcome === 'background-failed' ? 'failed' : 'completed', bgId: `entry-${id}` })
      await flush()
      if (outcome === 'background-failed') {
        assert.equal(runtime.inspect().readiness.status, 'blocked')
        assert.equal(readinessEvents.at(-1).reason, 'background-renderable')
        assert.equal(runtime.hasBlockingAuto(), true)
        assert.equal(calls.length, 1, 'failed entry background cannot start the cue clock')
        runtime.cleanup()
        await flush(); assert.equal(frames.size, 0)
        continue
      }
      if (outcome === 'paused') {
        assert.equal(calls.length, 1, 'paused mounting applies entry but does not play cues')
        paused = false; await runtime.resume(); await tick()
      }
      assert.deepEqual(calls[1], [`destination-${id}`, 4], 'the first cue must execute after entry publication')
      assert.equal(runtime.inspect().readiness.status, 'playable')
      assert.equal(readinessEvents.at(-1).status, 'playable')
      assert.equal(calls.length, 2)
      runtime.cleanup()
    }
    await flush(); assert.equal(frames.size, 0)
  }
  console.log('Story stage readiness: actor/background renderability, playable publication, paused mount, stale projection and disposal passed')
} finally {
  [globalThis.window, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved
}
