// One name per destination. The sidebar, phone bar, portal directory, page titles, breadcrumbs and browser
// tabs all read these labels, so a page is called what its navigation entry is called. Ids are route
// sections (archiveRoute.js); glyphs live with the components (components/archive/archiveNavigationIcons.js),
// keyed by the same ids. `shortLabel` is for narrow buttons only.
export const ARCHIVE_BRAND = Object.freeze({ name: 'GS 资料馆', mark: 'GS', sub: '资料馆', english: 'GS Archive' })

export const ARCHIVE_SECTIONS = Object.freeze(Object.fromEntries([
  { id: 'home', label: '事务所' },
  { id: 'portal', label: '资料馆' },
  { id: 'stories', label: '剧情', groupId: 'stories' },
  { id: 'interactions', label: '通信', groupId: 'stories' },
  { id: 'idols', label: '偶像', groupId: 'people' },
  { id: 'units', label: '组合', groupId: 'people' },
  { id: 'cards', label: '卡片', groupId: 'people' },
  { id: 'songs', label: '歌曲', groupId: 'songs' },
  { id: 'events', label: '活动', groupId: 'history' },
  { id: 'gashas', label: '卡池', groupId: 'history' },
  { id: 'collections', label: '道具', groupId: 'collection' },
  { id: 'honors', label: '称号', groupId: 'collection' },
  { id: 'currencies', label: '货币', groupId: 'collection' },
  { id: 'costumes', label: '服装', groupId: 'collection' },
  { id: 'photos', label: '摄影资源', groupId: 'collection' },
  { id: 'unused', label: '其他语音', groupId: 'collection' },
  { id: 'live', label: 'LIVE', groupId: 'live' },
  { id: 'studio', label: '摄影工作台', groupId: 'studio' },
  { id: 'resources', label: '资源', groupId: 'resources' },
  { id: 'about', label: '关于本站' },
].map(section => [section.id, Object.freeze(section)])))

// Sidebar groups, in sidebar order. A group with one section renders as a direct link.
export const ARCHIVE_SECTION_GROUPS = Object.freeze([
  { id: 'stories', label: '剧情与通信' },
  { id: 'people', label: '偶像与卡片' },
  { id: 'songs', label: '歌曲' },
  { id: 'history', label: '活动与卡池' },
  { id: 'collection', label: '图鉴' },
  { id: 'live', label: 'LIVE' },
  { id: 'studio', label: '摄影工作台' },
  { id: 'resources', label: '资源' },
].map(group => Object.freeze(group)))

// Story kinds whose names appear outside their own page (gateways, idol relations, portal shortcuts).
// card_scenarios are the same 342 calls as 通信 › 电话通信, so they carry that name.
export const STORY_KINDS = Object.freeze({
  idol_story: Object.freeze({ label: '个人剧情' }),
  work: Object.freeze({ label: '工作剧情', shortLabel: '工作' }),
  external: Object.freeze({ label: '社区剧情' }),
  card_scenarios: Object.freeze({ label: '电话通信' }),
})

export function sectionLabel(id) {
  return ARCHIVE_SECTIONS[id]?.label || ''
}
