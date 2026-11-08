const MAX_VERTICES = 65536
const FLOATS_PER_VERTEX = 4

// WebGL1 uses 16-bit indices. Preserve mesh and triangle order for alpha blending.
export function createSongHoldMeshBatch(gl, vertexBuffer, indexBuffer) {
  let vertices = new Float32Array(0), indices = new Uint16Array(0)
  let vertexCapacity = 0, indexCapacity = 0
  let vertexCount = 0, indexCount = 0

  function reserve(nextVertices, nextIndices) {
    const floats = nextVertices * FLOATS_PER_VERTEX
    if (floats > vertices.length) {
      const grown = new Float32Array(Math.min(MAX_VERTICES * FLOATS_PER_VERTEX, Math.max(floats, vertices.length * 2, 1024)))
      grown.set(vertices)
      vertices = grown
    }
    if (nextIndices > indices.length) {
      const grown = new Uint16Array(Math.max(nextIndices, indices.length * 2, 1024))
      grown.set(indices)
      indices = grown
    }
  }

  function appendVertex(mesh, sourceIndex) {
    const offset = vertexCount++ * FLOATS_PER_VERTEX
    const point = mesh.vertices[sourceIndex], uv = mesh.uv[sourceIndex]
    vertices[offset] = point.x
    vertices[offset + 1] = point.y
    vertices[offset + 2] = uv[0]
    vertices[offset + 3] = uv[1]
  }

  function flush(stats) {
    if (!indexCount) {
      vertexCount = 0
      return
    }
    const vertexData = vertices.subarray(0, vertexCount * FLOATS_PER_VERTEX)
    const indexData = indices.subarray(0, indexCount)
    if (vertexCapacity < vertices.byteLength) {
      vertexCapacity = vertices.byteLength
      gl.bufferData(gl.ARRAY_BUFFER, vertexCapacity, gl.DYNAMIC_DRAW)
    }
    if (indexCapacity < indices.byteLength) {
      indexCapacity = indices.byteLength
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexCapacity, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indexData)
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0)
    if (stats) {
      stats.bytes += vertexData.byteLength + indexData.byteLength
      stats.draws++
    }
    vertexCount = indexCount = 0
  }

  return function draw(holds, stats) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    for (const { nativeMesh: mesh } of holds) {
      if (!mesh.triangles.length) continue
      if (mesh.vertices.length > MAX_VERTICES) {
        // Unusual oversized mesh: duplicate triangle corners within each chunk
        // so every index stays local, including triangles that span a boundary.
        for (let i = 0; i < mesh.triangles.length; i += 3) {
          if (vertexCount + 3 > MAX_VERTICES) flush(stats)
          reserve(vertexCount + 3, indexCount + 3)
          for (let corner = 0; corner < 3; corner++) {
            indices[indexCount++] = vertexCount
            appendVertex(mesh, mesh.triangles[i + corner])
          }
        }
        continue
      }
      if (vertexCount + mesh.vertices.length > MAX_VERTICES) flush(stats)
      reserve(vertexCount + mesh.vertices.length, indexCount + mesh.triangles.length)
      const base = vertexCount
      for (let i = 0; i < mesh.vertices.length; i++) appendVertex(mesh, i)
      for (const index of mesh.triangles) indices[indexCount++] = base + index
    }
    flush(stats)
  }
}
