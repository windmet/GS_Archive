import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { deferred, tick, until } from './helpers.mjs'
const source = await readFile(new URL('../../src/components/archive/ArchiveImmersiveHome.vue', import.meta.url), 'utf8')
const section = (start,end) => source.slice(source.indexOf(start), source.indexOf(end,source.indexOf(start)))
function setup() {
  const gate = deferred(), calls = []
  const cue={cue:'next',voice:'next.m4a',scenarioId:'qa',previewStep:{dialogue:{voice:'next.m4a'}}}
  const context={ AbortController, nextTick:tick, homeDisposed:false, homePlaybackRevision:0,stageTapAbort:null,
    stageTapPending:{value:false},stageTapCommitPending:{value:false},activeIdol:{value:{id:'001tom'}},activeCue:{value:{cue:'old'}},
    voiceError:{value:false},lastStartedVoice:{value:''},queuedStageCue:{value:cue},queuedStageVoice:{value:{voice:'next.m4a'}},
    playing:{value:false},performanceRevision:{value:0},
    resolveNextCue:()=>cue, emit:(_event,id)=>{calls.push(id);context.activeCue.value=cue},
    homeCueRuntime:{cancelCurrentStep(){},handleStepChange(){calls.push('runtime-start')}},
    voicePlayer:{unlockAudioContext(){},resetVoiceDedup(){},releasePreparedVoice(){},stopCurrentVoice(){},
      playPreparedVoice(){calls.push('play');return gate.promise},playVoice(){calls.push('play');return gate.promise},retryVoice(){calls.push('compat');return gate.promise}} }
  vm.createContext(context)
  vm.runInContext([section('async function handleStageTap()', 'async function queueNextStageVoice()'),
    section('function stopVoice()', 'function resetPreferences()'),
    'this.tap=handleStageTap;this.toggle=toggleVoice;this.compat=replayCompatibilityVoice;this.stop=stopVoice'].join('\n'),context)
  return {context,gate,calls}
}
test('actual Home cached tap locks while async backend starts; second tap cannot transfer the same preparation', async()=>{
  const t=setup();const first=t.context.tap();assert.equal(t.context.stageTapPending.value,true)
  await t.context.tap();await until(()=>t.calls.includes('play'))
  assert.equal(t.calls.filter(x=>x==='play').length,1)
  t.gate.resolve(true);await first
  assert.equal(t.context.stageTapPending.value,false)
  assert.equal(t.context.stageTapCommitPending.value,false)
  assert.equal(t.context.lastStartedVoice.value,'next.m4a')
})
test('actual Home late replay cannot change successor cue error or last-started UI', async()=>{
  const t=setup();const old=t.context.toggle();await until(()=>t.calls.includes('play'))
  t.context.activeCue.value={cue:'new'};t.context.stop();t.context.voiceError.value=false
  t.gate.resolve(false);await old
  assert.equal(t.context.voiceError.value,false)
  assert.equal(t.context.lastStartedVoice.value,'')
})
