// Source spelling only: never infer variants from IDs or image colors.
export function collectionItemVariant(source) {
  if (typeof source !== 'string') return ''
  const compact = source.replace(/\s/g, '')
  const jelly = /^ゴーゴーゼリー(SP|DX)$/.exec(compact)
  if (jelly) return jelly[1]
  const rarity = /^彩光の欠片(N|R|SR|SSR)$/.exec(compact)
  if (rarity) return rarity[1]
  const draws = /(\d+)(?:回|連)(?:ガシャ)?チケット$/.exec(compact)
  if (draws) return `${draws[1]}×`
  const stars = /^アンコールスター(II|III|V)$/.exec(compact)
  return stars ? stars[1] : ''
}
