import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export function checkStorageBudget({ targetBytes, otherBytes, uploadBytes }) {
  for (const value of [targetBytes, otherBytes, uploadBytes]) assert.ok(Number.isSafeInteger(value) && value >= 0)
  // Keep the documented allowance for other uses even when visible buckets
  // currently use less. GB is decimal; the Preview target is binary GiB.
  const reservedOtherBytes = Math.max(otherBytes, 880_000_000)
  const projectedTarget = targetBytes + uploadBytes
  const projectedAccount = projectedTarget + reservedOtherBytes
  assert.ok(projectedTarget <= Math.floor(8.3 * 2 ** 30), `Preview budget exceeded: ${projectedTarget} B; delete a verified batch first`)
  assert.ok(projectedAccount <= 10_000_000_000, `Account budget exceeded: ${projectedAccount} B`)
  return { targetBytes, otherBytes, reservedOtherBytes, uploadBytes, projectedTarget, projectedAccount }
}

export function verifyLiveUploadBudget(remote, uploadBytes) {
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
  const receipt = checkStorageBudget({ targetBytes, otherBytes, uploadBytes })
  console.log(JSON.stringify({ storage_budget: receipt, checked_at: new Date().toISOString() }))
  return receipt
}
