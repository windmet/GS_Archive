import { build } from 'vite'
import {execFileSync} from 'node:child_process'
import { mkdir, realpath, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveBuildAuditPlugin } from './lib/archive-build-audit.mjs'

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
for (const script of ['generate-translation-release.mjs','generate-translation-audit.mjs','generate-resource-audit.mjs']) execFileSync(process.execPath,[path.join(root,'scripts',script)],{cwd:root,stdio:'pipe',windowsHide:true})
await build({ root, configLoader: 'native', plugins: [archiveBuildAuditPlugin(root)],
  build: { outDir, assetsDir: '_app', emptyOutDir: true, copyPublicDir: false } })
