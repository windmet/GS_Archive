import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { addressingMatches, chooseReviewRows, csv, idolSpeakerNames,
  readerLocator, resolveBibleSpeaker, videoSearchKey } from './lib/producer-addressing-bible.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const dictionary = { speakers: { '012yus': { speaker_type: 'idol', display_name: '蒼井 悠介' } } }
const names = idolSpeakerNames(dictionary)
assert.equal(resolveBibleSpeaker({ speaker: { kind: 'named', sourceName: '蒼井 悠介' } }, names).id, '012yus')
assert.equal(resolveBibleSpeaker({ speaker: { kind: 'unknown', sourceName: '？？？' } }, names).resolution, 'unresolved')
assert.deepEqual(addressingMatches('●●●●プロデューサークン、よろしく。').map(x => x.address_expression),
  ['producer_slot_4dot+プロデューサークン'])
assert.deepEqual(addressingMatches('●●●●●●●●●●Ｐ！').map(x => x.address_expression),
  ['producer_slot_10dot+Ｐ'])
assert.deepEqual(addressingMatches('プロデューサーさん、今日は。').map(x => x.address_expression),
  ['literal:プロデューサーさん'])
assert.equal(videoSearchKey('前文●●●●●●●●●●監督も楽しみにしてろよな！',
  addressingMatches('前文●●●●●●●●●●監督も楽しみにしてろよな！')[0]),
  '前文監督も楽しみにしてろよな！')
assert.match(readerLocator('story', 'story:step-9:text'), /reading_row=story%3Astep-9%3Atext/)
assert.equal(csv([{ value: 'a,"b"\nc' }], ['value']), '"value"\n"a,""b""\nc"\n')
const sample = Array.from({ length: 6 }, (_, i) => ({ evidence_id: `${i}`,
  speaker_entity_id: '012yus', address_expression: 'producer_slot_10dot+監督',
  domain: i < 3 ? 'work' : 'event', has_voice: i % 2 ? 'yes' : 'no', document_id: `d${i}` }))
assert.equal(chooseReviewRows(sample).length, 3)
assert.equal(new Set(chooseReviewRows(sample).map(x => x.domain)).size, 2)

const outputs = ['producer-addressing-evidence.csv', 'producer-addressing-evidence.json',
  'producer-addressing-summary.csv', 'producer-addressing-following.csv']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const outputHashes = async () => Promise.all(outputs.map(async name => hash(await fs.readFile(path.join(root, '.analysis/translation-bible', name)))))
const review = path.join(root, 'translation/bible/review/producer-addressing-review.csv')
const reviewBefore = hash(await fs.readFile(review))
execFileSync(process.execPath, ['scripts/generate-producer-addressing-bible.mjs'], { cwd: root, stdio: 'pipe' })
const first = await outputHashes()
execFileSync(process.execPath, ['scripts/generate-producer-addressing-bible.mjs'], { cwd: root, stdio: 'pipe' })
assert.deepEqual(await outputHashes(), first, 'Evidence export must rerun byte-identically')
assert.equal(hash(await fs.readFile(review)), reviewBefore, 'Human review sheet must never be overwritten')
execFileSync(process.execPath, ['scripts/generate-producer-addressing-bible.mjs', '--check'], { cwd: root, stdio: 'pipe' })
const evidence = JSON.parse(await fs.readFile(path.join(root, '.analysis/translation-bible/producer-addressing-evidence.json')))
assert.equal(new Set(evidence.map(row => row.evidence_id)).size, evidence.length)
assert.ok(evidence.every(row => row.reader_url.includes(`reading=${row.document_id}`)))
assert.ok(evidence.every(row => !Object.hasOwn(row, 'verification_status')),
  'Machine evidence must not contain human review decisions')
console.log(`Producer addressing Bible verified: ${evidence.length} evidence, deterministic exports, preserved review sheet and source hashes`)
