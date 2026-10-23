import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildNativeSongNoteQuad } from '../src/presentation/SongTrackNativeNoteGeometry.js'
import { songNoteRole, songHoldMiddleNodes } from '../src/presentation/SongNotePresentation.js'
import { songTrackNoteImage } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-note-geometry.json', import.meta.url)))
const spec = JSON.parse(readFileSync(new URL('../config/song-track-native-note-geometry.v1.json', import.meta.url)))
assert.deepEqual(spec.source, fixture.source)
let maximumError = 0
function checkNative(build) {
  for (const sample of fixture.cases) {
    const quad = build({ ...sample, target: fixture.target })
    for (let i = 0; i < 4; i++) for (const [j, axis] of ['x', 'y', 'z'].entries()) {
      const error = Math.abs(quad.vertices[i][axis] - sample.vertices[i][j])
      maximumError = Math.max(maximumError, error)
      assert.ok(error <= .0001, `native quad ${axis} vertex ${i}, lane ${sample.lane}, fraction ${sample.fraction}, size ${sample.textureWidth}: ${error}`)
    }
  }
}
checkNative(buildNativeSongNoteQuad)
const nativeError = maximumError
for (const [type, role] of Object.entries(spec.source.roles)) {
  if (type === 'HOLD_MIDDLE') {
    const node = songHoldMiddleNodes({ notes: [{ sourceIndex: 1, tick: 0, duration: 100, type: 'VARIABLE_HOLD',
      poly: [{ subtick: 0, posx: 0 }, { subtick: 50, posx: 2 }, { subtick: 100, posx: 4 }] }] })[0]
    assert.equal(node.role, role, 'middle nodes use their separate preview consumer')
  } else assert.equal(songNoteRole(type), role, `native type/draw/Sprite chain: ${type}`)
}
for (const skin of Object.values(spec.skins)) for (const sprite of Object.values(skin)) {
  assert.ok(sprite.uv.left >= 0 && sprite.uv.right <= sprite.pngWidth)
  assert.ok(sprite.uv.top >= 0 && sprite.uv.bottom <= sprite.pngHeight)
  assert.ok(sprite.textureWidth > 0 && sprite.textureHeight > 0)
}
assert.notEqual(spec.skins.Note3SpriteAtlas.normal.textureWidth, spec.skins.Note3SpriteAtlas.normal.pngWidth,
  'native packed rect fractions must survive extraction')
let maximumAdapterError = 0
for (const [skin, roles] of Object.entries(spec.skins)) for (const [role, sprite] of Object.entries(roles)) {
  for (const lane of [0, 2, 4]) for (const fraction of [0, .5, 1]) {
    const image = songTrackNoteImage(role, skin, lane, fraction)
    assert.equal(image.url, sprite.url)
    assert.equal(image.pngWidth, sprite.pngWidth)
    const { left, right, top, bottom } = sprite.uv
    const uv = [[left, bottom], [left, top], [right, top], [right, bottom]]
    const [a, b, c, d, tx, ty] = image.matrix
    for (let i = 0; i < 4; i++) {
      const [u, v] = uv[i]
      const error = Math.max(Math.abs(a * u + c * v + tx - image.vertices[i].x),
        Math.abs(b * u + d * v + ty - image.vertices[i].y))
      maximumAdapterError = Math.max(maximumAdapterError, error)
      assert.ok(error <= .0002, `native bitmap UV adapter ${skin}/${role}: ${error}`)
    }
  }
}
const source = readFileSync(new URL('../src/presentation/SongTrackNativeNoteGeometry.js', import.meta.url), 'utf8')
const resolved = source.replace('./SongTrackNativeProjection.js', new URL('../src/presentation/SongTrackNativeProjection.js', import.meta.url).href)
for (const [name, mutant] of [
  ['old 148px width', resolved.replace('f(textureWidth / 312) * .5 * noteScale * scaleRate', '(148 / 176) * .5')],
  ['PNG rounded dimensions', resolved.replace('textureWidth = f(textureWidth); textureHeight = f(textureHeight)',
    'textureWidth = Math.round(textureWidth); textureHeight = Math.round(textureHeight)')],
  ['flat rectangle', resolved.replace('vertex(left, -1), vertex(left, 1), vertex(right, 1), vertex(right, -1)',
    'vertex({ ...left, x: left.x + displacement[0] }, -1), vertex({ ...left, x: left.x - displacement[0] }, 1), vertex({ ...right, x: right.x - displacement[0] }, 1), vertex({ ...right, x: right.x + displacement[0] }, -1)')],
]) {
  assert.notEqual(mutant, resolved, `${name} mutation must apply`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
  assert.throws(() => checkNative(module.buildNativeSongNoteQuad), /native quad/, `${name} must fail`)
}
assert.throws(() => buildNativeSongNoteQuad({ lane: 0, fraction: 0, textureWidth: 0, textureHeight: 256 }), /geometry/)
console.log(`Native note geometry: ${fixture.cases.length} ARM64 quads, max error ${nativeError}; 21 Sprite UV adapters max error ${maximumAdapterError}; old width/rounded size/flat rectangle mutations rejected.`)
