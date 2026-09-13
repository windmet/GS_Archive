import { normalizeIdolAccentColor } from './idolAccentColor.js'

const IDOL_CODE = /^\d{3}[a-z0-9]{3}$/i

/** Identity comes from the idol dictionary; a missing owner is never replaced by a different idol. */
export function buildIdolReference(idolCode, dictionary, manifest, context = '') {
  const code = IDOL_CODE.test(idolCode || '') ? idolCode : ''
  const profile = code ? dictionary?.by_idol_code?.[code] || dictionary?.idols?.find(idol => idol.idol_code === code) : null
  const displayName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  if (!displayName) {
    return {
      idolCode: code,
      displayName: '姓名待确认',
      unitName: '',
      accentColor: '',
      actionable: false,
      imageCandidates: [],
      source: { kind: 'unresolved', context },
    }
  }

  const membership = manifest?.unit_membership_by_idol?.[code]
  return {
    idolCode: code,
    displayName,
    unitName: membership?.unit_name || profile.unit_name || '',
    accentColor: normalizeIdolAccentColor(profile.color),
    actionable: true,
    imageCandidates: [{ url: `/assets/idols/icons/image_chara_icon_${code}.png`, kind: 'idol_icon' }],
    source: { kind: 'idol_unit_dictionary', context },
  }
}

/** Promoted event art requires both the event ID and compiled story file in source evidence. */
export function buildEventIdolReference(idolCode, dictionary, manifest, registry, event, rawCandidateUrl = '') {
  const eventId = Number(event?.event_id)
  const context = `event:${Number.isFinite(eventId) ? eventId : ''}`
  const reference = buildIdolReference(idolCode, dictionary, manifest, context)
  if (!reference.actionable || !Number.isFinite(eventId) || !event?.file) return reference
  const promotion = (registry?.entries || []).find(entry =>
    entry?.kind === 'event_story_visual' && entry?.idol_code === idolCode &&
    entry?.master_evidence?.event_ids?.some(id => Number(id) === eventId) &&
    entry?.master_evidence?.compiled_files?.includes(event.file) &&
    typeof entry.asset_url === 'string' && entry.asset_url.startsWith('/assets/events/characters/'),
  )
  if (!promotion) return reference
  const visualCandidates = [rawCandidateUrl, promotion.asset_url]
    .filter(url => typeof url === 'string' && url.startsWith('/assets/'))
    .map(url => ({ url, kind: 'event_story_visual' }))
  return {
    ...reference,
    imageCandidates: [...visualCandidates, ...reference.imageCandidates],
    source: { kind: 'event_story_visual_promotion', context },
  }
}
