import fs from 'node:fs'
import { createHash } from 'node:crypto'

// Chats (personal and unit talks, random topics) are legacy compiled files without text units, kept
// only in the local corpus. Their text is extracted here into a tracked index so translation batches
// and CI read the same source: each line with its file, step, speaker and the conversation's owner.
// Usage: node scripts/generate-chat-text-index.mjs [--check]
const root = new URL('../', import.meta.url)
const read = file => JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'))
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const mobile = read('public/data/masterdata/mobile_archive_index.json')
const random = read('public/data/masterdata/random_talk_presentation_index.json')
const owners = new Map()
const own = (file, owner) => { if (file && !owners.has(file)) owners.set(file, owner) }
for (const scenario of Object.values(mobile.scenarios)) {
  if (scenario.kind === 'idol_phone') continue
  own(scenario.compiled_file, scenario.kind === 'unit_talk' ? { kind: 'unit_talk', unit: scenario.unit_code } : { kind: 'idol_talk', idol: scenario.idol_code })
}
for (const entry of Array.isArray(random.entries) ? random.entries : Object.values(random.entries))
  own(entry.compiled_file, { kind: 'random_talk', idol: entry.idol_code })

const files = {}
for (const file of [...owners.keys()].sort()) {
  const bytes = fs.readFileSync(new URL(`public/data/compiled/${file}`, root))
  const compiled = JSON.parse(bytes)
  const rows = []
  for (const step of compiled.steps || []) {
    if (step.type === 'talk' && step.dialogue) {
      const source = step.dialogue.text_jp ?? step.dialogue.text
      if (typeof source === 'string' && source.trim()) rows.push({ step: step.step_id, kind: 'line', speaker: step.dialogue.speaker || '', source })
    } else if (step.type === 'choice') {
      for (const [index, option] of (step.options || []).entries()) {
        if (typeof option.text === 'string' && option.text.trim()) rows.push({ step: step.step_id, option: index, kind: 'choice', source: option.text })
        if (typeof option.detail === 'string' && option.detail.trim() && option.detail !== option.text) rows.push({ step: step.step_id, option: index, kind: 'detail', source: option.detail })
      }
    }
  }
  files[file] = { sha256: sha(bytes), owner: owners.get(file), rows }
}
const output = `${JSON.stringify({ schema_version: 1, files })}\n`
const target = new URL('translation/studio/source/chat-text-index.json', root)
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw Error('Chat text index differs from the local corpus; regenerate it')
} else {
  fs.mkdirSync(new URL('translation/studio/source/', root), { recursive: true })
  fs.writeFileSync(target, output)
}
const rows = Object.values(files).flatMap(file => file.rows)
console.log(`Chat text index: ${Object.keys(files).length} files, ${rows.length} rows (${new Set(rows.map(row => row.source)).size} unique), ${Buffer.byteLength(output)} bytes`)
