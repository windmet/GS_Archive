import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const compiledRoot = path.join(root, 'public', 'data', 'compiled')
const files = (await readdir(compiledRoot)).filter(file =>
  file.endsWith('.json') && !['index.json', 'manifest.json', 'voice_index.json'].includes(file),
)
const malformed = []

for (const file of files) {
  let scenario
  try {
    scenario = JSON.parse(await readFile(path.join(compiledRoot, file), 'utf8'))
  } catch {
    continue
  }
  for (const step of scenario.steps || []) {
    const voice = step.dialogue?.voice || ''
    if (/_([a-z])_\1\d+\.m4a$/i.test(voice)) malformed.push({ file, step: step.step_id, voice })
  }
}

assert.deepEqual(malformed, [], `${malformed.length} voice cues repeat their episode letter`)

const prologue = JSON.parse(await readFile(path.join(compiledRoot, '1_4_001_00.json'), 'utf8'))
const callVoices = prologue.steps.filter(step => step.type === 'call').map(step => step.dialogue?.voice)
assert.deepEqual(callVoices, [
  '1_4_001_00_b1007.m4a',
  '1_4_001_00_b1008.m4a',
  '1_4_001_00_b1009.m4a',
  '1_4_001_00_b1010.m4a',
])

console.log(`Compiled voice cues: ${files.length} scenarios checked, no repeated episode-letter prefixes`)
