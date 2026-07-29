import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { publishRawCharacterImageBatch } from './lib/raw-character-image-promotion.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['candidate-dirs', 'registry', 'assets-root', 'backup-dir', 'confirm']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}
const candidateDirectories = args['candidate-dirs']
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
if (candidateDirectories.length < 2) {
  throw new Error('--candidate-dirs requires at least two comma-separated paths')
}

const report = await publishRawCharacterImageBatch({
  workspaceRoot,
  candidateDirectories,
  registryFile: args.registry,
  assetsRoot: args['assets-root'],
  backupDirectory: args['backup-dir'],
  confirmKey: args.confirm,
})
console.log(JSON.stringify(report, null, 2))
