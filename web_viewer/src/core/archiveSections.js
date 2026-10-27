// One name per destination. The sidebar, phone bar, portal directory, page titles, breadcrumbs and browser
// tabs all read these labels, so a page is called what its navigation entry is called. Ids are route
// sections (archiveRoute.js); glyphs live with the components (components/archive/archiveNavigationIcons.js),
// keyed by the same ids. `shortLabel` is for narrow buttons only; `blurb` is the one-line description a
// tool (not a catalogue) carries where it is offered as a card — what its landing page opens.
export const ARCHIVE_BRAND = Object.freeze({ name: 'GROWING STARS 资料馆', mark: 'GROWING STARS', sub: 'SideM 资料馆', english: 'GROWING STARS 资料馆' })

export const ARCHIVE_SECTIONS = Object.freeze(Object.fromEntries([
  { id: 'home', label: '事务所' },
  { id: 'portal', label: '资料馆' },
  { id: 'stories', label: '剧情', groupId: 'stories' },
  { id: 'interactions', label: '通信', groupId: 'stories' },
  { id: 'idols', label: '偶像', groupId: 'people' },
  { id: 'units', label: '组合', groupId: 'people' },
  { id: 'cards', label: '卡片', groupId: 'people' },
  { id: 'songs', label: '歌曲', groupId: 'songs' },
  // The story score (counsel_calm, job, …), the songs scenes play, ambience and sound effects.
  { id: 'scores', label: '配乐', groupId: 'songs' },
  { id: 'events', label: '活动', groupId: 'history' },
  { id: 'gashas', label: '卡池', groupId: 'history' },
  { id: 'collections', label: '道具', groupId: 'collection' },
  { id: 'honors', label: '称号', groupId: 'collection' },
  { id: 'currencies', label: '货币', groupId: 'collection' },
  { id: 'costumes', label: '服装', groupId: 'collection' },
  { id: 'photos', label: '摄影资源', groupId: 'collection' },
  { id: 'unused', label: '其他语音', groupId: 'collection' },
  { id: 'live', label: 'LIVE', groupId: 'live', blurb: '谱面 · 2D舞台' },
  { id: 'studio', label: '摄影工作台', groupId: 'studio', blurb: '图层拼贴' },
  { id: 'resources', label: '资源', groupId: 'resources' },
  { id: 'about', label: '关于本站' },
].map(section => [section.id, Object.freeze(section)])))

// Sidebar groups, in sidebar order. A group with one section renders as a direct link.
export const ARCHIVE_SECTION_GROUPS = Object.freeze([
  { id: 'stories', label: '剧情与通信' },
  { id: 'people', label: '偶像与卡片' },
  { id: 'songs', label: '歌曲与配乐' },
  { id: 'history', label: '活动与卡池' },
  { id: 'collection', label: '图鉴' },
  { id: 'live', label: 'LIVE' },
  { id: 'studio', label: '摄影工作台' },
  { id: 'resources', label: '资源' },
].map(group => Object.freeze(group)))

// Story kinds whose names appear outside their own page (gateways, idol relations, portal shortcuts).
// card_scenarios are the same 342 calls as 通信 › 电话通信, so they carry that name.
export const STORY_KINDS = Object.freeze({
  // The unit prequels are the game's 第零话 (Episode Zero); the alias is shown on their landing and found by search.
  unit_story: Object.freeze({ label: '组合前传', alias: '第零话' }),
  idol_story: Object.freeze({ label: '个人剧情' }),
  work: Object.freeze({ label: '工作剧情', shortLabel: '工作' }),
  external: Object.freeze({ label: '社区剧情' }),
  card_scenarios: Object.freeze({ label: '电话通信' }),
})

/** The other names a search should find a story kind by (组合前传 is also 第零话). */
export function storyKindAliases(domain) {
  return STORY_KINDS[domain]?.alias ? [STORY_KINDS[domain].alias] : []
}

export function sectionLabel(id) {
  return ARCHIVE_SECTIONS[id]?.label || ''
}
