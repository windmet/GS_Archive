import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { nativeSongEffectRoot, songStaticFlickHint, nativeEffects } from '../src/presentation/SongTrackNativeEffects.js'
import { buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-effects.json', import.meta.url)))
const rendering = JSON.parse(readFileSync(new URL('../config/song-note-rendering.v1.json', import.meta.url)))
const typeNames = new Map(rendering.nativeEnums.EventNoteType.values.map(e => [e.value, e.name]))
function noteFor(c) {
  const type = typeNames.get(c.noteType)
  return { type, start: c.startLane, end: c.endLane, speed: c.speed,
    ...(['VARIABLE_HOLD', 'LARGE_VARIABLE_HOLD'].includes(type) ? { poly: [{ posx: c.startLane }, { posx: c.endLane }] } : {}) }
}
function checkNative(rootFn) {
  for (const c of fixture.cases) {
    const root = rootFn(noteFor(c), c.current, c.hit, c.tail, c.lead, fixture.target, c.noteSize)
    assert.deepEqual(root.pointInfo, c.pointInfo, 'native effect PointInfo')
    assert.deepEqual(root.position, c.transform.position, 'native effect position')
    assert.deepEqual(root.scale, c.transform.scale, 'native effect scale')
  }
}
checkNative(nativeSongEffectRoot)
function checkCenters(hintFn) {
  for (const c of fixture.cases) {
    const root = nativeSongEffectRoot(noteFor(c), c.current, c.hit, c.tail, c.lead, fixture.target, c.noteSize)
    for (const role of Object.keys(nativeEffects.layouts)) {
      const hint = hintFn(role, root, { width: 0, height: 0 })
      const [x, y] = c.staticEmitterCenters[role]
      for (const layer of hint.layers) {
        assert.equal(layer.cx, x, 'native emitter X')
        assert.equal(layer.cy, -y, 'native emitter Y')
      }
    }
  }
}
checkCenters(songStaticFlickHint)
for (const [url, asset] of Object.entries(nativeEffects.assets)) {
  const data = readFileSync(new URL('../public' + url, import.meta.url))
  assert.equal(data.length, asset.bytes)
  assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256)
}
function checkAuthoredSizes(hintFn) {
  for (const [role, layers] of Object.entries(nativeEffects.layouts)) {
    const hint = hintFn(role, { position: [0,0,0], scale: [1,1,1] })
    for (let i = 0; i < layers.length; i++) {
      assert.equal(hint.layers[i].width, layers[i].authoredSize.x, 'native authored emitter size')
      assert.equal(hint.layers[i].height, layers[i].authoredSize.y, 'native authored emitter height')
    }
  }
}
checkAuthoredSizes(songStaticFlickHint)
const sourceUrl = new URL('../src/presentation/SongTrackNativeEffects.js', import.meta.url)
const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_, p) => `from '${new URL(p, sourceUrl).href}'`)
for (const [name, oldText, replacement, check, fn] of [
  ['head clock for holds', 'held ? tail : hit', 'hit', checkNative, 'nativeSongEffectRoot'],
  ['missing pre-window hold suppression', 'held && time < -1 ? 0 :', 'false ? 0 :', checkNative, 'nativeSongEffectRoot'],
  ['raw projection scale', 'f(point.scale * rate)', 'point.scale', checkNative, 'nativeSongEffectRoot'],
  ['old sideways 148*.57 offset', 'layer.offset.x * root.scale[0]', '148 * .57 * root.scale[0]', checkCenters, 'songStaticFlickHint'],
  ['old 148*.65/.28 width', 'Math.abs(f(layer.authoredSize.x * root.scale[0]))', "148 * (role === 'swipe_up' ? .65 : .28) * root.scale[0]", checkAuthoredSizes, 'songStaticFlickHint'],
  ['old up 1.12 offset', 'layer.offset.y * root.scale[1]', 'layer.offset.y * 1.12 * root.scale[1]', checkCenters, 'songStaticFlickHint'],
]) {
  const mutant = source.replace(oldText, replacement)
  assert.notEqual(mutant, source, `${name}: mutation applied`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
  assert.throws(() => check(module[fn]), /native effect|native emitter|native authored/, `${name} must fail`)
}
// Each actual static marker retains the whole cell; alpha trimming cannot set
// the authored quad width. The original .65/.28 values must not determine it.
for (const [role, layers] of Object.entries(nativeEffects.layouts)) {
  const hint = songStaticFlickHint(role, { position: [0,0,0], scale: [1,1,1] })
  for (let i = 0; i < layers.length; i++) {
    assert.equal(hint.layers[i].width, layers[i].authoredSize.x)
    assert.notEqual(hint.layers[i].width, 148 * (role === 'swipe_up' ? .65 : .28))
  }
}
const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
let charts = 0, markers = 0
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), root)))
  const first = chart.notes.find(n => n.type.startsWith('FLICK_') || n.endtype?.startsWith('END_FLICK_'))
  if (first) {
    const scene = buildSongTrackGeometry(chart, first.tick, 6000)
    for (const glyph of scene.glyphs) {
      if (!glyph.role.startsWith('swipe_')) continue
      assert.ok(glyph.hint)
      assert.equal(glyph.hint.defaultIndex, 2)
      assert.equal(glyph.hint.layers.length, 6)
      assert.equal(glyph.hint.presentation, 'native-loop-sampler')
      for (const layer of glyph.hint.layers) assert.ok([layer.cx,layer.cy,layer.width,layer.height].every(Number.isFinite))
      markers++
    }
  }
  charts++
}
console.log(`Native effect roots: ${fixture.cases.length} ARM64 PointInfo/Transform cases, 486 Matrix4x4 emitter centers; old clock/scale/offset mutations rejected. Animated default-2 consumer markers: ${charts} charts/${markers} consumer glyphs, four PNG hashes; motion and loop sampler have their own regression; Unity GPU parity remains separate.`)
