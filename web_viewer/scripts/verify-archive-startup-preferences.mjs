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
const unset = { version: ARCHIVE_USER_PREFERENCES_VERSION, startupMode: 'unset', startupIdol: null, preferredIdol: null, onboardingComplete: false }
assert.equal(isBareArchiveEntry('http://localhost/'), true)
assert.equal(isBareArchiveEntry('http://localhost/?utm_source=test&gclid=x'), true)
assert.equal(isBareArchiveEntry('http://localhost/?view=home'), false)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/', { ...unset, startupMode: 'immersive' }), false)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/', { ...unset, startupMode: 'light' }), true)
assert.equal(canResolveArchiveStartupBeforeData('http://localhost/?view=home&home_idol=002sht', { ...unset, startupMode: 'immersive' }), true)
assert.equal(resolveArchiveStartup('http://localhost/', unset, idols).route.view, 'welcome')
assert.equal(resolveArchiveStartup('http://localhost/', { ...unset, startupMode: 'light' }, idols).route.view, 'portal')
assert.deepEqual(resolveArchiveStartup('http://localhost/', { ...unset, startupMode: 'immersive', startupIdol: '002sht' }, idols).route,
  { view: 'home', homeIdol: '002sht' })
assert.deepEqual(resolveArchiveStartup('http://localhost/', { ...unset, startupMode: 'immersive', startupIdol: '999xxx' }, idols).route,
  { view: 'home' })
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=reader&reading=test', { ...unset, startupMode: 'light' }, idols).route.view, 'reader')
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=home&home_idol=003hok', { ...unset, startupMode: 'light' }, idols).route.homeIdol, '003hok')
assert.deepEqual(resolveArchiveStartup('http://localhost/?view=home', { ...unset, startupMode: 'immersive', startupIdol: '002sht' }, idols).route,
  { ...resolveArchiveStartup('http://localhost/?view=home', unset, idols).route, homeIdol: '' })
assert.deepEqual(resolveArchiveHomeAction({ ...unset, startupMode: 'light' }, idols), { view: 'portal' })

const memory = new Map()
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
let saved = saveArchiveUserPreferences({ ...unset, startupMode: 'immersive', startupIdol: '002sht', preferredIdol: '003hok', onboardingComplete: true }, storage)
assert.equal(saved.persisted, true)
assert.deepEqual(loadArchiveUserPreferences(storage).preferences, saved.preferences)
assert.equal(clearArchiveUserPreferences(storage).preferences.startupMode, 'unset')
const rejecting = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
assert.match(loadArchiveUserPreferences(rejecting).issue, /本次选择/)
saved = saveArchiveUserPreferences({ ...unset, startupMode: 'light', onboardingComplete: true }, rejecting)
assert.equal(saved.persisted, false)
assert.equal(saved.preferences.startupMode, 'light')
assert.equal(loadArchiveUserPreferences({ getItem: () => '{bad' }).preferences.startupMode, 'unset')
assert.equal(loadArchiveUserPreferences({ getItem: () => JSON.stringify({ version: 99, startupMode: 'light' }) }).preferences.startupMode, 'unset')
assert.match(loadArchiveUserPreferences({}).issue, /无法读取/)
assert.equal(saveArchiveUserPreferences({ ...unset, startupMode: 'light' }, {}).persisted, false)
assert.equal(clearArchiveUserPreferences({}).persisted, false)
console.log('Archive startup preferences: raw URL priority, lightweight fallback, versioning and storage failure passed')
