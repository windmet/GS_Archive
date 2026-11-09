import nativeHolds from '../../config/song-track-native-hold-geometry.v1.json' with { type: 'json' }

// One track frame as textured triangles in the 1280x720 scene plane, in the SVG layers' paint order:
// background, lane flashes, holds and flick connectors, simultaneous links, middle nodes, the judgement
// band, then each note body followed by its direction-hint layers. Everything that moves is drawn into
// one WebGL surface, so a note, its hold and its link can never be presented from different frames.
export const FLOATS_PER_VERTEX = 8 // x, y, u, v, premultiplied r, g, b, a
export const JUDGE_BAND_HALF_HEIGHT = 24
export const TRACK_TEXTURES = { background: 'track:background', judge: 'track:judge', white: 'track:white' }
const LINK_RGB = [233 / 255, 250 / 255, 246 / 255], LINK_ALPHA = .8
const FLASH_RGB = [132 / 255, 232 / 255, 255 / 255], FLASH_ALPHA = .28
const WHITE = { r: 1, g: 1, b: 1, a: 1 }

export function createSongTrackCanvasFrameBuilder() {
  let data = new Float32Array(8192), vertexCount = 0, runs = []

  function reserve(vertices) {
    const needed = (vertexCount + vertices) * FLOATS_PER_VERTEX
    if (needed <= data.length) return
    const grown = new Float32Array(Math.max(needed, data.length * 2))
    grown.set(data.subarray(0, vertexCount * FLOATS_PER_VERTEX))
    data = grown
  }
  function run(texture, blend, vertices) {
    const last = runs.at(-1)
    if (last && last.texture === texture && last.blend === blend) last.count += vertices
    else runs.push({ texture, blend, first: vertexCount, count: vertices })
  }
  function vertex(x, y, u, v, r, g, b, a) {
    const o = vertexCount++ * FLOATS_PER_VERTEX
    data[o] = x; data[o + 1] = y; data[o + 2] = u; data[o + 3] = v
    data[o + 4] = r * a; data[o + 5] = g * a; data[o + 6] = b * a; data[o + 7] = a
  }
  // Corners in order top-left, top-right, bottom-left, bottom-right; UVs follow the same corners.
  function quad(texture, blend, corners, color, uv = [0, 0, 1, 1]) {
    reserve(6)
    run(texture, blend, 6)
    const [u0, v0, u1, v1] = uv, { r, g, b, a } = color
    const at = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]
    for (const i of [0, 2, 1, 1, 2, 3]) vertex(corners[i][0], corners[i][1], at[i][0], at[i][1], r, g, b, a)
  }
  const affine = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f]
  // The whole PNG through the note's affine matrix, as the unclipped SVG <image> draws it.
  function sprite(image) {
    const w = image.pngWidth, h = image.pngHeight, m = image.matrix
    quad(image.url, 'normal', [affine(m, 0, 0), affine(m, w, 0), affine(m, 0, h), affine(m, w, h)], WHITE)
  }
  // SVG: rotate(rotation cx cy) around an x/y/width/height image, tinted by feColorMatrix and opacity.
  function hintLayer(layer) {
    if (!(layer.width > 0 && layer.height > 0)) return // SVG renders nothing for a non-positive size
    const angle = (layer.rotation || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
    const hw = layer.width / 2, hh = layer.height / 2
    const corner = (dx, dy) => [layer.cx + dx * cos - dy * sin, layer.cy + dx * sin + dy * cos]
    const c = layer.color || WHITE, alpha = (layer.alpha ?? 1) * (c.a ?? 1)
    quad(layer.url, layer.blendMode === 'lighter' ? 'additive' : 'normal',
      [corner(-hw, -hh), corner(hw, -hh), corner(-hw, hh), corner(hw, hh)], { r: c.r, g: c.g, b: c.b, a: alpha })
  }
  function line(a, b, width, rgb, alpha) {
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
    if (!length) return
    const nx = -dy / length * width / 2, ny = dx / length * width / 2
    quad(TRACK_TEXTURES.white, 'normal', [[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [a.x - nx, a.y - ny], [b.x - nx, b.y - ny]],
      { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha })
  }
  // Native meshes are centred with Y up and a bottom-up V (the old canvas uploaded with UNPACK_FLIP_Y).
  function mesh(texture, nativeMesh) {
    const { vertices, uv, triangles } = nativeMesh
    if (!triangles.length) return
    reserve(triangles.length)
    run(texture, 'normal', triangles.length)
    for (const index of triangles) {
      const p = vertices[index], t = uv[index]
      vertex(640 + p.x, 360 - p.y, t[0], 1 - t[1], 1, 1, 1, 1)
    }
  }

  return function build(scene, { skin, laneAlphas = null } = {}) {
    vertexCount = 0
    runs = []
    const { width, height } = scene
    quad(TRACK_TEXTURES.background, 'normal', [[0, 0], [width, 0], [0, height], [width, height]], WHITE)
    if (laneAlphas?.some(a => a > 0)) for (let i = 0; i < 5; i++) {
      if (!(laneAlphas[i] > 0)) continue
      const l = scene.lanes[i], r = scene.lanes[i + 1]
      quad(TRACK_TEXTURES.white, 'normal', [[l.topX, scene.topY], [r.topX, scene.topY], [l.bottomX, height], [r.bottomX, height]],
        { r: FLASH_RGB[0], g: FLASH_RGB[1], b: FLASH_RGB[2], a: laneAlphas[i] * FLASH_ALPHA })
    }
    const holdTexture = nativeHolds.skins[skin].url
    for (const hold of scene.holds) mesh(holdTexture, hold.nativeMesh)
    for (const link of scene.links) line(link.a, link.b, Math.max(.5, 2 * link.a.scale), LINK_RGB, LINK_ALPHA)
    for (const node of scene.middleNodes) sprite(node.image)
    quad(TRACK_TEXTURES.judge, 'normal', [[0, scene.judgeY - JUDGE_BAND_HALF_HEIGHT], [width, scene.judgeY - JUDGE_BAND_HALF_HEIGHT],
      [0, scene.judgeY + JUDGE_BAND_HALF_HEIGHT], [width, scene.judgeY + JUDGE_BAND_HALF_HEIGHT]], WHITE)
    for (const glyph of scene.glyphs) {
      sprite(glyph.image)
      for (const layer of glyph.hint?.layers || []) hintLayer(layer)
    }
    return { data: data.subarray(0, vertexCount * FLOATS_PER_VERTEX), runs, vertexCount }
  }
}
