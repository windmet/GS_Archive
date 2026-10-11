import assert from 'node:assert/strict'
import { mergeStudioPreviewOverlays } from './lib/ai-studio-preview.mjs'

const hash = `sha256:${'a'.repeat(64)}`
const unit = suffix => `story-text:v1:1_4_001_00:1_4_001_00_${suffix}:cmd-000001:dialogue:000`
const overlay = (suffix, raw = hash) => ({ schema_version: 1, locale: 'zh-CN',
  scenario_id: '1_4_001_00', source_raw_hash: raw,
  entries: { [unit(suffix)]: { source_hash: hash, text: `译文${suffix}`, status: 'draft' } } })
const merged = mergeStudioPreviewOverlays(new Map([['segment-a', overlay('a')], ['segment-b', overlay('b')]]))
assert.equal(merged.byCatalog.size, 1)
assert.equal(merged.units, 2)
assert.equal(Object.keys(merged.byCatalog.get('1_4_001_00').entries).length, 2)
assert.throws(() => mergeStudioPreviewOverlays(new Map([['a', overlay('a')], ['b', overlay('b', `sha256:${'b'.repeat(64)}`)]])), /RAW identity conflict/)
assert.throws(() => mergeStudioPreviewOverlays(new Map([['a', overlay('a')], ['b', overlay('a')]])), /Duplicate preview unit/)
const reviewed = overlay('a')
reviewed.entries[unit('a')].status = 'reviewed'
assert.throws(() => mergeStudioPreviewOverlays(new Map([['a', reviewed]])), /draft entries only/)
console.log('Reader trial aggregation verified: shared catalogue, hash conflict, collision, draft-only')
