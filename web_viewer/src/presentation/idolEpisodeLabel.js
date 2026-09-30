const SOURCE_KINDS = [
  [/^スモールトーク\s*0?(\d+)$/u, 'SMALL TALK'],
  [/^エピソード\s*0?(\d+)$/u, 'EPISODE'],
  [/^EPISODE\s+(\d+)$/u, 'EPISODE'],
]
const STRUCTURAL_KINDS = { small_talk: 'SMALL TALK', episode: 'EPISODE' }

export function presentIdolEpisodeLabel({ sourceName = '', kind = '', ordinal = null, format = 'full' } = {}) {
  const source = String(sourceName || '')
  const knownKind = STRUCTURAL_KINDS[kind]
  const number = Number(ordinal)
  const display = (label, value) => label === 'EPISODE' && format === 'reader' ? `EP ${String(value).padStart(2, '0')}`
    : label === 'EPISODE' && format === 'player' ? `EP${String(value).padStart(2, '0')}` : `${label} ${String(value).padStart(2, '0')}`
  if (knownKind && Number.isInteger(number) && number > 0) return display(knownKind, number)
  for (const [pattern, label] of SOURCE_KINDS) {
    const match = source.match(pattern)
    if (match) return display(label, Number(match[1]))
  }
  return source
}
