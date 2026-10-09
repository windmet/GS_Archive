import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'
import { validateReaderTitles, validateReaderTitleShard, readerTitleShardKey, READER_TITLE_BYTE_BUDGET, READER_TITLE_SHARD_COUNT } from '../src/presentation/ReaderTitle.js'
const root = new URL('../public/',import.meta.url)
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const manifest = JSON.parse(await fs.readFile(new URL('data/reading/manifest.json',root),'utf8'))
const titles = [], translated = new Map(), chosen = new Map(), ownTitles = new Map()
// A document is named by the title row that matches its manifest title. Where none does (extra and
// some event documents carry a synopsis line as their manifest title), its opening title row
// (cmd-000000) names it instead, bound to that document alone.
const leadingTitle = /:cmd-0+:title:000$/u
for (const entry of manifest.entries) {
  const bytes = await fs.readFile(new URL(`data/reading/${entry.file}`,root))
  if (hash(bytes) !== entry.sha256) throw Error(`Stale Reader ${entry.document_id}`)
  const document = JSON.parse(bytes)
  const titleRows = document.rows.filter(row => row.kind === 'title')
  const exact = titleRows.find(row => row.source_text === entry.title)
  const row = exact || titleRows.find(row => leadingTitle.test(row.text_ref?.unit_id || ''))
  const key = exact || !row ? entry.logical_id : `document:${entry.document_id}`
  chosen.set(entry.document_id, { key, source: row ? row.source_text : entry.title })
  if (!row) continue
  const catalogId = document.text_catalog_id || document.scenario_id
  let overlay
  try { overlay = JSON.parse(await fs.readFile(new URL(`translations/zh-CN/scenarios/${catalogId}.json`,root),'utf8')) }
  catch(error) { if(error.code === 'ENOENT') continue; throw error }
  if (!validateStoryTranslationOverlay(overlay,{scenarioId:catalogId,locale:'zh-CN'}).valid) throw Error(`Invalid overlay ${catalogId}`)
  const view = resolveStoryText({source:row.source_text,textRef:row.text_ref,overlayEntry:overlay.entries[row.text_ref?.unit_id],preferences:{story_content_mode:'translation'}})
  if (!view.translation.available) continue
  const record = {source:row.source_text,text:view.primary.text,source_hash:row.text_ref.source_hash,unit_id:row.text_ref.unit_id}
  if (key.startsWith('document:')) { ownTitles.set(entry.document_id, record); continue }
  const existing = translated.get(key)
  if (existing !== undefined && JSON.stringify(titles[existing]) !== JSON.stringify(record) && titles[existing].text !== record.text) throw Error(`Ambiguous chapter title ${key}`)
  if (existing === undefined) { translated.set(key,titles.length); titles.push(record) }
}
const documents = {}
for (const entry of manifest.entries) {
  const { key, source } = chosen.get(entry.document_id)
  if (ownTitles.has(entry.document_id)) { documents[entry.document_id] = {revision:entry.sha256,record:ownTitles.get(entry.document_id)}; continue }
  const title = translated.get(key)
  if (title !== undefined && titles[title].source === source) documents[entry.document_id] = {revision:entry.sha256,title}
}
const payloads = {}, shards = {}
for (let n = 0; n < READER_TITLE_SHARD_COUNT; n++) {
  const key = n.toString(16).padStart(2, '0')
  const shardDocuments = Object.fromEntries(Object.entries(documents).filter(([id]) => readerTitleShardKey(id) === key))
  const text = `${JSON.stringify({schema_version:1,locale:'zh-CN',key,documents:shardDocuments},null,2)}\n`
  const bytes = Buffer.byteLength(text)
  if (bytes >= READER_TITLE_BYTE_BUDGET) throw Error(`Reader title shard ${key} exceeds byte budget`)
  shards[key] = {file:`reader-titles/${key}.json`,sha256:hash(text),bytes}
  payloads[key] = text
}
const index = validateReaderTitles({schema_version:2,locale:'zh-CN',titles,documents:{},shards})
for (const [key, text] of Object.entries(payloads)) validateReaderTitleShard(JSON.parse(text), index, key)
const output = `${JSON.stringify(index,null,2)}\n`
if (Buffer.byteLength(output) >= READER_TITLE_BYTE_BUDGET) throw Error('Reader title index exceeds byte budget')
const target = new URL('translations/zh-CN/reader-titles.json',root)
if (process.argv.includes('--check')) {
  if(await fs.readFile(target,'utf8') !== output) throw Error('Reader title index differs from bound sources')
} else await fs.writeFile(target,output)
if (!process.argv.includes('--check')) await fs.mkdir(new URL('translations/zh-CN/reader-titles/',root),{recursive:true})
for (const [key, text] of Object.entries(payloads)) {
  const file = new URL(`translations/zh-CN/${shards[key].file}`,root)
  if (process.argv.includes('--check')) {
    if (await fs.readFile(file,'utf8') !== text) throw Error(`Reader title shard ${key} differs from bound sources`)
  } else await fs.writeFile(file,text)
}
console.log(`Reader titles: ${titles.length} translated titles, ${Object.keys(documents).length} document bindings, ${Buffer.byteLength(output)} bytes (${fileURLToPath(target)})`)
