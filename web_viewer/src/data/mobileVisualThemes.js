/**
 * Mobile story presentation themes, one per unit that owns a mobile
 * background. Colors are accessibility-adjusted versions sampled from
 * committed unit logo + unit mobile background PNGs (see handoff §5.2.1):
 * sourcePrimary keeps the sampled hue for identity strips; primary is the
 * darkened accessible variant for small text-on-solid backgrounds.
 */
export const MOBILE_UNIT_THEMES = {
  '06fra': {
    primary: '#087A2C',
    sourcePrimary: '#00C814',
    onPrimary: '#FFFFFF',
    backgroundKey: '06fra',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '13the': {
    primary: '#242843',
    sourcePrimary: '#242843',
    onPrimary: '#FFFFFF',
    backgroundKey: '13the',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '16cfi': {
    primary: '#007C73',
    sourcePrimary: '#00C7B7',
    onPrimary: '#FFFFFF',
    accent: '#CAA954',
    backgroundKey: '16cfi',
    evidence: 'unit-logo + unit-mobile-background',
  },
}

export function getMobileUnitTheme(unitCode) {
  return MOBILE_UNIT_THEMES[unitCode] || null
}
