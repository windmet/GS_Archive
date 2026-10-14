import { cardsForCharacter } from './archiveSelectors.js'

export function buildIdolProfile(id, dictionary, manifest) {
  const profile = dictionary?.by_idol_code?.[id]
  if (!profile) return null
  const unit = manifest?.unit_membership_by_idol?.[id]
  return {
    ...profile,
    idol_code: id,
    unit_id: unit?.unit_id || profile.unit_id,
    unit_code: unit?.unit_code || profile.unit_code,
    unit_name: unit?.unit_name || profile.unit_name,
  }
}

export function buildIdolStats(id, { cardIndex, cardMap = new Map(), episodes, mobile } = {}) {
  const chapter = episodes?.by_idol_code?.[id]?.[0]
  const mobileById = new Map((mobile?.scenarios || []).map(scenario => [scenario.id, scenario]))
  const mobileScenarios = (mobile?.by_idol_code?.[id] || []).map(scenarioId => mobileById.get(scenarioId)).filter(Boolean)
  // A personal story is 第N話 sections; Small Talk episodes are counted apart from the Episode parts.
  const storyEpisodes = (chapter?.sections || []).flatMap(section => section.episodes || [])
  const smallTalks = storyEpisodes.filter(episode => /^スモールトーク/u.test(String(episode.name || ''))).length
  return {
    cards: cardsForCharacter(cardIndex, cardMap, id).length,
    stories: episodes ? storyEpisodes.length : null,
    storySections: episodes ? (chapter?.sections || []).length : null,
    storyEpisodes: episodes ? storyEpisodes.length - smallTalks : null,
    storySmallTalks: episodes ? smallTalks : null,
    chats: mobile ? mobileScenarios.filter(scenario => scenario.kind === 'idol_talk').length : null,
    phones: mobile ? mobileScenarios.filter(scenario => scenario.kind === 'idol_phone').length : null,
  }
}

export function eventsForIdol(id, manifest) {
  return (manifest?.unit_event_relations || [])
    .filter(event => (event.characters || []).includes(id))
    .sort((left, right) => Number(left.release_at || 0) - Number(right.release_at || 0))
}

export function songsForIdol(id, catalog) {
  return Object.values(catalog?.songs || {})
    .filter(song => (song.performance_mapping?.performer_idol_codes || []).includes(id))
    .map(song => ({
      song,
      evidenceLabel: song.performance_mapping.performer_basis === 'table46_explicit'
        ? '表 46 明确演唱／参演'
        : '由正式组合归属补全',
    }))
    .sort((left, right) => Number(left.song.song_id || 0) - Number(right.song.song_id || 0))
}

// The game's display age: digits get the unit, a placeholder such as ？？ is shown as is. Never fall back to the internal numeric age.
export function formatIdolAge(displayAge) {
  const text = typeof displayAge === 'string' || typeof displayAge === 'number' ? String(displayAge).trim() : ''
  return /^\d+$/.test(text) ? `${text}岁` : text
}

/** The profile view's 自己紹介 line: the idol's IdolDetail system scenario and its script. */
export function idolSelfIntroduction(id, systemVoiceData) {
  const row = (systemVoiceData?.idols || []).find(idol => idol.idol_code === id)?.idol_detail?.[0]
  if (!row?.compiled_file || !row.voice) return null
  return { file: row.compiled_file, scenarioId: row.scenario_id || '', stepId: row.step_id, label: row.script_label,
    voice: row.voice, speaker: row.speaker || '', text: row.text || '' }
}
