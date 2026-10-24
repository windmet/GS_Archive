import { NEW_SUSPENSIONLIGHT_COMMANDS } from './chibiSuspensionlights.js'
import { stageCommandCoverage } from './stageCommandCoverage.js'

function uniqueAssets(events, key) {
  return [...new Set((events || []).map(event => event[key]).filter(Boolean))].sort()
}

// Match loadObjectLayerRuntime precedence. A bound consumer is not visual parity.
export function objectParticleCoverage(entry) {
  const consumer = ['nativeParticleAnimation', 'bloomAnimation', 'floorAnimation', 'particleAnimation']
    .find(key => entry?.[key]) || null
  const model = consumer ? entry[consumer] : entry?.nativeParticleDeferred
  const partialMarkers = [...new Set((model?.systems || []).flatMap(system => system.partial || []))].sort()
  const deferredSystems = (model?.deferred || model?.deferredSystems || []).length
  return { consumer, partialMarkers, deferredSystems,
    // Legacy consumers retain their own projection/RNG/material boundaries.
    status: !consumer ? 'missing' : partialMarkers.length || deferredSystems ? 'partial' : 'mapped_unverified' }
}

export function buildStageVfxCoverage(song, indexes = {}) {
  if (!song) return null
  const rawCommands = stageCommandCoverage(song, indexes.commandInventory, indexes)
  const objectAssets = uniqueAssets(song.objectLayerEvents, 'asset')
  const objectIndex = indexes.objectLayers?.assets || {}
  const objectSprites = objectAssets.filter(asset => ['sprite', 'mixed'].includes(objectIndex[asset]?.kind))
  const objectParticles = objectAssets.filter(asset => objectIndex[asset]?.kind === 'particle')
  const objectParticleConsumers = Object.fromEntries(objectParticles.map(asset => [asset, objectParticleCoverage(objectIndex[asset])]))
  const objectParticlePilots = objectParticles.filter(asset => objectParticleConsumers[asset].consumer)
  const objectParticlePartial = objectParticles.filter(asset => objectParticleConsumers[asset].status === 'partial')
  const objectParticleUnimplemented = objectParticles.filter(asset => !objectParticleConsumers[asset].consumer)
  const objectMissing = objectAssets.filter(asset => !objectIndex[asset])
  const objectOther = objectAssets.filter(asset => objectIndex[asset] &&
    !['sprite', 'mixed', 'particle'].includes(objectIndex[asset].kind))
  const backmonitorAssets = uniqueAssets(song.backmonitorEvents, 'movie')
  const imageAssets = uniqueAssets(song.imageLayerEvents, 'asset')
  const imageObjectEvents = indexes.imageObjects?.songs?.[song.id]?.events || []
  const imageObjectAssets = uniqueAssets(imageObjectEvents, 'asset')
  const pinspotlightAssets = uniqueAssets(song.pinspotlightEvents, 'asset')
  const stagelightEvents = indexes.stagelight?.songs?.[song.id]?.events || indexes.stageEffects?.stagelightSongs?.[song.songCode]?.events || []
  const stagelightAssets = uniqueAssets(stagelightEvents, 'asset')
  const stagelightUnimplemented = stagelightAssets.filter(asset=>!indexes.stageEffects?.stagelights?.[asset])
  const stagelightUnimplementedCommands = stagelightEvents.filter(event=>!event.hide && (!indexes.stageEffects?.stagelights?.[event.asset] || event.previewSupported===false))
  const suspensionTrack = indexes.stageEffects?.newSuspensionlightSongs?.[song.id]
  const suspensionEvents = indexes.newSuspensionlightTrack?.events || suspensionTrack?.events || []
  const suspensionCount = suspensionTrack?.eventCount ?? suspensionEvents.length
  const suspensionUnimplemented = suspensionEvents.filter(event =>
      !NEW_SUSPENSIONLIGHT_COMMANDS.includes(event.command))
  const backmonitorLogoRequests = (song.backmonitorEvents || []).filter(event =>
    Number(event.rawValue6 ?? event.rotation) === 1).length
  const unresolvedColorPlanes = (song.wholeScreenColorLayerEvents || []).filter(event => event.unresolvedReason)
  const unresolvedImageColors = (song.imageColorEvents || []).filter(event => event.unresolvedReason)
  const imageColorAssets = uniqueAssets((song.imageColorEvents || []).filter(event => !event.unresolvedReason), 'asset')
  const staticAssets = indexes.stageBackgrounds?.songs?.[song.songCode]?.layers || []
  const imageColorMissing = imageColorAssets.filter(asset => !staticAssets.includes(asset)
    && !indexes.imageLayers?.assets?.[asset] && !indexes.imageObjects?.assets?.[asset])
  const missingMedia = [
    ...backmonitorAssets.filter(asset => !indexes.backmonitor?.assets?.[asset]),
    ...imageAssets.filter(asset => !indexes.imageLayers?.assets?.[asset]),
    ...imageObjectAssets.filter(asset => !indexes.imageObjects?.assets?.[asset]),
    ...pinspotlightAssets.filter(asset => !indexes.stageEffects?.assets?.[asset]),
  ]
  return {
    songId: song.id,
    rawCommands,
    sourceEvents: {
      camera: song.cameraEvents?.length || 0,
      backmonitor: song.backmonitorEvents?.length || 0,
      imageLayer: song.imageLayerEvents?.length || 0,
      imageObject: imageObjectEvents.length,
      objectLayer: song.objectLayerEvents?.length || 0,
      characterLight: song.characterLightEvents?.length || 0,
      bodyColor: song.bodyColorEvents?.length || 0,
      imageColor: song.imageColorEvents?.length || 0,
      wholeScreenColorLayer: song.wholeScreenColorLayerEvents?.length || 0,
      spotlight: song.spotlightEvents?.length || 0,
      pinspotlight: song.pinspotlightEvents?.length || 0,
      laserlight: song.laserlightEvents?.length || 0,
      stagelight: stagelightEvents.length,
      newSuspensionlight: suspensionCount,
      penlight: indexes.penlightCommands?.songs?.[song.id]?.events?.length || 0,
      mouthFix: indexes.mouthFix?.songs?.[song.id]?.events?.length || 0,
      footSolo: indexes.footSolo?.songs?.[song.id]?.events?.filter(event=>event.solo).length || 0,
      motionOffset: indexes.motionOffset?.songs?.[song.id]?.events?.length || 0,
    },
    resourceAssets: { backmonitor: backmonitorAssets.length, imageLayer: imageAssets.length, imageObject: imageObjectAssets.length },
    objectSprites,
    objectParticles,
    objectParticlePilots,
    objectParticleUnimplemented,
    objectParticlePartial,
    objectParticleConsumers,
    floorParticleStatus: objectAssets.some(asset => objectIndex[asset]?.floorAnimation)
      ? 'native_inputs_reference_projection_rng_noise_not_unity_equivalent' : 'not_loaded',
    objectMissing,
    objectOther,
    stagelightAssets,
    stagelightUnimplemented,
    stagelightUnimplementedCommands:stagelightUnimplementedCommands.length,
     // Sidecar metadata may predate newly wired commands. Count the loaded
     // RAW track rather than promoting that stale summary to runtime coverage.
     newSuspensionlightUnimplementedCommands: suspensionEvents.length ? suspensionUnimplemented.length : null,
     newSuspensionlightTempoPending: indexes.newSuspensionlightTempo > 0 ? 0 : suspensionEvents.filter(event => event.command === 'NewSuspensionlight_beat_show' && !event.erase).length,
     newSuspensionlightCommandsLoaded: Boolean(indexes.newSuspensionlightTrack || suspensionTrack?.events),
     newSuspensionlightStatus: suspensionCount ? 'native_channels_reference_projection_constant_tempo_only' : 'not_loaded',
    backmonitorLogoRequests,
    backmonitorLogoStatus: backmonitorLogoRequests ? 'partial_native_selection_reference_clock' : 'not_requested',
    // Resource binding / color assignment are separate from native tween parity.
    stagelightAnimationStatus: stagelightEvents.length ? indexes.stagelight ? 'native_director_channels_projection_rng_partial' : 'legacy_fields_not_consumed' : 'not_loaded',
    missingMedia,
    unresolvedColorPlanes,
    unresolvedImageColors,
    imageColorMissing,
    status: rawCommands.missing.length || rawCommands.unknown.length || rawCommands.guarded.some(row => row.guard === 'disabled' || row.guard === 'partial') || objectParticles.length || objectMissing.length || objectOther.length || missingMedia.length || unresolvedColorPlanes.length || unresolvedImageColors.length || imageColorMissing.length || stagelightUnimplemented.length || stagelightUnimplementedCommands.length || suspensionCount || backmonitorLogoRequests
      ? 'partial'
      : 'source_mapped_unverified',
  }
}
