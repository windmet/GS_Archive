// Fixed-bucket, explicit-key replacement authorized by the user; no bucket clear.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hashFile } from './lib/preview-source-baseline.mjs'
import { checkStorageBudget, readLiveStorageUsage, verifyLiveUploadBudget } from './lib/upload-storage-budget.mjs'

assert.equal(process.argv[2], '--execute-authorized-voice-replacement')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/voice64')
const stage = path.join(directory, 'stage')
const remote = 'cloudflare:sidem-archive-preview'
const manifestPath = path.join(directory, 'manifest.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const previousPath = path.join(root, '.deploy/storage-compression/full-reupload-manifest.json')
const previous = JSON.parse(await fs.readFile(previousPath, 'utf8'))
const combined = JSON.parse(await fs.readFile(path.join(directory, 'full-manifest.json'), 'utf8'))
const manifestSha = (await hashFile(manifestPath)).sha256
assert.equal(manifest.kind, 'voice64-replacement'); assert.equal(manifest.remote, remote)
assert.equal((await hashFile(previousPath)).sha256, manifest.baseline_manifest_sha256)
assert.equal(combined.voice_manifest_sha256, manifestSha)
const old = new Map(previous.entries.map(e => [e.object_key, e]))
const replacement = new Map(manifest.entries.map(e => [e.object_key, e]))
assert.equal(replacement.size, 32421); assert.equal(manifest.entries.length, 32421)
assert.equal(manifest.totals.files, replacement.size)
assert.equal(manifest.totals.bytes, manifest.entries.reduce((n, e) => n + e.deployed_size, 0))
assert.equal(manifest.totals.old_bytes, manifest.entries.reduce((n, e) => n + e.old_deployed_size, 0))
for (const entry of manifest.entries) {
  assert.match(entry.object_key, /^assets\/voice\/[A-Za-z0-9_-]+\.m4a$/)
  assert.equal(entry.request_key, entry.object_key)
  assert.equal(entry.stage, '.deploy/voice64/stage')
  assert.equal(entry.transform, 'aac-lc-64k-from-acb-pcm16-v1')
  assert.equal(entry.deployed_content_type, 'audio/mp4'); assert.equal(entry.deployed_content_encoding, '')
  assert.equal(entry.old_deployed_sha256, old.get(entry.object_key)?.deployed_sha256)
  assert.equal(entry.old_deployed_size, old.get(entry.object_key)?.deployed_size)
  const current = await hashFile(path.join(stage, entry.object_key))
  assert.equal(current.sha256, entry.deployed_sha256)
  assert.equal((await fs.stat(path.join(stage, entry.object_key))).size, entry.deployed_size)
  // Preserve and verify the original deployment bytes before touching R2.
  const backup = old.get(entry.object_key)
  assert.equal((await hashFile(path.join(root, backup.stage, backup.object_key))).sha256, entry.old_deployed_sha256)
}
assert.equal(combined.entries.length, old.size)
assert.deepEqual(combined.entries, previous.entries.map(e => replacement.get(e.object_key) || e))
assert.equal(combined.totals.bytes, previous.totals.bytes - manifest.totals.old_bytes + manifest.totals.bytes)
const list = path.join(directory, 'keys.txt')
await fs.writeFile(list, manifest.entries.map(e => e.object_key).join('\n') + '\n')
const receiptPath = path.join(directory, 'replacement-receipt.json')
let receipt
try { receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8')); assert.equal(receipt.manifest_sha256, manifestSha) }
catch (error) { if (error.code !== 'ENOENT') throw error; receipt = { manifest_sha256: manifestSha, remote,
  started_at: new Date().toISOString(), phase: 'prepared' } }
const save = async phase => {
  receipt.phase = phase; receipt.updated_at = new Date().toISOString()
  const temporary = receiptPath + '.writing'
  await fs.writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n'); await fs.rename(temporary, receiptPath)
}
const run = (args, capture = false) => {
  console.log(JSON.stringify({ at: new Date().toISOString(), rclone: args }))
  const result = spawnSync('rclone', args, { cwd: root, windowsHide: true,
    ...(capture ? { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 } : { stdio: 'inherit' }) })
  if (result.error) throw result.error
  assert.equal(result.status, 0, capture ? result.stderr : 'rclone failed; retain receipt and resume this phase')
  return result.stdout
}
const inventory = async (name, expectedEntries) => {
  const listing = run(['lsf', remote, '--recursive', '--files-only', '--format', 'ps', '--separator', '|', '--fast-list'], true)
  await fs.writeFile(path.join(directory, name), listing)
  const expected = new Map(expectedEntries.map(e => [e.object_key, e.deployed_size]))
  for (const line of listing.trim().split(/\r?\n/).filter(Boolean)) {
    const i = line.lastIndexOf('|'), key = line.slice(0, i), bytes = Number(line.slice(i + 1))
    assert.equal(expected.get(key), bytes, `Unexpected remote object or size: ${key}`); expected.delete(key)
  }
  assert.equal(expected.size, 0, 'Expected remote objects missing')
}
const common = ['--fast-list', '--stats', '30s', '--stats-log-level', 'NOTICE']
const copy = ['copy', stage, remote, '--files-from-raw', list, '--transfers', '64', '--checkers', '32',
  '--metadata', '--metadata-set', 'content-type=audio/mp4', ...common]
if (receipt.phase === 'prepared') {
  await inventory('remote-before.psv', previous.entries)
  const usage = readLiveStorageUsage(remote)
  assert.equal(usage.targetBytes, previous.totals.bytes)
  receipt.projected_budget = checkStorageBudget({ targetBytes: usage.targetBytes - manifest.totals.old_bytes,
    otherBytes: usage.otherBytes, uploadBytes: manifest.totals.bytes })
  run([...copy, '--dry-run', '--log-level', 'ERROR'])
  await save('clearing')
}
if (receipt.phase === 'clearing') {
  run(['delete', remote, '--files-from-raw', list, '--max-delete', String(replacement.size), '--checkers', '64', ...common])
  const empty = JSON.parse(run(['size', `${remote}/assets/voice`, '--json', '--fast-list'], true))
  assert.equal(empty.count, 0); assert.equal(empty.bytes, 0); assert.equal(empty.sizeless, 0)
  await inventory('remote-without-voice.psv', previous.entries.filter(e => !replacement.has(e.object_key)))
  receipt.empty_voice = empty; await save('empty')
}
if (receipt.phase === 'empty') {
  receipt.upload_budget = verifyLiveUploadBudget(remote, manifest.totals.bytes)
  await save('uploading')
}
if (receipt.phase === 'uploading') {
  // Resuming uses rclone's normal checks; it never repeats the deletion phase.
  run(copy); await save('uploaded')
}
if (receipt.phase === 'uploaded') {
  run(['check', stage, remote, '--files-from-raw', list, '--one-way', '--checkers', '32', ...common])
  await inventory('remote-after.psv', combined.entries)
  receipt.metadata_samples = []
  for (const channels of [1, 2]) {
    const entry = manifest.entries.find(e => e.channels === channels)
    assert.ok(entry)
    const stat = JSON.parse(run(['lsjson', `${remote}/${entry.object_key}`, '--stat', '--metadata', '--no-modtime', '--no-mimetype'], true))
    assert.equal(stat.Metadata?.['content-type'], 'audio/mp4')
    assert.equal(stat.Metadata?.['content-encoding'] || '', '')
    receipt.metadata_samples.push({ key: entry.object_key, channels, content_type: 'audio/mp4' })
  }
  receipt.final_budget = verifyLiveUploadBudget(remote, 0)
  receipt.voice_totals = manifest.totals; receipt.bucket_totals = combined.totals
  await save('verified')
}
assert.equal(receipt.phase, 'verified')
console.log(JSON.stringify(receipt, null, 2))
