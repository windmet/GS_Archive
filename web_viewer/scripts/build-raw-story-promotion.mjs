import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildRawStoryPromotionCandidate } from './lib/raw-story-promotion.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['current', 'compatibility', 'authoritative', 'output-dir']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}
const manifest = await buildRawStoryPromotionCandidate({
  workspaceRoot,
  currentFile: args.current,
  compatibilityFile: args.compatibility,
  authoritativeFile: args.authoritative,
  translationsRoot: args['translations-root'] || path.join(workspaceRoot, 'public', 'translations'),
  outputDirectory: args['output-dir'],
  scenarioId: args['scenario-id'] || null,
})
console.log(JSON.stringify(manifest, null, 2))
