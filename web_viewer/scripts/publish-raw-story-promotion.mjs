import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { publishRawStoryPromotion } from './lib/raw-story-promotion.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['candidate-dir', 'compiled-dir', 'backup-dir', 'confirm-scenario']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}
const report = await publishRawStoryPromotion({
  workspaceRoot,
  candidateDirectory: args['candidate-dir'],
  compiledDirectory: args['compiled-dir'],
  translationsRoot: args['translations-root'] || path.join(workspaceRoot, 'public', 'translations'),
  backupDirectory: args['backup-dir'],
  confirmScenario: args['confirm-scenario'],
})
console.log(JSON.stringify(report, null, 2))
