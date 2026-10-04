import { getCardIconUrl, getCardLandscapeUrl, getCardLargeImageUrl, getCardPortraitUrl } from '../utils/CardAssetResolver.js'
import { getCharaIconUrl } from '../utils/AssetResolver.js'
import { eventKindLabels, historicalDate } from './DomainPresentation.mjs'

export const PORTAL_SEARCH_DOMAINS = Object.freeze(['cards', 'stories', 'songs', 'idols'])
const IDOL_CODE = /^\d{3}[a-z0-9]{3}$/i
const CARD_CODE = /^\d{3}[a-z0-9]{3}_[a-z0-9_]+$/i
const SONG_CODE = /^[a-z0-9_]+$/i
const FILE = /^[a-z0-9_]+\.json$/i
const text = value => typeof value === 'string' ? value : ''
const nonempty = value => Boolean(text(value).trim())
const integer = value => Number.isInteger(value) && value >= 0 ? value : null
const normalizeSearch = value => text(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
const sourceText = (callback, source, ...args) => typeof callback === 'function' ? text(callback(source, ...args)) || source : source
const safeAssetUrl = value => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg|jpeg)$/u.test(value) && !value.includes('..')
const storyLabels = { main: '主线剧情', event: '活动剧情', unit_story: '组合剧情', idol_story: '个人剧情',
  card_scenarios: '卡片剧情', work: '工作剧情', birthday: '生日剧情', extra: '额外剧情' }

function requireValue(condition, message) {
  if (!condition) throw new TypeError(`Portal read model: ${message}`)
}

function identities(bootstrap) {
  requireValue(Array.isArray(bootstrap?.idols), 'formal idol directory is missing')
  const result = new Map()
  for (const idol of bootstrap.idols) {
    requireValue(IDOL_CODE.test(idol?.id || '') && !result.has(idol.id), 'formal idol identity is invalid or duplicated')
    result.set(idol.id, idol)
  }
  return result
}

function domainCount(bootstrap, domain) {
  if (domain === 'idols') return Array.isArray(bootstrap?.idols) ? bootstrap.idols.length : null
  return integer(bootstrap?.counts?.[{ cards: 'canonical_cards', stories: 'catalog_story_entries', songs: 'primary_songs' }[domain]])
}

function detailDescriptor(bootstrap, domain, descriptor, id) {
  requireValue(/^[a-f0-9]{64}$/u.test(bootstrap?.release || ''), 'a pinned release is required')
  requireValue(descriptor?.kind === `${domain}.detail` && /^[a-f0-9]{64}$/u.test(descriptor?.sha256 || '') &&
    Number.isInteger(descriptor?.bytes) && descriptor.bytes > 0 &&
    typeof descriptor.url === 'string' && new RegExp(`^/_catalog/v/${bootstrap.release}/${domain}/detail/[a-f0-9]+\\.json$`, 'u').test(descriptor.url),
  `${domain} detail descriptor for ${id} is not pinned to its domain and release`)
  if (descriptor.expectedId !== undefined) requireValue(String(descriptor.expectedId) === id, `${domain} descriptor identity differs from its row`)
}

/** The client validates the envelope/hash; this validates the four core index data and page descriptors. */
export function portalSearchPageDescriptors(bootstrap, domain, indexData) {
  requireValue(PORTAL_SEARCH_DOMAINS.includes(domain), 'unsupported search domain')
  requireValue(/^[a-f0-9]{64}$/u.test(bootstrap?.release || ''), 'a pinned release is required')
  requireValue(bootstrap?.domains?.[domain]?.kind === `${domain}.index`, `${domain} index kind is invalid`)
  requireValue(integer(indexData?.count) !== null && indexData.count === domainCount(bootstrap, domain), `${domain} directory count differs from bootstrap`)
  requireValue(integer(indexData?.searchCount) !== null && indexData.searchCount === indexData.count,
    `${domain} full search count differs from its directory`)
  requireValue(Array.isArray(indexData.searchPages) && (indexData.searchCount === 0 ? indexData.searchPages.length === 0 : indexData.searchPages.length > 0),
    `${domain} search pages are missing`)
  const urls = new Set()
  for (const descriptor of indexData.searchPages) {
    requireValue(descriptor?.kind === `${domain}.search` && /^[a-f0-9]{64}$/u.test(descriptor?.sha256 || '') &&
      Number.isInteger(descriptor?.bytes) && descriptor.bytes > 0 &&
      typeof descriptor.url === 'string' && new RegExp(`^/_catalog/v/${bootstrap.release}/${domain}/search/[a-z0-9_-]+\\.json$`, 'u').test(descriptor.url) &&
      !urls.has(descriptor.url), `${domain} search descriptor is invalid or duplicated`)
    urls.add(descriptor.url)
  }
  return [...indexData.searchPages]
}

function rowIdentity(domain, row, directory) {
  if (domain === 'cards') {
    requireValue(CARD_CODE.test(row?.resource_id || '') && IDOL_CODE.test(row?.character_id || '') &&
      row.resource_id.startsWith(`${row.character_id}_`) && directory.has(row.character_id) &&
      (row.id === undefined || row.id === row.resource_id), 'card identity and owner do not match')
    return row.resource_id
  }
  if (domain === 'songs') {
    requireValue(SONG_CODE.test(row?.song_code || '') && (row.id === undefined || row.id === row.song_code), 'song identity is invalid')
    return row.song_code
  }
  if (domain === 'idols') {
    requireValue(directory.has(row?.id) && nonempty(row?.name) && row.name === directory.get(row.id).name,
      'idol search identity/name differs from formal directory')
    return row.id
  }
  requireValue(nonempty(row?.id) && FILE.test(row?.file || '') && row.id === row.file &&
    Object.hasOwn(storyLabels, row?.domain) && typeof row.exists === 'boolean' &&
    (typeof row.sectionId === 'string' || Number.isInteger(row.sectionId)), 'story identity/file/domain is invalid')
  return row.id
}

/** Validate after flattening every selected search page; no partial count is called complete. */
export function validatePortalSearchRows(domain, rows, bootstrap, { expectedCount } = {}) {
  requireValue(PORTAL_SEARCH_DOMAINS.includes(domain) && Array.isArray(rows), 'search rows must belong to one core domain')
  if (expectedCount !== undefined) requireValue(integer(expectedCount) !== null && rows.length === expectedCount, `${domain} search row count is incomplete`)
  const directory = identities(bootstrap), ids = new Set()
  for (const row of rows) {
    const id = rowIdentity(domain, row, directory)
    requireValue(!ids.has(id), `${domain} search row identity is duplicated`)
    ids.add(id)
    detailDescriptor(bootstrap, domain, row.detail, id)
  }
  return rows
}

function cardImage(row, thumbnail = false) {
  const state = row.asset_status
  if (!state || typeof state !== 'object') return null
  const types = thumbnail ? ['icon', 'portrait', 'large', 'landscape'] : ['portrait', 'large', 'landscape', 'icon']
  const resolvers = { icon: getCardIconUrl, portrait: getCardPortraitUrl, large: getCardLargeImageUrl, landscape: getCardLandscapeUrl }
  for (const kind of types) {
    for (const variant of row.single_state === true ? ['base', 'p'] : ['p', 'base']) {
      if (state[`${variant === 'p' ? 'awakened' : 'normal'}_${kind}`] !== true) continue
      const url = resolvers[kind](row.resource_id, variant === 'p')
      if (safeAssetUrl(url)) return { url, kind: `card_${kind}`, variant, status: 'available' }
    }
  }
  return null
}

function songImage(row) {
  return safeAssetUrl(row.jacket_url) ? { url: row.jacket_url, kind: 'song_jacket', status: 'catalogued' } : null
}

function idolDisplay(id, directory, idolName) {
  const fallback = text(directory.get(id)?.name)
  return typeof idolName === 'function' ? text(idolName(id, fallback)) || fallback : fallback
}

function cardTarget(row) {
  return { domain: 'cards', view: 'card_detail', cardId: row.resource_id, idolCode: row.character_id }
}
function songTarget(row) { return { domain: 'songs', view: 'song_detail', songCode: row.song_code } }
function storyTarget(row) {
  return { domain: 'stories', view: 'story_detail', storyId: row.id, file: row.file,
    storyDomain: row.domain, sectionId: String(row.sectionId) }
}

function boundImage(binding, kind) {
  if (!safeAssetUrl(binding?.url) || binding.status === 'file-not-found') return null
  const verified = binding.status === 'verified-local-file' ||
    (/^[a-f0-9]{64}$/u.test(binding.sha256 || '') && Number.isFinite(binding.width) && binding.width > 0 &&
      Number.isFinite(binding.height) && binding.height > 0)
  return verified ? { ...binding, kind, status: binding.status || 'catalogued' } : null
}

const prioritize = (rows, predicate) => [...rows.filter(predicate), ...rows.filter(row => !predicate(row))]

function songStageTarget(row, manifest, unitCode) {
  if (manifest === null || manifest === undefined) return null
  requireValue(manifest.schemaVersion === 1 && manifest.timeUnit === 'ms' && manifest.songs &&
    typeof manifest.songs === 'object' && !Array.isArray(manifest.songs), 'stage manifest shape is invalid')
  const entries = manifest.songs[row.song_code]
  if (!Array.isArray(entries)) return null
  const ids = new Map()
  for (const group of Object.values(manifest.songs)) {
    for (const entry of Array.isArray(group) ? group : []) {
      if (typeof entry?.id === 'string') ids.set(entry.id, (ids.get(entry.id) || 0) + 1)
    }
  }
  const eligible = entries.filter(entry => SONG_CODE.test(entry?.id || '') && ids.get(entry.id) === 1 &&
    typeof entry.variant === 'string' && ['choreography_candidate', 'special_single'].includes(entry.stageKind) &&
    /^[a-f0-9]{64}$/u.test(entry.entrySha256 || '') &&
    entry.url === `/data/song_timelines/entries/${entry.id}.json`)
  const preferred = unitCode ? eligible.filter(entry => entry.variant === unitCode) : []
  const base = eligible.filter(entry => entry.variant === '')
  const candidates = preferred.length ? preferred : base
  if (candidates.length !== 1) return null
  return { songCode: row.song_code, choreographyId: candidates[0].id }
}

function validateEventRows(rows, bootstrap) {
  requireValue(Array.isArray(rows), 'event overview rows must be an array')
  const ids = new Set()
  for (const row of rows) {
    requireValue(typeof row?.id === 'string' && /^(?:\d+|event:\d+)$/u.test(row.id) && row.id === String(row.event_id) &&
      /^\d+$/u.test(row.event_code || '') && nonempty(row.title) && !ids.has(row.id), 'event identity is invalid or duplicated')
    if (row.id.startsWith('event:')) requireValue(row.id === `event:${row.event_code}`, 'historical event identity differs from its source code')
    ids.add(row.id)
    detailDescriptor(bootstrap, 'events', row.detail, row.id)
  }
}

function preferredStats(preferredId, detail) {
  if (detail !== null && detail !== undefined) requireValue(detail.id === preferredId && detail.view?.profile?.idol_code === preferredId,
    'preferred statistics belong to a different idol')
  const stats = detail?.view?.stats
  return [['cards', '卡片'], ['stories', '个人故事'], ['chats', '个人聊天'], ['phones', '电话通信']]
    .map(([id, label]) => ({ id, label, value: integer(stats?.[id]) }))
}

export function buildPortalDesktopOverview({ bootstrap, cards = [], songs = [], stories = [], events = [], stageManifest = null,
  preferredIdol = null, preferredDetail = null, idolName, cardTitle, songTitle, storyTitle, storySummary, eventTitle,
  loading = false, error = '' } = {}) {
  const directory = identities(bootstrap)
  const preferredId = typeof preferredIdol === 'string' ? preferredIdol : preferredIdol?.id || ''
  requireValue(!preferredId || directory.has(preferredId), 'preferred idol is outside the formal directory')
  validatePortalSearchRows('cards', cards, bootstrap)
  validatePortalSearchRows('songs', songs, bootstrap)
  validatePortalSearchRows('stories', stories, bootstrap)
  validateEventRows(events, bootstrap)
  const stats = preferredStats(preferredId, preferredDetail)
  const preferred = directory.get(preferredId)
  const selectedCards = preferredId ? cards.filter(row => row.character_id === preferredId) : cards
  const rarityOrder = { SSR: 0, SR: 1, R: 2, N: 4 }
  const previewCards = [...selectedCards].sort((left, right) => (rarityOrder[left.rarity] ?? 3) - (rarityOrder[right.rarity] ?? 3))
  const relatedSong = row => Boolean(preferredId && ((nonempty(preferred?.unitName) && row.performance?.unitName === preferred.unitName) ||
    (Array.isArray(row.performance?.performers) && row.performance.performers.some(performer => performer?.id === preferredId))))
  const previewSongs = prioritize(songs, relatedSong)
  const relatedStory = row => Boolean(preferredId && Array.isArray(row.characters) && row.characters.includes(preferredId))
  const previewStories = prioritize(stories.filter(row => row.exists === true), relatedStory)
  const relatedEventIds = new Set((Array.isArray(preferredDetail?.view?.events) ? preferredDetail.view.events : [])
    .map(row => String(row.event_id)))
  const previewEvents = prioritize(events, row => relatedEventIds.has(row.id))
  return {
    counts: [['cards', '卡片'], ['stories', '故事条目'], ['songs', '歌曲'], ['idols', '偶像']]
      .map(([id, label]) => ({ id, label, value: domainCount(bootstrap, id) })),
    preferredStats: stats,
    preferredUnitName: text(preferred?.unitName),
    preferredUnitCode: text(preferred?.unitCode),
    unitCount: [...directory.values()].every(idol => nonempty(idol.unitCode))
      ? new Set([...directory.values()].map(idol => idol.unitCode)).size : null,
    cards: previewCards.slice(0, 3).map(row => ({ id: row.resource_id, title: sourceText(cardTitle, text(row.title) || text(row.title_full)),
      idolName: idolDisplay(row.character_id, directory, idolName), rarity: text(row.rarity), image: cardImage(row), target: cardTarget(row) })),
    songs: previewSongs.slice(0, 4).map(row => ({ id: row.song_code, title: sourceText(songTitle, text(row.title)),
      unitName: text(row.performance?.unitName), image: songImage(row), target: songTarget(row),
      isPreferredRelated: relatedSong(row),
      stageTarget: songStageTarget(row, stageManifest, text(preferred?.unitCode)) })),
    stories: previewStories.slice(0, 3).map(row => ({ id: row.id, title: sourceText(storyTitle, text(row.title)),
      subtitle: [text(row.domainLabel) || storyLabels[row.domain], text(row.episodeLabel) || text(row.subtitle)].filter(Boolean).join(' · '),
      summary: sourceText(storySummary, text(row.preplaySynopsis?.text)),
      cast: [...new Set(row.characters || [])].filter(id => directory.has(id))
        .map(id => ({ id, name: idolDisplay(id, directory, idolName), accentColor: directory.get(id).color || '' })),
      image: boundImage(row.image, 'story_cover') || boundImage(row.resources?.hero, 'story_cover'), target: storyTarget(row) })),
    events: previewEvents.slice(0, 3).map(row => ({ id: row.id, title: sourceText(eventTitle, text(row.title)),
      subtitle: [eventKindLabels[row.eventKind], row.isReprint === true ? '复刻' : '',
        Number.isFinite(row.release_at) && new Date(row.release_at * 1000).getUTCFullYear() > 2000 &&
          new Date(row.release_at * 1000).getUTCFullYear() < 2099 ? historicalDate(row.release_at) : ''].filter(Boolean).join(' · '),
      image: boundImage(row.resources?.hero, 'event_banner') || boundImage(row.image, 'event_banner'),
      target: { domain: 'events', view: 'event_detail', eventId: row.id } })),
    loading: loading === true, error: text(error),
  }
}

export function buildPortalSearchResults({ query = '', rowsByDomain = {}, bootstrap, idolName, idolSearch,
  cardTitle, cardSearch, songTitle } = {}) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  if (!terms.length) return []
  const directory = identities(bootstrap), results = []
  for (const domain of PORTAL_SEARCH_DOMAINS) {
    const rows = rowsByDomain[domain] || []
    validatePortalSearchRows(domain, rows, bootstrap)
    for (const row of rows) {
      let result, searchable
      if (domain === 'cards') {
        const source = text(row.title) || text(row.title_full), label = sourceText(cardTitle, source)
        const owner = idolDisplay(row.character_id, directory, idolName)
        result = { key: `cards:${row.resource_id}`, domain, label, subtitle: [text(row.rarity), owner].filter(Boolean).join(' · '),
          image: cardImage(row, true), target: cardTarget(row) }
        searchable = [source, row.title_full, label, sourceText(cardSearch, source), owner,
          sourceText(idolSearch, row.character_id, text(directory.get(row.character_id)?.name)), row.rarity, row.resource_id]
      } else if (domain === 'songs') {
        const label = sourceText(songTitle, text(row.title)), unit = text(row.performance?.unitName)
        result = { key: `songs:${row.song_code}`, domain, label, subtitle: unit || '歌曲档案', image: songImage(row), target: songTarget(row) }
        searchable = [row.title, label, row.kana, row.song_code, unit,
          ...(Array.isArray(row.performance?.performers) ? row.performance.performers.flatMap(idol =>
            [text(idol.displayName), sourceText(idolName, text(idol.id), text(idol.displayName)), sourceText(idolSearch, text(idol.id), text(idol.displayName))]) : []),
          ...(Array.isArray(row.variants) ? row.variants.flatMap(variant => [text(variant.title), text(variant.song_code)]) : [])]
      } else if (domain === 'idols') {
        const metadata = directory.get(row.id), label = idolDisplay(row.id, directory, idolName)
        result = { key: `idols:${row.id}`, domain, label, subtitle: text(metadata.unitName),
          image: { url: getCharaIconUrl(row.id), kind: 'idol_icon', status: 'catalogued' },
          target: { domain: 'idols', view: 'idol_detail', idolCode: row.id } }
        searchable = [row.name, label, metadata.kana, metadata.unitName, row.id, sourceText(idolSearch, row.id, row.name)]
      } else {
        if (row.exists !== true) continue
        result = { key: `stories:${row.id}`, domain, label: text(row.title),
          subtitle: [storyLabels[row.domain], text(row.subtitle)].filter(Boolean).join(' · '), image: null,
          target: storyTarget(row) }
        searchable = [row.title, row.subtitle, storyLabels[row.domain], row.id, row.file,
          ...(Array.isArray(row.characters) ? row.characters.flatMap(id => directory.has(id)
            ? [idolDisplay(id, directory, idolName), text(directory.get(id).name), sourceText(idolSearch, id, text(directory.get(id).name))] : []) : [])]
      }
      const haystack = normalizeSearch(searchable.filter(value => typeof value === 'string').join(' '))
      if (terms.every(term => haystack.includes(term))) results.push(result)
    }
  }
  return results
}
