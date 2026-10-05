import { ARCHIVE_NAVIGATION } from './archiveRoute.js'
import { isMaintainerMode } from './maintainerMode.js'

// Sections that only describe the archive's own build state, not the game.
const MAINTAINER_SECTIONS = new Set(['resources'])

// Six destinations organised by what a reader came for. Sub-sections keep their
// route identities; a destination with one visible section renders as a direct link.
// `names` relabels a section inside its destination so a menu never reads "故事 → 故事".
const DESTINATIONS = [
  { id: 'stories', label: '故事', ids: ['stories', 'interactions'], names: { stories: '剧情' } },
  { id: 'people', label: '偶像与卡片', ids: ['idols', 'cards'] },
  { id: 'songs', label: '歌曲', ids: ['songs'] },
  { id: 'history', label: '活动与卡池', ids: ['events', 'gashas'] },
  { id: 'collection', label: '收藏', ids: ['collections', 'honors', 'photos'] },
  { id: 'tools', label: '工具', ids: ['experiments', 'resources'] },
]

export function buildNavigationGroups(maintainer = isMaintainerMode()) {
  return DESTINATIONS.map(group => ({
    ...group,
    items: group.ids
      .filter(id => maintainer || !MAINTAINER_SECTIONS.has(id))
      .map(id => ARCHIVE_NAVIGATION.find(item => item.id === id))
      .map(item => group.names?.[item.id] ? { ...item, label: group.names[item.id] } : item),
  }))
}

export const ARCHIVE_NAVIGATION_GROUPS = buildNavigationGroups()
