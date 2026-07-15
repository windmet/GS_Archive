import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const storyMasterPath = path.join(root, 'public', 'data', 'masterdata', 'story_master_index.json')
const compiledRoot = path.join(root, 'public', 'data', 'compiled')
const outputPath = path.join(root, 'public', 'data', 'masterdata', 'story_presentation_index.json')

const storyMaster = JSON.parse(await readFile(storyMasterPath, 'utf8'))
const rows = [
  ...(storyMaster.main?.episodes || []),
  ...(storyMaster.event?.episodes || []),
  ...(storyMaster.unit_story?.episodes || []),
  ...(storyMaster.idol_story?.episodes || []),
  ...(storyMaster.card_scenarios || []),
  ...(storyMaster.work || []),
  ...(storyMaster.birthday || []),
  ...(storyMaster.extra?.episodes || []),
]

const files = [...new Set(rows.map(row => row.compiled_file).filter(Boolean))].sort()
const byFile = {}
let synopsisCount = 0
let skippedSynopsisSteps = 0

for (const file of files) {
  const scenario = JSON.parse(await readFile(path.join(compiledRoot, file), 'utf8'))
  const steps = Array.isArray(scenario.steps) ? scenario.steps : []
  const playableStartIndex = steps.findIndex(step => step?.type !== 'synopsis')
  const leadingSynopsisSteps = playableStartIndex < 0 ? steps : steps.slice(0, playableStartIndex)
  const synopsisStep = leadingSynopsisSteps.find(step => step?.dialogue?.speaker || step?.dialogue?.text)
  const titleCards = steps
    .filter(step => step?.type === 'title' && (step?.dialogue?.speaker || step?.dialogue?.text))
    .map(step => ({
      episode_index: Number(step.episode_index || 0),
      episode_part: step.episode_part || '',
      label: step.dialogue?.speaker || '',
      title: step.dialogue?.text_jp || step.dialogue?.text || '',
    }))
    .filter((card, index, all) => index === all.findIndex(candidate =>
      candidate.episode_index === card.episode_index &&
      candidate.label === card.label &&
      candidate.title === card.title,
    ))

  const preplaySynopsis = synopsisStep
    ? {
        title: synopsisStep.dialogue?.speaker || '',
        text: synopsisStep.dialogue?.text_jp || synopsisStep.dialogue?.text || '',
        text_cn: synopsisStep.dialogue?.text_cn || '',
      }
    : null

  if (preplaySynopsis) synopsisCount += 1
  skippedSynopsisSteps += leadingSynopsisSteps.length
  byFile[file] = {
    scenario_id: scenario.scenario_id || file.replace(/\.json$/i, ''),
    preplay_synopsis: preplaySynopsis,
    playable_start_index: playableStartIndex < 0 ? 0 : playableStartIndex,
    playable_step_count: Math.max(0, steps.length - Math.max(0, playableStartIndex)),
    title_cards: titleCards,
  }
}

const output = {
  schema_version: 1,
  meta: {
    story_file_count: files.length,
    synopsis_count: synopsisCount,
    skipped_synopsis_step_count: skippedSynopsisSteps,
  },
  by_file: byFile,
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outputPath)} (${files.length} stories, ${synopsisCount} synopses)`)
