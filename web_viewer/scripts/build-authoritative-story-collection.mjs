import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAuthoritativeCollectionCandidate } from './lib/authoritative-collection-candidate.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
for (const required of ['group-id', 'output-dir', 'compiler-version']) {
  if (!args[required]) throw new Error(`--${required}=... is required`)
}
const manifest = await buildAuthoritativeCollectionCandidate({
  workspaceRoot,
  compiledDirectory: args['compiled-dir'] || path.join(workspaceRoot, 'public', 'data', 'compiled'),
  outputDirectory: args['output-dir'],
  groupId: args['group-id'],
  compilerVersion: args['compiler-version'],
})
console.log(JSON.stringify(manifest, null, 2))
