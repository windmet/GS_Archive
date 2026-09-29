import { scanProducerPlaceholders } from './producer-placeholder-audit.mjs'
import { readingVisualAvatarEntity } from '../../shared/reading/ReadingVisualIdentity.js'

const roleSurface = 'プロデューサー(?:さん|サン|ちゃん|チャン|くん|クン|君|殿|様)?'
const literalRole = new RegExp(roleSurface, 'gu')
const tenDotSuffix = /^(?:ぴぃちゃん|番長さん|監督|師匠|ボス|さん|Ｐ|P)/u
const boundary = /[\s、。，．。！？!?「」『』（）()：:；;…]/u

export const normalizeSpeakerName = value => String(value || '').normalize('NFKC').replace(/\s+/gu, '').trim()

export function idolSpeakerNames(dictionary) {
  const names = new Map()
  for (const [id, entry] of Object.entries(dictionary.speakers || {})) {
    if (entry.speaker_type !== 'idol' || !/^\d{3}[a-z]{3}$/.test(id)) continue
    const name = normalizeSpeakerName(entry.display_name)
    if (names.has(name)) throw Error(`Ambiguous idol speaker name: ${name}`)
    names.set(name, id)
  }
  return names
}

export function resolveBibleSpeaker(row, names) {
  const speaker = row.speaker || {}
  const publicLabel = speaker.sourceName || ''
  if (speaker.kind === 'idol' && /^\d{3}[a-z]{3}$/.test(speaker.entityId || ''))
    return { id: speaker.entityId, resolution: 'explicit-speaker-id', confidence: 'high', publicLabel }
  if (speaker.kind === 'named') {
    const id = names.get(normalizeSpeakerName(publicLabel))
    if (id) return { id, resolution: 'exact-speaker-dictionary', confidence: 'high', publicLabel }
  }
  const visualId = readingVisualAvatarEntity(row)
  if (visualId) return { id: visualId, resolution: 'visible-actor-candidate', confidence: 'candidate', publicLabel }
  return { id: '', resolution: 'unresolved', confidence: 'unknown', publicLabel }
}

function followingSurface(text, index, length = 8) {
  const rest = Array.from(text.slice(index))
  const result = []
  for (const char of rest) {
    if (boundary.test(char) || result.length >= length) break
    result.push(char)
  }
  return result.join('')
}

export function addressingMatches(text) {
  if (typeof text !== 'string') return []
  const matches = []
  for (const match of scanProducerPlaceholders(text)) {
    if (!match.form.startsWith('●')) continue
    const after = text.slice(match.index + match.form.length)
    const suffix = match.form.length === 4
      ? (after.match(new RegExp(`^${roleSurface}`, 'u'))?.[0] || '')
      : (after.match(tenDotSuffix)?.[0] || '')
    const slot = match.form.length === 4 ? 'producer_slot_4dot'
      : match.form.length === 10 ? 'producer_slot_10dot' : 'unclassified_dot_run'
    matches.push({ index: match.index, surface: match.form, placeholder_class: slot,
      address_suffix: suffix, following_surface: followingSurface(text, match.index + match.form.length,
        match.form.length === 4 ? 12 : 8),
      address_expression: suffix ? `${slot}+${suffix}` : slot })
  }
  for (const match of text.matchAll(literalRole)) {
    const before = text.slice(0, match.index)
    if (before.endsWith('●●●●')) continue
    matches.push({ index: match.index, surface: match[0], placeholder_class: 'literal_producer_term',
      address_suffix: match[0], following_surface: followingSurface(text, match.index, 12),
      address_expression: `literal:${match[0]}` })
  }
  return matches.sort((a, b) => a.index - b.index)
}

export function videoSearchKey(text, match) {
  const before = Array.from(text.slice(0, match.index)).slice(-16).join('')
  const after = Array.from(text.slice(match.index + match.surface.length)).slice(0, 25).join('')
  return `${before}${match.placeholder_class === 'literal_producer_term' ? match.surface : ''}${after}`
    .replace(/\s+/gu, ' ').trim()
}

export function readerLocator(documentId, rowId, base = 'http://127.0.0.1:5176/') {
  const url = new URL(base)
  url.searchParams.set('view', 'reader')
  url.searchParams.set('reading', documentId)
  url.searchParams.set('reading_row', rowId)
  return url.toString()
}

export function csv(rows, fields) {
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  return `${fields.map(cell).join(',')}\n${rows.map(row => fields.map(field => cell(row[field])).join(',')).join('\n')}\n`
}

export function chooseReviewRows(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.speaker_entity_id
      ? `${row.speaker_entity_id}|${row.address_expression}`
      : `unresolved|${row.evidence_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const selected = []
  for (const group of groups.values()) {
    const limit = group.length <= 3 ? group.length : group.length < 20 ? 3 : 5
    const remaining = [...group].sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
    const domains = new Set(), voiceStates = new Set(), documents = new Set()
    while (remaining.length && selected.filter(x => group.includes(x)).length < limit) {
      remaining.sort((a, b) => {
        const score = x => (domains.has(x.domain) ? 0 : 8) +
          (voiceStates.has(x.has_voice) ? 0 : 4) + (documents.has(x.document_id) ? 0 : 2)
        return score(b) - score(a) || a.evidence_id.localeCompare(b.evidence_id)
      })
      const row = remaining.shift()
      selected.push(row)
      domains.add(row.domain); voiceStates.add(row.has_voice); documents.add(row.document_id)
    }
  }
  return selected.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
}
