import { buildPortalSearchResults, PORTAL_SEARCH_DOMAINS } from './ArchivePortalPresentation.js'
import { eventKindLabels, historicalDate } from './DomainPresentation.mjs'
import { getCharaIconUrl, getUnitLogoUrl } from '../utils/AssetResolver.js'

export const GLOBAL_SEARCH_TABS = Object.freeze([
  { id: 'all', label: '全部' },
  { id: 'idols', label: '偶像' },
  { id: 'units', label: '组合' },
  { id: 'cards', label: '卡片' },
  { id: 'songs', label: '歌曲' },
  { id: 'stories', label: '剧情' },
  { id: 'events', label: '活动' },
  { id: 'gashas', label: '卡池' },
  { id: 'collection', label: '图鉴' },
])

export const GLOBAL_SEARCH_PRIMARY_DOMAINS = Object.freeze([...PORTAL_SEARCH_DOMAINS, 'events', 'gashas'])
export const GLOBAL_SEARCH_COLLECTION_DOMAINS = Object.freeze(['items', 'costumes', 'currencies', 'honors'])

const COLLECTION_SINGULAR = Object.freeze({
  items: 'item',
  costumes: 'costume',
  currencies: 'currency',
  honors: 'honor',
})

const COLLECTION_LABEL = Object.freeze({
  items: '道具',
  costumes: '服装',
  currencies: '货币',
  honors: '称号',
})

const GASHA_CATEGORY_LABEL = Object.freeze({
  standard_pickup: '常驻 / 活动卡池',
  growing_fes: 'GROWING FES',
  stage_step_up: '阶段卡池',
  full_roster_series: '全员系列',
  ticket_named: '券池',
})

const text = value => typeof value === 'string' ? value : ''
const normalizeSearch = value => text(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
const safeAssetUrl = value => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg|jpeg)$/u.test(value) && !value.includes('..')

export function parseSearchTerms(query = '') {
  return normalizeSearch(query).split(' ').filter(Boolean)
}

function matchesTerms(parts, terms) {
  if (!terms.length) return false
  const haystack = normalizeSearch(parts.filter(value => typeof value === 'string' && value).join(' '))
  return terms.every(term => haystack.includes(term))
}

export function buildInstantIdolAndUnitResults({ query = '', bootstrap, idolName, idolSearch } = {}) {
  const terms = parseSearchTerms(query)
  if (!terms.length || !Array.isArray(bootstrap?.idols)) return { idols: [], units: [] }
  const idols = []
  const unitsByCode = new Map()
  for (const row of bootstrap.idols) {
    const label = (typeof idolName === 'function' ? idolName(row.id, row.name) : '') || row.name
    const searchAlias = typeof idolSearch === 'function' ? idolSearch(row.id, row.name) : ''
    if (matchesTerms([row.name, label, row.kana, row.unitName, row.unitCode, row.id, searchAlias], terms)) {
      idols.push({
        key: `idols:${row.id}`,
        domain: 'idols',
        idolCode: row.id,
        accentColor: row.color || '',
        label,
        subtitle: text(row.unitName),
        image: { url: getCharaIconUrl(row.id), kind: 'idol_icon', status: 'catalogued' },
        target: { domain: 'idols', view: 'idol_detail', idolCode: row.id },
      })
    }
    if (row.unitCode) {
      if (!unitsByCode.has(row.unitCode)) {
        unitsByCode.set(row.unitCode, {
          unitCode: row.unitCode,
          unitName: text(row.unitName) || row.unitCode,
          members: [],
        })
      }
      unitsByCode.get(row.unitCode).members.push({ id: row.id, name: row.name, label, searchAlias })
    }
  }
  const units = []
  for (const unit of unitsByCode.values()) {
    const memberNames = unit.members.map(member => member.label).join(' · ')
    const searchable = [
      unit.unitName,
      unit.unitCode,
      ...unit.members.flatMap(member => [member.label, member.name, member.searchAlias]),
    ]
    if (matchesTerms(searchable, terms)) {
      units.push({
        key: `units:${unit.unitCode}`,
        domain: 'units',
        unitCode: unit.unitCode,
        label: unit.unitName,
        subtitle: `${unit.members.length} 位成员 · ${memberNames}`,
        image: { url: getUnitLogoUrl(unit.unitCode), kind: 'unit_logo', status: 'catalogued' },
        target: { domain: 'units', view: 'unit_detail', unitCode: unit.unitCode },
      })
    }
  }
  return { idols, units }
}

export function buildExtendedDomainResults({
  query = '',
  rowsByDomain = {},
  bootstrap,
  idolName,
  idolSearch,
  cardTitle,
  cardSearch,
  songTitle,
  storyTitle,
  gashaTitle,
  collectionText,
} = {}) {
  const terms = parseSearchTerms(query)
  if (!terms.length) {
    return { idols: [], units: [], cards: [], songs: [], stories: [], events: [], gashas: [], collection: [] }
  }
  const instant = buildInstantIdolAndUnitResults({ query, bootstrap, idolName, idolSearch })
  const coreRows = {}
  for (const domain of PORTAL_SEARCH_DOMAINS) {
    if (domain !== 'idols' && Array.isArray(rowsByDomain[domain])) coreRows[domain] = rowsByDomain[domain]
  }
  const coreMatches = buildPortalSearchResults({
    query,
    rowsByDomain: coreRows,
    bootstrap,
    idolName,
    idolSearch,
    cardTitle,
    cardSearch,
    songTitle,
    storyTitle,
  })
  const byDomain = {
    idols: instant.idols,
    units: instant.units,
    cards: [],
    songs: [],
    stories: [],
    events: [],
    gashas: [],
    collection: [],
  }
  for (const item of coreMatches) {
    if (byDomain[item.domain]) byDomain[item.domain].push(item)
  }

  for (const row of rowsByDomain.events || []) {
    const title = text(row.title)
    const kind = eventKindLabels[row.eventKind] || ''
    const date = historicalDate(row.release_at)
    const id = String(row.id ?? row.event_id ?? '')
    if (!id) continue
    if (matchesTerms([title, kind, date, id, String(row.event_code || ''), row.isReprint ? '复刻' : ''], terms)) {
      byDomain.events.push({
        key: `events:${id}`,
        domain: 'events',
        label: title || id,
        subtitle: [kind, date, row.isReprint ? '复刻' : ''].filter(Boolean).join(' · '),
        image: safeAssetUrl(row.image?.url) ? { url: row.image.url, kind: 'event_banner', status: 'catalogued' } : null,
        target: { domain: 'events', view: 'event_detail', eventId: id },
      })
    }
  }

  const idolMap = new Map((bootstrap?.idols || []).map(row => [row.id, row]))
  for (const row of rowsByDomain.gashas || []) {
    const id = String(row.id ?? '')
    if (!id) continue
    const sourceTitle = text(row.display_name)
    const label = (typeof gashaTitle === 'function' ? gashaTitle(sourceTitle) : '') || sourceTitle || id
    const categoryLabel = GASHA_CATEGORY_LABEL[row.category] || ''
    const date = historicalDate(row.start_at)
    const pickups = [...(row.related_pickup_cards || []), ...(row.derived_pickup_cards || [])]
    const pickupText = pickups.flatMap(card => {
      const idol = idolMap.get(card.character_id)
      const ownerName = idol ? ((typeof idolName === 'function' ? idolName(idol.id, idol.name) : '') || idol.name) : ''
      const ownerAlias = idol && typeof idolSearch === 'function' ? idolSearch(idol.id, idol.name) : ''
      const localizedCard = typeof cardTitle === 'function' ? cardTitle(card.card_title) : ''
      return [text(card.card_title), localizedCard, ownerName, ownerAlias, text(card.rarity)]
    })
    if (matchesTerms([sourceTitle, label, categoryLabel, date, id, String(row.code || ''), ...pickupText], terms)) {
      byDomain.gashas.push({
        key: `gashas:${id}`,
        domain: 'gashas',
        label,
        subtitle: [categoryLabel, date, row.is_reprint ? '复刻' : ''].filter(Boolean).join(' · '),
        image: safeAssetUrl(row.banner_url) ? { url: row.banner_url, kind: 'gasha_banner', status: 'catalogued' } : null,
        target: { domain: 'gashas', view: 'gasha_detail', gashaId: id },
      })
    }
  }

  for (const kind of GLOBAL_SEARCH_COLLECTION_DOMAINS) {
    const singular = COLLECTION_SINGULAR[kind]
    const kindLabel = COLLECTION_LABEL[kind]
    for (const row of rowsByDomain[kind] || []) {
      const id = String(row.id ?? '')
      if (!id) continue
      const sourceName = text(row.nameJa) || text(row.displayName) || text(row.name)
      const translated = typeof collectionText === 'function' ? collectionText(kind, sourceName, row) : ''
      const label = translated || sourceName || id
      const idol = row.idolCode ? idolMap.get(row.idolCode) : null
      const ownerName = idol ? ((typeof idolName === 'function' ? idolName(idol.id, idol.name) : '') || idol.name) : ''
      const ownerAlias = idol && typeof idolSearch === 'function' ? idolSearch(idol.id, idol.name) : ''
      if (matchesTerms([sourceName, translated, row.displayName, row.name, kindLabel, ownerName, ownerAlias, row.resourceId, id], terms)) {
        byDomain.collection.push({
          key: `collection:${singular}:${id}`,
          domain: 'collection',
          collectionKind: kind,
          label,
          subtitle: [kindLabel, ownerName].filter(Boolean).join(' · '),
          image: safeAssetUrl(row.image?.url) ? { url: row.image.url, kind: `${singular}_icon`, status: 'catalogued' } : null,
          target: { domain: 'collection', view: 'collection_entity', entityKey: `${singular}:${id}` },
        })
      }
    }
  }

  return byDomain
}
