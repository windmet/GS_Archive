import { effectTextureUrl } from '../../shared/story/EffectTextures.js'

/** Share successful/in-flight effect loads; a failed request must be retryable. */
export function loadEffectTexture(cache, name, loadTextureFromUrl) {
  if (!cache[name]) {
    const pending = Promise.resolve()
      .then(() => loadTextureFromUrl(effectTextureUrl(name)))
      .catch(error => {
        if (cache[name] === pending) delete cache[name]
        throw error
      })
    cache[name] = pending
  }
  return cache[name]
}
