// Moves only the JobData SortOrder/IdolType/Term and JobStory(Appendix) Term fields from a
// `--work-story-only` pipeline candidate into the published work index. Work compiled scripts are
// now runtime-v2 snapshots that the legacy work projection cannot summarize, so a full regeneration
// would lose titles and backgrounds; everything except these fields must stay byte-identical.
// Usage: node scripts/apply-work-story-native-fields.mjs <candidate work_story_index.json> [--write]
import assert from 'node:assert/strict'
import fs from 'node:fs'

const [candidatePath, flag] = process.argv.slice(2)
assert(candidatePath, 'Usage: apply-work-story-native-fields.mjs <candidate> [--write]')
const publishedPath = new URL('../public/data/masterdata/work_story_index.json', import.meta.url)
const published = JSON.parse(fs.readFileSync(publishedPath, 'utf8'))
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'))

const typeById = new Map(candidate.work_types.map(row => [row.id, row]))
const entryKey = row => `${row.kind}:${row.id}`
const entries = idol => [...idol.scene_lines, ...idol.short_stories]
const candidateEntries = new Map(candidate.idols.flatMap(entries).map(row => [entryKey(row), row]))
const changes = []

const workTypes = published.work_types.map(row => {
  const source = typeById.get(row.id)
  assert(source && source.name === row.name, `work type ${row.id} differs in identity`)
  assert(Number.isInteger(source.sort_order) && Number.isInteger(source.idol_type) && source.term, `work type ${row.id} lacks native fields`)
  if (row.sort_order !== source.sort_order) changes.push({ id: row.id, field: 'sort_order', from: row.sort_order, to: source.sort_order })
  return { ...row, sort_order: source.sort_order, idol_type: source.idol_type, term: source.term, _source: source._source }
}).sort((left, right) => left.sort_order - right.sort_order)

let termCount = 0 // idols and by_idol_code each carry every entry
const project = idol => ({ ...idol, ...Object.fromEntries(['scene_lines', 'short_stories'].map(list => [list, idol[list].map(row => {
  const source = candidateEntries.get(entryKey(row))
  assert(source && source.resource_id === row.resource_id && source.relation_id === row.relation_id, `${entryKey(row)} differs in identity`)
  assert(source.term && Number.isInteger(source.term.start_at) && Number.isInteger(source.term.end_at), `${entryKey(row)} lacks a term`)
  termCount++
  // Insert the term beside the other source fields, before the evidence block.
  const { _source, ...rest } = row
  return { ...rest, term: source.term, _source }
})]))})
const idols = published.idols.map(project)
const byIdolCode = Object.fromEntries(Object.entries(published.by_idol_code).map(([code, idol]) => [code, project(idol)]))
const next = { ...published, work_types: workTypes, idols, by_idol_code: byIdolCode }

// Nothing else moved: strip the migrated fields and compare to the published file.
const strip = value => JSON.parse(JSON.stringify(value, (key, field) => ['term', 'idol_type'].includes(key) ? undefined : field))
const before = strip(published), after = strip(next)
for (const row of before.work_types) { row.sort_order = null; delete row._source }
for (const row of after.work_types) { row.sort_order = null; delete row._source }
before.work_types.sort((a, b) => a.id - b.id); after.work_types.sort((a, b) => a.id - b.id)
assert.deepEqual(after, before, 'only native work fields may change')
assert.equal(termCount / 2, published.meta.scene_line_count + published.meta.short_story_count, 'every work entry carries its term')

const terms = new Set(idols.flatMap(entries).map(row => JSON.stringify(row.term)))
console.log(JSON.stringify({ workTypes: workTypes.map(row => [row.id, row.sort_order, row.idol_type]), sortOrderChanges: changes,
  entryTerms: termCount / 2, distinctTerms: [...terms] }))
// Keep the pipeline writer's layout: two-space indent, CRLF, no final newline.
if (flag === '--write') fs.writeFileSync(publishedPath, JSON.stringify(next, null, 2).replace(/\n/g, '\r\n'))
