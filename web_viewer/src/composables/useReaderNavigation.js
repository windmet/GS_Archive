import { ref, shallowRef, computed } from 'vue'
import { chapterReadingPlan, createChapterReadingSession, directoryReadingPlan } from '../core/ChapterReadingPlan.js'
import { readerChapterNavigation } from '../core/ReaderChapterNavigation.js'
import { seasonalReaderChapters } from '../core/SeasonalReaderChapters.js'
import { readerScopeForViewport } from '../core/ReaderViewport.js'
import { readingPlaybackTarget } from '../core/ReadingPlayback.js'
import { createReadingRepository } from '../data/ReadingRepository.js'
import { createReadingSession, knownReadingLocator } from '../core/ReadingSession.js'
import { readyEpisodeReading } from '../data/IdolStoryReading.js'
import { entityShardDescriptor } from '../../readmodels/runtime/ReadModelClient.mjs'
import { buildArchiveSourceQuery, readArchiveSourceRoute } from '../core/archiveRoute.js'
import { PlayerPreferencesRepository } from '../core/story-runtime/PlayerPreferencesRepository.js'
import { playbackPreferencesForReadingMode } from '../core/ReaderPlaybackPreferences.js'
import { saveStoryContentMode, setStoryLanguagePreferences, storyContentMode } from '../utils/LanguageStore.js'

export function useReaderNavigation({
  view, readingDocumentId, readingRowId, readingMode, readingRevision, readingScope,
  currentStoryDomain, currentStorySection, currentEpisodeId, currentStoryFile, currentWorkMode, currentCharacterId,
  currentEventId, eventParentView, currentCategoryId, currentArchiveUnitCode, detailSourceRoute, currentScenarioFile,
  loading, loadingPurpose, collectionReadModelDetail, storyReadModelDetail, eventReadModelDetail,
  workReadModelDetail, idolStoryReadModelDetail, currentStoryCollection, currentStory, currentEventProjection,
  currentWorkIdol, currentIdolStoryPage, navigation, archiveBootstrap, readModelClient, playbackController, playbackError,
  applyArchiveRoute, syncArchiveRoute, currentArchiveRoute, restoreDetailSource, openStoryCatalog, loadCollectionDetail, loadPlayerQueue,
  loadSeasonalLedger = null, seasonalParticipantName = undefined,
}) {
  const readingState = ref({ status: 'idle', document: null, entries: [], error: '' })

  const chapterReadingState = ref(null)

  const readerCollectionDetail = shallowRef(null)

  // Seasonal chapters (one per participant) are navigation only: kept apart from the collection
  // directory so they never stand in for a chapter plan or a document locator.
  const seasonalChapters = shallowRef(null)
  const readingChapterNavigation = computed(() => {
    if (readerCollectionDetail.value) return readerChapterNavigation(readerCollectionDetail.value.view.collection,
      readerCollectionDetail.value.view.readingEntries, readingDocumentId.value, currentStoryFile.value)
    return currentStoryDomain.value === 'seasonal_campaign' && seasonalChapters.value
      ? readerChapterNavigation(seasonalChapters.value.collection, seasonalChapters.value.entries, readingDocumentId.value) : null
  })
  function prepareSeasonalChapters(route) {
    if (route.storyType !== 'seasonal_campaign' || seasonalChapters.value || !loadSeasonalLedger) return
    loadSeasonalLedger().then(ledger => { seasonalChapters.value = seasonalReaderChapters(ledger, seasonalParticipantName) })
      .catch(() => { /* Optional chapter navigation must not block a readable document. */ })
  }

  const readingPlaybackNotice = ref('')

  const readingRepository = createReadingRepository({ locatorResolver: async (documentId, { fresh, signal }) => {
    const descriptor = await entityShardDescriptor(archiveBootstrap, 'reading-docs', documentId, 'reading-docs.shard')
    if (fresh) readModelClient.invalidate(descriptor)
    try {
      const shard = await readModelClient.load(descriptor, { signal, expectedId: descriptor.expectedId,
        validate: data => { if (!Array.isArray(data.rows) || data.rows.some(row => !row.view?.entry || !Array.isArray(row.view.entries))) throw Error('Reading locator shape mismatch') } })
      const row = shard.rows.find(item => item.id === documentId)
      if (row) return row.view
      const exists = (await readingRepository.manifest({signal})).entries.some(entry => entry.document_id === documentId)
      if (exists) throw Error('Reading locator missing from its shard')
      return { entry: null, entries: [] }
    } catch (error) {
      if (error.code !== 'RELEASE_OR_ARTIFACT_MISSING') throw error
      const exists = (await readingRepository.manifest({signal})).entries.some(entry => entry.document_id === documentId)
      if (exists) throw error
      return { entry: null, entries: [] }
    }
  } })

  const readingCatalogEntries = computed(() => {
    if (view.value === 'story_collection' && currentStoryCollection.value)
      return collectionReadModelDetail.value.view.readingEntries
    if (view.value === 'story_detail' && currentStory.value)
      return storyReadModelDetail.value.view.readingEntries
    if (view.value === 'event_detail' && currentEventProjection.value)
      return eventReadModelDetail.value.view.readingEntries
    if (view.value === 'work_archive' && currentWorkIdol.value)
      return workReadModelDetail.value.view.readingEntries
    if (view.value === 'idol_story_archive' && currentIdolStoryPage.value)
      return idolStoryReadModelDetail.value.view.readingEntries
    return []
  })

  const chapterReadingSession = createChapterReadingSession({ repository: readingRepository, publish: state => {
    chapterReadingState.value = state
    const segment = state.segments.find(item => item.documentId === readingDocumentId.value)
    readingState.value = { status: segment?.status || 'not-generated', document: segment?.document || null,
      entries: state.segments.map(item => item.entry).filter(Boolean), error: segment?.error || '' }
  } })

  const readingSession = createReadingSession({ repository: readingRepository, publish: state => { readingState.value = state } })

  // Directory pages pass the reading entry they hold; pages without one (phone calls) pass its id.
  async function loadSynopsisReadingDocument(entryOrId) {
    const entry = typeof entryOrId === 'string' ? (await readingRepository.locator(entryOrId)).entry : entryOrId
    if (!entry) return { status: 'not-generated', document: null }
    return readingRepository.load(entry.document_id, entry, navigation.getLoadOptions())
  }

  async function openStoryReader(documentId, source = {}, returnSourceRoute = '') {
    const context = view.value === 'reader' ? currentArchiveRoute() : { ...source,
      sourceRoute: returnSourceRoute || buildArchiveSourceQuery(currentArchiveRoute()) }
    // A mode that differs from the saved choice (e.g. from a shared link) carries only between
    // documents inside the reader; entering the reader from elsewhere follows the saved choice.
    const carriedMode = view.value === 'reader' && readingMode.value !== storyContentMode.value ? readingMode.value : ''
    const pending = applyArchiveRoute({ ...context, view: 'reader', reading: documentId, readingRow: '', readingRev: '', readingMode: carriedMode, readingScope: source.readingScope ?? context.readingScope ?? '' }, { restoring: false })
    // Publish the requested route immediately, including while text is loading.
    syncArchiveRoute()
    await pending
  }

  async function refreshStoryReader() {
    return navigation.run(async intent => {
      loading.value = true
      try {
        await readingRepository.locator(readingDocumentId.value, { fresh: true })
        if (intent.isCurrent()) await openStoryReader(readingDocumentId.value)
      } catch (error) {
        if (intent.isCurrent()) readingPlaybackNotice.value = `正文刷新失败：${error.message}`
      }
    })
  }

  function openCollectionReader({ chapter, documentId }) {
    return openStoryReader(documentId, { storyType: currentStoryDomain.value,
      storySection: currentStorySection.value, story: chapter.story?.file || chapter.file || '', readingScope:'chapter' })
  }

  function selectReaderDocument(documentId) {
    const segment = readingScope.value === 'chapter' && chapterReadingState.value?.segments.find(item => item.documentId === documentId)
    if (!segment) return openStoryReader(documentId)
    readingDocumentId.value = documentId; readingRowId.value = ''; readingRevision.value = segment.entry?.sha256 || ''
    readingState.value = { status:segment.status, document:segment.document, entries:chapterReadingState.value.segments.map(item=>item.entry).filter(Boolean), error:segment.error }
    syncArchiveRoute({ replace:true })
  }

  async function selectReaderChapter(chapterId) {
    const target = readingChapterNavigation.value?.chapters.find(chapter => chapter.id === chapterId)
    if (!target?.documentId || !target.storyFile || chapterId === readingChapterNavigation.value.chapterId) return
    const context = currentArchiveRoute()
    const source = readArchiveSourceRoute(context.sourceRoute || '')
    if (source.view === 'story_collection' && source.storyType === context.storyType && source.storySection === context.storySection)
      context.sourceRoute = buildArchiveSourceQuery({ ...source, story:target.storyFile })
    // A seasonal chapter is a participant: the page behind the Reader opens on them on return.
    if (context.storyType === 'seasonal_campaign') {
      context.idol = chapterId
      if (source.view === 'seasonal_campaign') context.sourceRoute = buildArchiveSourceQuery({ ...source, idol: chapterId })
    }
    const pending = applyArchiveRoute({ ...context, view:'reader', story:target.storyFile,
      reading:target.documentId, readingRow:'', readingRev:'' }, { restoring:false })
    syncArchiveRoute()
    await pending
  }

  function locateChapterReadingRow({ documentId, rowId, revision }) {
    const segment = chapterReadingState.value?.segments.find(item => item.documentId === documentId)
    if (!segment || segment.status !== 'ready' || segment.entry.sha256 !== revision || !segment.document.rows.some(row => row.anchor.row_id === rowId)) return
    selectReaderDocument(documentId); readingRowId.value = rowId; readingRevision.value = revision; syncArchiveRoute({ replace:true })
  }

  function playChapterReadingSegment({ documentId, rowId }) {
    selectReaderDocument(documentId)
    const segment = chapterReadingState.value?.segments.find(item => item.documentId === documentId)
    if (segment?.status !== 'ready') return
    readingRowId.value = segment.document.rows.some(row=>row.anchor.row_id===rowId) ? rowId : ''
    readingRevision.value = segment.entry.sha256
    return openReaderPlayback(readingRowId.value, { fullDocument:true })
  }

  function closeStoryReader() {
    // Legacy event Reader URLs stored the event's parent; newer URLs store the event itself.
    if (detailSourceRoute.value && (!currentEventId.value ||
        ['event_detail','story_catalog'].includes(readArchiveSourceRoute(detailSourceRoute.value).view))) return restoreDetailSource(openStoryCatalog)
    if (currentStoryDomain.value === 'work' && currentCharacterId.value) {
      const pending = applyArchiveRoute({ view: 'work_archive', storyType: 'work', idol: currentCharacterId.value,
        story: currentStoryFile.value, workMode: currentWorkMode.value }, { restoring: false })
      const revision = navigation.getRevision()
      return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
    }
    if (currentStoryDomain.value === 'seasonal_campaign') {
      const pending = applyArchiveRoute({ view: 'seasonal_campaign', storyType: 'seasonal_campaign',
        storySection: currentStorySection.value, idol: currentCharacterId.value }, { restoring: false })
      const revision = navigation.getRevision()
      return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
    }
    if (currentEventId.value) {
      const pending = applyArchiveRoute({ view: 'event_detail', event: currentEventId.value,
        parentView: eventParentView.value, category: currentCategoryId.value,
        unit: currentArchiveUnitCode.value, sourceRoute: detailSourceRoute.value }, { restoring: false })
      const revision = navigation.getRevision()
      return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
    }
    if (!currentStorySection.value && !currentStoryFile.value) return openStoryCatalog()
    const pending = applyArchiveRoute({ view: currentStorySection.value ? 'story_collection' : 'story_detail', storyType: currentStoryDomain.value,
      storySection: currentStorySection.value, story: currentStoryFile.value }, { restoring: false })
    const revision = navigation.getRevision()
    return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
  }

  function returnToReader() {
    const route = { ...currentArchiveRoute(), view: 'reader', story: currentStoryFile.value, reading: readingDocumentId.value, readingRow: readingRowId.value,
      readingMode: readingMode.value === storyContentMode.value ? '' : readingMode.value, readingRev: readingRevision.value, readingScope:readingScope.value,
      category: currentEventId.value ? currentCategoryId.value : '',
      unit: currentEventId.value && eventParentView.value === 'unit_detail' ? currentArchiveUnitCode.value : '',
      parentView: currentEventId.value ? eventParentView.value : '',
      sourceRoute: detailSourceRoute.value }
    const pending = applyArchiveRoute(route, { restoring: false })
    syncArchiveRoute()
    return pending
  }

  function openEventReader(documentId) {
    return openStoryReader(documentId, { event: currentEventId.value, parentView: eventParentView.value,
      category: currentCategoryId.value, unit: currentArchiveUnitCode.value,
      sourceRoute: detailSourceRoute.value })
  }

  function openIdolStoryReader({ section, episode }) {
    const entry = readyEpisodeReading(readingCatalogEntries.value, episode)
    if (!entry) return
    const source = { ...currentArchiveRoute(), view: 'idol_story_archive', storyType: 'idol_story',
      idol: currentCharacterId.value, storySection: String(section.id), episode: String(episode.id), story: episode.file }
    return openStoryReader(entry.document_id, source, buildArchiveSourceQuery(source))
  }

  function openSeasonalReader(documentId) {
    return openStoryReader(documentId, { storyType: 'seasonal_campaign', storySection: currentStorySection.value,
      idol: currentCharacterId.value })
  }

  function openWorkReader(file) {
    const entry = readingCatalogEntries.value.find(entry => entry.source_file === file && entry.status === 'ready')
    if (entry) return openStoryReader(entry.document_id, { storyType: 'work', idol: currentCharacterId.value,
      story: file, workMode: currentWorkMode.value })
  }

  async function openReaderPlayback(rowId, { intent: inherited, route, fullDocument = false } = {}) {
    return navigation.run(async intent => {
      readingPlaybackNotice.value = ''
      try {
        const entry = readingState.value.entries.find(e => e.document_id === readingDocumentId.value)
        const revision = route ? route.readingRev : (readingRevision.value || entry?.sha256)
        // An initial index of 1 denotes the full episode; row remains the return location.
        let target
        if (route && ['segment','chapter'].includes(route.playMode) &&
            (route.scenario !== readingState.value.document?.source.file || !route.initialStep)) {
          // A picker URL keeps the original Reader locator while identifying a
          // different full segment. Validate both identities independently.
          if (!entry || revision !== entry.sha256) throw Error('阅读版本已变化，请重新打开本篇正文后再演出。')
          let candidates = readingState.value.entries.filter(item => item.source_file === route.scenario)
          if (!candidates.length && route.storyType && route.storySection) {
            const detail=await loadCollectionDetail(route.storyType,route.storySection,{signal:intent.signal,priority:'foreground'})
            if (!intent.isCurrent()) return false
            const memberships=detail.view.collection.chapters.filter(chapter=>!chapter.canonicalRelation)
              .flatMap(chapter=>chapter.episodes.filter(episode=>episode.file === route.scenario && episode.exists !== false))
            if (memberships.length === 1) candidates=detail.view.readingEntries.filter(item=>item.source_file === route.scenario)
          }
          if (candidates.length !== 1 || ![0,1].includes(route.initialStep || 0)) throw Error('选集来源或演出定位不一致。')
          const selectedEntry = candidates[0]
          const selectedDocument = selectedEntry.document_id === readingDocumentId.value
            ? readingState.value.document : (await readingRepository.load(selectedEntry.document_id, selectedEntry)).document
          if (!intent.isCurrent()) return false
          target = readingPlaybackTarget(selectedDocument, '', selectedEntry.sha256, selectedEntry, { fullDocument:true })
          if (route.startStep !== target.startStep || route.endStep !== target.endStep) {
            const queue = await loadPlayerQueue({ ...route, view:'reader' }, { file:route.scenario, startStep:route.startStep, endStep:route.endStep, signal:intent.signal })
            if (!intent.isCurrent()) return false
            const ranges=(Array.isArray(queue) ? queue : queue.episodes || []).filter(item=>item.file === route.scenario && item.exists !== false)
            if (ranges.length !== 1 || Number(ranges[0].startStep || 1) !== route.startStep || Number(ranges[0].endStep || target.endStep) !== route.endStep || route.startStep < target.startStep || route.endStep > target.endStep) throw Error('选集范围与正式目录不一致。')
            target.startStep=route.startStep; target.endStep=route.endStep
          }
          target.initialStep = route.initialStep
        } else target = readingPlaybackTarget(readingState.value.document, rowId, revision, entry,
          { fullDocument: route ? route.initialStep === 1 : fullDocument })
        if (route && (route.scenario !== target.file || route.startStep !== target.startStep ||
            route.endStep !== target.endStep || route.initialStep !== target.initialStep)) {
          throw Error('链接中的演出范围与正文定位不一致，请从正文重新打开演出。')
        }
        readingRevision.value = revision
        readingRowId.value = rowId
        // Pin the requested text version/row even if media preparation subsequently fails.
        if (!route) syncArchiveRoute({ replace: true })
        loadingPurpose.value = 'story-playback'
        if (!intent.isCurrent()) return false
        const languagePreferences = new PlayerPreferencesRepository().update(
          playbackPreferencesForReadingMode(readingMode.value))
        setStoryLanguagePreferences(languagePreferences)
        const loaded = await playbackController.load(target.file, 'reader', { ...target, intent, syncRoute: !route, lazyQueue: true, entryIntent: route?.playMode || 'segment' })
        if (!loaded && intent.isCurrent()) readingPlaybackNotice.value = playbackError.value
      } catch (error) {
        if (intent.isCurrent()) readingPlaybackNotice.value = error.message
      }
    }, { intent: inherited })
  }

  function updateReadingMode(mode) {
    readingMode.value = saveStoryContentMode(mode)
    syncArchiveRoute({ replace: true })
  }

  function locateReadingRow(rowId) {
    if (view.value !== 'reader' || readingState.value.status !== 'ready' || !readingState.value.document.rows.some(row => row.anchor.row_id === rowId)) return
    readingRowId.value = rowId
    syncArchiveRoute({ replace: true })
  }

  async function resolveReaderContinuationSource(file, returnRoute = currentArchiveRoute()) {
    const mountedFile = currentScenarioFile.value
    let entries = (await readingRepository.locator(returnRoute.reading || readingDocumentId.value)).entries
    if (!entries.some(entry => entry.source_file === file) && returnRoute.storyType && returnRoute.storySection) {
      const detail = await loadCollectionDetail(returnRoute.storyType, returnRoute.storySection, { priority:'background' })
      const chapters=detail.view.collection.chapters
      const owners=chapters.map((chapter,index)=>({chapter,index})).filter(({chapter})=>!chapter.canonicalRelation && chapter.episodes.some(episode=>episode.file === mountedFile))
      if (owners.length !== 1) throw Error('后续演出缺少唯一正式话目来源')
      const {chapter,index}=owners[0], adjacent=chapters[index+1]
      const allowed=chapter.episodes.some(episode=>episode.file === file && episode.exists !== false) ||
        (!adjacent?.canonicalRelation && adjacent?.exists && adjacent.episodes[0]?.exists && adjacent.episodes[0].file === file)
      if (!allowed) throw Error('后续演出不是当前话目或相邻话目的明确入口')
      entries=detail.view.readingEntries
    }
    const candidates = entries.filter(entry => entry.source_file === file)
    if (candidates.length !== 1) throw Error('后续演出缺少唯一正文来源')
    const documentId = candidates[0].document_id
    const { entry } = await readingRepository.locator(documentId)
    const { document } = await readingRepository.load(documentId, entry)
    if (!document || entry.document_id !== documentId || entry.source_file !== file || entry.sha256 !== candidates[0].sha256 || entry.source_sha256 !== candidates[0].source_sha256) throw Error('后续演出缺少匹配正文来源，请返回目录重新打开。')
    return readingPlaybackTarget(document, null, entry.sha256, entry, { fullDocument: true }).readScenario
  }

  async function applyReaderRoute(route, intent) {
    route = { ...route, readingScope:readerScopeForViewport(route) }
    // Reuse only this mounted collection's verified membership. Keep the
    // chapter component mounted while changing its plan; never flash through
    // the generic single-document loading page between two chapters.
    const reusableDirectory = currentStoryDomain.value === route.storyType && currentStorySection.value === route.storySection
      ? view.value === 'reader' ? readerCollectionDetail.value : view.value === 'story_collection' ? collectionReadModelDetail.value : null : null
    readingDocumentId.value = route.reading
    readingRowId.value = route.readingRow || ''
    readingMode.value = route.readingMode || storyContentMode.value
    readingRevision.value = route.readingRev || ''
    readingScope.value = route.readingScope || ''
    chapterReadingSession.close()
    if (route.readingScope !== 'chapter' || !reusableDirectory) chapterReadingState.value = null
    readerCollectionDetail.value = reusableDirectory
    prepareSeasonalChapters(route)
    currentStoryDomain.value = route.storyType || ''
    currentStorySection.value = route.storySection || ''
    currentEpisodeId.value = route.episode || ''
    currentStoryFile.value = route.story || ''
    currentWorkMode.value = route.storyType === 'work' ? (route.workMode || 'stories') : 'stories'
    currentCharacterId.value = route.idol || ''
    currentEventId.value = route.event || ''
    eventParentView.value = route.event ? (route.parentView || '') : ''
    currentCategoryId.value = route.event ? (route.category || '') : ''
    currentArchiveUnitCode.value = route.event && route.parentView === 'unit_detail' ? (route.unit || '') : ''
    detailSourceRoute.value = route.sourceRoute || ''
    readingPlaybackNotice.value = ''
    playbackController.reset()
    view.value = 'reader'
    loading.value = false
    if (readingScope.value === 'chapter') {
      if (!reusableDirectory) readingState.value = { status:'loading', document:null, entries:[], error:'' }
      // The chapter is the story collection's when the page has one (main, unit, birthday, extra),
      // otherwise the Reader directory that already groups a story's parts in order (event
      // episodes, an idol story's 话, a work story). If neither forms, read the one document.
      let plan = null, detail = null
      try {
        if (route.storyType && route.storySection && !route.event) {
          detail = reusableDirectory || await loadCollectionDetail(route.storyType, route.storySection, { signal:intent.signal, priority:'foreground' }).catch(() => null)
          if (!intent.isCurrent()) return
          try { if (detail) plan = chapterReadingPlan(detail.view.collection, detail.view.readingEntries, route.reading, route.story || '') }
          catch { plan = null }
        }
        if (!plan) {
          const locator = await readingRepository.locator(route.reading, { signal:intent.signal })
          if (!intent.isCurrent()) return
          plan = directoryReadingPlan(locator, route.reading)
          detail = null
        }
      } catch { plan = null }
      if (!intent.isCurrent()) return
      if (plan) {
        if (detail) readerCollectionDetail.value = detail
        await chapterReadingSession.open(plan, intent)
      } else {
        readingScope.value = ''
        chapterReadingState.value = null
        await readingSession.open(route.reading, intent, knownReadingLocator(reusableDirectory, route.reading))
      }
    } else {
      const directory = !reusableDirectory && route.storyType && route.storySection ? loadCollectionDetail(route.storyType, route.storySection, { signal:intent.signal, priority:'background' })
        .then(detail => { if (intent.isCurrent()) readerCollectionDetail.value = detail })
        .catch(() => { /* Optional chapter navigation must not block a readable document. */ }) : Promise.resolve()
      await readingSession.open(route.reading, intent, knownReadingLocator(reusableDirectory, route.reading))
      await directory
    }
    if (!intent.isCurrent()) return
    if (route.view === 'player') await openReaderPlayback(route.readingRow, { intent, route })
    else if (readingRevision.value && readingRevision.value !== readingState.value.entries.find(e => e.document_id === route.reading)?.sha256) {
      readingPlaybackNotice.value = '阅读版本已变化。请重新选择本篇分段，确认最新正文后再演出。'
    }
    return
  }

  async function loadReaderQueue(route) {
    const locator = await readingRepository.locator(route.reading)
    return locator.entries.map(entry => ({ id: entry.document_id, file: entry.source_file,
      label: entry.episode_label || entry.title, exists: true }))
  }

  return {
    readingState, chapterReadingState, readingPlaybackNotice, readingCatalogEntries, readingChapterNavigation, chapterReadingSession,
    loadSynopsisReadingDocument, openStoryReader, refreshStoryReader, openCollectionReader,
    selectReaderDocument, selectReaderChapter, locateChapterReadingRow, playChapterReadingSegment,
    closeStoryReader, returnToReader, openEventReader, openIdolStoryReader, openWorkReader, openSeasonalReader,
    openReaderPlayback, updateReadingMode, locateReadingRow, resolveReaderContinuationSource,
    applyReaderRoute, loadReaderQueue,
  }
}
