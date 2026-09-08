import { validateStoryCatalog } from './storyCatalog.js'

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const versionAtLeast = (data, minimum) => Number.isInteger(data.schema_version) && data.schema_version >= minimum
const hasCount = (meta, key, count) => Number.isInteger(meta?.[key]) && meta[key] === count
function indexRows(rows, id) {
  if (!Array.isArray(rows)) return null
  const index = new Map()
  for (const row of rows) {
    if (!isRecord(row) || !['string', 'number'].includes(typeof row[id]) || index.has(String(row[id]))) return null
    index.set(String(row[id]), row)
  }
  return index
}

function validBirthday(data) {
  const chapters = indexRows(data.chapters, 'id')
  const sections = indexRows(data.sections, 'id')
  const announcements = indexRows(data.announcements, 'id')
  if (data.schema_version !== 1 || !chapters || !sections || !announcements || !isRecord(data.by_episode_id)) return false
  const episodes = Object.entries(data.by_episode_id)
  return hasCount(data.meta, 'chapter_count', chapters.size)
    && hasCount(data.meta, 'section_count', sections.size)
    && hasCount(data.meta, 'episode_count', episodes.length)
    && hasCount(data.meta, 'announcement_count', announcements.size)
    && [...sections.values()].every(section => chapters.has(String(section.chapter_id)))
    && episodes.every(([id, episode]) => isRecord(episode)
      && String(episode.episode_id) === id
      && chapters.has(String(episode.chapter_id))
      && sections.get(String(episode.section_id))?.chapter_id === episode.chapter_id
      && Array.isArray(episode.announcement_ids)
      && episode.announcement_ids.every(id => announcements.has(String(id))))
}

function validExtraVisuals(data) {
  const entries = indexRows(data.entries, 'extra_story_entry_id')
  const chapters = indexRows(data.entries, 'chapter_id')
  if (data.schema_version !== 1 || !entries || !chapters || !isRecord(data.by_chapter_id)) return false
  return hasCount(data.meta, 'entry_count', entries.size)
    && Object.keys(data.by_chapter_id).length === chapters.size
    && [...chapters].every(([chapter, entry]) => data.by_chapter_id[chapter] === entry.extra_story_entry_id)
}

function validSongPlayback(data) {
  if (data.schema_version !== 1 || data.status !== 'local-derived' || !Array.isArray(data.scope)
    || !data.scope.includes('song_detail') || !isRecord(data.songs)) return false
  const tracks = Object.entries(data.songs)
  return hasCount(data.summary, 'catalog_songs', tracks.length)
    && hasCount(data.summary, 'full_mix_tracks', tracks.length)
    && tracks.every(([code, track]) => isRecord(track) && track.song_code === code
      && track.kind === 'full-mix' && typeof track.url === 'string' && track.url.startsWith('/assets/'))
}

export function validateArchivePayload(key, payload) {
  if (key === 'storyCatalog') validateStoryCatalog(payload)
  if (!isRecord(payload)) {
    throw new Error(`${key} must be a JSON object`)
  }
  if (key === 'compiledIndex' && !Array.isArray(payload.categories)) {
    throw new Error('compiledIndex.categories must be an array')
  }
  if (key === 'cardIndex' && (!Array.isArray(payload.cards) || !payload.by_character)) {
    throw new Error('cardIndex must include cards and by_character')
  }
  if (key === 'gashaIndex' && (
    !versionAtLeast(payload, 2) ||
    !Array.isArray(payload.gashas) ||
    !payload.by_id ||
    !payload.by_logical_id ||
    !payload.relations_by_card
  )) {
    throw new Error('gashaIndex must include normalized announcement and logical-gasha indexes')
  }
  if (key === 'eventIndex' && (!versionAtLeast(payload, 1) || !Array.isArray(payload.events) || !payload.by_code)) {
    throw new Error('eventIndex must include normalized event and reward indexes')
  }
  if (key === 'cardDetailIndex' && (!payload.cards_by_resource_id || !payload.skills_by_id || !payload.costumes_by_key)) {
    throw new Error('cardDetailIndex is missing normalized card detail dictionaries')
  }
  if (key === 'storyMaster' && !payload.main && !payload.idol_story) {
    throw new Error('storyMaster has no recognized story families')
  }
  if (key === 'birthdayStorySemantic' && !validBirthday(payload)) {
    throw new Error('birthdayStorySemantic must include consistent chapter, section, episode and announcement relations')
  }
  if (key === 'extraStoryVisualIndex' && !validExtraVisuals(payload)) {
    throw new Error('extraStoryVisualIndex must include consistent entry and chapter indexes')
  }
  if (key === 'storyPresentation' && (!payload.by_file || !versionAtLeast(payload, 1))) {
    throw new Error('storyPresentation must include normalized display metadata')
  }
  if (key === 'seasonalCampaign' && (!versionAtLeast(payload, 1) || !Array.isArray(payload.campaigns) || !payload.by_id)) {
    throw new Error('seasonalCampaign must include normalized campaign entities')
  }
  if (key === 'workStory' && (!versionAtLeast(payload, 1) || !Array.isArray(payload.idols) || !payload.by_idol_code)) {
    throw new Error('workStory must include idol work-story entities')
  }
  if (key === 'idolEpisode' && (!versionAtLeast(payload, 1) || !Array.isArray(payload.chapters) || !payload.by_idol_code)) {
    throw new Error('idolEpisode must include normalized chapters and idol indexes')
  }
  if (key === 'mobileArchive' && (!versionAtLeast(payload, 1) || !Array.isArray(payload.scenarios) || !payload.by_kind)) {
    throw new Error('mobileArchive must include normalized scenarios and kind indexes')
  }
  if (key === 'idolUnit' && !payload.by_idol_code) {
    throw new Error('idolUnit.by_idol_code is missing')
  }
  if (key === 'speakerDictionary' && !payload.speakers) {
    throw new Error('speakerDictionary.speakers is missing')
  }
  if (key === 'costumeDictionary' && (!Array.isArray(payload.costumes) || !payload.by_model_resource_id)) {
    throw new Error('costumeDictionary must include costumes and by_model_resource_id')
  }
  if (key === 'archiveManifest' && (!payload.counts || !versionAtLeast(payload, 1))) {
    throw new Error('archiveManifest must include schema_version and counts')
  }
  if (key === 'archiveVerification' && (!payload.scenarios || !payload.dialogue_voices)) {
    throw new Error('archiveVerification must include scenarios and dialogue_voices')
  }
  if (key === 'uiAssetCatalog' && (!Array.isArray(payload.entries) || !payload.meta || !payload.featured_sets)) {
    throw new Error('uiAssetCatalog must include entries, meta and featured_sets')
  }
  if (key === 'rawCharacterImagePromotions' && (
    payload.schema_version !== 1 ||
    !Array.isArray(payload.entries) ||
    payload.entries.some(entry =>
      !entry?.kind ||
      !/^\d{3}[a-z0-9]{3}$/i.test(entry?.idol_code || '') ||
      !String(entry?.asset_url || '').startsWith('/assets/')
    )
  )) {
    throw new Error('rawCharacterImagePromotions must include valid promoted entries')
  }
  if (key === 'externalStoryResources' && (
    payload.schema_version !== 1 ||
    !Array.isArray(payload.entries)
  )) {
    throw new Error('externalStoryResources must include a v1 entries array')
  }
  if (key === 'songCatalog' && (
    payload.schema_version !== 1 ||
    !payload.songs ||
    !payload.summary ||
    typeof payload.songs !== 'object'
  )) {
    throw new Error('songCatalog must include a v1 songs map and summary')
  }
  if (key === 'songExperimentalAudio' && (
    payload.schema_version !== 2 ||
    payload.status !== 'experimental' ||
    !Array.isArray(payload.scope) ||
    !payload.scope.includes('song_detail') ||
    !payload.scope.includes('chibi_stage') ||
    !payload.songs ||
    typeof payload.songs !== 'object'
  )) {
    throw new Error('songExperimentalAudio must include the v2 song-detail and Chibi-stage experimental contract')
  }
  if (key === 'songPlaybackAudio' && !validSongPlayback(payload)) {
    throw new Error('songPlaybackAudio must include consistent local full-mix tracks and summary')
  }
  if (key === 'songJacketIndex' && (
    payload.schema_version !== 1 ||
    !payload.entries ||
    typeof payload.entries !== 'object'
  )) {
    throw new Error('songJacketIndex must include a v1 entries map')
  }
  return payload
}

