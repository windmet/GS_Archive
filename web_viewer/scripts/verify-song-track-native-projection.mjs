import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { songTrackNativePoint } from '../src/presentation/SongTrackNativeProjection.js'
import { projectTrackPoint, buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-projection.json', import.meta.url)))
const geometry = JSON.parse(readFileSync(new URL('../config/song-track-native-geometry.v1.json', import.meta.url)))
assert.deepEqual(geometry.source, fixture.source)
assert.equal(geometry.source.normalWidth.record.value, 1000)
assert.equal(geometry.source.normalWidth.divisor, 1000)
assert.equal(geometry.target.laneWidthRate, geometry.source.normalWidth.rate)
assert.equal(geometry.source.serializedPanel.camera.orthographic, true)
let maximumError = 0
function checkNative(project) {
  for (const test of fixture.cases) {
    const actual = project(test.lane, test.fraction, test.target)
    for (const axis of ['x', 'y', 'z', 'scale']) {
      const error = Math.abs(actual[axis] - test.result[axis])
      maximumError = Math.max(maximumError, error)
      assert.ok(error <= 0.00004, `native ${axis}: lane ${test.lane}, fraction ${test.fraction}: ${actual[axis]} != ${test.result[axis]}`)
    }
  }
}
checkNative(songTrackNativePoint)
const nativeError = maximumError
for (const test of fixture.cases.filter(c => c.target.y === geometry.target.y && c.target.laneWidthRate === geometry.target.laneWidthRate)) {
  const actual = projectTrackPoint(test.lane, test.fraction)
  assert.equal(actual.x, geometry.viewport.width / 2 + test.result.x)
  assert.equal(actual.y, geometry.viewport.height / 2 - test.result.y)
  assert.equal(actual.z, test.result.z)
  assert.equal(actual.scale, test.result.scale)
}
const scene = buildSongTrackGeometry({ notes: [] })
assert.equal(scene.topY, 0)
assert.equal(scene.judgeY, geometry.viewport.height / 2 - geometry.target.y)
assert.equal(scene.lanes[0].topX, 629.5)
assert.deepEqual(scene.judges.map(p => p.x), [288, 464, 640, 816, 992])
const source = readFileSync(new URL('../src/presentation/SongTrackNativeProjection.js', import.meta.url), 'utf8')
const mutants = [
  ['old depthRatio=2', source.replace('const depth = nativeTrackDepth(fraction)', 'const depth = (1 - fraction) / (1 + fraction)')],
  ['old topY=8', source.replace('y: lerp(360, target.y, depth)', 'y: lerp(352, target.y, depth)')],
  ['old judgeY=570', source.replace('y: lerp(360, target.y, depth)', 'y: lerp(360, -210, depth)')],
]
for (const [name, mutant] of mutants) {
  assert.notEqual(mutant, source, `${name} mutation must apply`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
  assert.throws(() => checkNative(module.songTrackNativePoint), /native/, `${name} must fail`)
}
assert.throws(() => songTrackNativePoint(NaN, 0, geometry.target), /point/)
console.log(`Native projection: ${fixture.cases.length} ARM64 coordinate cases, max error ${nativeError}; old depth/top/judge mutations rejected. Full mesh/GPU equivalence remains open.`)
