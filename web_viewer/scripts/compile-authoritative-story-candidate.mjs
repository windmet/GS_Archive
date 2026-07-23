import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileAuthoritativeScenario } from './lib/authoritative-scenario-compiler.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=')]
}))
if (!args.input || !args.output) {
  throw new Error('Usage: node scripts/compile-authoritative-story-candidate.mjs --input=<json> --output=<json> [--compiler-version=<version>]')
}
const inputPath = path.resolve(args.input)
const outputPath = path.resolve(args.output)
const relativeOutput = path.relative(root, outputPath)
if (relativeOutput === '' || (!relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput))) {
  throw new Error('Authoritative candidate output must remain outside the web_viewer workspace')
}
const input = JSON.parse(await readFile(inputPath, 'utf8'))
const output = compileAuthoritativeScenario(input, { compilerVersion: args['compiler-version'] })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ input: inputPath, output: outputPath, steps: output.steps.length }, null, 2))
