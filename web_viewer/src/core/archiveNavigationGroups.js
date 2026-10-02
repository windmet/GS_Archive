import { ARCHIVE_NAVIGATION } from './archiveRoute.js'

// One shared hierarchy for the sidebar and portal; public route identities remain unchanged.
export const ARCHIVE_NAVIGATION_GROUPS = [
  { id: 'core', label: '核心档案', english: 'CORE', ids: ['stories', 'cards', 'songs', 'idols'] },
  { id: 'records', label: '历程记录', english: 'RECORDS', ids: ['gashas', 'events', 'interactions', 'collections'] },
  { id: 'tools', label: '工具拓展', english: 'TOOLS', ids: ['photos', 'experiments', 'resources'] },
].map(group => ({ ...group, items: group.ids.map(id => ARCHIVE_NAVIGATION.find(item => item.id === id)) }))
