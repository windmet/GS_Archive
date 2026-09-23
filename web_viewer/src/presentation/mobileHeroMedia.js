import { getMobileBgUrl, getUnitMobileBgUrl } from '../utils/AssetResolver.js'

// The sampled room surfaces place meaningful art in the upper portion.
// Keep one source-coordinate focal point independent of viewport breakpoints.
export const MOBILE_HERO_FOCAL_POINT = Object.freeze({ x: 0.5, y: 0.26 })

export function resolveMobileHeroMedia({ mode, idolCode, unitCode }) {
  const src = mode === 'unit'
    ? unitCode ? getUnitMobileBgUrl(unitCode) : ''
    : idolCode ? getMobileBgUrl(idolCode) : ''
  return { src, focalX: MOBILE_HERO_FOCAL_POINT.x, focalY: MOBILE_HERO_FOCAL_POINT.y }
}
