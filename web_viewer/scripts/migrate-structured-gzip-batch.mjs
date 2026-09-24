import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { verifyStructuredGzip } from './verify-structured-gzip.mjs'
import { hashFile } from './lib/preview-source-baseline.mjs'
import { verifyLiveUploadBudget } from './lib/upload-storage-budget.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/storage-compression')
const [batch, mode] = process.argv.slice(2)
assert.match(batch || '', /^0[1-6]$/)
assert.equal(mode, '--execute', 'Maintenance-only tool: supply batch 01..06 and --execute')
const remote = 'cloudflare:sidem-archive-preview'
const run = args => {
  console.log(JSON.stringify({ rclone: args, at: new Date().toISOString() }))
  const result = spawnSync('rclone', args, { cwd: root, windowsHide: true, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, 'rclone failed; stop this batch and preserve receipt')
}
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const gzipPath = path.join(directory, 'structured-manifest.json')
const manifest = await verifyStructuredGzip(gzipPath)
const oldPath = path.join(root, '.deploy/r2-manifest.json')
const old = await read(oldPath)
const baseline = await read(path.join(directory, 'source-baseline.json'))
assert.equal((await hashFile(oldPath)).sha256, baseline.previous_manifest_sha256)
const oldByKey = new Map(old.entries.map(e => [e.request_key, e]))
const deleteList = path.join(directory, `cleanup-migration-${batch}-delete-keys.txt`)
const deleteKeys = (await fs.readFile(deleteList, 'utf8')).trim().split('\n').map(s => s.trim())
const selectedKeys = new Set(deleteKeys)
assert.equal(selectedKeys.size, deleteKeys.length)
const selected = manifest.entries.filter(e => selectedKeys.has(e.request_key))
assert.equal(selected.length, deleteKeys.length)
for (const entry of selected) {
  const previous = oldByKey.get(entry.request_key)
  assert.equal(previous.object_key, entry.request_key)
  assert.equal(previous.sha256, entry.source_sha256)
  const local = await hashFile(path.join(root, '.deploy/r2', previous.object_key))
  assert.equal(local.sha256, previous.sha256, `Missing rollback bytes: ${entry.request_key}`)
  assert.equal(local.size, previous.deployed_size)
}
const identity = { batch, remote, manifest_sha256: (await hashFile(gzipPath)).sha256,
  delete_list_sha256: (await hashFile(deleteList)).sha256, files: selected.length }
const receiptPath = path.join(directory, `migration-${batch}-receipt.json`)
let receipt
try { receipt = await read(receiptPath); for (const [k, v] of Object.entries(identity)) assert.equal(receipt[k], v) }
catch (error) { if (error.code !== 'ENOENT') throw error; receipt = { ...identity, started_at: new Date().toISOString(), phase: 'prepared' } }
const save = async phase => { receipt.phase = phase; receipt.updated_at = new Date().toISOString(); await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n') }
const common = ['--fast-list', '--use-server-modtime', '--stats', '30s', '--stats-log-level', 'NOTICE']
if (receipt.phase === 'prepared') {
  // Prove that the preserved old package really matches the remote bytes we
  // are about to delete, not merely their sizes or historical manifest.
  run(['check', path.join(root, '.deploy/r2'), remote, '--files-from-raw', deleteList,
    '--download', '--one-way', '--checkers', '16', ...common])
  run(['delete', remote, '--files-from-raw', deleteList, '--max-delete', String(selected.length), '--dry-run', ...common])
  await save('delete-started')
}
if (receipt.phase === 'delete-started') {
  // Resuming a partially completed deletion is safe: the exact key list and
  // fully checked local backups are bound into the receipt.
  run(['delete', remote, '--files-from-raw', deleteList, '--max-delete', String(selected.length), '--checkers', '16', ...common])
  const remaining = spawnSync('rclone', ['lsf', remote, '--recursive', '--files-only', '--format', 'p',
    '--files-from-raw', deleteList, '--fast-list'], { cwd: root, windowsHide: true, encoding: 'utf8' })
  assert.equal(remaining.status, 0); assert.equal(remaining.stdout.trim(), '', 'Old batch still present')
  await save('deleted')
}
if (receipt.phase === 'deleted') {
  await save('upload-started')
}
const uploadList = path.join(directory, `cleanup-migration-${batch}-upload-keys.txt`)
await fs.writeFile(uploadList, selected.map(e => e.object_key).join('\n') + '\n')
if (receipt.phase === 'upload-started') {
  // On resume remeasure rather than trusting a stale capacity receipt.
  receipt.budget = verifyLiveUploadBudget(remote, selected.reduce((s, e) => s + e.deployed_size, 0))
  for (const type of ['application/json', 'application/octet-stream']) {
    const group = selected.filter(e => e.deployed_content_type === type)
    if (!group.length) continue
    const list = path.join(directory, `migration-${batch}-${type.endsWith('json') ? 'json' : 'binary'}-keys.txt`)
    await fs.writeFile(list, group.map(e => e.object_key).join('\n') + '\n')
    run(['copy', path.join(directory, 'structured'), remote, '--files-from-raw', list,
      '--metadata', '--metadata-set', `content-type=${type}`, '--metadata-set', 'content-encoding=gzip',
      '--ignore-times', '--transfers', '16', '--checkers', '16', ...common])
  }
  await save('uploaded')
}
if (receipt.phase === 'uploaded') {
  run(['check', path.join(directory, 'structured'), remote, '--files-from-raw', uploadList,
    '--download', '--one-way', '--checkers', '16', ...common])
  receipt.metadata_samples = []
  for (const type of new Set(selected.map(e => e.deployed_content_type))) {
    const entry = selected.find(e => e.deployed_content_type === type)
    const probe = spawnSync('rclone', ['lsjson', `${remote}/${entry.object_key}`, '--stat', '--metadata',
      '--no-modtime', '--no-mimetype'], { cwd: root, windowsHide: true, encoding: 'utf8' })
    assert.equal(probe.status, 0)
    const object = JSON.parse(probe.stdout)
    assert.equal(object.Size, entry.deployed_size)
    assert.equal(object.Metadata?.['content-encoding'], 'gzip')
    assert.equal(object.Metadata?.['content-type'], type)
    receipt.metadata_samples.push({ object_key: entry.object_key, content_type: type, content_encoding: 'gzip' })
  }
  await save('verified')
}
assert.equal(receipt.phase, 'verified')
console.log(JSON.stringify(receipt, null, 2))
