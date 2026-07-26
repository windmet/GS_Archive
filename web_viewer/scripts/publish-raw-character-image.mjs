import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { publishRawCharacterImage } from './lib/raw-character-image-promotion.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['candidate-dir', 'registry', 'assets-root', 'backup-dir', 'confirm']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}

const report = await publishRawCharacterImage({
  workspaceRoot,
  candidateDirectory: args['candidate-dir'],
  registryFile: args.registry,
  assetsRoot: args['assets-root'],
  backupDirectory: args['backup-dir'],
  confirmKey: args.confirm,
})
console.log(JSON.stringify(report, null, 2))
