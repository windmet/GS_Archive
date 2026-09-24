import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { verifyLiveUploadBudget } from './lib/upload-storage-budget.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [remote, mode = '--plan'] = process.argv.slice(2)
assert.ok(/^[\w-]+:[^\s]+$/.test(remote || ''), 'Supply remote:bucket')
assert.ok(['--plan', '--dry-run', '--upload'].includes(mode))
execFileSync(process.execPath, ['scripts/prepare-preview-data-snapshot.mjs', '--verify'], { cwd: root, stdio: 'inherit' })
const directory = path.join(root, '.deploy/storage-compression')
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'data-snapshot-manifest.json'), 'utf8'))
if (mode === '--upload') verifyLiveUploadBudget(remote, manifest.totals.bytes)
const list = path.join(directory, 'data-snapshot-keys.txt')
await fs.writeFile(list, manifest.entries.map(e => e.object_key).join('\n') + '\n')
// Version-prefixed objects are immutable. Existing different bytes are errors;
// rollback never depends on overwriting the shared data keys.
const args = ['copy', path.join(directory, manifest.stage), remote, '--files-from-raw', list,
  '--immutable', '--checksum', '--metadata', '--metadata-set', 'content-type=application/json',
  '--transfers', '4', '--checkers', '8']
if (mode !== '--upload') args.push('--dry-run')
console.log(JSON.stringify({ executable: 'rclone', args, ...manifest.totals, mode }))
if (mode !== '--plan') {
  const result = spawnSync('rclone', args, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  assert.equal(result.status, 0, 'Data snapshot upload failed')
}
