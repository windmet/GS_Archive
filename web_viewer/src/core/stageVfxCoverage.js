function uniqueAssets(events, key) {
  return [...new Set((events || []).map(event => event[key]).filter(Boolean))].sort()
}

export function buildStageVfxCoverage(song, indexes = {}) {
  if (!song) return null
  const objectAssets = uniqueAssets(song.objectLayerEvents, 'asset')
  const objectIndex = indexes.objectLayers?.assets || {}
  const objectSprites = objectAssets.filter(asset => ['sprite', 'mixed'].includes(objectIndex[asset]?.kind))
  const objectParticles = objectAssets.filter(asset => objectIndex[asset]?.kind === 'particle')
  const objectParticlePilots = objectParticles.filter(asset => objectIndex[asset]?.particleAnimation || objectIndex[asset]?.floorAnimation)
  const objectParticleUnimplemented = objectParticles.filter(asset => !objectIndex[asset]?.particleAnimation && !objectIndex[asset]?.floorAnimation)
  const objectMissing = objectAssets.filter(asset => !objectIndex[asset])
  const objectOther = objectAssets.filter(asset => objectIndex[asset] &&
    !['sprite', 'mixed', 'particle'].includes(objectIndex[asset].kind))
  const backmonitorAssets = uniqueAssets(song.backmonitorEvents, 'movie')
  const imageAssets = uniqueAssets(song.imageLayerEvents, 'asset')
  const imageObjectEvents = indexes.imageObjects?.songs?.[song.id]?.events || []
  const imageObjectAssets = uniqueAssets(imageObjectEvents, 'asset')
  const pinspotlightAssets = uniqueAssets(song.pinspotlightEvents, 'asset')
  const stagelightEvents = indexes.stageEffects?.stagelightSongs?.[song.songCode]?.events || []
  const stagelightAssets = uniqueAssets(stagelightEvents, 'asset')
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
    },
    resourceAssets: { backmonitor: backmonitorAssets.length, imageLayer: imageAssets.length, imageObject: imageObjectAssets.length },
    objectSprites,
    objectParticles,
    objectParticlePilots,
    objectParticleUnimplemented,
    floorParticleStatus: objectAssets.some(asset => objectIndex[asset]?.floorAnimation)
      ? 'native_inputs_reference_projection_rng_noise_not_unity_equivalent' : 'not_loaded',
    objectMissing,
    objectOther,
    stagelightAssets,
    // Resource binding / color assignment are separate from native tween parity.
    stagelightAnimationStatus: stagelightEvents.length ? 'reference_preview_unverified_native_tweens' : 'not_loaded',
    missingMedia,
    unresolvedColorPlanes,
    unresolvedImageColors,
    imageColorMissing,
    status: objectParticles.length || objectMissing.length || objectOther.length || missingMedia.length || unresolvedColorPlanes.length || unresolvedImageColors.length || imageColorMissing.length
      ? 'partial'
      : 'source_mapped_unverified',
  }
}
