function uniqueAssets(events, key) {
  return [...new Set((events || []).map(event => event[key]).filter(Boolean))].sort()
}

export function buildStageVfxCoverage(song, indexes = {}) {
  if (!song) return null
  const objectAssets = uniqueAssets(song.objectLayerEvents, 'asset')
  const objectIndex = indexes.objectLayers?.assets || {}
  const objectSprites = objectAssets.filter(asset => ['sprite', 'mixed'].includes(objectIndex[asset]?.kind))
  const objectParticles = objectAssets.filter(asset => objectIndex[asset]?.kind === 'particle')
  const objectMissing = objectAssets.filter(asset => !objectIndex[asset])
  const objectOther = objectAssets.filter(asset => objectIndex[asset] &&
    !['sprite', 'mixed', 'particle'].includes(objectIndex[asset].kind))
  const backmonitorAssets = uniqueAssets(song.backmonitorEvents, 'movie')
  const imageAssets = uniqueAssets(song.imageLayerEvents, 'asset')
  const pinspotlightAssets = uniqueAssets(song.pinspotlightEvents, 'asset')
  const missingMedia = [
    ...backmonitorAssets.filter(asset => !indexes.backmonitor?.assets?.[asset]),
    ...imageAssets.filter(asset => !indexes.imageLayers?.assets?.[asset]),
    ...pinspotlightAssets.filter(asset => !indexes.stageEffects?.assets?.[asset]),
  ]
  return {
    songId: song.id,
    sourceEvents: {
      camera: song.cameraEvents?.length || 0,
      backmonitor: song.backmonitorEvents?.length || 0,
      imageLayer: song.imageLayerEvents?.length || 0,
      objectLayer: song.objectLayerEvents?.length || 0,
      characterLight: song.characterLightEvents?.length || 0,
      spotlight: song.spotlightEvents?.length || 0,
      pinspotlight: song.pinspotlightEvents?.length || 0,
      laserlight: song.laserlightEvents?.length || 0,
    },
    resourceAssets: { backmonitor: backmonitorAssets.length, imageLayer: imageAssets.length },
    objectSprites,
    objectParticles,
    objectMissing,
    objectOther,
    missingMedia,
    status: objectParticles.length || objectMissing.length || objectOther.length || missingMedia.length
      ? 'partial'
      : 'source_mapped_unverified',
  }
}
