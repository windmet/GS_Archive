import assert from 'node:assert/strict'
import { createSongHoldMeshBatch } from '../src/presentation/SongHoldMeshBatch.js'

const { ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER } = { ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2 }
const allocations = [], submissions = []
const capacity = new Map(), uploads = new Map()
const gl = {
  ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, DYNAMIC_DRAW: 3, TRIANGLES: 4, UNSIGNED_SHORT: 5,
  bindBuffer() {},
  bufferData(target, bytes) {
    assert.equal(typeof bytes, 'number')
    allocations.push([target, bytes])
    capacity.set(target, bytes)
  },
  bufferSubData(target, offset, data) {
    assert.equal(offset, 0)
    assert.ok(data.byteLength <= capacity.get(target))
    uploads.set(target, data.slice())
  },
  drawElements(primitive, count, indexType, offset) {
    assert.deepEqual([primitive, indexType, offset], [this.TRIANGLES, this.UNSIGNED_SHORT, 0])
    const vertices = uploads.get(ARRAY_BUFFER), indices = uploads.get(ELEMENT_ARRAY_BUFFER)
    assert.equal(count, indices.length)
    assert.ok(indices.every(index => index < vertices.length / 4))
    submissions.push({ vertices, indices })
  },
}

function hold(n, triangles, start = 0) {
  return { nativeMesh: {
    vertices: Array.from({ length: n }, (_, i) => ({ x: start + i, y: -i })),
    uv: Array.from({ length: n }, (_, i) => [i % 2, .25]),
    triangles,
  } }
}
const draw = createSongHoldMeshBatch(gl, {}, {})
const small = [hold(3, [0, 1, 2]), hold(3, [2, 1, 0], 10)]
const stats = { draws: 0, bytes: 0 }
draw(small, stats)
assert.deepEqual(stats, { draws: 1, bytes: 6 * 16 + 6 * 2 })
assert.deepEqual([...submissions.at(-1).indices], [0, 1, 2, 5, 4, 3])
assert.deepEqual([...submissions.at(-1).vertices.slice(12, 16)], [10, -0, 0, .25])
draw([], stats)
assert.equal(submissions.length, 1)
draw(small)
assert.equal(allocations.length, 2, 'steady-state draw should reuse both GPU stores')
assert.equal(submissions.length, 2)

// Exact Uint16 boundary, followed by another mesh that must start a new batch.
draw([hold(65533, [0, 1, 65532]), ...small])
assert.deepEqual([...submissions.at(-2).indices], [0, 1, 65532, 65533, 65534, 65535])
assert.deepEqual([...submissions.at(-1).indices], [2, 1, 0])

// One mesh over the limit with triangles that cross it. Preserve triangle order
// and source vertex/UV association across all submissions.
const triangles = Array.from({ length: 65538 }, (_, i) => 65537 - i)
draw([hold(65538, triangles)])
assert.equal(submissions.at(-2).indices.length, 65535)
assert.equal(submissions.at(-1).indices.length, 3)
assert.deepEqual(submissions.slice(-2).flatMap(({ vertices, indices }) =>
  Array.from(indices, index => vertices[index * 4])), triangles)
console.log('Hold batch: order, index rebasing, buffer reuse and overflow passed')
