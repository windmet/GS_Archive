const SOURCE_KINDS = [
  [/^スモールトーク\s*0?(\d+)$/u, 'SMALL TALK'],
  [/^エピソード\s*0?(\d+)$/u, 'EPISODE'],
]
const STRUCTURAL_KINDS = { small_talk: 'SMALL TALK', episode: 'EPISODE' }

export function presentIdolEpisodeLabel({ sourceName = '', kind = '', ordinal = null } = {}) {
  const source = String(sourceName || '')
  const knownKind = STRUCTURAL_KINDS[kind]
  const number = Number(ordinal)
  if (knownKind && Number.isInteger(number) && number > 0) return `${knownKind} ${String(number).padStart(2, '0')}`
  for (const [pattern, label] of SOURCE_KINDS) {
    const match = source.match(pattern)
    if (match) return `${label} ${String(Number(match[1])).padStart(2, '0')}`
  }
  return source
}
