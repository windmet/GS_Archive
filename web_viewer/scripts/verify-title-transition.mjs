import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { readFile } from 'node:fs/promises'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'
import { isTransitionStep, getAutoAdvanceTiming } from '../src/utils/StoryStepFlow.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const [viewer, title] = await Promise.all([read('src/core/StoryViewer.vue'), read('src/components/TitleUI.vue')])
assert.match(title, /100%\s*\{\s*opacity:\s*0;/)
assert.match(title, /\.title-fx\.paused\s*,\s*\.title-fx\.paused \*\s*\{\s*animation-play-state: paused/)
assert.match(viewer, /:paused="titlePaused"/)
assert.match(viewer, /runtimePauseReasons = reactive\(new Set\(\)\)/)
assert.match(viewer, /titlePaused = computed\(\(\) => runtimePauseReasons.size > 0 \|\| uiHidden.value\)/)
assert.match(viewer, /visibility: uiHidden \? 'hidden' : undefined/)
assert.match(title, /emit\(type, props.step\)/)
assert.match(viewer, /@complete="onTitleAnimationSettled\('complete', \$event\)"/)
assert.match(viewer, /@cancel="onTitleAnimationSettled\('cancel', \$event\)"/)
assert.match(viewer, /:key="currentStepIndex"/)
assert.match(viewer, /hasBlockingAuto:\s*\(\)\s*=>[^\n]*titleAnimationPending.value/)
assert.match(viewer, /document.addEventListener\('visibilitychange', handleVisibilityChange\)\s+handleVisibilityChange\(\)/,
  'a viewer mounted in the background must adopt the initial visibility state')
const mounted = title.match(/onMounted\(\(\)\s*=>\s*\{[\s\S]*?\n\}\)/)[0]
assert.ok(mounted.indexOf('prefers-reduced-motion') < mounted.indexOf("emit('start'"))
assert.match(title, /\.title-fx \{ opacity: 1; \}/)
assert.equal(isTransitionStep({type:'title'}), false)
assert.equal(getAutoAdvanceTiming({type:'title'}), null)

// Run the production viewer handlers against the real cue scheduler and handles.
// Only the stage drawing methods and navigation destination are test doubles.
const fixture = JSON.parse(await read('public/data/compiled/episodes/1_4_001_00_a.json'))
const base = fixture.steps.find(s=>s.type==='title')
const cue = {...fixture.steps[3].cues[0], cue_id:'title-settlement', duration:30}
const drain = async () => { for(let i=0;i<20;i++) await Promise.resolve() }
let frame = 0
const frames = new Map()
globalThis.requestAnimationFrame = fn => { frames.set(++frame, fn); return frame }
globalThis.cancelAnimationFrame = id => frames.delete(id)
globalThis.window = {}
const functions = ['setTitleAnimationPending','onTitleAnimationStart','retryTitleAdvance','onTitleAnimationSettled','goNext'].map(name=>{
  const match = viewer.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))
  assert.ok(match, name)
  return match[0]
}).join('\n')
const navigation = viewer.match(/watch\(currentStep, \(newStep, oldStep\) => \{([\s\S]*?)\n\}\)/)[1]

function setup({withCue=false}={}) {
 const first=structuredClone(base), second=structuredClone(base)
 first.cues=withCue?[structuredClone(cue)]:[]; second.cues=[]; second.step_id=first.step_id+1
 const source={...fixture,steps:[first,second]}
 const index={value:0}, step={value:first}
 let settlements=0
 const runtime=useStoryRuntimeCues({compiledData:{value:source},currentStepIndex:index,
  spineStageRef:{value:{manager:{setScreenFade(){settlements++},clearScreenFade(){}}}},audioManager:{}})
 const ctx={currentStep:step,titleAnimationPending:{value:false},titlePaused:{value:false},
  playbackController:{notifyStateChanged(){}},episodeFinished:{value:false},backlogOpen:{value:false},menuOpen:{value:false},
  storyRuntimeCues:runtime,isLastStep:{value:false},markStepRead(){},recordHistoryStep(){},leaveRestoredScene(){},finishEpisode(){},
  restoredSceneState:{value:null},handleStepChange(){},advances:0,
  advanceStep(){ctx.advances++; ctx.oldStep=step.value; index.value=1; step.value=second; ctx.newStep=second; runInNewContext(navigation,ctx); runtime.handleStepChange()},
 }
 runInNewContext('var titleAdvancePending = null;\n'+functions,ctx)
 runtime.handleStepChange()
 return {ctx,runtime,first,second,settlements:()=>settlements}
}
{
 const {ctx,runtime,first,second}=setup()
 ctx.onTitleAnimationStart(first); assert.equal(ctx.titleAnimationPending.value,true)
 ctx.titlePaused.value=true
 ctx.onTitleAnimationSettled('complete',first)
 ctx.retryTitleAdvance(); assert.equal(ctx.advances,0,'completion cannot bypass a pause')
 ctx.titlePaused.value=false; ctx.retryTitleAdvance()
 assert.equal(ctx.advances,1,'resume consumes completion once')
 ctx.onTitleAnimationStart(second)
 ctx.onTitleAnimationSettled('cancel',first)
 ctx.onTitleAnimationSettled('complete',first)
 assert.equal(ctx.titleAnimationPending.value,true,'outgoing events cannot release incoming hold')
 assert.equal(ctx.advances,1)
 runtime.cleanup(); await drain()
}
{
 const {ctx,runtime,first}=setup({withCue:true})
 ctx.onTitleAnimationSettled('complete',first)
 assert.equal(ctx.advances,0,'wait for real cue settlement')
 ctx.onTitleAnimationSettled('complete',first)
 ctx.titlePaused.value=true
 await drain(); assert.equal(ctx.advances,0,'pause arriving during settlement is respected')
 assert.equal(runtime.inspect().entries[0].status,'settled')
 ctx.titlePaused.value=false; ctx.retryTitleAdvance(); ctx.retryTitleAdvance()
 assert.equal(ctx.advances,1,'settlement resumes navigation exactly once')
 runtime.cleanup(); await drain()
}
{
 const {ctx,runtime,first,second}=setup({withCue:true})
 ctx.onTitleAnimationSettled('complete',first)
 ctx.advanceStep(); ctx.onTitleAnimationStart(second)
 await drain()
 assert.equal(ctx.advances,1,'late settlement cannot advance adjacent title')
 assert.equal(ctx.titleAnimationPending.value,true)
 runtime.cleanup(); await drain()
}
{
 const {ctx,runtime,first}=setup({withCue:true})
 ctx.onTitleAnimationSettled('complete',first)
 runtime.cleanup(); await drain()
 assert.equal(ctx.advances,0,'disposed runtime cannot deliver settlement')
}
{
 const {ctx,runtime,first}=setup()
 ctx.menuOpen.value=true
 ctx.onTitleAnimationSettled('complete',first)
 assert.equal(ctx.advances,0,'an overlay blocks a racing completion before pause propagation')
 ctx.menuOpen.value=false; ctx.retryTitleAdvance()
 assert.equal(ctx.advances,1)
 runtime.cleanup(); await drain()
}
{
 const {ctx,runtime,first}=setup()
 ctx.onTitleAnimationStart(first); ctx.goNext('user')
 ctx.onTitleAnimationSettled('complete',first)
 assert.equal(ctx.advances,1,'manual next plus old animation completion cannot skip a step')
 runtime.cleanup(); await drain()
}
assert.equal(frames.size,0,'all scheduler frames disposed')
delete globalThis.window
delete globalThis.requestAnimationFrame
delete globalThis.cancelAnimationFrame
console.log('Title lifecycle verified: pause, production cue settlement, duplicate completion, adjacent-title ownership, manual next and disposal; browser visual QA remains separate.')
