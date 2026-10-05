import { ARCHIVE_NAVIGATION } from './archiveRoute.js'
import { isMaintainerMode } from './maintainerMode.js'

// Sections that only describe the archive's own build state, not the game.
const MAINTAINER_SECTIONS = new Set(['resources'])

// One shared hierarchy for the sidebar and portal; public route identities remain unchanged.
const GROUPS = [
  { id: 'core', label: '核心档案', english: 'CORE', ids: ['stories', 'cards', 'songs', 'idols'] },
  { id: 'records', label: '历程记录', english: 'RECORDS', ids: ['gashas', 'events', 'interactions', 'collections'] },
  { id: 'tools', label: '工具拓展', english: 'TOOLS', ids: ['photos', 'experiments', 'resources'] },
]

export function buildNavigationGroups(maintainer = isMaintainerMode()) {
  return GROUPS.map(group => ({
    ...group,
    items: group.ids
      .filter(id => maintainer || !MAINTAINER_SECTIONS.has(id))
      .map(id => ARCHIVE_NAVIGATION.find(item => item.id === id)),
  }))
}

export const ARCHIVE_NAVIGATION_GROUPS = buildNavigationGroups()
