import { normalizeIdolAccentColor } from './idolAccentColor.js'

// The producer's 担当 colour can take over the stage light (selection, play, progress,
// focus). Only its hue survives: lightness and chroma are fixed per role, so a bright
// yellow and a pale pink weigh the same on the page and text stays at 4.5:1.
// Colours without a usable hue (near-black, grey) get a cool silver light instead.

export const STAGE_LIGHT_TOKENS = ['--gs-mint', '--gs-mint-ink', '--gs-mint-wash']
const INK = '#13213a', PAPER = '#f5f6f8'
const MIN_HUE_CHROMA = 0.06

const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const enc = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const channels = hex => [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255))

function hexToOklch(hex) {
  const [r, g, b] = channels(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return { C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
}

// Reduce chroma until the colour fits sRGB, keeping lightness and hue.
function oklchHex(L, C, h) {
  let rgb = oklchToLinear(L, C, h)
  for (let c = C; c > 0 && !rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4); c -= 0.002) rgb = oklchToLinear(L, c, h)
  return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, enc(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('')
}

const luminance = hex => { const [r, g, b] = channels(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export function contrastRatio(x, y) {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (a + 0.05) / (b + 0.05)
}

/** { light, ink, wash, silver } for an idol colour, or null when there is none. */
export function idolStageLight(color) {
  const hex = normalizeIdolAccentColor(color)
  if (!hex) return null
  const { C, h } = hexToOklch(hex)
  const silver = C < MIN_HUE_CHROMA
  const hue = silver ? 255 : h
  const wash = oklchHex(0.955, silver ? 0.006 : Math.min(C, 0.04), hue)
  let ink, light
  for (let L = 0.5; L > 0.2; L -= 0.01) {
    ink = oklchHex(L, silver ? 0.02 : Math.min(C, 0.13), hue)
    if (contrastRatio(ink, wash) >= 4.5 && contrastRatio(ink, PAPER) >= 4.5) break
  }
  // The light carries an ink glyph (the play button), so it must stay light enough for it.
  for (let L = silver ? 0.76 : 0.74; L < 0.98; L += 0.01) {
    light = oklchHex(L, silver ? 0.015 : Math.min(C, 0.16), hue)
    if (contrastRatio(light, INK) >= 4.5) break
  }
  return { light, ink, wash, silver }
}

/** Custom properties that re-point the stage light; empty when the default mint applies. */
export function idolStageLightProperties(color) {
  const stage = idolStageLight(color)
  return stage ? { '--gs-mint': stage.light, '--gs-mint-ink': stage.ink, '--gs-mint-wash': stage.wash } : {}
}
