// Photo Studio stickers carry no category in masterdata (table 61). Their names and id ranges do:
// ids 1-65 are the client's base set (16 unit logos, brand marks, 3 attributes, motifs), later ids
// are event and limited stickers, and SideMini chibis are named as such. One grouping for every
// place that lists stickers (photo catalogue, studio material picker).
const UNIT_STICKERS = new Set(['Jupiter', 'DRAMATIC STARS', 'Altessimo', 'Beit', 'W', 'FRAME', '彩', 'High×Joker',
  '神速一魂', 'Café Parade', 'もふもふえん', 'S.E.M', 'THE 虎牙道', 'F-LAGS', 'Legenders', 'C.FIRST'])

export const PHOTO_STICKER_GROUPS = Object.freeze([
  { id: 'unit', label: '组合' },
  { id: 'sidemini', label: 'SideMini' },
  { id: 'motif', label: '图案' },
  { id: 'event', label: '活动与限定' },
  { id: 'mark', label: '标志与属性' },
])

export function photoStickerGroup(sticker) {
  const name = String(sticker?.name || '').replace(/^ステッカー\s*/, '')
  if (UNIT_STICKERS.has(name)) return 'unit'
  if (/^SideMini/.test(name)) return 'sidemini'
  if (/フィジカル|メンタル|インテリ/.test(name)) return 'mark'
  const id = Number(sticker?.id)
  if (id <= 22) return 'mark'
  if (id <= 65) return 'motif'
  return 'event'
}
