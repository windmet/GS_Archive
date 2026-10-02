import assert from 'node:assert/strict'
import { createReaderThemeStore, READER_THEME_KEY } from '../src/presentation/ReaderTheme.js'

const records = new Map([['player-preferences', 'untouched']])
const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }
const options = { getStorage: () => storage }
const first = createReaderThemeStore(options)
assert.equal(first.theme.value, 'light', 'first visit has a neutral default')
assert.equal(first.setTheme('warm'), true)
assert.equal(records.get(READER_THEME_KEY), 'warm')
const reopened = createReaderThemeStore(options)
assert.equal(reopened.theme.value, 'warm', 'saved selection survives reopening')
assert.equal(reopened.setTheme('unknown'), false)
assert.equal(reopened.theme.value, 'warm', 'invalid input cannot replace a valid preference')
assert.equal(records.get('player-preferences'), 'untouched', 'Reader owns only its own storage key')
records.set(READER_THEME_KEY, 'obsolete')
assert.equal(createReaderThemeStore(options).theme.value, 'light', 'obsolete saved value falls back')
records.set(READER_THEME_KEY, 'game')
const legacy = createReaderThemeStore(options)
assert.equal(legacy.theme.value, 'mint', 'existing office preference migrates without resetting to white')
assert.equal(records.get(READER_THEME_KEY), 'game', 'loading a preference does not write storage')
assert.equal(legacy.setTheme('game'), true, 'legacy callers remain compatible')
assert.equal(records.get(READER_THEME_KEY), 'mint', 'next explicit selection persists the canonical identifier')
assert.equal(createReaderThemeStore(options).theme.value, 'mint')
for (const getStorage of [() => undefined, () => { throw Error('denied') }, () => ({
  getItem() { throw Error('read blocked') }, setItem() { throw Error('quota exceeded') },
})]) {
  const isolated = createReaderThemeStore({ getStorage })
  assert.equal(isolated.theme.value, 'light')
  assert.equal(isolated.setTheme('dark'), true)
  assert.equal(isolated.theme.value, 'dark', 'storage failures never prevent in-memory switching')
}
console.log('Reader theme preferences: neutral default, reopen, invalid values, isolated storage and blocked storage passed')
