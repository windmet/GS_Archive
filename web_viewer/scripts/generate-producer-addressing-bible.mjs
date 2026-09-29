import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { READING_SOURCE_FILE } from '../shared/reading/ReadingCatalog.js'
import { addressingMatches, chooseReviewRows, csv, idolSpeakerNames,
  readerLocator, resolveBibleSpeaker, videoSearchKey } from './lib/producer-addressing-bible.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const check = process.argv.includes('--check')
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const read = async file => fs.readFile(path.join(root, file))
const manifest = JSON.parse(await read('public/data/reading/manifest.json'))
const dictionary = JSON.parse(await read('public/data/masterdata/speaker_dictionary.json'))
const speakerNames = idolSpeakerNames(dictionary)
const sourceCache = new Map()
const evidence = []
const baseUrl = process.env.SIDEM_BIBLE_READER_URL || 'http://127.0.0.1:5176/'

async function voiceFor(doc, row) {
  if (!row.has_voice) return { cue: '', resolution: 'reader-no-voice' }
  const file = doc.source.file
  assert(READING_SOURCE_FILE.test(file), `Unsafe compiled source: ${file}`)
  if (!sourceCache.has(file)) {
    try { sourceCache.set(file, JSON.parse(await read(`public/data/compiled/${file}`))) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      sourceCache.set(file, null)
    }
  }
  const source = sourceCache.get(file)
  if (!source) return { cue: '', resolution: 'compiled-source-unavailable' }
  const step = source.steps?.[row.anchor.step_index]
  const dialogue = step?.dialogue
  if (step?.step_id !== row.anchor.step_id ||
      (dialogue?.source_text ?? dialogue?.text_jp ?? dialogue?.text) !== row.source_text)
    return { cue: '', resolution: 'step-or-text-mismatch' }
  return typeof dialogue.voice === 'string' && dialogue.voice
    ? { cue: dialogue.voice, resolution: 'exact-step-and-text' }
    : { cue: '', resolution: 'source-step-has-no-voice' }
}

for (const entry of manifest.entries) {
  const bytes = await read(`public/data/reading/${entry.file}`)
  assert.equal(sha256(bytes), entry.sha256, `Reader hash changed: ${entry.file}`)
  const doc = JSON.parse(bytes)
  assert.equal(doc.document_id, entry.document_id)
  for (const [index, row] of doc.rows.entries()) {
    // Non-dialogue mentions are not evidence of a character's form of address.
    if (row.kind !== 'dialogue') continue
    const matches = addressingMatches(row.source_text)
    if (!matches.length) continue
    if (row.text_ref) assert.equal(sha256(row.source_text), row.text_ref.source_hash,
      `Canonical text hash changed: ${entry.document_id}:${row.anchor.row_id}`)
    const speaker = resolveBibleSpeaker(row, speakerNames)
    const voice = check ? { cue: '', resolution: 'not-read-in-check-mode' } : await voiceFor(doc, row)
    for (const match of matches) {
      const evidenceId = createHash('sha256')
        .update(`${entry.document_id}\0${row.anchor.row_id}\0${match.index}\0${match.address_expression}`)
        .digest('hex').slice(0, 20)
      evidence.push({ evidence_id: evidenceId, speaker_entity_id: speaker.id,
        speaker_name: speaker.id ? dictionary.speakers[speaker.id]?.display_name || '' : '',
        display_speaker: speaker.publicLabel, speaker_resolution: speaker.resolution,
        speaker_confidence: speaker.confidence,
        placeholder_class: match.placeholder_class, placeholder_surface: match.surface,
        address_suffix: match.address_suffix, following_surface: match.following_surface,
        address_expression: match.address_expression, domain: entry.domain,
        document_id: entry.document_id, story_title: entry.title || '',
        episode_label: entry.episode_label || '', row_id: row.anchor.row_id,
        step_id: row.anchor.step_id, step_index: row.anchor.step_index,
        source_part_id: row.text_ref?.source?.part_id || row.anchor.source_part_id || '',
        command_index: row.text_ref?.source?.command_index ?? row.anchor.command_start ?? '',
        unit_id: row.text_ref?.unit_id || '', source_hash: row.text_ref?.source_hash || '',
        compiled_source_file: doc.source.file, raw_source_file: row.text_ref?.source?.file || row.anchor.source_file || '',
        has_voice: row.has_voice ? 'yes' : 'no', voice_cue: voice.cue, voice_resolution: voice.resolution,
        source_text: row.source_text,
        previous_text: doc.rows[index - 1]?.source_text || '', next_text: doc.rows[index + 1]?.source_text || '',
        reader_url: readerLocator(entry.document_id, row.anchor.row_id, baseUrl),
        video_search_key: videoSearchKey(row.source_text, match),
      })
    }
  }
}
evidence.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
assert.equal(new Set(evidence.map(row => row.evidence_id)).size, evidence.length, 'Evidence IDs must be unique')

const groups = new Map(), following = new Map()
for (const row of evidence) {
  const key = row.speaker_entity_id ? `${row.speaker_entity_id}|${row.address_expression}` : `unresolved|${row.evidence_id}`
  const group = groups.get(key) || { speaker_entity_id: row.speaker_entity_id,
    speaker_name: row.speaker_name, address_expression: row.address_expression,
    placeholder_class: row.placeholder_class, address_suffix: row.address_suffix,
    occurrence_count: 0, document_ids: new Set(), domains: new Set(),
    identity_backed_count: 0, voiced_reader_count: 0, resolution_counts: {} }
  group.occurrence_count++
  group.document_ids.add(row.document_id); group.domains.add(row.domain)
  if (row.unit_id) group.identity_backed_count++
  if (row.has_voice === 'yes') group.voiced_reader_count++
  group.resolution_counts[row.speaker_resolution] = (group.resolution_counts[row.speaker_resolution] || 0) + 1
  groups.set(key, group)
  if (row.placeholder_class === 'producer_slot_10dot') {
    const surface = row.following_surface
    const item = following.get(surface) || { following_surface: surface, occurrence_count: 0,
      speakers: new Set(), documents: new Set(), example: row.source_text }
    item.occurrence_count++
    if (row.speaker_entity_id) item.speakers.add(row.speaker_entity_id)
    item.documents.add(row.document_id)
    following.set(surface, item)
  }
}
const selected = chooseReviewRows(evidence)
const selectedCounts = new Map()
for (const row of selected) {
  const key = row.speaker_entity_id ? `${row.speaker_entity_id}|${row.address_expression}` : `unresolved|${row.evidence_id}`
  selectedCounts.set(key, (selectedCounts.get(key) || 0) + 1)
}
const summary = [...groups.entries()].map(([key, item]) => ({
  speaker_entity_id: item.speaker_entity_id, speaker_name: item.speaker_name,
  address_expression: item.address_expression, placeholder_class: item.placeholder_class,
  address_suffix: item.address_suffix, occurrence_count: item.occurrence_count,
  document_count: item.document_ids.size, domains: [...item.domains].sort().join('|'),
  identity_backed_count: item.identity_backed_count, voiced_reader_count: item.voiced_reader_count,
  speaker_resolution_counts: JSON.stringify(item.resolution_counts),
  review_queue_count: selectedCounts.get(key) || 0, verification_status: 'unreviewed',
})).sort((a, b) => a.speaker_entity_id.localeCompare(b.speaker_entity_id) ||
  a.address_expression.localeCompare(b.address_expression))
assert.equal(summary.reduce((n, row) => n + row.occurrence_count, 0), evidence.length)
assert.equal(summary.reduce((n, row) => n + row.review_queue_count, 0), selected.length)

const evidenceFields = ['evidence_id', 'speaker_entity_id', 'speaker_name', 'display_speaker',
  'speaker_resolution', 'speaker_confidence', 'placeholder_class', 'placeholder_surface',
  'address_suffix', 'following_surface', 'address_expression', 'domain', 'document_id',
  'story_title', 'episode_label', 'row_id', 'step_id', 'step_index', 'source_part_id',
  'command_index', 'unit_id', 'source_hash', 'compiled_source_file', 'raw_source_file',
  'has_voice', 'voice_cue', 'voice_resolution', 'source_text', 'previous_text', 'next_text',
  'reader_url', 'video_search_key']
const summaryFields = ['speaker_entity_id', 'speaker_name', 'address_expression', 'placeholder_class',
  'address_suffix', 'occurrence_count', 'document_count', 'domains', 'identity_backed_count',
  'voiced_reader_count', 'speaker_resolution_counts', 'review_queue_count', 'verification_status']
const followingRows = [...following.values()].map(item => ({ following_surface: item.following_surface,
  occurrence_count: item.occurrence_count, speaker_ids: [...item.speakers].sort().join('|'),
  document_count: item.documents.size, example: item.example }))
  .sort((a, b) => b.occurrence_count - a.occurrence_count || a.following_surface.localeCompare(b.following_surface))
const reviewFields = ['evidence_id', 'speaker_entity_id', 'speaker_name', 'address_expression',
  'domain', 'document_id', 'row_id', 'story_title', 'source_text', 'reader_url', 'video_search_key',
  'has_voice', 'verification_status', 'video_reference', 'video_timestamp', 'observed_name',
  'observed_full_address', 'notes']
const reviewRows = selected.map(row => ({ ...row, source_text: row.source_text.replace(/\s+/gu, ' ').trim(),
  verification_status: 'unreviewed' }))
const reviewContent = csv(reviewRows, reviewFields)
const reviewFile = path.join(root, 'translation/bible/review/producer-addressing-review.csv')
let existingReview = null
try { existingReview = await fs.readFile(reviewFile, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
if (check) {
  assert(existingReview, 'Review queue missing; run generator once')
  const ids = existingReview.trimEnd().split('\n').slice(1).map(line => line.match(/^"([a-f0-9]{20})",/)?.[1])
  assert.deepEqual(ids, selected.map(row => row.evidence_id), 'Review queue IDs changed; reconcile human annotations')
} else {
  const out = path.join(root, '.analysis/translation-bible')
  await fs.mkdir(out, { recursive: true })
  await fs.writeFile(path.join(out, 'producer-addressing-evidence.csv'), csv(evidence, evidenceFields))
  await fs.writeFile(path.join(out, 'producer-addressing-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  await fs.writeFile(path.join(out, 'producer-addressing-summary.csv'), csv(summary, summaryFields))
  await fs.writeFile(path.join(out, 'producer-addressing-following.csv'), csv(followingRows,
    ['following_surface', 'occurrence_count', 'speaker_ids', 'document_count', 'example']))
  if (!existingReview) {
    await fs.mkdir(path.dirname(reviewFile), { recursive: true })
    await fs.writeFile(reviewFile, reviewContent)
  }
}
const byClass = {}
for (const row of evidence) byClass[row.placeholder_class] = (byClass[row.placeholder_class] || 0) + 1
console.log(JSON.stringify({ mode: check ? 'check' : 'generate', documents: manifest.entries.length,
  evidence: evidence.length, summary_groups: summary.length, review_queue: selected.length,
  by_class: byClass, speaker_ids: new Set(evidence.map(row => row.speaker_entity_id).filter(Boolean)).size,
  voice_cues: evidence.filter(row => row.voice_cue).length,
  review_file: path.relative(root, reviewFile), review_preserved: Boolean(existingReview) }, null, 2))
