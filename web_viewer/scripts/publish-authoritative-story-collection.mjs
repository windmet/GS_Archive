import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishAuthoritativeCollection } from './lib/authoritative-collection-publisher.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['candidate-dir', 'compiled-dir', 'backup-dir', 'confirm-group']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}
const report = await publishAuthoritativeCollection({
  workspaceRoot,
  candidateDirectory: args['candidate-dir'],
  compiledDirectory: args['compiled-dir'],
  backupDirectory: args['backup-dir'],
  confirmGroup: args['confirm-group'],
})
console.log(JSON.stringify(report, null, 2))
