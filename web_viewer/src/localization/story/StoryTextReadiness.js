import { uiLocale } from '../ui/UiLocaleStore.js'
import { prepareReaderTitles } from '../../components/archive/useReaderTitles.js'
import { loadArchiveNames } from '../../components/archive/useArchiveNamedText.js'

// Story pages show text from translation files published apart from the read model: Reader
// titles (index + shards) and archive names (work titles, card titles, chat lines). Components used
// to start those downloads when they mounted, so a page first painted its Japanese source and then
// switched to Chinese. Every story page's read-model loader now passes its result through here: the
// translations the page needs are fetched with its data, and the page is shown when both are in,
// or after a short wait at most, in which case the components' own pending states take over.
//
// One table says what each kind of story page needs; nothing else decides it.
const PAGE_TEXT = {
  collection: { names: [] },
  story: { names: [] },
  event: { names: ['cards'] },
  work: { names: ['profiles', 'photos'] },
  idol_story: { names: ['profiles'] },
  mobile: { names: ['chats', 'card-lines', 'profiles'] },
  seasonal: { names: [] },
}
export const STORY_TEXT_WAIT_MS = 1200

export function storyTextNeeds(kind, detail) {
  const page = PAGE_TEXT[kind]
  if (!page) throw new Error(`Unknown story page kind: ${kind}`)
  const documents = (detail?.view?.readingEntries || []).map(entry => entry?.document_id).filter(Boolean)
  return { documents, names: page.names }
}

export async function withStoryText(kind, detail, { signal, waitMs = STORY_TEXT_WAIT_MS, timer = setTimeout } = {}) {
  if (uiLocale.value !== 'zh-CN') return detail
  const { documents, names } = storyTextNeeds(kind, detail)
  const ready = Promise.allSettled([
    prepareReaderTitles(documents, { signal }),
    ...names.map(domain => loadArchiveNames(domain)),
  ])
  await Promise.race([ready, new Promise(resolve => timer(resolve, waitMs))])
  return detail
}
