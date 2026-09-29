import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStoryTranslationDraft, importStoryTranslationDraft } from '../src/localization/story/StoryTranslationDraft.js'
import { parseJsonStrict } from './lib/strict-json.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const [action, ...argumentsList] = process.argv.slice(2)
const options = {}
for (let index = 0; index < argumentsList.length; index += 2) {
  const key = argumentsList[index]
  const value = argumentsList[index + 1]
  if (!['--evidence', '--draft', '--out', '--locale'].includes(key) || !value || value.startsWith('--')) {
    throw new Error('Use export --evidence FILE --out FILE [--locale LOCALE] or import --evidence FILE --draft FILE --out FILE')
  }
  options[key.slice(2)] = value
}
if (!['export', 'import'].includes(action) || !options.evidence || !options.out
    || (action === 'import' && !options.draft) || (action === 'export' && options.draft)) {
  throw new Error('Use export --evidence FILE --out FILE [--locale LOCALE] or import --evidence FILE --draft FILE --out FILE')
}
const absolute = file => path.resolve(root, file)
const evidence = parseJsonStrict(await readFile(absolute(options.evidence), 'utf8'), options.evidence)
const output = action === 'export'
  ? createStoryTranslationDraft(evidence, { locale: options.locale || 'zh-CN' })
  : importStoryTranslationDraft(evidence,
    parseJsonStrict(await readFile(absolute(options.draft), 'utf8'), options.draft))
await writeFile(absolute(options.out), `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' })
console.log(`${action}ed ${Object.keys(output.entries).length} source-bound translation units to ${absolute(options.out)}`)
