import { validateArchivePayload } from './archiveDataContracts.js'

const ARCHIVE_SOURCES = {
  compiledIndex: '/data/compiled/index.json',
  cardIndex: '/data/masterdata/card_index.json',
  gashaIndex: '/data/masterdata/gasha_index.json',
  eventIndex: '/data/masterdata/event_index.json',
  storyMaster: '/data/masterdata/story_master_index.json',
  storyCatalog: '/data/masterdata/story_catalog.json',
  birthdayStorySemantic: '/data/masterdata/birthday_story_semantic_index.json',
  extraStoryVisualIndex: '/data/masterdata/extra_story_visual_index.json',
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
  songCatalog: '/data/song_catalog.json',
  songPlaybackAudio: '/data/song_playback_audio.json',
  songExperimentalAudio: '/data/song_experimental_audio.json',
  songJacketIndex: '/data/song_jacket_index.json',
}

const CARD_DETAIL_SOURCE = '/data/masterdata/card_detail_index.json'
const IDOL_COMMUNICATION_SOURCES = {
  idolEpisode: '/data/masterdata/idol_episode_index.json',
  mobileArchive: '/data/masterdata/mobile_archive_index.json',
  randomTalkPresentation: '/data/masterdata/random_talk_presentation_index.json',
}

// Each repository owns its cache. The default instance preserves the public API;
// isolated instances allow transport behavior to be exercised without global fetch.
export function createArchiveDataRepository({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  const payloadCache = new Map()

  async function fetchJson(key, url, { fresh = false } = {}) {
    if (!fresh && payloadCache.has(key)) return payloadCache.get(key)

    const request = fetchImpl(url, { cache: fresh ? 'no-store' : 'default' })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          throw new Error('received HTML instead of JSON')
        }
        return validateArchivePayload(key, await response.json())
      })
      .catch(error => {
        // Only this request owns its cache entry. An older failure may arrive
        // after a fresh load or after clear+reload has installed a replacement.
        if (payloadCache.get(key) === request) payloadCache.delete(key)
        throw new Error(`${key} (${url}): ${error.message}`)
      })

    payloadCache.set(key, request)
    return request
  }

  async function loadArchiveData(options = {}) {
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

  function loadCardDetailData(options = {}) {
    return fetchJson('cardDetailIndex', CARD_DETAIL_SOURCE, options)
  }

  async function loadIdolCommunicationData(options = {}) {
    const [idolEpisode, mobileArchive, randomTalkPresentation] = await Promise.all([
      fetchJson('idolEpisode', IDOL_COMMUNICATION_SOURCES.idolEpisode, options),
      fetchJson('mobileArchive', IDOL_COMMUNICATION_SOURCES.mobileArchive, options),
      fetchJson('randomTalkPresentation', IDOL_COMMUNICATION_SOURCES.randomTalkPresentation, options),
    ])
    return { idolEpisode, mobileArchive, randomTalkPresentation }
  }

  function clearArchiveDataCache() {
    payloadCache.clear()
  }

  return { loadArchiveData, loadCardDetailData, loadIdolCommunicationData, clearArchiveDataCache }
}

export const { loadArchiveData, loadCardDetailData, loadIdolCommunicationData, clearArchiveDataCache } = createArchiveDataRepository()

export { ARCHIVE_SOURCES, CARD_DETAIL_SOURCE, IDOL_COMMUNICATION_SOURCES }
