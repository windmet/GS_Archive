import assert from 'node:assert/strict'
import { identityIssues, sourceHash } from './audit-reading-diagnostics.mjs'

const text = '原文\nテスト'
const ref = { unit_id: 'story-text:v1:sample:part:cmd-000012:dialogue_text:000',
  source_hash: sourceHash(text), source: { scenario_id: 'sample', part_id: 'part',
    file: 'assets/resources/scenario_part.json', command_index: 12, field_kind: 'dialogue_text', field_ordinal: 0 } }
assert.deepEqual(identityIssues(text, ref), [])
assert.equal(sourceHash('\uFEFFe\u0301\r\nx\ry'), sourceHash('é\nx\ny'))
assert.deepEqual(identityIssues(text, null), ['missing-text-ref'])
assert.deepEqual(identityIssues(`${text}変更`, ref), ['source-hash-mismatch'])
assert.deepEqual(identityIssues(text, { ...ref, source: { ...ref.source, command_index: 13 } }), ['identity-source-mismatch'])
for (const file of ['../scenario.json', '/scenario.json', 'C:/scenario.json', 'assets\\scenario.json']) {
  assert.ok(identityIssues(text, { ...ref, source: { ...ref.source, file } }).includes('invalid-source-evidence'))
}
assert.ok(identityIssues(text, { ...ref, unit_id: 'row-12' }).includes('invalid-unit-id'))
console.log('Reading diagnostics audit: normalization, stale hash, source coordinates and unsafe evidence checks passed')
