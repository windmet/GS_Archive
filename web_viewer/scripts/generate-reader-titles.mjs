import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'
import { validateReaderTitles } from '../src/presentation/ReaderTitle.js'
const root = new URL('../public/',import.meta.url)
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const manifest = JSON.parse(await fs.readFile(new URL('data/reading/manifest.json',root),'utf8'))
const titles = [], translated = new Map()
for (const entry of manifest.entries) {
  const bytes = await fs.readFile(new URL(`data/reading/${entry.file}`,root))
  if (hash(bytes) !== entry.sha256) throw Error(`Stale Reader ${entry.document_id}`)
  const document = JSON.parse(bytes)
  const catalogId = document.text_catalog_id || document.scenario_id
  let overlay
  try { overlay = JSON.parse(await fs.readFile(new URL(`translations/zh-CN/scenarios/${catalogId}.json`,root),'utf8')) }
  catch(error) { if(error.code === 'ENOENT') continue; throw error }
  if (!validateStoryTranslationOverlay(overlay,{scenarioId:catalogId,locale:'zh-CN'}).valid) throw Error(`Invalid overlay ${catalogId}`)
  for (const row of document.rows) {
    if (row.kind !== 'title' || row.source_text !== entry.title) continue
    const view = resolveStoryText({source:row.source_text,textRef:row.text_ref,overlayEntry:overlay.entries[row.text_ref?.unit_id],preferences:{story_content_mode:'translation'}})
    if (!view.translation.available) continue
    const record = {source:row.source_text,text:view.primary.text,source_hash:row.text_ref.source_hash,unit_id:row.text_ref.unit_id}
    const existing = translated.get(entry.logical_id)
    if (existing !== undefined && JSON.stringify(titles[existing]) !== JSON.stringify(record) && titles[existing].text !== record.text) throw Error(`Ambiguous chapter title ${entry.logical_id}`)
    if (existing === undefined) { translated.set(entry.logical_id,titles.length); titles.push(record) }
    break
  }
}
const documents = {}
for (const entry of manifest.entries) {
  const title = translated.get(entry.logical_id)
  if (title !== undefined && titles[title].source === entry.title) documents[entry.document_id] = {revision:entry.sha256,title}
}
const output = `${JSON.stringify(validateReaderTitles({schema_version:1,locale:'zh-CN',titles,documents}),null,2)}\n`
const target = new URL('translations/zh-CN/reader-titles.json',root)
if (process.argv.includes('--check')) {
  if(await fs.readFile(target,'utf8') !== output) throw Error('Reader title index differs from bound sources')
} else await fs.writeFile(target,output)
console.log(`Reader titles: ${titles.length} translated titles, ${Object.keys(documents).length} document bindings, ${Buffer.byteLength(output)} bytes (${fileURLToPath(target)})`)
