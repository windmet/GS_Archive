const ARCHIVE_SOURCES = {
  compiledIndex: '/data/compiled/index.json',
  cardIndex: '/data/masterdata/card_index.json',
  storyMaster: '/data/masterdata/story_master_index.json',
  idolUnit: '/data/masterdata/idol_unit_dictionary.json',
  archiveManifest: '/data/archive_manifest.json',
  archiveVerification: '/data/archive_verification.json',
}

const CARD_DETAIL_SOURCE = '/data/masterdata/card_detail_index.json'

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
  if (key === 'cardDetailIndex' && (!payload.cards_by_resource_id || !payload.skills_by_id || !payload.costumes_by_key)) {
    throw new Error('cardDetailIndex is missing normalized card detail dictionaries')
  }
  if (key === 'storyMaster' && !payload.main && !payload.idol_story) {
    throw new Error('storyMaster has no recognized story families')
  }
  if (key === 'idolUnit' && !payload.by_idol_code) {
    throw new Error('idolUnit.by_idol_code is missing')
  }
  if (key === 'archiveManifest' && (!payload.counts || !payload.schema_version)) {
    throw new Error('archiveManifest must include schema_version and counts')
  }
  if (key === 'archiveVerification' && (!payload.scenarios || !payload.dialogue_voices)) {
    throw new Error('archiveVerification must include scenarios and dialogue_voices')
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

export function clearArchiveDataCache() {
  payloadCache.clear()
}

export { ARCHIVE_SOURCES, CARD_DETAIL_SOURCE }
