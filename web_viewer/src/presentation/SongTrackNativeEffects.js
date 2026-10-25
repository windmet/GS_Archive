import nativeEffects from '../../config/song-track-native-effects.v1.json' with { type: 'json' }
import flickMotion from '../../config/song-flick-motion.v1.json' with { type: 'json' }
import nativeNotes from '../../config/song-track-native-note-geometry.v1.json' with { type: 'json' }
import nativeGeometry from '../../config/song-track-native-geometry.v1.json' with { type: 'json' }
import { nativeSongNoteIsHold } from './SongTrackNativeNoteTypes.js'
import { songTrackNoteTime } from './SongTrackNativeTiming.js'
import { songTrackNativePoint } from './SongTrackNativeProjection.js'
import { buildNativeSongNoteQuad } from './SongTrackNativeNoteGeometry.js'
import { noteRendering } from './SongNotePresentation.js'

const f = Math.fround
export { nativeEffects }

// GetEffectPointInfoByNoteSerialNo + NoteEffectManager.LateUpdate, normal mode.
// Input scheduling and the ParticleSystem's internal simulation are separate.
export function nativeSongEffectRoot(note, current, hit, tail, lead, target, noteSize = 100) {
  const held = nativeSongNoteIsHold(note)
  const variable = note.type === 'VARIABLE_HOLD' || note.type === 'LARGE_VARIABLE_HOLD'
  const lane = held ? (variable ? note.poly?.at(-1)?.posx : note.end) : note.start
  const time = songTrackNoteTime(current, held ? tail : hit, lead, note.speed ?? 1)
  const point = songTrackNativePoint(f(lane), -time, target)
  const t = f(Math.max(0, Math.min(1, time + 1)))
  const rate = f(f(1.8) + f(f(1 - f(1.8)) * t))
  const effectScale = held && time < -1 ? 0 : f(point.scale * rate)
  const scale = f(effectScale * f(f(noteSize) / 100))
  return { position: [point.x, point.y, point.z], scale: [scale, scale, scale],
    pointInfo: [point.x, point.y, point.z, effectScale] }
}

// Authored emitter origins and outline/fill sizes from default prefab set 2.
// These are static direction indicators, not snapshots of living particles.
export function songStaticFlickHint(role, root, viewport = nativeGeometry.viewport) {
  const layout = nativeEffects.layouts[role]
  if (!layout) return null
  const layers = layout.map(layer => {
    const cx = f(root.position[0] + f(layer.offset.x * root.scale[0]))
    const cy = f(root.position[1] + f(layer.offset.y * root.scale[1]))
    return { url: layer.url, color: layer.color,
      sortingOrder:flickMotion.layers[role].find(source=>source.nodeId===layer.particlePathId).sortingOrder,
      cx: viewport.width / 2 + cx, cy: viewport.height / 2 - cy,
      width: Math.abs(f(layer.authoredSize.x * root.scale[0])),
      height: Math.abs(f(layer.authoredSize.y * root.scale[1])),
      rotation: -layer.rotation * 180 / Math.PI }
  })
  return { defaultIndex: nativeEffects.defaultIndex, layers:layers.sort((a,b)=>a.sortingOrder-b.sortingOrder) }
}

// The long chart remains a schematic. Scale the same authored marker to its
// 30-unit note width; this is a Web adapter, not the game's camera or clock.
export function songChartStaticFlickHint(role, x, y, width, skin) {
  if (!nativeEffects.layouts[role]) return null
  const sprite = nativeNotes.skins[skin].normal
  const quad = buildNativeSongNoteQuad({ lane: 2, fraction: 0,
    textureWidth: sprite.textureWidth, textureHeight: sprite.textureHeight,
    target: nativeGeometry.target })
  const bounds = noteRendering.skins[skin].normal.displayBounds
  const visibleWidth = quad.width * (bounds[2] - bounds[0]) / (sprite.uv.right - sprite.uv.left)
  const scale = width / visibleWidth
  return songStaticFlickHint(role, { position: [x, -y, 0], scale: [scale, scale, scale] }, { width: 0, height: 0 })
}
