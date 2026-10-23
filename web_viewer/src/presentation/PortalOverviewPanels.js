import { sectionLabel } from '../core/archiveSections.js'
import { SONG_LINEUP_TAXONOMY } from './SongPresentation.js'

// The Portal's two cross-link blocks: 通信 (personal chats, unit rooms, phone calls) and 图鉴
// (items, honors, currencies, costumes, photography, other voices). They carry a count only when
// the release-pinned scope provides one; a missing count is shown as nothing, never guessed from
// the four-row story preview.
const count = value => Number.isInteger(value) && value >= 0 ? value : null

export const PORTAL_HUB_GROUPS = Object.freeze([
  {
    id: 'interactions', label: sectionLabel('interactions'), entries: Object.freeze([
      { id: 'personal', label: '个人聊天', countKey: 'chats' },
      { id: 'unit', label: '组合聊天', countKey: 'groups' },
      { id: 'phone', label: '电话通信', countKey: 'phones' },
    ]),
  },
  {
    id: 'collection', label: '图鉴', entries: Object.freeze([
      { id: 'collections', label: sectionLabel('collections'), countKey: 'items' },
      { id: 'honors', label: sectionLabel('honors'), countKey: 'honors' },
      { id: 'currencies', label: sectionLabel('currencies'), countKey: 'currencies' },
      { id: 'costumes', label: sectionLabel('costumes'), countKey: 'costumes' },
      { id: 'photos', label: sectionLabel('photos'), countKey: 'photos' },
      { id: 'unused', label: sectionLabel('unused'), countKey: null },
    ]),
  },
])

/** Entries with their optional count and the navigation intent each one sends. */
export function portalHubGroups(collectionCounts = null) {
  const read = key => key ? count(collectionCounts?.[key]) : null
  return PORTAL_HUB_GROUPS.map(group => ({
    ...group,
    entries: group.entries.map(entry => ({
      ...entry,
      count: read(entry.countKey),
      // 通信 opens the section's tab; 图鉴 opens the section itself.
      target: group.id === 'interactions'
        ? { section: 'interactions', mobileMode: entry.id }
        : { section: entry.id },
    })),
  }))
}

const joined = rows => rows.filter(Boolean).join(' · ')

/**
 * Four compact tiles beside the 担当 hero. Every number comes from the scope's own summary
 * (cardCounts/storyCounts/songCounts/preferredStats); nothing is fetched for this panel.
 */
export function portalPreferredStatTiles({ cardCounts, storyCounts, songCounts, preferredStats } = {}) {
  const stat = id => count(preferredStats?.find?.(row => row.id === id)?.value)
  const chats = stat('chats'), phones = stat('phones')
  return [
    { id: 'cards', label: '卡片', action: 'cards', value: count(cardCounts?.total),
      meta: joined(['SSR', 'SR', 'R'].filter(rarity => count(cardCounts?.rarity?.[rarity]) !== null)
        .map(rarity => `${rarity} ${cardCounts.rarity[rarity]}`)) },
    { id: 'stories', label: '出场剧情', action: 'stories', value: count(storyCounts?.all),
      meta: joined([['main', '主线'], ['event', '活动'], ['personal', '个人'], ['other', '其他']]
        .filter(([key]) => count(storyCounts?.[key]) !== null).map(([key, label]) => `${label} ${storyCounts[key]}`)) },
    { id: 'songs', label: '参与歌曲', action: 'songs', value: count(songCounts?.all),
      meta: joined(SONG_LINEUP_TAXONOMY.filter(entry => entry.id !== 'all')
        .filter(entry => count(songCounts?.[entry.id]) !== null).map(entry => `${entry.label} ${songCounts[entry.id]}`)) },
    { id: 'communication', label: '通信', action: 'mobile',
      value: chats !== null && phones !== null ? chats + phones : null,
      meta: joined([chats !== null && `个人聊天 ${chats}`, phones !== null && `电话 ${phones}`]) },
  ]
}

const CARD_ATTRIBUTES = Object.freeze([
  { id: 'Physical', label: 'Physical', color: 'var(--gs-attr-physical)', icon: 'var(--gs-attr-icon-physical)' },
  { id: 'Intelligence', label: 'Intelli', color: 'var(--gs-attr-intelli)', icon: 'var(--gs-attr-icon-intelli)' },
  { id: 'Mental', label: 'Mental', color: 'var(--gs-attr-mental)', icon: 'var(--gs-attr-icon-mental)' },
])
const CARD_RARITIES = Object.freeze(['SSR', 'SR', 'R', 'N'])

/**
 * The card section's heading chips: three attributes and four rarities, each a jump into the card
 * directory. Counts come from the scope facets; the attribute chips are disabled when the scope has
 * no complete attribute facet (an older scope) and the preview rows do not carry attributes either.
 */
export function portalCardFilters(cardCounts = null, cards = []) {
  const attributeAvailable = Boolean(cardCounts?.attribute && Object.keys(cardCounts.attribute).length === 3)
    || (cards.length > 0 && cards.every(row => row.attribute))
  return {
    attributeAvailable,
    attributes: CARD_ATTRIBUTES.map(attribute => ({ ...attribute,
      count: attributeAvailable ? cardCounts?.attribute?.[attribute.id] ?? cards.filter(row => row.attribute === attribute.id).length : null })),
    rarities: CARD_RARITIES.map(id => ({ id, count: cardCounts?.rarity?.[id] ?? cards.filter(row => row.rarity === id).length })),
  }
}
