import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
export const PREVIEW_BUCKET_LIMIT_BYTES = 8_600_000_000

export function projectIncrementalUsage(entries, remoteInventory) {
  const remote = new Map(), seen = new Set()
  let targetBytes = 0, netDelta = 0, positiveDelta = 0
  for (const row of remoteInventory) {
    assert.ok(!row.IsDir && Number.isSafeInteger(row.Size) && row.Size >= 0)
    assert.ok(typeof row.Path === 'string' && row.Path && !remote.has(row.Path), 'Duplicate remote key')
    remote.set(row.Path, row.Size); targetBytes += row.Size
  }
  for (const entry of entries) {
    assert.ok(typeof entry.object_key === 'string' && entry.object_key && !seen.has(entry.object_key), 'Duplicate staged key')
    assert.ok(Number.isSafeInteger(entry.deployed_size) && entry.deployed_size >= 0)
    seen.add(entry.object_key)
    const delta = entry.deployed_size - (remote.get(entry.object_key) || 0)
    netDelta += delta; positiveDelta += Math.max(0, delta)
  }
  const projectedBytes = targetBytes + netDelta, conservativePeakBytes = targetBytes + positiveDelta
  for (const value of [targetBytes, positiveDelta, projectedBytes, conservativePeakBytes]) assert.ok(Number.isSafeInteger(value) && value >= 0)
  return {targetBytes, netDelta, positiveDelta, projectedBytes, conservativePeakBytes}
}

export function checkStorageBudget({ targetBytes, otherBytes, uploadBytes }) {
  for (const value of [targetBytes, otherBytes, uploadBytes]) assert.ok(Number.isSafeInteger(value) && value >= 0)
  // Keep the documented allowance for other uses even when visible buckets
  // currently use less. User authorization requires strictly less than 8.6 GB.
  const reservedOtherBytes = Math.max(otherBytes, 880_000_000)
  const projectedTarget = targetBytes + uploadBytes
  const projectedAccount = projectedTarget + reservedOtherBytes
  assert.ok(projectedTarget < PREVIEW_BUCKET_LIMIT_BYTES, `Preview budget exceeded: ${projectedTarget} B; wait for user approval before uploading`)
  assert.ok(projectedAccount <= 10_000_000_000, `Account budget exceeded: ${projectedAccount} B`)
  return { targetBytes, otherBytes, reservedOtherBytes, uploadBytes, projectedTarget, projectedAccount }
}

export function readLiveStorageUsage(remote) {
  assert.match(remote, /^[\w-]+:[^/\s]+$/, 'Budget guard requires a bucket root')
  const [name, target] = remote.split(':')
  const run = args => execFileSync('rclone', args, { encoding: 'utf8', windowsHide: true })
  const buckets = run(['lsf', `${name}:`, '--dirs-only']).trim().split(/\r?\n/).filter(Boolean).map(s => s.replace(/\/$/, ''))
  assert.ok(buckets.includes(target), 'Target bucket not visible in account inventory')
  let targetBytes = 0, otherBytes = 0
  for (const bucket of buckets) {
    const size = JSON.parse(run(['size', `${name}:${bucket}`, '--json']))
    assert.equal(size.sizeless, 0, 'Incomplete storage accounting')
    if (bucket === target) targetBytes = size.bytes
    else otherBytes += size.bytes
  }
  return { targetBytes, otherBytes }
}

export function verifyLiveUploadBudget(remote, uploadBytes) {
  const receipt = checkStorageBudget({ ...readLiveStorageUsage(remote), uploadBytes })
  console.log(JSON.stringify({ storage_budget: receipt, checked_at: new Date().toISOString() }))
  return receipt
}
