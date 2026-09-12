import { build } from 'vite'
import { mkdir, realpath, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Routine source compilation: never copy the local media corpus to QA output.
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const parent = path.join(root, '.analysis')
await mkdir(parent, { recursive: true })
if (await realpath(parent) !== parent) throw new Error('Refusing redirected .analysis output')
const outDir = path.join(parent, 'build-check')
try {
  if ((await lstat(outDir)).isSymbolicLink()) throw new Error('Refusing linked build output')
} catch (error) { if (error.code !== 'ENOENT') throw error }
console.log(`Source build only; public assets stay in place. Output: ${outDir}`)
await build({ root, configLoader: 'native', build: { outDir, emptyOutDir: true, copyPublicDir: false } })
