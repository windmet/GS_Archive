const ARCHIVE_SOURCES = {
  compiledIndex: '/data/compiled/index.json',
  cardIndex: '/data/masterdata/card_index.json',
  gashaIndex: '/data/masterdata/gasha_index.json',
  eventIndex: '/data/masterdata/event_index.json',
  storyMaster: '/data/masterdata/story_master_index.json',
  storyPresentation: '/data/masterdata/story_presentation_index.json',
  seasonalCampaign: '/data/masterdata/seasonal_campaign_index.json',
  workStory: '/data/masterdata/work_story_index.json',
  idolUnit: '/data/masterdata/idol_unit_dictionary.json',
  speakerDictionary: '/data/masterdata/speaker_dictionary.json',
  costumeDictionary: '/data/masterdata/costume_dictionary.json',
  archiveManifest: '/data/archive_manifest.json',
  archiveVerification: '/data/archive_verification.json',
  uiAssetCatalog: '/data/assets/ui_asset_catalog.json',
  rawCharacterImagePromotions: '/data/assets/raw_character_image_promotions.json',
  externalStoryResources: '/data/external_story_resources.json',
}

const CARD_DETAIL_SOURCE = '/data/masterdata/card_detail_index.json'
const IDOL_COMMUNICATION_SOURCES = {
  idolEpisode: '/data/masterdata/idol_episode_index.json',
  mobileArchive: '/data/masterdata/mobile_archive_index.json',
}

const payloadCache = new Map()

function validatePayload(key, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${key} must be a JSON object`)
  }
  if (key === 'compiledIndex' && !Array.isArray(payload.categories)) {
    throw new Error('compiledIndex.categories must be an array')
  }
  if (key === 'cardIndex' && (!Array.isArray(payload.cards) || !payload.by_character)) {
    throw new Error('cardIndex must include cards and by_character')
  }
  if (key === 'gashaIndex' && (
    payload.schema_version < 2 ||
    !Array.isArray(payload.gashas) ||
    !payload.by_id ||
    !payload.by_logical_id ||
    !payload.relations_by_card
  )) {
    throw new Error('gashaIndex must include normalized announcement and logical-gasha indexes')
  }
  if (key === 'eventIndex' && (payload.schema_version < 1 || !Array.isArray(payload.events) || !payload.by_code)) {
    throw new Error('eventIndex must include normalized event and reward indexes')
  }
  if (key === 'cardDetailIndex' && (!payload.cards_by_resource_id || !payload.skills_by_id || !payload.costumes_by_key)) {
    throw new Error('cardDetailIndex is missing normalized card detail dictionaries')
  }
  if (key === 'storyMaster' && !payload.main && !payload.idol_story) {
    throw new Error('storyMaster has no recognized story families')
  }
  if (key === 'storyPresentation' && (!payload.by_file || payload.schema_version < 1)) {
    throw new Error('storyPresentation must include normalized display metadata')
  }
  if (key === 'seasonalCampaign' && (payload.schema_version < 1 || !Array.isArray(payload.campaigns) || !payload.by_id)) {
    throw new Error('seasonalCampaign must include normalized campaign entities')
  }
  if (key === 'workStory' && (payload.schema_version < 1 || !Array.isArray(payload.idols) || !payload.by_idol_code)) {
    throw new Error('workStory must include idol work-story entities')
  }
  if (key === 'idolEpisode' && (payload.schema_version < 1 || !Array.isArray(payload.chapters) || !payload.by_idol_code)) {
    throw new Error('idolEpisode must include normalized chapters and idol indexes')
  }
  if (key === 'mobileArchive' && (payload.schema_version < 1 || !Array.isArray(payload.scenarios) || !payload.by_kind)) {
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
  if (key === 'archiveManifest' && (!payload.counts || !payload.schema_version)) {
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
  return payload
}

async function fetchJson(key, url, { fresh = false } = {}) {
  if (!fresh && payloadCache.has(key)) return payloadCache.get(key)

  const request = fetch(url, { cache: fresh ? 'no-store' : 'default' })
    .then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        throw new Error('received HTML instead of JSON')
      }
      return validatePayload(key, await response.json())
    })
    .catch(error => {
      payloadCache.delete(key)
      throw new Error(`${key} (${url}): ${error.message}`)
    })

  payloadCache.set(key, request)
  return request
}

export async function loadArchiveData(options = {}) {
  const entries = Object.entries(ARCHIVE_SOURCES)
  const settled = await Promise.allSettled(
    entries.map(([key, url]) => fetchJson(key, url, options)),
  )
  const data = {}
  const errors = []

  settled.forEach((result, index) => {
    const [key] = entries[index]
    if (result.status === 'fulfilled') data[key] = result.value
    else {
      data[key] = null
      errors.push({ key, error: result.reason })
    }
  })

  return { data, errors }
}

export function loadCardDetailData(options = {}) {
  return fetchJson('cardDetailIndex', CARD_DETAIL_SOURCE, options)
}

export async function loadIdolCommunicationData(options = {}) {
  const [idolEpisode, mobileArchive] = await Promise.all([
    fetchJson('idolEpisode', IDOL_COMMUNICATION_SOURCES.idolEpisode, options),
    fetchJson('mobileArchive', IDOL_COMMUNICATION_SOURCES.mobileArchive, options),
  ])
  return { idolEpisode, mobileArchive }
}

export function clearArchiveDataCache() {
  payloadCache.clear()
}

export { ARCHIVE_SOURCES, CARD_DETAIL_SOURCE, IDOL_COMMUNICATION_SOURCES }
