import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sourceUnits, CARD_LINE_KINDS, CHAT_KINDS, shards, validateGeneralReturn, rootOverlayEntries, loadGeneralRevisions, hash } from './lib/general-translation-batches.mjs'
import { validateProducerAddressingOverlay, protectProducerAddressingForTranslation } from '../src/localization/story/ProducerAddressing.js'
import { planCompactBatches, renderCompactInput, parseCompactReturn, returnHeading } from './lib/general-translation-markdown.mjs'

// Card lines, home touch voices and call titles go through the general (source-text) workflow:
// one line at a time, bound to their speaker, published only to the lazy card-lines shard.
const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const read = file => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
const units = sourceUnits(root)
const lines = units.filter(unit => CARD_LINE_KINDS.includes(unit.kind))
const count = kind => lines.filter(unit => unit.kind === kind).length
assert.equal(count('card-line'), 1534, 'normal 584 + awakened 826 + extra 124 unique card lines')
assert.equal(count('card-touch'), 2356, 'unique home touch voices')
assert.equal(count('call-title'), 341, 'unique call titles')
const speakers = unit => new Set(unit.references.map(ref => ref.speaker))
// Spoken lines belong to one idol; a call title may name calls of several (確かな手ごたえ: 011min, 046chr).
assert.ok(lines.filter(unit => unit.kind !== 'call-title').every(unit => speakers(unit).size === 1), 'every spoken line has exactly one idol speaker')
assert.ok(lines.every(unit => [...speakers(unit)].every(code => /^\d{3}[a-z]{3}$/.test(code))), 'speakers are idol codes')
assert.ok(!lines.some(unit => unit.source.trim() === '0'), 'the extra placeholder 0 is not a line')
assert.ok(units.filter(unit => !CARD_LINE_KINDS.includes(unit.kind) && !CHAT_KINDS.includes(unit.kind)).every(unit => unit.references.every(ref => !ref.speaker)), 'metadata identities are unchanged')
assert.ok(CARD_LINE_KINDS.every(kind => shards['card-lines'](kind)) && Object.entries(shards).every(([name, select]) => name === 'card-lines' || !CARD_LINE_KINDS.some(select)))

// Batches: speaker by speaker, character-line instructions, speaker headings.
const { batches, contexts } = planCompactBatches(units)
const lineBatches = batches.filter(batch => batch.batch_id.startsWith('G-card-lines-'))
assert.equal(lineBatches.reduce((n, batch) => n + batch.rows.length, 0), lines.length)
const order = lineBatches.flatMap(batch => batch.rows.map(row => [...speakers(row)][0]))
assert.ok(order.every((speaker, index) => index === 0 || order[index - 1] <= speaker), 'one idol\'s lines are contiguous')
const input = renderCompactInput(lineBatches[0], contexts)
assert.match(input, /角色台词翻译/)
assert.match(input, /### 说话人：天濑冬马（天ヶ瀬 冬馬） · 卡面台词 · 普通/)
assert.match(input, /\{\{GS_ADDRESS:编号:类型\}\} 是程序替换的制作人称呼/)
// The model sees the story-style markers, never the raw macro it could half-translate (●●●●制作人).
assert.match(input, /\{\{GS_ADDRESS:0:producer_name_with_p\}\}/)
assert.doesNotMatch(input.slice(input.indexOf('## 待译原文')), /●/)
assert.doesNotMatch(input, /本批只含通用资料/)
assert.ok(lineBatches.every(batch => renderCompactInput(batch, contexts).length <= 16000), 'inputs stay within the export budget')

// Round trip: markers come back as the source macro; a dropped or translated slot is rejected.
const batch = lineBatches[0]
const withSlots = batch.rows.findIndex(row => row.source.includes('●●●●プロデューサー'))
assert.ok(withSlots >= 0, 'the first batch includes a producer name slot')
const answer = rows => `${returnHeading(batch)}\n${rows.map((text, index) => `[${String(index + 1).padStart(3, '0')}]${text}`).join('\n')}\n`
const markers = row => protectProducerAddressingForTranslation(row.source).slots.map(slot => slot.marker).join('')
const faithful = batch.rows.map(row => `译文${markers(row)}${row.source.match(/\d+(?:\.\d+)?/gu)?.join(' ') || ''}`)
const parsed = parseCompactReturn(batch, answer(faithful))
validateGeneralReturn(batch, parsed, units)
assert.ok(parsed.entries[withSlots].translation.includes('●●●●プロデューサー'), 'a marker is restored to the source macro')
const asMacro = text => text.replace(/\{\{GS_ADDRESS:\d+:producer_name_with_p\}\}/gu, '●●●●プロデューサー')
const legacy = [...faithful]; legacy[withSlots] = asMacro(faithful[withSlots])
validateGeneralReturn(batch, parseCompactReturn(batch, answer(legacy)), units)
for (const broken of ['译文（没有占位符）', asMacro(faithful[withSlots]).replaceAll('●●●●プロデューサー', '●●●●制作人')]) {
  const rows = [...faithful]; rows[withSlots] = broken
  assert.throws(() => validateGeneralReturn(batch, parseCompactReturn(batch, answer(rows)), units), 'a dropped or translated producer slot is rejected')
}
const extra = [...faithful]; extra[withSlots] += '{{GS_ADDRESS:9:producer_name}}'
assert.throws(() => parseCompactReturn(batch, answer(extra)), 'an invented marker is rejected')

// Imported revisions: every slot is the source macro, and the 2026-10-10 producer-slot-restore
// amendments undo back to exactly the returns the user approved.
const revisions = loadGeneralRevisions(root, units)
assert.ok([...revisions.values()].every(entry => validateProducerAddressingOverlay(entry.source, entry.translation)))
const record = read('translation/studio/general/revisions/G-card-lines-001.json')
assert.equal(record.amendments?.[0]?.repair, 'producer-slot-restore')
assert.equal(record.amendments[0].from_return_sha256, record.approval.return_sha256, 'the amendment starts from the approved return')
const undone = { ...record.return, entries: record.return.entries.map(entry => {
  const change = record.amendments[0].changes.find(item => item.key === entry.key)
  return change ? { ...entry, translation: change.before } : entry
}) }
assert.equal(hash(JSON.stringify(undone)), record.approval.return_sha256)

// Publication: lazy shard only; the bundled root overlay never carries character lines.
const synthetic = { card: { title: { a: 'A' } }, 'card-line': { normal: { b: 'B' } }, 'card-touch': { text: { c: 'C' } }, 'call-title': { title: { d: 'D' } } }
assert.deepEqual(Object.keys(rootOverlayEntries(synthetic)), ['card'], 'the generator keeps card lines out of the bundled root overlay')
const rootOverlay = read('public/translations/zh-CN/archive-general.json').entries
assert.ok(CARD_LINE_KINDS.every(kind => !Object.hasOwn(rootOverlay, kind)), 'the bundled root overlay has no card lines')
const shard = read('public/translations/zh-CN/archive-general/card-lines.json')
assert.ok(Object.keys(shard.entries).every(kind => CARD_LINE_KINDS.includes(kind)), 'the card-lines shard holds only card lines')
for (const fields of Object.values(shard.entries)) for (const texts of Object.values(fields))
  for (const [source, text] of Object.entries(texts)) assert.ok(validateProducerAddressingOverlay(source, text), `published slot drift: ${text}`)
console.log(`Card line translation: ${lines.length} speaker-bound lines in ${lineBatches.length} batches; slots protected as markers and restored verbatim; amendments bound to approvals; lazy shard only`)
