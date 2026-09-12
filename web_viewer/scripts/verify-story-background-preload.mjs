import assert from 'node:assert/strict'
import { ref } from 'vue'
import { Preloader } from '../src/utils/Preloader.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
const source = { steps: [{step_id:1,type:'adv',state:{bg:'entry'}}, {step_id:2,type:'adv',state:{bg:'later'}}] }
const requests = []
let release
let pauseEntry = false
class Controlled extends Preloader {
  static async _preloadImage(url, {signal}) {
    requests.push(url)
    if (url.includes('later') || pauseEntry) await new Promise((resolve, reject) => {
      release = fail => fail ? reject(Error('controlled later failure')) : resolve()
      signal.addEventListener('abort', () => reject(signal.reason), {once:true})
    })
    return 'image-loaded'
  }
}
function setup() {
  const state = {...useArchiveNavigationState(),loading:ref(false),preloadProgress:ref(0)}
  const navigation = createArchiveNavigationCoordinator()
  const controller = useStoryPlaybackController({state,navigation,loadPlayer:async()=>{},
    preloadAssets:(plan, progress, options)=>Controlled.preloadScenario(plan,progress,options),
    prepare: async (name,options) => {
      const {prepareScenario} = await import('../src/data/prepareScenario.js')
      return prepareScenario(name,{...options,fetchImpl:async()=>new Response(JSON.stringify(source))})
    },syncRoute:()=>{},returnTo:()=>{state.view.value='story_catalog'},onError:e=>{throw e}})
  return {state,navigation,controller}
}
const t=setup()
assert.equal(await t.controller.load('test.json'),true)
assert.equal(t.state.view.value,'player','entry publishes without waiting for later image')
assert.equal(t.state.loading.value,false)
assert.equal(requests.filter(url=>url.includes('entry')).length,1,'critical result is reused')
assert.equal(requests.filter(url=>url.includes('later')).length,1)
t.controller.reset()
await new Promise(resolve=>setTimeout(resolve,0))
assert.equal(t.controller.preloadStatus.value,null,'reset prevents stale background report')
release()
const second=setup()
await second.controller.load('test.json')
second.controller.stepChanged({instance:second.controller.currentScenarioInstance.value,stepIndex:1})
assert.equal(second.controller.preloadStatus.value.priority.entryIndex,1)
second.controller.stepChanged({instance:999,stepIndex:0})
second.controller.stepChanged({instance:second.controller.currentScenarioInstance.value,stepIndex:99})
assert.equal(second.controller.preloadStatus.value.priority.entryIndex,1,'old instance and outside range are ignored')
release()
await new Promise(resolve=>setTimeout(resolve,0))
assert.equal(second.state.view.value,'player')
assert.equal(second.state.loading.value,false)
assert.ok(['pending','settled'].includes(second.controller.preloadStatus.value.phase))
const settled = second.controller.preloadStatus.value
second.controller.stepChanged({instance:second.controller.currentScenarioInstance.value,stepIndex:0})
assert.equal(second.controller.preloadStatus.value,settled,'completed plan does not return to warming')
second.navigation.invalidate()
const third=setup()
await third.controller.load('test.json')
release(true)
await new Promise(resolve=>setTimeout(resolve,0))
assert.equal(third.state.view.value,'player','background failure does not discard usable entry')
assert.equal(third.state.loading.value,false)
assert.equal(third.controller.preloadStatus.value.phase,'partial')
assert.equal(third.controller.preloadStatus.value.failed,1)
assert.equal(third.controller.canRetry.value,false,'background failure is not an entry retry')
third.navigation.invalidate()
pauseEntry = true
const fourth = setup()
const requestCount = requests.length
const pendingEntry = fourth.controller.load('test.json')
while (requests.length === requestCount) await new Promise(resolve=>setTimeout(resolve,0))
fourth.controller.reset()
assert.equal(await pendingEntry,false)
assert.equal(fourth.controller.canRetry.value,false,'reset during critical preparation is cancellation, not a retryable failure')
assert.equal(fourth.controller.error.value,'')
fourth.navigation.invalidate()
console.log('Background warming verified: entry publishes before pending image, no critical replay, reset cancellation and settlement without navigation')
