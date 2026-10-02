// Shared native textures with generation-bound asynchronous installation.
// A seek/toggle while loading must not resurrect a stale lamp or a released stage.
export function createSpotlightSpriteStore({ loadTexture, createRuntime, destroyRuntime, destroyTexture, onReady, onError, layerCount = 2 }) {
  let generation = 0
  const runtimes = new Map()
  const pending = new Map()
  const loads = new Map()
  const textures = new Map()
  const failed = new Set()

  function textureFor(asset, file, version) {
    if (!loads.has(asset)) {
      const promise = Promise.resolve().then(() => loadTexture(file)).then(texture => {
        if (version !== generation) {
          destroyTexture(texture)
          return null
        }
        textures.set(asset, texture)
        return texture
      })
      loads.set(asset, promise)
    }
    return loads.get(asset)
  }

  function ensure(id, model, assets) {
    if (runtimes.has(id)) return runtimes.get(id)
    if (pending.has(id) || failed.has(id)) return null
    if (model?.layers?.length !== layerCount || model.layers.some(layer => !assets?.[layer.asset]?.file)) return null
    const version = generation
    const promise = Promise.all(model.layers.map(layer => textureFor(layer.asset, assets[layer.asset].file, version)))
      .then(loaded => {
        if (version !== generation || loaded.some(texture => !texture)) return
        const runtime = createRuntime(id, model.layers, loaded)
        runtimes.set(id, runtime)
        pending.delete(id)
        onReady()
      }).catch(error => {
        if (version !== generation) return
        pending.delete(id)
        failed.add(id)
        onError(error)
      })
    pending.set(id, promise)
    return null
  }

  function release() {
    generation += 1
    for (const runtime of runtimes.values()) destroyRuntime(runtime)
    for (const texture of textures.values()) destroyTexture(texture)
    runtimes.clear()
    pending.clear()
    loads.clear()
    textures.clear()
    failed.clear()
  }

  return { runtimes, ensure, release }
}
