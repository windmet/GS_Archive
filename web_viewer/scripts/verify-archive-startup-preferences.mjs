import assert from 'node:assert/strict'
import {
  canResolveArchiveStartupBeforeData,
  isBareArchiveEntry,
  resolveArchiveHomeAction,
  resolveArchiveStartup,
} from '../src/core/archiveStartup.js'
import {
  ARCHIVE_USER_PREFERENCES_VERSION,
  clearArchiveUserPreferences,
  loadArchiveUserPreferences,
  saveArchiveUserPreferences,
} from '../src/data/archiveUserPreferences.js'

const idols = ['001tom', '002sht', '003hok']
const unset = { version: ARCHIVE_USER_PREFERENCES_VERSION, homeMode: 'unset', startupIdol: null, preferredIdol: null, onboardingComplete: false }
assert.equal(isBareArchiveEntry('http://localhost/'), true)
assert.equal(isBareArchiveEntry('http://localhost/?utm_source=test&gclid=x'), true)
assert.equal(isBareArchiveEntry('http://localhost/?view=home'), false)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/', { ...unset, homeMode: 'spine' }), false)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/', { ...unset, homeMode: 'card' }), false)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/?view=home&home_idol=002sht', { ...unset, homeMode: 'spine' }), true)
assert.equal(resolveArchiveStartup('http://localhost/', unset, idols).route.view, 'welcome')
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/', { ...unset, homeMode: 'portal', onboardingComplete: true }), true)
for (let visit = 2; visit <= 3; visit++) {
  assert.deepEqual(resolveArchiveStartup('http://localhost/', { ...unset, onboardingComplete: true }, idols).route,
    { view: 'portal' }, `visit ${visit} must not repeat the completed introduction`)
}
assert.equal(resolveArchiveStartup('http://localhost/?view=welcome', { ...unset, onboardingComplete: true }, idols).route.view, 'welcome')
assert.equal(resolveArchiveStartup('http://localhost/?view=reader&reading=test', { ...unset, homeMode: 'portal' }, idols).route.view, 'reader')
assert.equal(resolveArchiveStartup('http://localhost/', { ...unset, homeMode: 'card' }, idols).route.view, 'home')
assert.deepEqual(resolveArchiveStartup('http://localhost/', { ...unset, homeMode: 'spine', startupIdol: '002sht' }, idols).route,
  { view: 'home', homeIdol: '002sht' })
assert.deepEqual(resolveArchiveStartup('http://localhost/', { ...unset, homeMode: 'spine', startupIdol: '999xxx' }, idols).route,
  { view: 'home' })
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=reader&reading=test', { ...unset, homeMode: 'card' }, idols).route.view, 'reader')
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=home&home_idol=003hok', { ...unset, homeMode: 'card' }, idols).route.homeIdol, '003hok')
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=home', { ...unset, homeMode: 'spine', startupIdol: '002sht' }, idols).route,
  { ...resolveArchiveStartup('http://localhost/?view=home', unset, idols).route, homeIdol: '' })
assert.deepEqual(resolveArchiveHomeAction({ ...unset, homeMode: 'card' }, idols), { view: 'home' })

const memory = new Map()
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
let saved = saveArchiveUserPreferences({ ...unset, homeMode: 'spine', startupIdol: '002sht', preferredIdol: '003hok', onboardingComplete: true }, storage)
assert.equal(saved.persisted, true)
assert.deepEqual(loadArchiveUserPreferences(storage).preferences, saved.preferences)
saved = saveArchiveUserPreferences({ ...saved.preferences, homeMode: 'portal', onboardingComplete: true }, storage)
assert.equal(loadArchiveUserPreferences(storage).preferences.homeMode, 'portal')
assert.equal(loadArchiveUserPreferences(storage).preferences.startupIdol, '002sht', 'choosing the archive keeps the selected home idol available')
assert.deepEqual(resolveArchiveStartup('http://localhost/', loadArchiveUserPreferences(storage).preferences, idols).route, { view: 'portal' })
assert.equal(clearArchiveUserPreferences(storage).preferences.homeMode, 'unset')
assert.equal(resolveArchiveStartup('http://localhost/', loadArchiveUserPreferences(storage).preferences, idols).route.view, 'welcome')
const rejecting = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
assert.match(loadArchiveUserPreferences(rejecting).issue, /本次选择/)
saved = saveArchiveUserPreferences({ ...unset, homeMode: 'card', onboardingComplete: true }, rejecting)
assert.equal(saved.persisted, false)
assert.equal(saved.preferences.homeMode, 'card')
saved = saveArchiveUserPreferences({ ...unset, homeMode: 'portal', onboardingComplete: true }, rejecting)
assert.equal(saved.persisted, false)
assert.equal(resolveArchiveStartup('http://localhost/', saved.preferences, idols).route.view, 'portal')
assert.equal(loadArchiveUserPreferences({ getItem: () => '{bad' }).preferences.homeMode, 'unset')
assert.equal(loadArchiveUserPreferences({ getItem: () => JSON.stringify({ version: 99, homeMode: 'card' }) }).preferences.homeMode, 'unset')
assert.match(loadArchiveUserPreferences({}).issue, /无法读取/)
assert.equal(saveArchiveUserPreferences({ ...unset, homeMode: 'card' }, {}).persisted, false)
assert.equal(clearArchiveUserPreferences({}).persisted, false)
console.log('Archive startup preferences: raw URL priority, lightweight fallback, versioning and storage failure passed')

for (const [oldMode, mode] of [['light', 'card'], ['immersive', 'spine']]) {
  const legacy = { version: 1, startupMode: oldMode, startupIdol: null, preferredIdol: '003hok', onboardingComplete: true }
  const migrated = loadArchiveUserPreferences({ getItem: () => JSON.stringify(legacy) })
  assert.equal(migrated.issue, '')
  assert.equal(migrated.preferences.homeMode, mode)
  assert.equal(migrated.preferences.preferredIdol, '003hok')
  assert.equal(migrated.preferences.onboardingComplete, true)
  assert.deepEqual(resolveArchiveHomeAction(migrated.preferences, idols), { view: 'home', homeIdol: '003hok' })
}
assert.deepEqual(resolveArchiveHomeAction(unset, idols), { view: 'home' })
