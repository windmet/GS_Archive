/**
 * Effect textures the background and screen managers actually request.
 *
 * Handlers are per domain: an authored effect only produces a texture
 * requirement in the domain that implements it. The same id used in the other
 * domain is a runtime no-op, which stays visible instead of being silently
 * treated as satisfied. Every entry here traces to a handler in
 * BackgroundEffectManager or ScreenEffectManager.
 */

const EXTRACTED_ROOT = '/data/fx_extracted'

const EFFECT_HANDLERS = {
  'bg_effects': {
    cameraflare: { textures: ['fx_adv_flare_01'], runtimeDisabled: 'cameraflare-re-authored-as-particles' },
    fx_adv_rain: { textures: ['fx_adv_rain'] },
    fx_adv_rain_heavy2: { textures: ['fx_adv_rain'] },
    fx_adv_sakura: { textures: ['fx_adv_sakura'] },
    fx_adv_momiji: { textures: ['fx_adv_momiji'] },
  },
  'screen_effects': {
    fx_adv_punch: { textures: ['fx_adv_punch'] },
    fx_adv_sakura: { textures: ['fx_adv_sakura'] },
    fx_adv_momiji: { textures: ['fx_adv_momiji'] },
    // Kamifubuki mixes the sakura and star textures.
    fx_adv_kamifubuki: { textures: ['fx_adv_sakura', 'fx_adv_star'] },
  },
}

const GENERATED_OVERLAY_TYPES = new Set(['fadein', 'fadeout'])

/** URL the managers load for an extracted effect texture. */
export function effectTextureUrl(textureId) {
  return `${EXTRACTED_ROOT}/unity_${textureId}.png`
}

/**
 * Textures an authored effect requires in one snapshot field, the reason the
 * runtime ignores it, or an explicit reason it cannot be accounted for.
 */
export function effectTextures(effect, domain) {
  if (GENERATED_OVERLAY_TYPES.has(effect?.type)) return { textures: [] }
  const id = effect?.id
  if (typeof id !== 'string' || !id) return { textures: [], reason: 'effect-without-id' }
  const handlers = EFFECT_HANDLERS[domain]
  if (!handlers) return { textures: [], reason: `unknown-effect-domain:${domain}` }
  const entry = handlers[id]
  if (!entry) {
    const known = Object.values(EFFECT_HANDLERS).some(list => list[id])
    return { textures: [], reason: known ? 'effect-unhandled-in-domain' : 'unmapped-effect-texture' }
  }
  return { textures: [...entry.textures], runtimeDisabled: entry.runtimeDisabled || null }
}

/** Texture ids the mapping can require, for boundary and parity tests. */
export function knownEffectTextureIds() {
  return [...new Set(Object.values(EFFECT_HANDLERS).flatMap(handlers =>
    Object.values(handlers).flatMap(entry => entry.textures)))].sort()
}

export const EFFECT_DOMAINS = Object.keys(EFFECT_HANDLERS)
