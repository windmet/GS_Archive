import assert from 'node:assert/strict'
import { Preloader } from '../src/utils/Preloader.js'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { createStoryAssetPriority } from '../shared/story/StoryAssetPriority.js'
const source = { steps: Array.from({length:12}, (_,i)=>({step_id:100+i*7,type:'adv',state:{bg:`bg${i}`}})) }
const plan = createStoryAssetPlan(source,{file:'test.json',sha256:`sha256:${'a'.repeat(64)}`})
const requests=[], held=[]
let status
const abort = new AbortController()
class Controlled extends Preloader {
  static async _preloadImage(url) {
    requests.push(url)
    if (/bg[123]\.png$/.test(url)) await new Promise(resolve=>held.push(resolve))
    if (/bg10\.png$/.test(url)) throw Error('controlled current-step failure')
    return 'image-loaded'
  }
}
const entry=await Controlled.preloadScenario(plan,null,{entryOnly:true,signal:abort.signal,
  priority:createStoryAssetPriority(source),onStatus:value=>{status=value}})
assert.equal(requests.length,1)
const background=entry.startBackground()
assert.equal(entry.startBackground(),background,'continuation is idempotent')
assert.equal(held.length,3)
entry.updatePriority(createStoryAssetPriority(source,{initialStep:11}))
for (const resolve of held) resolve()
await background
assert.ok(requests[4].endsWith('/bg10.png'),'new current step starts before old deferred work')
assert.ok(requests[5].endsWith('/bg11.png'),'new neighbour follows current step')
assert.equal(new Set(requests).size,12,'no duplicate download and later failure does not abandon remaining tasks')
assert.equal(status.phase,'partial','promoted background failure must not become entry-blocked')
assert.equal(status.priority.entryIndex,10,'source offsets are not raw step IDs')
abort.abort()
assert.equal(entry.updatePriority(createStoryAssetPriority(source)),false,'aborted plan cannot be reprioritized')
console.log('Background priority verified: real source offsets, pending-only reordering, no duplicate work, failure continuation and abort guard')
