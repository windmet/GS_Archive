import * as PIXI from 'pixi.js'
import { effectTextureUrl } from '../../shared/story/EffectTextures.js'

// The extracted fx_adv_* PNGs are straight alpha (white RGB under transparent pixels); read as
// premultiplied every quad would add its full RGB and turn solid. Premultiply on upload instead.
export const EFFECT_TEXTURE_ALPHA_MODE = PIXI.ALPHA_MODES.UNPACK

/** Share successful/in-flight effect loads; a failed request must be retryable. */
export function loadEffectTexture(cache, name, loadTextureFromUrl) {
  if (!cache[name]) {
    const pending = Promise.resolve()
      .then(() => loadTextureFromUrl(effectTextureUrl(name), { alphaMode: EFFECT_TEXTURE_ALPHA_MODE }))
      .catch(error => {
        if (cache[name] === pending) delete cache[name]
        throw error
      })
    cache[name] = pending
  }
  return cache[name]
}
