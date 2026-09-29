import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { normalizeArchiveHomePreferences, resolveHomeCard } from '../src/data/archiveHomePreferences.js'
import { normalizeArchiveUserPreferences } from '../src/data/archiveUserPreferences.js'

const entries = [{ id: '001tom_ssr02:base', idolCode: '001tom' }, { id: '002sht_ssr01:base', idolCode: '002sht' }, { id: '001tom_ssr01:p', idolCode: '001tom' }]
assert.equal(resolveHomeCard(entries, '001tom', '').id, '001tom_ssr01:p')
assert.equal(resolveHomeCard([...entries].reverse(), '001tom', '').id, '001tom_ssr01:p')
assert.equal(resolveHomeCard(entries, '001tom', '001tom_ssr02:base').id, '001tom_ssr02:base')
assert.equal(resolveHomeCard(entries, '001tom', '002sht_ssr01:base').idolCode, '001tom')
assert.equal(resolveHomeCard(entries, '003hok', ''), null)
const home = normalizeArchiveHomePreferences({ background: 'bg001_test', autoVoice: true, focusMode: true, cardKey: '001tom_ssr02:base', wallpaperKey: '002sht_ssr01:base' })
assert.equal(home.cardKey, '001tom_ssr02:base')
assert.equal(home.background, 'bg001_test')
assert.equal(home.autoVoice, true)
assert.ok(!Object.hasOwn(home, 'focusMode') && !Object.hasOwn(home, 'wallpaperKey'))
assert.equal(normalizeArchiveHomePreferences({ cardKey: '../bad' }).cardKey, '')
const migrated = normalizeArchiveUserPreferences({ version: 1, startupMode: 'light', startupIdol: '001tom', preferredIdol: '002sht', onboardingComplete: true })
assert.equal(migrated.homeMode, 'card')
assert.equal(migrated.startupIdol, '001tom')
assert.equal(migrated.preferredIdol, '002sht')
console.log('Home experience: deterministic idol-bound cards, separate preferences, transient focus and legacy identity preservation passed')

// Execute the real Home mount handler with a deliberately delayed Vue tick.
const source = fs.readFileSync(new URL('../src/components/archive/ArchiveImmersiveHome.vue', import.meta.url), 'utf8')
const handler = source.slice(source.indexOf('async function handleStageReady()'), source.indexOf('function handleStageError()'))
assert.ok(handler.includes('voicePlayer.setTalking'))
for (const state of ['playing', 'stopped', 'card', 'disposed', 'no-manager']) {
  let release, calls = 0
  const context = vm.createContext({ nextTick: () => new Promise(resolve => { release = resolve }),
    homeDisposed: false, props: { homeMode: 'spine' }, spineStageRef: { value: null },
    stageReady: { value: false }, stageError: { value: true }, playing: { value: true },
    voicePlayer: { setTalking: on => { assert.equal(on, true); calls++ } } })
  const ready = vm.runInContext(`${handler}; handleStageReady()`, context)
  assert.equal(calls, 0)
  context.spineStageRef.value = state === 'no-manager' ? null : { manager: {} }
  if (state === 'stopped') context.playing.value = false
  if (state === 'card') context.props.homeMode = 'card'
  if (state === 'disposed') context.homeDisposed = true
  release(); await ready
  assert.equal(calls, state === 'playing' ? 1 : 0, state)
  assert.equal(context.stageReady.value, ['playing', 'stopped'].includes(state), state)
}
console.log('Home stage handshake: late ref, stopped audio, renderer change, missing manager and disposal passed')
const sceneHandler = source.match(/function handleSceneReady\(step\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(sceneHandler)
for (const state of ['current', 'stale', 'stopped', 'card', 'disposed']) {
  let calls = 0
  const current = {}, context = vm.createContext({ homeDisposed: state === 'disposed',
    props: { homeMode: state === 'card' ? 'card' : 'spine' }, renderStep: { value: current },
    playing: { value: state !== 'stopped' }, voicePlayer: { setTalking: () => calls++ },
    completedStep: state === 'stale' ? {} : current })
  vm.runInContext(`${sceneHandler}; handleSceneReady(completedStep)`, context)
  assert.equal(calls, state === 'current' ? 1 : 0, state)
}
console.log('Home scene handshake: current actor projection only, no stale/stopped/disposed replay passed')
