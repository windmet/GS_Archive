import assert from 'node:assert/strict'
import { checkStorageBudget } from './lib/upload-storage-budget.mjs'
assert.throws(() => checkStorageBudget({ targetBytes: 9_077_547_776, otherBytes: 439_415_133, uploadBytes: 202_599_949 }), /Preview budget exceeded/)
assert.throws(() => checkStorageBudget({ targetBytes: 8_000_000_000, otherBytes: 2_000_000_001, uploadBytes: 0 }), /Account budget exceeded/)
assert.equal(checkStorageBudget({ targetBytes: 7_000_000_000, otherBytes: 439_415_133, uploadBytes: 100_000_000 }).reservedOtherBytes, 880_000_000)
assert.throws(() => checkStorageBudget({ targetBytes: NaN, otherBytes: 0, uploadBytes: 0 }))
const limit = Math.floor(8.3 * 2 ** 30)
assert.equal(checkStorageBudget({ targetBytes: limit - 1, otherBytes: 0, uploadBytes: 1 }).projectedTarget, limit)
assert.throws(() => checkStorageBudget({ targetBytes: limit, otherBytes: 0, uploadBytes: 1 }), /Preview budget exceeded/)
console.log('Storage budget verified: decimal account limit, binary Preview limit, reserve floor, fail closed')
