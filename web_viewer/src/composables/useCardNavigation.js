import { computed } from 'vue'
import { cardAttribute } from '../presentation/CatalogIdolScope.js'
import { buildCardRarityTabs, filterArchiveCards } from '../data/cardFilters.js'

export function useCardNavigation({
  cardReadModelCatalog, cardReadModelDetail, cardReadModelStatus, currentCharacterId,
  currentCardId, currentCardRarity, currentCardAttribute, currentCardAssetState,
  currentCardRelationState, filterQuery, currentArchiveUnit, unitReadModelStatus,
  currentCategoryId, currentArchiveUnitCode, currentIdolUnitFilter, currentGroup,
  detailSourceRoute, currentEventId, eventParentView, view,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, restoreDetailSource,
  commitArchiveSelection, openIdolReadModel, loadScenario, openEventDetail,
  openGasha, idolDisplayName, idolSourceName, archiveNamedSearchText,
  fetch,
}) {
  let pendingCardNavigation = 0

  const currentCards = computed(() => (cardReadModelCatalog.value || [])
    .filter(card => !currentCharacterId.value || card.character_id === currentCharacterId.value))

  const cardRarityTabs = computed(() => buildCardRarityTabs(currentCards.value))

  const filteredCards = computed(() => filterArchiveCards(currentCards.value, {
    query: filterQuery.value,
    titleSearchText: source=>archiveNamedSearchText('card',source,'title'),
    rarity: currentCardRarity.value,
    attribute: currentCardAttribute.value,
    assetState: currentCardAssetState.value,
    relationState: currentCardRelationState.value,
  }))

  const filteredCardRows = computed(() => filteredCards.value.map(card => ({
    ...card,
    ownerReference: card.ownerReference,
  })))

  const currentCard = computed(() => cardReadModelDetail.value?.id === currentCardId.value
    ? cardReadModelDetail.value.card : null)

  const currentCardOwnerReference = computed(() => {
    const reference = cardReadModelDetail.value?.id === currentCardId.value
      ? cardReadModelDetail.value.ownerReference : null
    return reference?.actionable && reference.idolCode
      ? { ...reference, displayName: idolDisplayName(reference.idolCode, reference.displayName) }
      : reference
  })

  const currentCardAssetStatus = computed(() => cardReadModelDetail.value?.id === currentCardId.value
    ? cardReadModelDetail.value.assetStatus : null)

  const currentCardEventRelation = computed(() => cardReadModelDetail.value?.id === currentCardId.value
    ? cardReadModelDetail.value.eventRelation : null)

  const currentCardGashaRelation = computed(() => cardReadModelDetail.value?.id === currentCardId.value
    ? cardReadModelDetail.value.gashaRelation : null)

  const currentCardLimitbreakMaterial = computed(() => cardReadModelDetail.value?.id === currentCardId.value
    ? cardReadModelDetail.value.limitbreakMaterial || null : null)

  const currentCardIndex = computed(() => currentCards.value.findIndex(card => card.resource_id === currentCardId.value))

  const previousCard = computed(() => currentCardIndex.value > 0
    ? currentCards.value[currentCardIndex.value - 1]
    : null)

  const nextCard = computed(() => currentCardIndex.value >= 0 && currentCardIndex.value < currentCards.value.length - 1
    ? currentCards.value[currentCardIndex.value + 1]
    : null)

  const currentSeriesCards = computed(() => {
    const seriesId = currentCard.value?.release_series?.series_id
    if (!seriesId) return []
    return (cardReadModelCatalog.value || [])
      .filter(card => (card.release_series_id || card.release_series?.series_id) === seriesId)
      .map(card => ({ ...card, character_name: idolSourceName(card.character_id) }))
  })

  const currentCardCharacterName = computed(() => {
    const id = currentCharacterId.value
    return id ? idolDisplayName(id) : '全部卡片'
  })

  function openUnitCards() {
    const unitId = String(currentArchiveUnit.value?.unit_id || '')
    if (!unitId) return
    const request = ++pendingCardNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    unitReadModelStatus.value = '正在读取卡片目录…'
    loading.value = true
    return prepareArchivePage('cards', loadCardCatalog()).then(() => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      unitReadModelStatus.value = ''
      captureDetailSource()
      filterQuery.value = ''
      currentCategoryId.value = 'cards'
      currentCharacterId.value = ''
      currentArchiveUnitCode.value = ''
      currentIdolUnitFilter.value = unitId
      currentCardRarity.value = 'all'
      currentCardAttribute.value = 'all'
      currentCardAssetState.value = 'all'
      currentCardRelationState.value = 'all'
      commitView('idols')
    }).catch(error => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[CardReadModel] Failed to load unit cards:', error)
      unitReadModelStatus.value = '卡片目录暂时无法读取，请重试。'
    })
  }

  function goBackToCards() {
    if (detailSourceRoute.value) {
      currentCardId.value = ''
      return restoreDetailSource(() => commitView('cards'))
    }
    currentCardId.value = ''
    commitView('cards')
  }

  function openPrimaryCards(idolCode = '', { captureSource = false, rarity = 'all', attribute = 'all' } = {}) {
    const request = ++pendingCardNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    cardReadModelStatus.value = '正在读取卡片目录…'
    loading.value = true
    return prepareArchivePage('cards', loadCardCatalog()).then(() => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      cardReadModelStatus.value = ''
      if (captureSource) captureDetailSource()
      filterQuery.value = ''
      currentCategoryId.value = 'cards'
      currentCharacterId.value = archiveBootstrap.idols.some(idol => idol.id === idolCode) ? idolCode : ''
      currentGroup.value = null
      currentCardId.value = ''
      currentCardRarity.value = ['SSR','SR','R','N'].includes(rarity) ? rarity : 'all'
      currentCardAttribute.value = ['Physical','Intelligence','Mental'].includes(attribute) ? attribute : 'all'
      currentCardAssetState.value = 'all'
      currentCardRelationState.value = 'all'
      commitView('cards')
    }).catch(error => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[CardReadModel] Failed to load catalog:', error)
      cardReadModelStatus.value = '卡片目录暂时无法读取，请重试。'
    })
  }

  function selectCardIdol(idolCode) {
    if (idolCode !== '' && !archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    currentCharacterId.value = idolCode
    currentCardId.value = ''
    filterQuery.value = ''
    currentCardRarity.value = 'all'
    currentCardAttribute.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    commitArchiveSelection()
  }

  function openCard(card, { resetContext = false, captureSource = false, clearEventContext = false } = {}) {
    if (!card?.resource_id) return
    const id = card.resource_id
    const request = ++pendingCardNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    cardReadModelStatus.value = '正在读取卡片详情…'
    loading.value = true
    return prepareArchivePage('card_detail', loadCardDetail(id)).then(detail => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      cardReadModelDetail.value = detail
      cardReadModelStatus.value = ''
      if (captureSource || view.value !== 'card_detail') captureDetailSource()
      if (clearEventContext) { currentEventId.value = ''; eventParentView.value = '' }
      if (resetContext) {
        currentCategoryId.value = 'cards'
        currentCharacterId.value = card.character_id
        filterQuery.value = ''
      }
      currentCardId.value = id
      commitView('card_detail')
    }).catch(error => {
      if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[CardReadModel] Failed to load detail:', error)
      cardReadModelStatus.value = '卡片详情暂时无法读取，请重试。'
    })
  }

  function openCardIdol(idolCode) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode) || currentCard.value?.character_id !== idolCode) return
    return openIdolReadModel(idolCode, { captureSource: true, resetContext: true })
  }

  function openCardGasha(relation) {
    if (!relation?.announcement_id) return
    openGasha({ id: String(relation.announcement_id) })
  }

  function openRelatedCard(card) {
    if (!card?.resource_id || !card?.character_id) return
    return openCard(card, { resetContext: true, captureSource: true })
  }

  function openCollectionCard(card) {
    if (!['collection_catalog', 'event_detail'].includes(view.value) ||
        card?.target?.view !== 'card_detail' || card.target.card !== card.resource_id ||
        !card.resource_id || !card.character_id) return
    return openCard(card, { resetContext: true, captureSource: true, clearEventContext: true })
  }

  function goBackFromCards() {
    currentCardId.value = ''
    currentCardRarity.value = 'all'
    currentCardAttribute.value = 'all'
    filterQuery.value = ''
    currentCategoryId.value = 'idol'
    commitView('idol_detail')
  }

  function openCardScenario(entry) {
    if (entry?.compiled_file) {
      return loadScenario(entry.compiled_file, 'card_detail')
    }
  }

  function openCardEvent(event) {
    return openEventDetail(event, 'card_detail')
  }

  let cardFacetsPromise = null

  function loadCardFacets() {
    if (!cardFacetsPromise) cardFacetsPromise = fetch('/data/assets/portal_card_facets.json').then(response => {
      if (!response.ok) throw Error('Card attributes unavailable')
      return response.json()
    }).catch(error => { cardFacetsPromise = null; throw error })
    return cardFacetsPromise
  }

  async function loadCardCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (cardReadModelCatalog.value) return cardReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.cards, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.canonical_cards ||
          new Set(rows.map(row => row.resource_id)).size !== rows.length ||
          rows.some(row => row.id !== row.resource_id || !row.detail || !row.ownerReference ||
            !Number.isInteger(row.home_voice_count) || !Number.isInteger(row.scenario_count)))
          throw new Error('Card catalog count or identity mismatch')
        const facets = rows.every(row => ['Physical','Intelligence','Mental'].includes(row.attribute)) ? null : await loadCardFacets().catch(() => null)
        options.signal?.throwIfAborted()
        cardReadModelCatalog.value = rows.map(row => ({ ...row, attribute: row.attribute || cardAttribute(row, facets, archiveBootstrap.release) }))
        return cardReadModelCatalog.value
    })()
  }

  async function loadCardDetail(id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadCardCatalog(options)).find(card => card.resource_id === id)
    if (!row) throw new Error(`Unavailable card: ${id}`)
    return readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (data.card?.resource_id !== id || !data.ownerReference ||
        !Array.isArray(data.card?.home_voice_cues) || !Array.isArray(data.card?.scenario_entries))
        throw new Error('Card detail identity or shape mismatch')
    } })
  }

  async function prepareCardRoute(route, { isCurrent }) {
    if (route.view === 'cards' || route.view === 'card_detail' ||
        (route.view === 'player' && route.returnView === 'card_detail')) {
      try {
        if (route.view === 'cards') {
          await loadCardCatalog()
          if (!isCurrent()) return null
        } else {
          const detail = await loadCardDetail(route.card)
          if (!isCurrent()) return null
          cardReadModelDetail.value = detail
        }
        cardReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[CardReadModel] Failed to restore card route:', error)
        cardReadModelStatus.value = '卡片资料暂时无法读取，请稍后重试。'
        route = { view: 'cards' }
      }
    }
    return route
  }

  function invalidateCardNavigation() { ++pendingCardNavigation }

  return {
    loadCardFacets, loadCardCatalog, loadCardDetail, openUnitCards,
    openPrimaryCards, openCard, selectCardIdol, goBackToCards,
    openCardIdol, openRelatedCard, openCollectionCard, goBackFromCards,
    openCardScenario, openCardEvent, openCardGasha, currentCards,
    cardRarityTabs, filteredCards, filteredCardRows, currentCard,
    currentCardOwnerReference, currentCardAssetStatus, currentCardEventRelation, currentCardGashaRelation,
    currentCardLimitbreakMaterial, currentCardIndex, previousCard, nextCard,
    currentSeriesCards, currentCardCharacterName, prepareCardRoute, invalidateCardNavigation,
  }
}
