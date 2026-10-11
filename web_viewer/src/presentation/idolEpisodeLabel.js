import { chapterLabel } from './chapterLabel.js'
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
  // A combined document covering several talks: スモールトーク1-3 -> SMALL TALK 01–03.
  const range = source.match(/^(.+?)\s*0?(\d+)\s*[-–〜~]\s*0?(\d+)$/u)
  if (range) {
    const [from, to] = [range[2], range[3]].map(value => presentIdolEpisodeLabel({ sourceName: `${range[1]}${value}`, format }))
    const prefix = from.replace(/\s*\d+$/u, '')
    if (prefix && prefix === to.replace(/\s*\d+$/u, '') && prefix !== from) return `${from}–${to.slice(prefix.length).trim()}`
  }
  for (const [pattern, label] of SOURCE_KINDS) {
    const match = source.match(pattern)
    if (match) return display(label, Number(match[1]))
  }
  return chapterLabel(source)
}

// Host-side formatters handed to the story player kernel (queue entries and the "next" label).
export const queueEpisodeLabel = label => presentIdolEpisodeLabel({ sourceName: label })
export const playerEpisodeLabel = label => presentIdolEpisodeLabel({ sourceName: label, format: 'player' })
