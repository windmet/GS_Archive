/**
 * Mobile story presentation themes, one per unit that owns a mobile
 * background. Colors are accessibility-adjusted versions sampled from
 * committed unit logo + unit mobile background PNGs (see handoff §5.2.1):
 * sourcePrimary keeps the sampled hue for identity strips; primary is the
 * darkened accessible variant for small text-on-solid backgrounds.
 */
export const MOBILE_UNIT_THEMES = {
  '01jup': {
    primary: '#056B63',
    sourcePrimary: '#3FF297',
    onPrimary: '#FFFFFF',
    accent: '#7BF5B7',
    backgroundKey: '01jup',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '02dra': {
    primary: '#6B551C',
    sourcePrimary: '#A5873C',
    onPrimary: '#FFFFFF',
    backgroundKey: '02dra',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '03alt': {
    primary: '#5F4A39',
    sourcePrimary: '#AD9C64',
    onPrimary: '#FFFFFF',
    backgroundKey: '03alt',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '04bei': {
    primary: '#0044C2',
    sourcePrimary: '#0044C2',
    onPrimary: '#FFFFFF',
    backgroundKey: '04bei',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '05w00': {
    primary: '#4B3DAA',
    sourcePrimary: '#574AD2',
    onPrimary: '#FFFFFF',
    accent: '#BCE144',
    backgroundKey: '05w00',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '06fra': {
    primary: '#087A2C',
    sourcePrimary: '#00C814',
    onPrimary: '#FFFFFF',
    backgroundKey: '06fra',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '07sai': {
    primary: '#71156F',
    sourcePrimary: '#A63174',
    onPrimary: '#FFFFFF',
    backgroundKey: '07sai',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '08hig': {
    primary: '#283657',
    sourcePrimary: '#CDB141',
    onPrimary: '#FFFFFF',
    accent: '#CDB141',
    backgroundKey: '08hig',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '09shi': {
    primary: '#A92524',
    sourcePrimary: '#EE3224',
    onPrimary: '#FFFFFF',
    accent: '#1A6BD0',
    backgroundKey: '09shi',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '10caf': {
    primary: '#780A5A',
    sourcePrimary: '#8C1A62',
    onPrimary: '#FFFFFF',
    backgroundKey: '10caf',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '11mof': {
    primary: '#087985',
    sourcePrimary: '#0C9AAB',
    onPrimary: '#FFFFFF',
    accent: '#F15F7C',
    backgroundKey: '11mof',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '12sem': {
    primary: '#A80A58',
    sourcePrimary: '#F2328B',
    onPrimary: '#FFFFFF',
    backgroundKey: '12sem',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '13the': {
    primary: '#242843',
    sourcePrimary: '#242843',
    onPrimary: '#FFFFFF',
    backgroundKey: '13the',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '14fla': {
    primary: '#000084',
    sourcePrimary: '#000084',
    onPrimary: '#FFFFFF',
    accent: '#C80012',
    backgroundKey: '14fla',
    evidence: 'unit-logo + unit-mobile-background',
  },
  '15leg': {
    primary: '#665A36',
    sourcePrimary: '#978756',
    onPrimary: '#FFFFFF',
    backgroundKey: '15leg',
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
