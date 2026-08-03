import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobilePath = path.join(root, 'public/data/masterdata/mobile_archive_index.json')
const compiledRoot = path.join(root, 'public/data/compiled')
const outputPath = path.join(root, 'public/data/masterdata/random_talk_presentation_index.json')

const mobile = JSON.parse(await readFile(mobilePath, 'utf8'))
const topics = mobile.random_talk?.topics || []
const intros = mobile.random_talk?.intros || []
const sourceRows = [
  ...topics.map(row => ({ ...row, presentation_kind: 'topic' })),
  ...intros.map(row => ({ ...row, presentation_kind: 'intro' })),
]
const rowsByFile = new Map()

for (const row of sourceRows) {
  const file = row.compiled_file || topics.find(topic =>
    topic.talk_room_id === row.talk_room_id && topic.script_name === row.script_name,
  )?.compiled_file || ''
  if (!file) continue
  if (!rowsByFile.has(file)) rowsByFile.set(file, [])
  rowsByFile.get(file).push({ ...row, compiled_file: file })
}

function plainText(value) {
  return String(value || '')
    .replace(/<comma>/gi, '、')
    .replace(/<emoji>[^<]*<\/emoji>/gi, '（表情）')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstDialogue(steps) {
  for (const step of steps) {
    const text = plainText(step?.dialogue?.text_jp || step?.dialogue?.text)
    if (text) return text
  }
  return ''
}

const entries = []
const missingLabels = []
for (const [file, rows] of [...rowsByFile.entries()].sort()) {
  const scenario = JSON.parse(await readFile(path.join(compiledRoot, file), 'utf8'))
  const jumpPoints = scenario.jump_points || {}
  const boundarySteps = rows
    .map(row => Number(jumpPoints[row.script_label] || 0))
    .filter(step => step > 0)
    .sort((left, right) => left - right)

  for (const row of rows) {
    const startStep = Number(jumpPoints[row.script_label] || 0)
    if (!startStep) {
      missingLabels.push({ id: row.id, label: row.script_label, file })
      continue
    }
    const nextStart = boundarySteps.find(step => step > startStep) || Number(scenario.total_steps || scenario.steps?.length || 0) + 1
    const endStep = Math.max(startStep, nextStart - 1)
    const steps = (scenario.steps || []).filter(step =>
      Number(step.step_id) >= startStep && Number(step.step_id) <= endStep,
    )
    const title = firstDialogue(steps) || row.script_label
    entries.push({
      id: row.id,
      kind: row.presentation_kind,
      talk_room_id: row.talk_room_id,
      idol_code: row.idol_code || topics.find(topic => topic.talk_room_id === row.talk_room_id)?.idol_code || '',
      script_name: row.script_name,
      script_label: row.script_label,
      compiled_file: file,
      start_step: startStep,
      end_step: endStep,
      title,
      dialogue_count: steps.filter(step => plainText(step?.dialogue?.text_jp || step?.dialogue?.text)).length,
      choice_count: steps.filter(step => step?.type === 'choice').length,
    })
  }
}

entries.sort((left, right) =>
  left.idol_code.localeCompare(right.idol_code) ||
  left.kind.localeCompare(right.kind) ||
  Number(left.id) - Number(right.id),
)

const output = {
  schema_version: 1,
  entries,
  by_topic_id: Object.fromEntries(entries.filter(entry => entry.kind === 'topic').map(entry => [String(entry.id), entry])),
  by_intro_id: Object.fromEntries(entries.filter(entry => entry.kind === 'intro').map(entry => [String(entry.id), entry])),
  meta: {
    topic_count: entries.filter(entry => entry.kind === 'topic').length,
    intro_count: entries.filter(entry => entry.kind === 'intro').length,
    compiled_file_count: rowsByFile.size,
    missing_label_count: missingLabels.length,
    missing_labels: missingLabels,
  },
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Random Talk presentation: ${output.meta.topic_count} topics, ${output.meta.intro_count} intros, ${output.meta.compiled_file_count} files`)
