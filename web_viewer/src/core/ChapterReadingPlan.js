import { readingDirectoryKey } from '../data/ReadingDirectory.js'

export function chapterReadingPlan(collection, entries, documentId, chapterFile = '') {
  const matches = entries.filter(entry => entry.document_id === documentId)
  if (matches.length !== 1) throw Error('阅读分段身份缺失或存在歧义')
  const focused = matches[0]
  const chapters = (collection?.chapters || []).filter(chapter => !chapter.canonicalRelation &&
    (chapter.episodes || []).some(episode => episode.file === focused.source_file))
  if (chapters.length !== 1) throw Error('阅读分段不属于唯一正式话目')
  const chapter = chapters[0]
  if (chapterFile && chapter.story?.file !== chapterFile && chapter.file !== chapterFile) throw Error('阅读分段与请求话目不一致')
  return { chapterId: chapter.id, title: chapter.title, label: chapter.label, documentId,
    segments: chapter.episodes.map(episode => {
      const candidates = entries.filter(entry => entry.source_file === episode.file)
      if (candidates.length > 1) throw Error('同一来源对应多份正文，已停止整话组合')
      return { episodeKey: episode.id, label: episode.label, source_file: episode.file,
        entry: candidates[0] || null, documentId: candidates[0]?.document_id || '',
        status: candidates.length ? 'idle' : 'not-generated', document: null, error: '' }
    }) }
}

// Event episodes have no story collection: the Reader directory the manifest already groups them
// into (one logical story, in in-game order) is their chapter.
export function directoryReadingPlan(locator, documentId) {
  const entries = locator?.entries || []
  const matches = entries.filter(entry => entry.document_id === documentId)
  if (matches.length !== 1) throw Error('阅读分段身份缺失或存在歧义')
  const focused = matches[0]
  return { chapterId: `directory:${readingDirectoryKey(focused)}`, title: focused.title, label: '', documentId,
    segments: entries.map(entry => ({ episodeKey: entry.document_id, label: entry.episode_label, source_file: entry.source_file,
      entry, documentId: entry.document_id, status: 'idle', document: null, error: '' })) }
}

// Own publication, not shared repository requests. At most three requests per
// chapter; a cancelled consumer cannot abort another consumer's cache flight.
export function createChapterReadingSession({ repository, publish }) {
  let generation = 0, state, activeIntent
  const current = token => token === generation && activeIntent?.isCurrent()
  function notify() { publish({ ...state, segments: state.segments.map(segment => ({ ...segment })) }) }
  async function load(segment, token, fresh = false) {
    if (!segment.entry || !current(token)) return
    if (!fresh && segment.document) return
    segment.status = 'loading'; segment.error = ''; notify()
    try {
      const entry = fresh ? (await repository.locator(segment.documentId, { fresh: true, signal:activeIntent.signal })).entry : segment.entry
      if (!entry || entry.source_file !== segment.source_file || entry.document_id !== segment.documentId) throw Error('阅读来源身份变化')
      const result = await repository.load(segment.documentId, entry,{signal:activeIntent.signal})
      if (!current(token)) return
      segment.entry = entry; segment.status = result.status; segment.document = result.document
    } catch (error) { if (current(token)) { segment.status = 'error'; segment.error = error.message } }
    if (current(token)) notify()
  }
  return {
    async open(plan, intent) {
      const token = ++generation; activeIntent = intent
      state = { ...plan, status: 'loading', segments: plan.segments.map(segment => ({ ...segment, ...repository.peek?.(segment.documentId, segment.entry) })) }
      notify()
      const target = state.segments.find(segment => segment.documentId === plan.documentId)
      const pending = state.segments.filter(segment => segment !== target && segment.entry && !segment.document)
      const worker = async () => { while (current(token) && pending.length) await load(pending.shift(), token) }
      // Start target first; other texts fill in independently. No compiled/media.
      const targetFlight = load(target, token)
      void worker(); void worker()
      await targetFlight
      if (current(token)) { state.status = 'ready'; notify(); void worker() }
    },
    retry(documentId) {
      const segment = state?.segments.find(segment => segment.documentId === documentId)
      return segment && segment.status === 'error' ? load(segment, generation, true) : Promise.resolve()
    },
    close() { generation++; activeIntent = null },
  }
}
