import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Archive Product -> GS Player Presentation -> Story Runtime Kernel. The kernel (src/core) must
// not depend on the archive product: no archive components and no archive presentation modules.
// The host injects what it needs (slots, formatters); see StoryViewer's language-switch slot.
const root = fileURLToPath(new URL('..', import.meta.url))
const core = path.join(root, 'src/core')
const forbidden = ['src/components/archive/', 'src/presentation/']
const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm

const files = []
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(js|mjs|vue)$/.test(entry.name)) files.push(full)
  }
}
walk(core)
assert.ok(files.length > 20, 'src/core was not scanned')

const violations = []
let relativeImports = 0
for (const file of files) {
  for (const [, specifier] of readFileSync(file, 'utf8').matchAll(importPattern)) {
    if (!specifier.startsWith('.')) continue
    relativeImports++
    const target = path.relative(root, path.resolve(path.dirname(file), specifier)).replaceAll('\\', '/')
    if (forbidden.some(prefix => target.startsWith(prefix))) violations.push(`${path.relative(root, file).replaceAll('\\', '/')} -> ${target}`)
  }
}
assert.deepEqual(violations, [], 'src/core must not import archive components or archive presentation')
console.log(`Core boundary: ${files.length} kernel files, ${relativeImports} relative imports, none into ${forbidden.join(' or ')}`)
