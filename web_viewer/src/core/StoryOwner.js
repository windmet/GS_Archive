import { communicationOwnerId } from './story-runtime/CommunicationPresentationContext.js'

// Every story file has exactly one page. This decides which, for every entry that opens a story: catalog
// and search rows, portal search, external resources, old story_detail links and the Reader's way back.
// The generic story detail page is only for a story no page owns (none in the current read model;
// scripts/verify-story-owner.mjs checks every story against it).

// Kinds whose stories are chapters of a collection page (story_collection).
export const COLLECTION_STORY_DOMAINS = Object.freeze(['main', 'unit_story', 'extra', 'birthday'])

/** `${domain}:${file}` -> collection section, from the domain landings (their collection ids are the
 *  collection catalogue's ids). Extra and birthday stories carry no section of their own. */
export function landingCollectionSections(landing) {
  const sections = new Map()
  for (const [domain, value] of Object.entries(landing || {})) {
    const files = new Map((value?.logicalEntries || []).map(entry => [entry?.id, entry?.compiledFile]))
    for (const collection of value?.collections || []) {
      const id = String(collection?.id || '')
      if (!id.startsWith(`${domain}:`)) continue
      for (const entryId of collection.logicalEntryIds || []) {
        const file = files.get(entryId)
        if (file && !sections.has(`${domain}:${file}`)) sections.set(`${domain}:${file}`, id.slice(domain.length + 1))
      }
    }
  }
  return sections
}

/** Whether the owner of a story needs the landing sections (see landingCollectionSections). */
export function storyOwnerNeedsLanding(story) {
  return COLLECTION_STORY_DOMAINS.includes(story?.domain) && !story.sectionId
}

/**
 * The page a story belongs to, or null when no page owns it.
 * @param {object} story a story row ({ file, domain, sectionId?, eventRelation? })
 * @param {{ idolIds?: Set<string>, sections?: Map<string,string> }} facts formal idol ids; landing sections
 */
export function storyOwner(story, { idolIds = new Set(), sections = new Map() } = {}) {
  const file = story?.file
  if (!file) return null
  const domain = story.domain
  // Phone calls are 通信 › 电话; their owner is the call itself.
  if (domain === 'card_scenarios') return { view: 'mobile_archive', file }
  if (domain === 'idol_story' || domain === 'work') {
    const idol = communicationOwnerId(file)
    if (!idolIds.has(idol)) return null
    return { view: domain === 'work' ? 'work_archive' : 'idol_story_archive', idol, file }
  }
  // An event's story is part of its event page (reprints share the original's story).
  if (domain === 'event') {
    const event = story.eventRelation?.event_id
    return event ? { view: 'event_detail', event: String(event), file } : null
  }
  if (COLLECTION_STORY_DOMAINS.includes(domain)) {
    const section = String(story.sectionId || sections.get(`${domain}:${file}`) || '')
    return section ? { view: 'story_collection', domain, section, file } : null
  }
  return null
}
