import { execFileSync } from 'node:child_process'

// Reports the blobs a revision range adds to the repository, grouped by directory: how many, their raw size
// and their size on disk. Disk sizes are exact only for packed objects (delta-compressed); a fresh loose blob
// counts at its zlib size, so run `git gc` (or measure a merged range) before quoting disk growth.
// A full story recompile should quote this in its PR (docs/REPO_DATA_GOVERNANCE_20261022.md).
// Usage: node scripts/report-git-data-growth.mjs <base>..<head> [--depth=4] [--top=12]
const range = process.argv.slice(2).find(arg => !arg.startsWith('--'))
if (!range?.includes('..')) {
  console.error('Usage: node scripts/report-git-data-growth.mjs <base>..<head> [--depth=4] [--top=12]')
  process.exit(2)
}
const option = (name, fallback) => Number(process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback)
const depth = option('depth', 4)
const top = option('top', 12)

const git = (args, input) => execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 1 << 30 })
const [base, head] = range.split('..')
const objects = git(['rev-list', '--objects', head, `^${base}`])
const rows = git(['cat-file', '--batch-check=%(objecttype) %(objectsize) %(objectsize:disk) %(rest)'], objects)
  .split('\n').filter(line => line.startsWith('blob '))

const groups = new Map()
const total = { count: 0, raw: 0, disk: 0 }
for (const line of rows) {
  const [, raw, disk, ...rest] = line.split(' ')
  const key = rest.join(' ').split('/').slice(0, depth).join('/') || '(root)'
  const group = groups.get(key) || { count: 0, raw: 0, disk: 0 }
  for (const sum of [group, total]) { sum.count++; sum.raw += Number(raw); sum.disk += Number(disk) }
  groups.set(key, group)
}
const mib = bytes => (bytes / 1048576).toFixed(1).padStart(8)
console.log(`${range}: ${total.count} new blobs, raw ${mib(total.raw).trim()} MiB, on disk ${mib(total.disk).trim()} MiB`)
console.log(' blobs   raw MiB  disk MiB  directory')
for (const [key, group] of [...groups].sort((a, b) => b[1].disk - a[1].disk).slice(0, top)) {
  console.log(`${String(group.count).padStart(6)}  ${mib(group.raw)}  ${mib(group.disk)}  ${key}`)
}
