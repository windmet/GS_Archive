import { ARCHIVE_NAVIGATION } from './archiveRoute.js'
import { ARCHIVE_SECTIONS, ARCHIVE_SECTION_GROUPS } from './archiveSections.js'
import { isMaintainerMode } from './maintainerMode.js'

// Sections that only describe the archive's own build state, not the game.
const MAINTAINER_SECTIONS = new Set(['resources'])

// Seven destinations (eight in maintainer mode) organised by what a reader came for. Sub-sections keep their
// route identities; a destination with one visible section renders as a direct link. Group and section
// names come from archiveSections.js.
const NAVIGABLE = new Set(ARCHIVE_NAVIGATION.map(item => item.id))
const DESTINATIONS = ARCHIVE_SECTION_GROUPS.map(group => ({
  ...group, ids: Object.values(ARCHIVE_SECTIONS).filter(section => section.groupId === group.id && NAVIGABLE.has(section.id)).map(section => section.id),
}))

export function buildNavigationGroups(maintainer = isMaintainerMode()) {
  return DESTINATIONS.map(group => ({
    ...group,
    items: group.ids
      .filter(id => maintainer || !MAINTAINER_SECTIONS.has(id))
      .map(id => ARCHIVE_NAVIGATION.find(item => item.id === id)),
  })).filter(group => group.items.length)
}

export const ARCHIVE_NAVIGATION_GROUPS = buildNavigationGroups()
