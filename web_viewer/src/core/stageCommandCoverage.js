import { NEW_SUSPENSIONLIGHT_COMMANDS } from './chibiSuspensionlights.js'

// Registration is evidence of a consumer path, never Unity visual acceptance.
// Exact spellings are deliberate: a new suffix must not inherit support.
const bound = (family, fields, exported, consumer, resources, verification) =>
  ({ family, fields, exported, consumer, resources, verification, status: 'partial' })
const absent = (family, fields = '尚未投影命名字段') =>
  ({ family, fields, exported: null, consumer: null, resources: null, verification: 'RAW census only', status: 'missing' })

export const STAGE_COMMAND_BINDINGS = {
  Livechara_motion: bound('人物动作', 'slot/motion/speed/mode', 'events', 'playLiveChibiMotion', 'motionCatalog + costume skeleton', 'verify-chibi-native-motion-chain.mjs'),
  Livechara_motion_group: bound('人物动作组', 'group/slots/motion/speed/mode', 'motionGroupEvents', 'weightedGroupMotion → playSlotEvent', 'motionCatalog', null),
  Livechara_motion_group_change: bound('人物动作组', 'group membership', 'motionGroupChanges', 'weightedGroupMotion', 'stagePositionMap', null),
  Livechara_position: bound('人物站位', 'slot/x/y/sortingOrder', 'positionEvents', 'layoutCoordinatesForStage + spotlightSortOffsetsAt', 'stagePositionMap', 'verify-chibi-character-layers.mjs'),
  Livechara_body_color: bound('人物染色', 'slot/color/alpha/duration/erase', 'bodyColorEvents', 'syncNativeBodyColor', 'costume mesh BodyColor material', 'verify-chibi-native-body-paint.mjs'),
  Livechara_Foot_Color: bound('人物脚光', 'color/alpha/duration/reciprocalHeight/erase', 'characterLightEvents', 'footUniformsAt', 'costume mesh FootColor material', 'verify-chibi-native-foot-colors.mjs'),
  Camera: bound('镜头', 'zoom/position/rotation/reset', 'cameraEvents + cameraControls', 'nativeLightCameraAt', 'native stage camera plane', 'verify-chibi-camera-reset.mjs'),
  Backmonitor: bound('背屏', 'movie/transform/logo/alpha/sortingOrder/logoSprite', 'backmonitorEvents', 'syncBackmonitor + global renderer planes', 'backmonitor/index + stage-effects backmonitorLayers', 'verify-chibi-backmonitor-controls.mjs'),
  Image_layer: bound('图片布景', 'asset/position/scale/alpha/duration', 'imageLayerEvents', 'syncImageLayers', 'image-layers/index', null),
  Image_layer_2: bound('图片布景', 'asset/position/scale/alpha/duration', 'imageLayerEvents', 'syncImageLayers', 'image-layers/index', null),
  Image_color: bound('布景染色', 'asset/color/alpha/duration/erase', 'imageColorEvents', 'syncImageLayers + stage background colors', 'image-components/index', 'verify-chibi-image-colors.mjs'),
  ImageObject_create: bound('图片对象', 'id/asset/depth', 'image-objects sidecar events', 'imageObjectsAt', 'image-objects/index', 'verify-chibi-image-objects.mjs'),
  ImageObject_show: bound('图片对象', 'id/transform/alpha/duration/erase', 'image-objects sidecar events', 'imageObjectsAt', 'image-objects/index', 'verify-chibi-image-objects.mjs'),
  Object_layer: bound('舞台对象', 'id/asset/transform/depth/erase', 'objectLayerEvents', 'syncObjectLayers + objectRendererPlanes', 'object-layers/index + particle sidecars', 'verify-chibi-object-renderer-planes.mjs'),
  Spotlight: bound('聚光', 'id/target/duration/color/background/depth/erase', 'spotlightEvents + spotlightCommandOrder', 'spotlightStatesAt + spotlightBackgroundAt', 'stage-effects spotlight', 'verify-chibi-spotlight-background.mjs'),
  Pinspotlight: bound('聚光蒙版', 'id/asset/transform/depth/erase', 'pinspotlightEvents', 'syncPinspotlights', 'stage-effects pinspotlight', 'verify-chibi-pinspotlight-sprites.mjs'),
  Laserlight: bound('激光', 'id/style/color/alpha/transform/speed/erase', 'laserlightEvents', 'laserlightStatesAt + sampleLaserParticles + sampleSpriteLaser', 'stage-effects laserlight/spotbeam/turnlaser + chibiSpriteLaserModel', 'verify-chibi-laser-particles.mjs'),
  Stagelight: bound('固定舞台灯', 'asset/alphaMode/colorMode', 'stage-stagelight-commands.json: songs[id]', 'stagelightStatesAt', 'stage-effects stagelights', 'verify-chibi-stagelights.mjs'),
  Whole_screen_color: bound('舞台染色', 'color/alpha/duration/depth/erase', 'wholeScreenColorEvents', 'wholeScreenColorAt', 'PIXI Graphics plane', 'verify-chibi-color-layers.mjs'),
  Whole_screen_color_2: bound('舞台染色层', 'id/color/alpha/duration/depth/erase', 'wholeScreenColorLayerEvents', 'colorLayersAt', 'PIXI Graphics planes', 'verify-chibi-color-layers.mjs'),
  Lyric: bound('歌词', 'text/time/duration', 'lyricEvents', 'currentLyric', 'text', 'verify-live-chibi-singer-slots.mjs'),
  SwitchSinger: bound('演唱切换', 'performer slots', 'singerEvents', 'currentSingerPositions', 'stagePositionMap', 'verify-live-chibi-singer-slots.mjs'),
  Penlight: bound('应援棒', 'id/prefab/animationType/animationId/speed/color/x/y/scale/depth',
    'stage-penlight-commands', 'penlightsAt + applyPenlightRuntime', 'penlight/index tight meshes + streamed clips', 'verify-chibi-penlights.mjs'),
  Penlight_unit: bound('应援棒', 'id/prefab/animationType/animationId/speed/x/y/scale/depth/colorMode/colors[7]',
    'stage-penlight-commands', 'penlightsAt + applyPenlightRuntime', 'penlight/index + native IdolData field39', 'verify-chibi-penlights.mjs'),
  Penlight_unit_color: bound('应援棒', 'id/prefab/animationType/animationId/speed/x/y/scale/depth/colorMode/colors(&)',
    'stage-penlight-commands', 'penlightsAt + applyPenlightRuntime', 'penlight/index + native IdolData field39', 'verify-chibi-penlights.mjs'),
  Livechara_mouth_shape_fix: bound('固定嘴型', 'target/value2 openRate/value3 duration/eraseDuration',
    'stage-mouth-fix', 'mouthFixAt + applyLiveChibiLipSync', 'mouth bone + open/close attachments', 'verify-chibi-mouth-fix.mjs'),
  Livechara_foot_color_solo: bound('单人脚光', 'native target/color/alpha/duration/reciprocalHeight/eraseDuration',
    'stage-foot-solo', 'addressedFootUniformsAt + syncNativeBodyColor', 'costume mesh FootColor material', 'verify-chibi-native-foot-colors.mjs'),
  Livechara_Offset: bound('随机动作启动偏移', 'value1 danceStartOffset /1000; erase no-op',
    'stage-motion-offset', 'randomMotionDueTime → performanceEventsByPosition', 'source-identified BPM set', 'verify-chibi-motion-offset.mjs'),
  Livechara_skill: absent('技能指令'),
  Smoke: absent('烟雾'),
  Whole_screen: bound('全屏粒子与遮罩', 'type/depth/duration/erase', 'wholeScreenEvents', 'wholeScreenAt + sampleWholeScreen', 'stage-whole-screen native prefabs/textures; Type6 deferred', 'verify-chibi-whole-screen.mjs'),
  After_Spappeal: absent('特殊演出后控制'),
  Finish: absent('结束控制'),
  Unit_serif: absent('组合台词'),
}
const newSuspensionFields = {
  NewSuspensionlight_create: 'id/asset/opacity/scaleXY/angle/positionXY/color/depth',
  NewSuspensionlight_normal_show: 'id/delay/rise/hold/fall/offWait',
  NewSuspensionlight_beat_show: 'id/startSwitch/holdBeats/offBeats',
  NewSuspensionlight_coloranim: 'id/mode/target/duration/hueDirection/palette',
  NewSuspensionlight_rotateanim: 'id/mode/angle/rise/hold/fall/wait/ease',
  NewSuspensionlight_scaleanim: 'id/scaleXY/rise/hold/fall/wait/mode',
  NewSuspensionlight_fade: 'id/opacity/rise/hold/fall/wait/mode',
}
for (const command of NEW_SUSPENSIONLIGHT_COMMANDS) STAGE_COMMAND_BINDINGS[command] = bound(
  '新悬灯', newSuspensionFields[command],
  'stage-effects newSuspensionlightSongs', 'newSuspensionlightsAt', 'stage-effects newSuspensionlight', 'verify-chibi-suspensionlights.mjs')
for (const command of ['Suspensionlight','Suspensionlight_2','Suspensionlight_3','Suspensionlight_4','Suspensionlight_5'])
  STAGE_COMMAND_BINDINGS[command] = { ...bound('旧悬灯', 'asset/color/period/transform/erase',
    'stage-effects oldSuspensionlightSongs', 'oldSuspensionlightsAt', 'stage-effects oldSuspensionlight', 'verify-chibi-old-suspension.mjs'), status: 'guarded' }
for (const suffix of ['show','show_2','ovalmove','rotateanim','scaleanim','coloranim','fade'])
  STAGE_COMMAND_BINDINGS[`Searchlight_${suffix}`] = bound('探照灯', 'id/Sprite/flash/alpha/color/target/position/angle/scale/depth + tween channels', 'searchlightEvents', 'searchlightsAt', 'stage-searchlights native Sprite bindings / six oval modes', 'verify-chibi-searchlights.mjs')
for (const command of ['Underlight','Underlight_2','Underlight_3','Underlight_4'])
  STAGE_COMMAND_BINDINGS[command] = absent('舞台底灯')
Object.freeze(STAGE_COMMAND_BINDINGS)

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const counts = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.entries(value).every(([command, n]) => command && Number.isSafeInteger(n) && n > 0)
export function validateStageCommandInventory(inventory, expectedHash) {
  if (inventory?.schemaVersion !== 1 || !hash(expectedHash) || inventory.choreographyIndexSha256 !== expectedHash)
    throw Error('Stage RAW inventory does not match the loaded choreography')
  if (!counts(inventory.commands) || !inventory.songs || Array.isArray(inventory.songs)
    || Object.keys(inventory.songs).length !== inventory.arrangements) throw Error('Invalid stage RAW inventory counts')
  const sums = Object.create(null)
  for (const [id, song] of Object.entries(inventory.songs)) {
    if (!id || !song.songCode || !song.source || !hash(song.raw?.textSha256) || !counts(song.commands))
      throw Error('Invalid stage RAW arrangement identity/counts')
    if (!counts(song.nonTimedCommands || {}) || Object.entries(song.nonTimedCommands || {}).some(([c,n]) => n > (song.commands[c] || 0)))
      throw Error('Invalid non-timed RAW row counts')
    for (const [command, n] of Object.entries(song.commands)) sums[command] = (sums[command] || 0) + n
  }
  if (Object.keys(sums).length !== Object.keys(inventory.commands).length
    || Object.entries(sums).some(([command,n]) => inventory.commands[command] !== n))
    throw Error('Stage RAW inventory aggregate mismatch')
  return inventory
}

export function stageCommandCoverage(song, inventory, indexes = {}) {
  if (!inventory) return { status: 'not_loaded', rows: [], missing: [], unknown: [], guarded: [], total: null }
  const record = inventory.songs?.[song.id]
  if (!record || record.songCode !== song.songCode || record.source + '.csv' !== song.source)
    return { status: 'identity_mismatch', rows: [], missing: [], unknown: [], guarded: [], total: null }
  const rows = Object.entries(record.commands).map(([command, count]) => {
    const binding = Object.hasOwn(STAGE_COMMAND_BINDINGS, command) ? STAGE_COMMAND_BINDINGS[command] : { ...absent('未识别指令'), status: 'unknown' }
    const guard = binding.status === 'guarded'
      ? !indexes.stageEffects ? 'not_loaded'
        : indexes.stageEffects.oldSuspensionlightSongs?.[song.id]?.nativeCapability === 'supported' ? 'enabled'
          : indexes.stageEffects.oldSuspensionlightSongs?.[song.id]?.nativeCapability === 'partial' ? 'partial' : 'disabled'
      : null
    const nonTimedCount = record.nonTimedCommands?.[command] || 0
    return { command, count, ...binding, guard, nonTimedCount, timedCount: count - nonTimedCount,
      status: count === nonTimedCount ? 'non_timed' : binding.status }
  }).sort((a,b) => a.command.localeCompare(b.command))
  return { status: 'source_inventory', source: record.raw, rows, total: rows.reduce((n,row) => n + row.count, 0),
    nonTimedCount: rows.reduce((n,row) => n + row.nonTimedCount, 0),
    missing: rows.filter(row => row.status === 'missing'), unknown: rows.filter(row => row.status === 'unknown'),
    guarded: rows.filter(row => row.status === 'guarded') }
}
