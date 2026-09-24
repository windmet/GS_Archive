import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { verifyStructuredGzip } from './verify-structured-gzip.mjs'

// Plan only unless --dry-run or --upload is explicitly supplied. No sync/delete.
const [manifestArg, remote, mode = '--plan'] = process.argv.slice(2)
assert.ok(manifestArg && /^[\w-]+:[^\s]+$/.test(remote || ''), 'Usage: upload-structured-gzip.mjs <manifest> <remote:bucket> [--plan|--dry-run|--upload]')
assert.ok(['--plan', '--dry-run', '--upload'].includes(mode))
const manifestPath = path.resolve(manifestArg)
const manifest = await verifyStructuredGzip(manifestPath)
const directory = path.dirname(manifestPath)
const groups = new Map()
for (const entry of manifest.entries) {
  const type = entry.deployed_content_type
  assert.ok(['application/json', 'application/octet-stream'].includes(type))
  if (!groups.has(type)) groups.set(type, [])
  groups.get(type).push(entry.object_key)
}
for (const [type, keys] of groups) {
  const list = path.join(directory, `${manifest.stage}-${type === 'application/json' ? 'json' : 'binary'}-keys.txt`)
  await fs.writeFile(list, keys.join('\n') + '\n')
  const args = ['copy', path.join(directory, manifest.stage), remote, '--files-from-raw', list,
    '--metadata', '--metadata-set', `content-type=${type}`, '--metadata-set', 'content-encoding=gzip',
    '--ignore-times', '--transfers', '4', '--checkers', '8']
  if (mode !== '--upload') args.push('--dry-run')
  console.log(JSON.stringify({ executable: 'rclone', args, objects: keys.length, mode }))
  if (mode !== '--plan') {
    const result = spawnSync('rclone', args, { stdio: 'inherit', windowsHide: true })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'rclone failed')
  }
}
