import assert from 'node:assert/strict'
import { checkStorageBudget, PREVIEW_BUCKET_LIMIT_BYTES, projectIncrementalUsage } from './lib/upload-storage-budget.mjs'
assert.throws(() => checkStorageBudget({ targetBytes: 9_077_547_776, otherBytes: 439_415_133, uploadBytes: 202_599_949 }), /Preview budget exceeded/)
assert.throws(() => checkStorageBudget({ targetBytes: 8_000_000_000, otherBytes: 2_000_000_001, uploadBytes: 0 }), /Account budget exceeded/)
assert.equal(checkStorageBudget({ targetBytes: 7_000_000_000, otherBytes: 439_415_133, uploadBytes: 100_000_000 }).reservedOtherBytes, 880_000_000)
assert.throws(() => checkStorageBudget({ targetBytes: NaN, otherBytes: 0, uploadBytes: 0 }))
const limit = PREVIEW_BUCKET_LIMIT_BYTES
assert.equal(checkStorageBudget({ targetBytes: limit - 2, otherBytes: 0, uploadBytes: 1 }).projectedTarget, limit - 1)
assert.throws(() => checkStorageBudget({ targetBytes: limit - 1, otherBytes: 0, uploadBytes: 1 }), /Preview budget exceeded/)
assert.throws(() => checkStorageBudget({ targetBytes: limit, otherBytes: 0, uploadBytes: 1 }), /Preview budget exceeded/)
const remote = [{Path:'old-orphan',Size:100}, {Path:'shrink',Size:90}, {Path:'grow',Size:30}]
const staged = [{object_key:'shrink',deployed_size:40}, {object_key:'grow',deployed_size:50}, {object_key:'versions/new/data/x.json',deployed_size:60}]
assert.deepEqual(projectIncrementalUsage(staged,remote), {targetBytes:220,netDelta:30,positiveDelta:80,projectedBytes:250,conservativePeakBytes:300})
assert.throws(() => projectIncrementalUsage([...staged,staged[0]],remote), /Duplicate staged/)
assert.throws(() => projectIncrementalUsage(staged,[...remote,remote[0]]), /Duplicate remote/)
assert.throws(() => projectIncrementalUsage([{object_key:'bad',deployed_size:-1}],remote))
// Shrinking an object must not grant room before the growing objects arrive.
assert.throws(() => checkStorageBudget({targetBytes:limit-50,otherBytes:0,uploadBytes:projectIncrementalUsage(staged,remote).positiveDelta}), /Preview budget exceeded/)
console.log('Storage budget verified: strict decimal 8.6 GB Preview limit, account reserve floor, fail closed')
