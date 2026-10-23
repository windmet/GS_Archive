import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildNativeSongHoldMesh } from '../src/presentation/SongTrackNativeHoldGeometry.js'
import { buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-hold-geometry.json', import.meta.url)))
const spec = JSON.parse(readFileSync(new URL('../config/song-track-native-hold-geometry.v1.json', import.meta.url)))
assert.deepEqual(spec.source, fixture.source)
assert.deepEqual(spec.metrics, fixture.metrics)
let vertices = 0, maximumError = 0
function checkNative(build) {
  for (const sample of fixture.cases) {
    const mesh = build(sample.points.map(([x, y]) => ({ x, y })), fixture.target, fixture.metrics, sample.drawScale)
    assert.equal(mesh.vertices.length, sample.vertexCount, 'native vertex count')
    const expected = Buffer.from(sample.verticesFloat32LE, 'base64'), uv = Buffer.from(sample.uvFloat32LE, 'base64'), tri = Buffer.from(sample.trianglesUint32LE, 'base64')
    assert.equal(mesh.uv.length * 8, uv.length, 'native UV count')
    assert.equal(mesh.triangles.length * 4, tri.length, 'native index count')
    for (let i = 0; i < mesh.vertices.length; i++) {
      for (const [j, axis] of ['x', 'y', 'z'].entries()) {
        const error = Math.abs(mesh.vertices[i][axis] - expected.readFloatLE((i * 3 + j) * 4))
        maximumError = Math.max(maximumError, error)
        assert.ok(error <= .0001, `native hold vertex ${i}/${axis}: ${error}`)
      }
      for (let j = 0; j < 2; j++) assert.equal(mesh.uv[i][j], uv.readFloatLE((i * 2 + j) * 4), 'native UV')
    }
    for (let i = 0; i < mesh.triangles.length; i++) assert.equal(mesh.triangles[i], tri.readUInt32LE(i * 4), 'native triangle')
    vertices += mesh.vertices.length
  }
}
checkNative(buildNativeSongHoldMesh)
const count = vertices, error = maximumError
for (const skin of Object.values(spec.skins)) {
  const png = readFileSync(new URL('../public' + skin.url, import.meta.url))
  assert.equal(createHash('sha256').update(png).digest('hex'), skin.pngSha256)
}
const source = readFileSync(new URL('../src/presentation/SongTrackNativeHoldGeometry.js', import.meta.url), 'utf8')
const resolved = source.replace('./SongTrackNativeProjection.js', new URL('../src/presentation/SongTrackNativeProjection.js', import.meta.url).href)
for (const [name, mutant] of [
  ['old 148 x .72 width', resolved.replace('f(f(f(metrics.radius / metrics.laneWidth) * 1.5) * f(drawScale))', '(148 * .72) / (176 * 2)')],
  ['old 32 subdivisions', resolved.replace('const count = Math.ceil(', 'const count = 32 + 0 * Math.ceil(')],
  ['tick-like ordinal UV', resolved.replace('f(ratios[i] * .5)', 'f((i / (points.length - 1)) * .5)')],
]) {
  assert.notEqual(mutant, resolved, `${name} must apply`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
  assert.throws(() => checkNative(module.buildNativeSongHoldMesh), /native/, `${name} must fail`)
}
const chart = { notes: [{ sourceIndex: 1, type: 'VARIABLE_HOLD', tick: 100, duration: 1000, start: 0, end: 4,
  poly: [{ subtick: 0, posx: 0 }, { subtick: 500, posx: 2.35 }, { subtick: 1000, posx: 4 }] }] }
const hold = buildSongTrackGeometry(chart, 300, 600).holds[0]
const points = [...hold.samples].reverse().map(p => ({ x: p.lane, y: -p.fraction * spec.metrics.timeFactor }))
assert.deepEqual(hold.nativeMesh, buildNativeSongHoldMesh(points, fixture.target, spec.metrics), 'runtime consumes the same native mesh function')
assert.ok(hold.triangles.length > 100, 'render native subdivisions instead of the old 32-point approximation')
const tempoHold = { offset: 0, maxTick: 5000, tempos: [{ tick: 0, tempo: 120 }, { tick: 960, tempo: 240 }],
  notes: [{ sourceIndex: 1, type: 'VARIABLE_HOLD', tick: 0, duration: 1920, start: 0, end: 4,
    poly: [{ subtick: 0, posx: 0 }, { subtick: 1920, posx: 4 }] }] }
assert.equal(buildSongTrackGeometry(tempoHold, 480, 3000).holds[0].samples[0].lane, 4 / 3,
  'clipped lane interpolates elapsed seconds across a BPM change')
assert.throws(() => buildNativeSongHoldMesh([{ x: 1, y: 0 }], fixture.target, fixture.metrics), /geometry/)
console.log(`Native hold geometry: ${fixture.cases.length} ARM64 cases, ${count} vertices, max error ${error}; exact UV/indices, consumer and old-width/subdivision/ordinal-UV mutations passed.`)
