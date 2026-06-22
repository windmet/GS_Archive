// Auto-generated from index.json — maps unit_code -> unit_name
// Unit codes use the 2-digit format matching asset filenames (e.g. "08hig", not "008hig")
export const UNIT_CODE_TO_NAME = {
  '01jup': 'Jupiter',
  '02dra': 'DRAMATIC STARS',
  '03alt': 'Altessimo',
  '04bei': 'Beit',
  '05w00': 'W',
  '06fra': 'FRAME',
  '07sai': '彩',
  '08hig': 'High×Joker',
  '09shi': '神速一魂',
  '10caf': 'Café Parade',
  '11mof': 'もふもふえん',
  '12sem': 'S.E.M',
  '13the': 'THE 虎牙道',
  '14fla': 'F-LAGS',
  '15leg': 'Legenders',
  '16cfi': 'C.FIRST',
}

// Convert 3-digit data format ("008hig") to 2-digit file format ("08hig")
// Scenario IDs embed unit codes with 3-digit prefix, but asset files use 2-digit
export function normalizeUnitCode(code3) {
  if (!code3 || code3.length < 5) return code3
  const num = parseInt(code3.slice(0, 3), 10)
  const suffix = code3.slice(3)
  return String(num).padStart(2, '0') + suffix
}

// Reverse: given any chara_id (e.g. "001tom"), returns the unit_code in 2-digit format
// Derived from the 8_2_x group chat file membership
const CHARA_TO_UNIT = {
  '001tom': '01jup', '002sht': '01jup', '003hok': '01jup',
  '004ter': '02dra', '005kao': '02dra', '006tsu': '02dra',
  '007kei': '03alt', '008rei': '03alt',
  '009kyj': '04bei', '010pie': '04bei', '011min': '04bei',
  '012yus': '05w00', '013kys': '05w00',
  '014hid': '06fra', '015ryu': '06fra', '016sei': '06fra',
  '017kir': '07sai', '018shm': '07sai', '019kur': '07sai',
  '020hay': '08hig', '021jun': '08hig', '022nat': '08hig',
  '023har': '08hig', '024shk': '08hig',
  '025suz': '09shi', '026gen': '09shi',
  '027yuk': '10caf', '028soi': '10caf', '029ass': '10caf',
  '030mak': '10caf', '031sak': '10caf',
  '032nao': '11mof', '033shr': '11mof', '034kan': '11mof',
  '035mco': '12sem', '036rui': '12sem', '037jir': '12sem',
  '038tak': '13the', '039mcr': '13the', '040ren': '13the',
  '041ryo': '14fla', '042dai': '14fla', '043kaz': '14fla',
  '044ame': '15leg', '045sor': '15leg', '046chr': '15leg',
  '047shu': '16cfi', '048mom': '16cfi', '049eis': '16cfi',
  // Extended / sub characters not in any unit
  '06fra': null, '100grp': null, '101ken': null, '102sha': null,
  '103kur': null, '104omn': null,
  '201sub': null, '204sub': null, '205sub': null, '206sub': null,
  '207sub': null, '208sub': null, '209sub': null, '210sub': null,
  '211sub': null, '212sub': null, '213sub': null, '214sub': null,
  '215sub': null, '216sub': null, '236sub': null, '238sub': null,
  '240sub': null, '241sub': null, '246sub': null,
  'group': null, 'mob': null,
}

export function getUnitCodeByCharaId(charaId) {
  return CHARA_TO_UNIT[charaId] || null
}

export function getUnitNameByCharaId(charaId) {
  const code = getUnitCodeByCharaId(charaId)
  return code ? UNIT_CODE_TO_NAME[code] : null
}
