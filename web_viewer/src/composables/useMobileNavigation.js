import { computed } from 'vue'
import { resolveMobileArchiveUnit } from '../core/mobileArchiveIdentity.js'
import { communicationOwnerId } from '../core/story-runtime/CommunicationPresentationContext.js'

export function useMobileNavigation({
  mobileIdolReadModelCatalog, mobileUnitReadModelCatalog, mobileIdolReadModelDetail, mobileUnitReadModelDetail,
  mobileReadModelStatus, legacyEntryStatus, currentCharacterId, currentMobileMode,
  currentArchiveUnitCode, currentMobileScenarioId, currentStoryDomain, currentStoryMode,
  currentCategoryId, currentCardId, cardReadModelDetail, archiveBootstrap,
  bootstrapMembership, navigation, readModelClient, idolDisplayName,
  openIdolPicker, captureDetailSource, commitView, commitArchiveSelection,
  goHome, loadScenario, loadCardDetail,
}) {
  const mobileIdolOptions = computed(() => archiveBootstrap.idols.map(idol => ({ idol_code: idol.id, display_name: idolDisplayName(idol.id), color: idol.color })))

  const mobileUnitOptions = computed(() => (mobileUnitReadModelCatalog.value || []).map(unit => ({
    unit_code: unit.id, unit_name: unit.name, unit_color: unit.color,
  })))

  let pendingMobileNavigation = 0

  async function openMobileArchive({ idolCode = '', mode = 'personal', scenarioId = '', scenarioFile = '', fromSection = false } = {}) {
    return navigation.run(async intent => {
      if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('mobile')
      const selectedMode = ['personal', 'phone', 'unit', 'random'].includes(mode) ? mode : 'personal'
      let mobile
      try { mobile = await loadMobileRoute(idolCode, selectedMode) }
      catch (error) {
        if (intent.isCurrent()) {
          console.error('[MobileReadModel] Failed to open archive:', error)
          legacyEntryStatus.value = '通信暂时无法读取，请重试。'
        }
        return
      }
      if (!intent.isCurrent()) return
      legacyEntryStatus.value = ''
      mobileReadModelStatus.value = ''
      if (!fromSection) captureDetailSource()
      mobileIdolReadModelDetail.value = mobile.idol
      mobileUnitReadModelDetail.value = mobile.unit
      currentCharacterId.value = idolCode
      currentMobileMode.value = selectedMode
      currentArchiveUnitCode.value = mobile.unitCode
      // A story-side link knows the call by its compiled file; the archive focuses it by record id.
      const fileScenario = scenarioFile && !scenarioId
        ? [...(mobile.idol?.view?.phoneBundles || []), ...(mobile.idol?.view?.personalBundles || [])]
          .flatMap(bundle => bundle.scenarios).find(scenario => scenario.compiled_file === scenarioFile)
        : null
      currentMobileScenarioId.value = String(scenarioId || fileScenario?.id || '')
      currentStoryDomain.value = 'mobile_archive'
      currentStoryMode.value = 'portal'
      commitView('mobile_archive')
    })
  }

  function openStoryCommunication(scenario) {
    openMobileArchive({
      idolCode: scenario?.idol_code || currentCharacterId.value,
      mode: scenario?.kind === 'idol_phone' ? 'phone' : 'personal',
      scenarioId: scenario?.id || '',
    })
  }

  async function selectMobileIdol(idolCode) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    const request = ++pendingMobileNavigation
    const revision = navigation.getRevision()
    let mobile
    try { mobile = await loadMobileRoute(idolCode, currentMobileMode.value) }
    catch (error) {
      if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
        console.error('[MobileReadModel] Failed to switch idol:', error)
        mobileReadModelStatus.value = '偶像通信暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    mobileIdolReadModelDetail.value = mobile.idol
    mobileUnitReadModelDetail.value = mobile.unit
    mobileReadModelStatus.value = ''
    currentCharacterId.value = idolCode
    currentArchiveUnitCode.value = mobile.unitCode
    currentMobileScenarioId.value = ''
    commitArchiveSelection()
  }

  async function selectMobileUnit(unitCode) {
    if (!mobileUnitOptions.value.some(unit => unit.unit_code === unitCode)) return
    const request = ++pendingMobileNavigation
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadMobileDetail('mobile-units', unitCode) }
    catch (error) {
      if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
        console.error('[MobileReadModel] Failed to switch unit:', error)
        mobileReadModelStatus.value = '组合通信暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    mobileUnitReadModelDetail.value = detail
    mobileReadModelStatus.value = ''
    currentArchiveUnitCode.value = unitCode
    currentMobileScenarioId.value = ''
    commitArchiveSelection()
  }

  async function setMobileMode(mode) {
    if (!['personal', 'phone', 'unit', 'random'].includes(mode)) return
    const request = ++pendingMobileNavigation
    const revision = navigation.getRevision()
    let mobile
    try { mobile = await loadMobileRoute(currentCharacterId.value, mode, currentArchiveUnitCode.value) }
    catch (error) {
      if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
        console.error('[MobileReadModel] Failed to switch mode:', error)
        mobileReadModelStatus.value = '通信分类暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    mobileIdolReadModelDetail.value = mobile.idol
    mobileUnitReadModelDetail.value = mobile.unit
    mobileReadModelStatus.value = ''
    currentMobileMode.value = mode
    currentArchiveUnitCode.value = mobile.unitCode
    currentMobileScenarioId.value = ''
    commitArchiveSelection()
  }

  function playMobileScenario(file) {
    if (file) loadScenario(file, 'mobile_archive')
  }

  function playRandomTalkTopic(topic) {
    if (!topic?.file || !Number(topic.startStep)) return
    loadScenario(topic.file, 'mobile_archive', {
      startStep: topic.startStep,
      endStep: topic.endStep,
    })
  }

  async function openMobileCard(cardId) {
    const refs = currentMobileMode.value === 'unit' ? mobileUnitReadModelDetail.value?.view?.cardRefs : mobileIdolReadModelDetail.value?.view?.cardRefs
    const card = (refs || []).find(entry => Number(entry.card_id) === Number(cardId))
    if (!card) return
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadCardDetail(card.resource_id) }
    catch (error) { console.error('[CardReadModel] Failed to open mobile relation:', error); return }
    if (revision !== navigation.getRevision() || navigation.isDisposed()) return
    cardReadModelDetail.value = detail
    captureDetailSource()
    currentCategoryId.value = 'cards'
    currentCharacterId.value = card.character_id
    currentCardId.value = card.resource_id
    commitView('card_detail')
  }

  function openStoryPhone(story) {
    // The call's owner, not its first listed speaker: Ren's card call also lists Haruna and Amehiko.
    const idolCode = communicationOwnerId(story?.file) || story?.characters?.[0] || ''
    return openMobileArchive({ idolCode, mode: 'phone', scenarioFile: story?.file || '' })
  }

  async function loadMobileCatalog(domain, options = navigation.getLoadOptions?.() || {}) {
    const idol = domain === 'mobile-idols'
    const current = idol ? mobileIdolReadModelCatalog : mobileUnitReadModelCatalog
    if (current.value) return current.value
    return (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains[domain], options)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || rows.some(row => !row.id || !row.detail ||
        (idol ? !row.idolCode || !row.name : !row.unitCode || !row.name)))
        throw new Error(`${domain} catalog identity or shape mismatch`)
      if (idol && (rows.length !== archiveBootstrap.idols.length ||
        rows.some(row => !archiveBootstrap.idols.some(entry => entry.id === row.id))))
        throw new Error('Mobile idol catalog differs from bootstrap identity')
      options.signal?.throwIfAborted()
      current.value = rows
      return rows
    })()
  }

  async function loadMobileDetail(domain, id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadMobileCatalog(domain, options)).find(entry => entry.id === id)
    if (!row) throw new Error(`Unavailable ${domain} entry: ${id}`)
    return readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (domain === 'mobile-idols' ?
        !Array.isArray(data.view?.personalBundles) || !Array.isArray(data.view?.phoneBundles) || !Array.isArray(data.view?.randomBundles) :
        !Array.isArray(data.view?.unitBundles))
        throw new Error(`${domain} detail identity or shape mismatch`)
    } })
  }

  async function loadMobileRoute(idolCode, mode, requestedUnit = '', options = navigation.getLoadOptions?.() || {}) {
    const [idol, units] = await Promise.all([
      loadMobileDetail('mobile-idols', idolCode, options), loadMobileCatalog('mobile-units', options),
    ])
    const unitCode = resolveMobileArchiveUnit({ idolCode, mode, requestedUnit,
      manifest: bootstrapMembership, units: units.map(unit => ({ unit_code: unit.id })),
      archive: { by_unit_code: Object.fromEntries(units.map(unit => [unit.id, true])) },
    })
    const unit = unitCode ? await loadMobileDetail('mobile-units', unitCode, options) : null
    return { idol, unit, unitCode }
  }

  function goBackFromMobileArchive() {
    currentCharacterId.value = ''
    currentArchiveUnitCode.value = ''
    currentMobileScenarioId.value = ''
    goHome()
  }

  function invalidateMobileNavigation() { ++pendingMobileNavigation }

  async function prepareMobileRoute(route, { isCurrent }) {
    if (route.view === 'mobile_archive' || (route.view === 'player' && route.returnView === 'mobile_archive')) {
      try {
        if (!archiveBootstrap.idols.some(idol => idol.id === route.idol)) throw new Error('Unknown mobile idol')
        const mobile = await loadMobileRoute(route.idol, route.mobileMode || 'personal', route.unit || '')
        if (!isCurrent()) return null
        if (isCurrent()) {
          mobileIdolReadModelDetail.value = mobile.idol
          mobileUnitReadModelDetail.value = mobile.unit
          mobileReadModelStatus.value = ''
        }
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[MobileReadModel] Failed to restore mobile route:', error)
        mobileReadModelStatus.value = '通信暂时无法读取，请重新选择。'
        route = { view: 'idol_picker', pickTarget: 'mobile' }
      }
    }
    return route
  }

  return {
    openMobileArchive, openStoryCommunication, selectMobileIdol, selectMobileUnit,
    setMobileMode, playMobileScenario, playRandomTalkTopic, openMobileCard,
    openStoryPhone, loadMobileCatalog, loadMobileDetail, loadMobileRoute,
    mobileIdolOptions, mobileUnitOptions, goBackFromMobileArchive, invalidateMobileNavigation,
    prepareMobileRoute,
  }
}
