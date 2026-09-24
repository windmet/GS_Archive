// User-authorized whole-bucket replacement. Fixed bucket; resumable after clearing.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hashFile } from './lib/preview-source-baseline.mjs'
import { checkStorageBudget, readLiveStorageUsage, verifyLiveUploadBudget } from './lib/upload-storage-budget.mjs'

assert.equal(process.argv[2], '--execute-authorized-clear')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/storage-compression')
const manifestPath = path.join(directory, 'full-reupload-manifest.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const remote = 'cloudflare:sidem-archive-preview'
assert.equal(manifest.remote, remote)
assert.equal(manifest.kind, 'full-preview-reupload')
const manifestSha = (await hashFile(manifestPath)).sha256
const receiptPath = path.join(directory, 'full-reupload-receipt.json')
let receipt
try { receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8')); assert.equal(receipt.manifest_sha256, manifestSha) }
catch (error) { if (error.code !== 'ENOENT') throw error; receipt = { manifest_sha256: manifestSha, remote,
  started_at: new Date().toISOString(), phase: 'prepared', uploaded_groups: [] } }
const save = async phase => { receipt.phase = phase; receipt.updated_at = new Date().toISOString();
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n') }
const run = (args, capture = false) => {
  console.log(JSON.stringify({ at: new Date().toISOString(), rclone: args }))
  const result = spawnSync('rclone', args, { cwd: root, windowsHide: true,
    ...(capture ? { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 } : { stdio: 'inherit' }) })
  if (result.error) throw result.error
  assert.equal(result.status, 0, capture ? result.stderr : 'rclone failed; preserve receipt and stop')
  return result.stdout
}
const common = ['--fast-list', '--stats', '30s', '--stats-log-level', 'NOTICE']
if (receipt.phase === 'prepared') {
  const before = (await fs.readFile(path.join(directory, 'full-reupload-remote-before.psv'), 'utf8')).trim().split(/\r?\n/).filter(Boolean)
  assert.ok(before.length > 0, 'Remote inventory required before authorized clear')
  receipt.before_files = before.length
  receipt.before_bytes = before.reduce((sum, line) => sum + Number(line.slice(line.lastIndexOf('|') + 1)), 0)
  assert.ok(Number.isSafeInteger(receipt.before_bytes))
  const usage = readLiveStorageUsage(remote)
  receipt.preclear_budget = checkStorageBudget({ targetBytes: 0, otherBytes: usage.otherBytes, uploadBytes: manifest.totals.bytes })
  console.log(JSON.stringify({ preclear_budget: receipt.preclear_budget }))
  await save('clearing')
}
if (receipt.phase === 'clearing') {
  // Delete objects, never the bucket itself or its Pages binding.
  run(['delete', remote, '--max-delete', String(receipt.before_files), '--checkers', '64', ...common])
  const empty = JSON.parse(run(['size', remote, '--json', '--fast-list'], true))
  assert.equal(empty.count, 0); assert.equal(empty.bytes, 0); assert.equal(empty.sizeless, 0)
  receipt.empty_bucket = empty
  await save('empty')
}
if (receipt.phase === 'empty') {
  receipt.budget = verifyLiveUploadBudget(remote, manifest.totals.bytes)
  await save('uploading')
}
if (receipt.phase === 'uploading') {
  for (const group of manifest.groups) {
    if (receipt.uploaded_groups.includes(group.list)) continue
    const entries = manifest.entries.filter(e => e.stage === group.stage && e.deployed_content_type === group.content_type &&
      (e.deployed_content_encoding || '') === group.content_encoding)
    assert.equal(entries.length, group.files)
    const list = path.join(directory, group.list)
    await fs.writeFile(list, entries.map(e => e.object_key).join('\n') + '\n')
    const metadata = ['--metadata', '--metadata-set', `content-type=${group.content_type}`]
    if (group.content_encoding) metadata.push('--metadata-set', `content-encoding=${group.content_encoding}`)
    run(['copy', path.join(root, group.stage), remote, '--files-from-raw', list, '--no-check-dest',
      '--transfers', '64', '--checkers', '32', ...metadata, ...common])
    receipt.uploaded_groups.push(group.list)
    await save('uploading')
  }
  await save('uploaded')
}
if (receipt.phase === 'uploaded') {
  // One acceptance phase for the complete upload. S3 checksum checks do not
  // download the entire media corpus again; local SHA256 was checked pre-clear.
  for (const stage of new Set(manifest.entries.map(e => e.stage))) {
    const list = path.join(directory, `full-check-${path.basename(stage)}-keys.txt`)
    await fs.writeFile(list, manifest.entries.filter(e => e.stage === stage).map(e => e.object_key).join('\n') + '\n')
    run(['check', path.join(root, stage), remote, '--files-from-raw', list, '--one-way', '--checkers', '32', ...common])
  }
  const listing = run(['lsf', remote, '--recursive', '--files-only', '--format', 'ps', '--separator', '|', '--fast-list'], true)
  await fs.writeFile(path.join(directory, 'full-reupload-remote-after.psv'), listing)
  const expected = new Map(manifest.entries.map(e => [e.object_key, e.deployed_size]))
  for (const line of listing.trim().split(/\r?\n/)) {
    const separator = line.lastIndexOf('|'), key = line.slice(0, separator), bytes = Number(line.slice(separator + 1))
    assert.equal(expected.get(key), bytes, `Unexpected or wrong-size remote object: ${key}`); expected.delete(key)
  }
  assert.equal(expected.size, 0, 'Remote objects missing')
  receipt.metadata_samples = []
  for (const group of manifest.groups) {
    const entry = manifest.entries.find(e => e.stage === group.stage && e.deployed_content_type === group.content_type &&
      (e.deployed_content_encoding || '') === group.content_encoding)
    const object = JSON.parse(run(['lsjson', `${remote}/${entry.object_key}`, '--stat', '--metadata', '--no-modtime', '--no-mimetype'], true))
    assert.equal(object.Metadata?.['content-type'], group.content_type)
    assert.equal(object.Metadata?.['content-encoding'] || '', group.content_encoding)
    receipt.metadata_samples.push({ key: entry.object_key, content_type: group.content_type, content_encoding: group.content_encoding })
  }
  receipt.totals = manifest.totals
  await save('verified')
}
assert.equal(receipt.phase, 'verified')
console.log(JSON.stringify(receipt, null, 2))
