import assert from 'node:assert/strict'
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
