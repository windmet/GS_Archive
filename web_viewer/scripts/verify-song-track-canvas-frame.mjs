import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSongTrackRenderer, songTextureTriangle } from '../src/presentation/SongTrackPresentation.js'
import { createSongTrackCanvasFrameBuilder, FLOATS_PER_VERTEX, JUDGE_BAND_HALF_HEIGHT, TRACK_TEXTURES } from '../src/presentation/SongTrackCanvasFrame.js'
import nativeHolds from '../config/song-track-native-hold-geometry.v1.json' with { type: 'json' }
import nativeNotes from '../config/song-track-native-note-geometry.v1.json' with { type: 'json' }

// The WebGL track frame must put every part exactly where the native geometry (and the SVG fallback) puts it,
// in the SVG paint order, so that moving all parts into one surface changes when they are presented, not where.
const data = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', data)))
const build = createSongTrackCanvasFrameBuilder()
const near = (a, b, label, tolerance = 1e-3) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`)
const point = (frame, i) => { const o = i * FLOATS_PER_VERTEX; return { x: frame.data[o], y: frame.data[o + 1], u: frame.data[o + 2], v: frame.data[o + 3], a: frame.data[o + 7] } }

// Walks the frame in paint order and checks each part against the scene it was built from.
function checkFrame(scene, frame, { skin, laneAlphas }) {
  let at = 0
  const runAt = vertex => frame.runs.find(r => vertex >= r.first && vertex < r.first + r.count)
  const take = (count, texture, blend, label) => {
    const run = runAt(at)
    assert.ok(run && run.texture === texture && run.blend === blend, `${label}: drawn with ${run?.texture}/${run?.blend}, expected ${texture}/${blend}`)
    assert.ok(at + count <= run.first + run.count, `${label}: crosses a texture run`)
    const points = Array.from({ length: count }, (_, i) => point(frame, at + i))
    at += count
    return points
  }
  // Quads are emitted as triangles [0,2,1,1,2,3] over corners TL, TR, BL, BR.
  const corners = q => [q[0], q[2], q[1], q[5]]
  const background = corners(take(6, TRACK_TEXTURES.background, 'normal', 'background'))
  assert.deepEqual(background.map(p => [p.x, p.y]), [[0, 0], [scene.width, 0], [0, scene.height], [scene.width, scene.height]])
  for (let i = 0; i < 5; i++) if (laneAlphas?.[i] > 0) {
    const [tl, tr, bl, br] = corners(take(6, TRACK_TEXTURES.white, 'normal', `lane flash ${i}`))
    const l = scene.lanes[i], r = scene.lanes[i + 1]
    for (const [p, x, y] of [[tl, l.topX, scene.topY], [tr, r.topX, scene.topY], [bl, l.bottomX, scene.height], [br, r.bottomX, scene.height]]) { near(p.x, x, 'flash x'); near(p.y, y, 'flash y') }
  }
  for (const hold of scene.holds) {
    const mesh = take(hold.nativeMesh.triangles.length, nativeHolds.skins[skin].url, 'normal', `hold ${hold.id}`)
    // The SVG fallback maps the 200px hold texture through one matrix per triangle; applied to the canvas
    // vertex's texture coordinate, that matrix must land on the canvas vertex.
    const fallback = hold.triangles
    let t = 0
    for (let i = 0; i < mesh.length; i += 3) {
      const corners = mesh.slice(i, i + 3)
      if (!songTextureTriangle(corners, corners.map(p => ({ x: p.u * 200, y: p.v * 200 })))) continue
      const [a, b, c, d, e, f] = fallback[t++].matrix.match(/-?[\d.e+-]+/g).map(Number)
      for (const p of corners) {
        near(a * p.u * 200 + c * p.v * 200 + e, p.x, `hold ${hold.id} x`, .05)
        near(b * p.u * 200 + d * p.v * 200 + f, p.y, `hold ${hold.id} y`, .05)
      }
    }
    assert.equal(t, fallback.length, `hold ${hold.id} triangle count`)
  }
  for (const link of scene.links) {
    const [tl, tr, bl, br] = corners(take(6, TRACK_TEXTURES.white, 'normal', `link ${link.id}`))
    near((tl.x + bl.x) / 2, link.a.x, 'link start x'); near((tl.y + bl.y) / 2, link.a.y, 'link start y')
    near((tr.x + br.x) / 2, link.b.x, 'link end x'); near((tr.y + br.y) / 2, link.b.y, 'link end y')
    near(Math.hypot(tl.x - bl.x, tl.y - bl.y), Math.max(.5, 2 * link.a.scale), 'link width')
  }
  // A sprite's atlas rectangle must land on the native quad: bottom-left, top-left, top-right, bottom-right.
  const sprite = (image, role, label) => {
    const [tl, tr, bl, br] = corners(take(6, image.url, 'normal', label))
    const { left, right, top, bottom } = nativeNotes.skins[skin][role].uv
    const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
    const at = (u, v) => lerp(lerp(tl, tr, u), lerp(bl, br, u), v)
    const [nativeBottomLeft, nativeTopLeft, nativeTopRight] = image.vertices
    const w = image.pngWidth, h = image.pngHeight
    for (const [expected, u, v] of [[nativeTopLeft, left / w, top / h], [nativeTopRight, right / w, top / h], [nativeBottomLeft, left / w, bottom / h]]) {
      const p = at(u, v)
      near(p.x, expected.x, `${label} x`, .01); near(p.y, expected.y, `${label} y`, .01)
    }
  }
  for (const node of scene.middleNodes) sprite(node.image, node.role, `middle ${node.id}`)
  const [jt, , jb] = corners(take(6, TRACK_TEXTURES.judge, 'normal', 'judgement band'))
  near(jt.y, scene.judgeY - JUDGE_BAND_HALF_HEIGHT, 'judge band top'); near(jb.y, scene.judgeY + JUDGE_BAND_HALF_HEIGHT, 'judge band bottom')
  let layers = 0
  for (const glyph of scene.glyphs) {
    sprite(glyph.image, glyph.role, `note ${glyph.sourceIndex}`)
    for (const layer of glyph.hint?.layers || []) {
      if (!(layer.width > 0 && layer.height > 0)) continue
      const quad = corners(take(6, layer.url, layer.blendMode === 'lighter' ? 'additive' : 'normal', `hint of ${glyph.sourceIndex}`))
      near(quad.reduce((s, p) => s + p.x, 0) / 4, layer.cx, 'hint centre x'); near(quad.reduce((s, p) => s + p.y, 0) / 4, layer.cy, 'hint centre y')
      near(Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y), layer.width, 'hint width')
      near(quad[0].a, (layer.alpha ?? 1) * (layer.color?.a ?? 1), 'hint alpha', 1e-6)
      layers++
    }
  }
  assert.equal(at, frame.vertexCount, 'frame holds exactly the scene parts')
  return layers
}

let charts = 0, frames = 0, notes = 0, holds = 0, links = 0, middles = 0, hints = 0
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), data)))
  const render = createSongTrackRenderer(chart)
  const ticks = [0, ...chart.notes.filter(n => n.duration > 0).slice(0, 6).map(n => n.tick + n.duration / 2), chart.maxTick / 2]
  for (const [i, tick] of ticks.entries()) {
    const skin = ['Note1SpriteAtlas', 'Note2SpriteAtlas', 'Note3SpriteAtlas'][i % 3]
    const laneAlphas = i % 2 ? [0, .5, 0, 1, .25] : null
    const scene = render(Math.round(tick), 4800, skin)
    const frame = build(scene, { skin, laneAlphas })
    hints += checkFrame(scene, frame, { skin, laneAlphas })
    notes += scene.glyphs.length; holds += scene.holds.length; links += scene.links.length; middles += scene.middleNodes.length
    frames++
  }
  charts++
}
assert.ok(notes > 1000 && holds > 100 && links > 100 && middles > 10 && hints > 100, `the corpus exercises every part: ${notes}/${holds}/${links}/${middles}/${hints}`)

// The checks must catch a part that moved or changed paint order.
{
  const chart = JSON.parse(readFileSync(new URL('song_charts/ldyrdm-4.json', data)))
  const hold = chart.notes.find(n => n.duration > 0)
  const skin = 'Note1SpriteAtlas', scene = createSongTrackRenderer(chart)(hold.tick, 4800, skin)
  assert.ok(scene.holds.length && scene.links.length, 'mutation scene has holds and links')
  const holdVertices = (frame, change) => {
    const run = frame.runs.find(r => r.texture === nativeHolds.skins[skin].url)
    for (let i = run.first; i < run.first + run.count; i++) change(i * FLOATS_PER_VERTEX)
  }
  const mutations = {
    'hold drawn one pixel low': frame => holdVertices(frame, o => { frame.data[o + 1] += 1 }),
    'hold V not flipped': frame => holdVertices(frame, o => { frame.data[o + 3] = 1 - frame.data[o + 3] }),
    'notes painted under the judgement band': frame => { const [a, b] = [frame.runs.at(-1), frame.runs.find(r => r.texture === TRACK_TEXTURES.judge)]; [a.texture, b.texture] = [b.texture, a.texture] },
    'note sprite shifted': frame => { const r = frame.runs.findLast(r => r.texture === scene.glyphs.at(-1).image.url); frame.data[r.first * FLOATS_PER_VERTEX] += .5 },
  }
  for (const [name, mutate] of Object.entries(mutations)) {
    const frame = build(scene, { skin })
    const copy = { ...frame, data: frame.data.slice(), runs: frame.runs.map(r => ({ ...r })) }
    mutate(copy)
    assert.throws(() => checkFrame(scene, copy, { skin }), undefined, `mutation not detected: ${name}`)
  }
}

// Canvas mode replaces the moving SVG layers; they render only as the fallback.
const vue = readFileSync(new URL('../src/components/archive/ArchiveSongTrackPreview.vue', import.meta.url), 'utf8')
const canvasTag = vue.indexOf('<ArchiveSongTrackCanvas'), fallback = vue.indexOf('<template v-else>', canvasTag)
assert.ok(canvasTag > 0 && /v-if="canvasMode"/.test(vue.slice(canvasTag, fallback)), 'track canvas is the primary layer')
const fallbackEnd = vue.indexOf('</template>', vue.indexOf('<ArchiveSongHitEffectPreview'))
for (const marker of ['data-track-note', 'data-hold-middle', 'data-simultaneous-tick', '<ArchiveSongHoldMeshPreview', '<ArchiveSongHitEffectPreview']) {
  const index = vue.indexOf(marker)
  assert.ok(index > fallback && index < fallbackEnd, `${marker} renders only in the SVG fallback`)
}
console.log(`Track canvas frame: ${charts} charts / ${frames} frames; ${notes} notes, ${holds} holds, ${links} links, ${middles} middle nodes, ${hints} hint layers land on native geometry in SVG paint order; 4 mutations detected`)
