import { build } from 'vite'
import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Git Pages deploys only the app bundle. The private R2 binding serves the
// locally exported /assets and /data corpus without copying it into dist.
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const outDir = path.join(root, 'dist')
try {
  if ((await lstat(outDir)).isSymbolicLink()) throw new Error('Refusing linked Preview output')
} catch (error) { if (error.code !== 'ENOENT') throw error }
console.log(`Preview code bundle only; /assets and /data are served by R2: ${outDir}`)
await build({ root, configLoader: 'native', build: { outDir, assetsDir: '_app', emptyOutDir: true, copyPublicDir: false } })
