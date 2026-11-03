import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
// Only ASCII spaces surrounded by Chinese glyphs/punctuation. English word
// boundaries, paragraph breaks and authored full-width chapter separators stay.
export const removeChineseInlineSpaces = text => text.replace(/([\p{Script=Han}，。！？、；：…—“”‘’（）《》【】「」『』]) +(?=[\p{Script=Han}，。！？、；：…—“”‘’（）《》【】「」『』])/gu, '$1')

// Preserve historical receipts: verify the published amended bytes, then undo
// this logged formatting pass solely to replay the original editorial receipt.
export function beforeSpacingAmendment(bytes, amendment) {
  if (!amendment) return bytes
  assert.equal(hash(bytes), amendment.amended_sha256, 'Amended translation bytes changed')
  const overlay = JSON.parse(bytes), seen = new Set()
  assert.equal(overlay.scenario_id, amendment.scenario_id)
  for (const edit of amendment.edits) {
    assert(!seen.has(edit.unit_id)); seen.add(edit.unit_id)
    const entry = overlay.entries[edit.unit_id]
    assert.equal(entry.source_hash, edit.source_hash)
    assert.equal(entry.text, edit.after)
    assert.equal(removeChineseInlineSpaces(edit.before), edit.after, 'Spacing amendment changed more than the declared spaces')
    assert.notEqual(edit.before, edit.after)
    entry.text = edit.before
  }
  const original = Buffer.from(JSON.stringify(overlay, null, 2) + '\n')
  assert.equal(hash(original), amendment.base_sha256, 'Original editorial bytes cannot be reconstructed')
  return original
}
