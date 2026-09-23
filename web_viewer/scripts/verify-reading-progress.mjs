import assert from 'node:assert/strict'
import { ReadingProgressStore, isReadingProgressCurrent } from '../src/data/ReadingProgressStore.js'

let raw = null, time = 0
const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
const store = new ReadingProgressStore(() => storage, () => ++time)
const entry = id => ({ documentId: id, version: `sha256:${'a'.repeat(64)}`, rowId: `${id}:step-7:text`, mode: 'bilingual' })
assert.equal(store.read('a').entry, null)
raw = '{broken'; assert.equal(store.read('a').entry, null)
assert.ok(store.save(entry('a')).ok)
assert.equal(store.read('a').entry.rowId, 'a:step-7:text')
const saved = store.read('a').entry
const rows = [{ anchor: { row_id: saved.rowId } }]
assert.ok(isReadingProgressCurrent(saved, 'a', saved.version, rows))
assert.equal(isReadingProgressCurrent(saved, 'a', `sha256:${'b'.repeat(64)}`, rows), false)
assert.equal(isReadingProgressCurrent(saved, 'a', saved.version, []), false)
assert.equal(isReadingProgressCurrent(saved, 'other', saved.version, rows), false)
assert.ok(store.save({ ...entry('a'), rowId: 'a:step-19:text' }).ok)
assert.equal(JSON.parse(raw).entries.length, 1)
assert.equal(store.read('a').entry.rowId, 'a:step-19:text')
const beforeInvalid = raw
assert.equal(store.save({ ...entry('a'), rowId: 'other:step-7:text' }).ok, false)
assert.equal(raw, beforeInvalid)
for (let i = 0; i < 101; i++) store.save(entry(`doc${i}`))
assert.equal(JSON.parse(raw).entries.length, 100)
assert.equal(store.read('a').entry, null)
assert.ok(store.read('doc100').entry)
assert.ok(store.remove('doc100').ok)
assert.equal(store.read('doc100').entry, null)
assert.ok(store.read('doc99').entry, 'clearing one document preserves others')
const denied = new ReadingProgressStore(() => { throw Error('denied') })
assert.equal(denied.read('a').ok, false)
assert.equal(denied.save(entry('a')).ok, false)
const quota = new ReadingProgressStore(() => ({ getItem: () => raw, setItem: () => { throw Error('quota') } }))
const beforeQuota = raw
assert.equal(quota.save(entry('a')).ok, false)
assert.equal(raw, beforeQuota)
console.log('Reading progress verified: explicit versioned records, malformed storage, isolated updates, bounded retention and storage failure')
