<template>
  <div id="story-viewer">

    <ArchiveShell
      v-if="archiveShellVisible"
      v-model="filterQuery"
      :active-section="archiveSection"
      :title="archiveTitle"
      :searchable="archiveSearchable"
      :search-placeholder="archiveSearchPlaceholder"
      :show-back="archiveShowBack"
      @navigate="navigateArchiveSection"
      @back="goArchiveBack"
    >
      <ArchiveHome
        v-if="view === 'home'"
        embedded
        :total-files="totalFiles"
        :categories="homeCategories"
        :stats="archiveStats"
        :manifest="archiveManifestData"
        @select="openCategoryById"
        @open-status="openArchiveStatus"
        @open-spine-lab="openSpineLab"
      />

      <ArchiveIdolGrid
        v-if="view === 'idols'"
        embedded
        v-model="filterQuery"
        :title="categoryHeaderText"
        :filter-placeholder="categoryFilterPlaceholder"
        :idols="filteredIdols"
        :unit-options="idolUnitOptions"
        :current-unit="currentIdolUnitFilter"
        :idols-before-unit-filter="searchMatchedIdols.length"
        @back="goHome"
        @select="openIdol"
        @select-unit="currentIdolUnitFilter = $event"
        @open-units="openUnitCatalog"
      />

      <ArchiveCardList
        v-if="view === 'cards'"
        embedded
        v-model="filterQuery"
        :title="currentCardCharacterName"
        :cards="filteredCards"
        :rarity-tabs="cardRarityTabs"
        :current-rarity="currentCardRarity"
        :current-asset-state="currentCardAssetState"
        :current-relation-state="currentCardRelationState"
        v-model:layout="cardLayout"
        @back="goBackFromCards"
        @select-card="openCard"
        @select-rarity="currentCardRarity = $event"
        @select-asset-state="currentCardAssetState = $event"
        @select-relation-state="currentCardRelationState = $event"
      />

      <ArchiveIdolDetail
        v-if="view === 'idol_detail'"
        :idol="currentIdolProfile"
        :stats="currentIdolStats"
        @open-domain="openIdolDomain"
        @open-unit="openUnitFromIdol"
      />

      <ArchiveCardDetail
        v-if="view === 'card_detail'"
        embedded
        :card="currentCard"
        :asset-status="currentCardAssetStatus"
        :art-mode="cardArtMode"
        :previous-card="previousCard"
        :next-card="nextCard"
        :series-cards="currentSeriesCards"
        @back="goBackToCards"
        @preview-voice="previewCardVoice"
        @open-scenario="openCardScenario"
        @navigate-card="openCard"
        @navigate-related-card="openRelatedCard"
        @update:art-mode="cardArtMode = $event"
      />

      <ArchiveGroupList
        v-if="view === 'groups'"
        embedded
        v-model="filterQuery"
        :title="groupTitle"
        :groups="filteredGroups"
        @back="goBackFromGroups"
        @select="openGroup"
      />

      <ArchiveUnitGrid
        v-if="view === 'episode_zero_units'"
        embedded
        :units="episodeZeroUnits"
        @back="goHome"
        @select="openUnit"
      />

      <ArchiveEpisodeList
        v-if="view === 'episodes'"
        embedded
        :unit="currentUnit"
        @back="goBackToUnits"
        @select="openEpisodeFiles"
      />

      <ArchiveFileList
        v-if="view === 'files'"
        embedded
        v-model="filterQuery"
        :title="currentGroup?.title || 'Scenarios'"
        :entries="filteredFileEntries"
        @back="goBackToFiles"
        @select="openScenarioEntry"
      />

      <ArchiveStatus
        v-if="view === 'archive_status'"
        :manifest="archiveManifestData"
        :verification="archiveVerificationData"
        @open-spine-lab="openSpineLab"
      />

      <ArchiveStoryCatalog
        v-if="view === 'story_catalog'"
        :entries="visibleStoryCatalogEntries"
        :domain-options="storyDomainOptions"
        :domain="currentStoryDomain"
        :availability="currentStoryAvailability"
        :sort="currentStorySort"
        :catalog-total="storyCatalog.length"
        :filtered-total="filteredStoryCatalog.length"
        @select="openCatalogStory"
        @load-more="storyVisibleLimit += 80"
        @update:domain="currentStoryDomain = $event"
        @update:availability="currentStoryAvailability = $event"
        @update:sort="currentStorySort = $event"
      />

      <ArchiveUnitCatalog
        v-if="view === 'unit_catalog'"
        :entries="unitCatalogEntries"
        @select="openArchiveUnit"
      />

      <ArchiveUnitDetail
        v-if="view === 'unit_detail'"
        :unit="currentArchiveUnit"
        :members="currentArchiveUnitMembers"
        :stories="currentArchiveUnitStories"
        @open-idol="openUnitMember"
        @open-story="openUnitStory"
      />
    </ArchiveShell>

    <!-- ====== STORY PLAYER ====== -->
    <StoryViewer
      v-if="view === 'player' && currentScenario"
      :scenario-json="currentScenario"
      @back="closePlayer"
      @ready="onPlayerReady"
    />

    <!-- ====== SPINE LAB ====== -->
    <SpineViewer v-if="view === 'spine_lab'" @back="goHome" />

    <!-- ====== PRELOADER LOADING SCREEN ====== -->
    <LoadingScreen :visible="loading" :progress="preloadProgress" />

  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch } from 'vue'
import { IDOL_ID_TO_NAME } from './utils/IdolNameMap.js'
import { groupFileList } from './utils/IndexNormalizer.js'
import { countScenarioFiles, getCategoryCountText } from './utils/IndexStats.js'
import { Preloader } from './utils/Preloader.js'
import LoadingScreen from './components/LoadingScreen.vue'
import ArchiveHome from './components/archive/ArchiveHome.vue'
import ArchiveShell from './components/archive/ArchiveShell.vue'
import ArchiveCardList from './components/archive/ArchiveCardList.vue'
import ArchiveCardDetail from './components/archive/ArchiveCardDetail.vue'
import ArchiveIdolGrid from './components/archive/ArchiveIdolGrid.vue'
import ArchiveIdolDetail from './components/archive/ArchiveIdolDetail.vue'
import ArchiveGroupList from './components/archive/ArchiveGroupList.vue'
import ArchiveFileList from './components/archive/ArchiveFileList.vue'
import ArchiveUnitGrid from './components/archive/ArchiveUnitGrid.vue'
import ArchiveEpisodeList from './components/archive/ArchiveEpisodeList.vue'
import ArchiveStatus from './components/archive/ArchiveStatus.vue'
import ArchiveStoryCatalog from './components/archive/ArchiveStoryCatalog.vue'
import ArchiveUnitCatalog from './components/archive/ArchiveUnitCatalog.vue'
import ArchiveUnitDetail from './components/archive/ArchiveUnitDetail.vue'
import { loadArchiveData } from './data/ArchiveDataRepository.js'
import {
  buildCardMap,
  buildCardRarityTabs,
  buildScenarioMetaByFile,
  buildStoryCatalog,
  cardsForCharacter,
} from './data/archiveSelectors.js'
import {
  onArchivePopState,
  readArchiveRoute,
  writeArchiveRoute,
} from './core/archiveRoute.js'
import { installSpineAnimationDebug } from './debug/installSpineAnimationDebug.js'

const storyViewerLoader = () => import('./core/StoryViewer.vue')
const spineViewerLoader = () => import('./components/SpineViewer.vue')
const StoryViewer = defineAsyncComponent(storyViewerLoader)
const SpineViewer = defineAsyncComponent(spineViewerLoader)

function resolveChatName(ch) {
  // index may store raw chara_id such as "031sak"; resolve to display name.
  if (ch && /^\d{3}[a-z0-9]{3}$/.test(ch.name || '')) {
    return { ...ch, name: IDOL_ID_TO_NAME[ch.name] || ch.name }
  }
  return ch
}

const view = ref('home')
const indexData = ref(null)
const cardIndexData = ref(null)
const storyMasterData = ref(null)
const idolUnitData = ref(null)
const archiveManifestData = ref(null)
const archiveVerificationData = ref(null)
const currentScenario = ref(null)
const currentScenarioFile = ref('')
const currentPreviewCue = ref('')
const filterQuery = ref('')
const loading = ref(false)
const preloadProgress = ref(0)

// Navigation context
const currentCategoryId = ref('')
const currentCharacterId = ref('')
const currentGroup = ref(null)
const currentUnit = ref(null)
const currentArchiveUnitCode = ref('')
const currentEpisodeId = ref('')
const currentCardId = ref('')
const currentCardRarity = ref('all')
const currentCardAssetState = ref('all')
const currentCardRelationState = ref('all')
const cardLayout = ref('compact')
const cardArtMode = ref('clean')
const currentIdolUnitFilter = ref('')
const currentStoryDomain = ref('')
const currentStoryAvailability = ref('all')
const currentStorySort = ref('domain')
const storyVisibleLimit = ref(80)
const returnViewAfterPlayer = ref('files')
let archiveRouteReady = false
let applyingArchiveRoute = false
let removeArchivePopState = null
let removeSpineAnimationDebug = null

const CATEGORIES = [
  { id: 'main_story', name: '主线剧情' },
  { id: 'event', name: '活动剧情' },
  { id: 'idol', name: '偶像个人' },
  { id: 'idol_chat', name: '短信聊天' },
  { id: 'idol_phone', name: '电话聊天' },
  { id: 'cards', name: '卡片档案' },
  { id: 'episode_zero', name: '第零话' },
  { id: 'extra', name: '额外剧情' },
]

const totalFiles = computed(() => countScenarioFiles(indexData.value?.categories || []))
const homeCategories = computed(() => CATEGORIES.map(category => ({
  ...category,
  count: catCountText(category.id),
})))

const archiveStats = computed(() => [
  { label: '剧情文件', value: archiveManifestData.value?.counts?.indexed_scenarios ?? totalFiles.value },
  { label: '偶像', value: archiveManifestData.value?.counts?.idols ?? Object.keys(idolUnitData.value?.by_idol_code || {}).length },
  { label: '卡片', value: archiveManifestData.value?.counts?.cards ?? cardIndexData.value?.meta?.card_count ?? cardIndexData.value?.cards?.length ?? 0 },
  { label: '首页语音', value: archiveManifestData.value?.counts?.home_voice_cues ?? cardIndexData.value?.meta?.home_voice_cue_count ?? 0 },
])

function categoryById(id) {
  if (!indexData.value) return null
  return indexData.value.categories.find(c => c.id === id) || null
}

const currentCategory = computed(() => categoryById(currentCategoryId.value))

function catCountText(id) {
  if (id === 'cards') {
    const cards = cardIndexData.value?.meta?.card_count || cardIndexData.value?.cards?.length || 0
    const chars = Object.keys(cardIndexData.value?.by_character || {}).length
    return cards ? `${cards} cards · ${chars} idols` : ''
  }
  return getCategoryCountText(categoryById(id))
}

// Idol / chat grid.
function withUnitEvidence(entry) {
  if (entry._isGroup) return entry
  const unit = archiveManifestData.value?.unit_membership_by_idol?.[entry.id]
  return unit ? { ...entry, unitId: String(unit.unit_id), unitCode: unit.unit_code, unitName: unit.unit_name } : entry
}

const idolList = computed(() => {
  const catId = currentCategoryId.value
  if (catId === 'cards') {
    const byCharacter = cardIndexData.value?.by_character || {}
    return Object.entries(byCharacter).map(([id, cards]) => withUnitEvidence({
      id,
      name: idolDisplayName(id),
      cardCount: cards.length,
      _isGroup: false,
    }))
  }
  if (catId === 'idol_phone') {
    const cat = categoryById('idol_phone')
    const source = cat?.individual
    if (!source) return []
    return Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...resolveChatName(data), _isGroup: false }))
  }
  const cat = categoryById(catId === 'idol_chat' ? 'idol_chat' : 'idol')
  const source = catId === 'idol_chat' ? cat?.individual : cat?.characters
  if (!source) return []
  // For chat category, also include group chat entries
  if (catId === 'idol_chat' && cat?.groups) {
    const chars = Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...resolveChatName(data), _isGroup: false }))
    const groups = cat.groups.map(g => ({ id: g.unit_code, name: g.unit_name, _isGroup: true, _groupData: g }))
    return [...groups, ...chars]
  }
  return Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...data }))
})

const searchMatchedIdols = computed(() => {
  const q = filterQuery.value.toLowerCase()
  if (!q) return idolList.value
  return idolList.value.filter(ch =>
    ch.name.toLowerCase().includes(q) ||
    String(ch.unitName || '').toLowerCase().includes(q),
  )
})

const filteredIdols = computed(() => {
  if (!currentIdolUnitFilter.value) return searchMatchedIdols.value
  return searchMatchedIdols.value.filter(entry => entry.unitId === currentIdolUnitFilter.value)
})

const idolUnitOptions = computed(() => {
  if (!['idol', 'cards'].includes(currentCategoryId.value)) return []
  const counts = new Map()
  for (const entry of idolList.value) {
    if (entry.unitId) counts.set(entry.unitId, (counts.get(entry.unitId) || 0) + 1)
  }
  return (idolUnitData.value?.units || []).map(unit => ({
    id: String(unit.unit_id),
    code: unit.unit_code,
    name: unit.unit_name,
    count: counts.get(String(unit.unit_id)) || 0,
  })).filter(unit => unit.count)
})

// Group list.
const filteredGroups = computed(() => {
  if (!currentCharacterId.value && !currentCategoryId.value) return []
  let groups = []

  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || []
    } else if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || []
    } else {
      const cat = categoryById('idol')
      const ch = cat?.characters?.[currentCharacterId.value]
      groups = ch?.groups || []
    }
  } else if (currentCategoryId.value) {
    const cat = categoryById(currentCategoryId.value)
    groups = cat?.groups || []
  }

  const q = filterQuery.value.toLowerCase()
  if (!q) return groups
  return groups.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.id.toLowerCase().includes(q)
  )
})

const groupTitle = computed(() => {
  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || currentCharacterId.value
    }
    if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || currentCharacterId.value
    }
    const cat = categoryById('idol')
    const ch = cat?.characters?.[currentCharacterId.value]
    return ch?.name || currentCharacterId.value
  }
  return currentCategory.value?.name || ''
})

const categoryHeaderText = computed(() => {
  if (currentCategoryId.value === 'cards') return '卡片档案'
  if (currentCategoryId.value === 'idol_chat') return '短信聊天'
  if (currentCategoryId.value === 'idol_phone') return '电话聊天'
  return '偶像个人'
})

const categoryFilterPlaceholder = computed(() => {
  if (currentCategoryId.value === 'cards') return 'Search card idol...'
  if (currentCategoryId.value === 'idol_chat') return 'Search chat...'
  if (currentCategoryId.value === 'idol_phone') return 'Search phone...'
  return 'Search idol...'
})

// Episode Zero units.
const episodeZeroUnits = computed(() => {
  const cat = categoryById('episode_zero')
  return cat?.units || []
})

const scenarioMetaByFile = computed(() => buildScenarioMetaByFile(storyMasterData.value))

const storyCatalog = computed(() => buildStoryCatalog(storyMasterData.value))

const storyDomainOptions = computed(() => {
  const counts = new Map()
  const labels = new Map()
  for (const entry of storyCatalog.value) {
    counts.set(entry.domain, (counts.get(entry.domain) || 0) + 1)
    labels.set(entry.domain, entry.domainLabel)
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count, label: labels.get(id) || id }))
})

const filteredStoryCatalog = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  const availability = currentStoryAvailability.value
  const entries = storyCatalog.value.filter(entry =>
    (!currentStoryDomain.value || entry.domain === currentStoryDomain.value) &&
    (availability === 'all' || (availability === 'playable' ? entry.exists : !entry.exists)) &&
    (!query || entry.searchText.includes(query)),
  )
  const sorted = [...entries]
  if (currentStorySort.value === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
  else if (currentStorySort.value === 'resource') sorted.sort((a, b) => a.resourceId.localeCompare(b.resourceId))
  else if (currentStorySort.value === 'steps_desc') sorted.sort((a, b) => (b.summary?.step_count || 0) - (a.summary?.step_count || 0))
  else sorted.sort((a, b) => a.domainOrder - b.domainOrder || a.resourceId.localeCompare(b.resourceId))
  return sorted
})

const visibleStoryCatalogEntries = computed(() => filteredStoryCatalog.value.slice(0, storyVisibleLimit.value))

const unitCatalogEntries = computed(() => (idolUnitData.value?.units || []).map(unit => {
  const unitId = String(unit.unit_id)
  return {
    unit,
    members: Object.entries(archiveManifestData.value?.unit_membership_by_idol || {})
      .filter(([, evidence]) => String(evidence.unit_id) === unitId)
      .map(([idolCode]) => ({ idol_code: idolCode, ...idolUnitData.value?.by_idol_code?.[idolCode] }))
      .sort((a, b) => Number(a.idol_id || 0) - Number(b.idol_id || 0)),
    storyCount: storyCatalog.value.filter(entry => entry.domain === 'unit_story' && entry.unitId === unitId).length,
  }
}))

const currentArchiveUnit = computed(() => (idolUnitData.value?.units || []).find(unit =>
  String(unit.unit_code) === currentArchiveUnitCode.value || String(unit.unit_id) === currentArchiveUnitCode.value,
) || null)

const currentArchiveUnitMembers = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return unitCatalogEntries.value.find(entry => String(entry.unit.unit_id) === id)?.members || []
})

const currentArchiveUnitStories = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return storyCatalog.value
    .filter(entry => entry.domain === 'unit_story' && entry.unitId === id)
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId))
})

function displayTitleForMeta(meta, fallbackFile) {
  const titles = meta?.titles?.filter(Boolean) || []
  if (!titles.length) return formatFileName(fallbackFile || meta?.resourceIds?.[0] || '')
  if (titles.length === 1) return titles[0]
  if (titles.every(title => /^エピソード\d+$/.test(String(title)))) {
    return `${titles[0]} - ${titles[titles.length - 1]}`
  }
  return titles.slice(0, 2).join(' / ') + (titles.length > 2 ? ` +${titles.length - 2}` : '')
}

function fileEntryFor(fn) {
  const meta = scenarioMetaByFile.value.get(fn)
  if (!meta) {
    return {
      file: fn,
      title: formatFileName(fn),
      subtitle: '',
      resourceId: fn,
      missing: false,
      searchText: fn,
    }
  }
  const resourceText = meta.resourceIds.length ? meta.resourceIds.join(', ') : fn
  const summaryText = summaryTextForMeta(meta)
  const title = displayTitleForMeta(meta, fn)
  return {
    file: fn,
    title,
    subtitle: summaryText ? `${resourceText} · ${summaryText}` : resourceText,
    resourceId: meta.resourceIds[0] || fn,
    missing: meta.exists === false,
    searchText: `${fn} ${title} ${resourceText}`,
  }
}

function summaryTextForMeta(meta) {
  const summary = meta?.summary
  if (!summary) return ''
  const parts = []
  if (summary.voice_count) parts.push(`${summary.voice_count} voices`)
  if (summary.lip_count) parts.push(`${summary.lip_count} lips`)
  if (!parts.length && summary.step_count) parts.push(`${summary.step_count} steps`)
  return parts.join(' · ')
}

const filteredFileEntries = computed(() => {
  if (!currentGroup.value) return []
  const files = groupFileList(currentGroup.value)
  let entries = files.map(fileEntryFor)

  if (currentCategoryId.value === 'extra') {
    const existingFiles = new Set(files)
    const missingExtra = (storyMasterData.value?.extra?.episodes || [])
      .filter(row => row.compiled_exists === false)
      .map(row => {
        const resourceId = row.resource_id || row['5']
        const title = row['3'] || resourceId
        return {
          file: null,
          title,
          subtitle: `${resourceId} · missing compiled`,
          resourceId,
          missing: true,
          searchText: `${title} ${resourceId}`,
        }
      })
      .filter(entry => !existingFiles.has(entry.file))
    entries = [...entries, ...missingExtra]
  }

  const q = filterQuery.value.toLowerCase()
  if (!q) return entries
  return entries.filter(entry => entry.searchText.toLowerCase().includes(q))
})

const cardMap = computed(() => buildCardMap(cardIndexData.value))

const currentCards = computed(() => cardsForCharacter(
  cardIndexData.value,
  cardMap.value,
  currentCharacterId.value,
))

const cardRarityTabs = computed(() => buildCardRarityTabs(currentCards.value))

const filteredCards = computed(() => {
  const q = filterQuery.value.toLowerCase()
  const rarity = currentCardRarity.value
  const assetState = currentCardAssetState.value
  const relationState = currentCardRelationState.value
  return currentCards.value.filter(card =>
    (rarity === 'all' || card.rarity === rarity) &&
    matchesCardAssetState(archiveManifestData.value?.card_assets_by_id?.[card.resource_id], assetState) &&
    matchesCardRelationState(card, relationState) &&
    (!q ||
    String(card.title || '').toLowerCase().includes(q) ||
    String(card.resource_id || '').toLowerCase().includes(q) ||
    String(card.rarity || '').toLowerCase().includes(q))
  )
})

const currentCard = computed(() => cardMap.value.get(currentCardId.value) || null)
const currentCardAssetStatus = computed(() => archiveManifestData.value?.card_assets_by_id?.[currentCardId.value] || null)
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
  return [...cardMap.value.values()]
    .filter(card => card.release_series?.series_id === seriesId)
    .map(card => ({ ...card, character_name: idolDisplayName(card.character_id) }))
})

const currentCardCharacterName = computed(() => {
  const id = currentCharacterId.value
  return idolDisplayName(id) || 'Cards'
})

function matchesCardAssetState(status, state) {
  if (state === 'all') return true
  if (!status) return false
  if (state === 'visible_icon') return status.awakened_icon || status.normal_icon
  if (state === 'complete_icons') return status.awakened_icon && status.normal_icon
  if (state === 'single_state') return status.single_state
  if (state === 'has_large') {
    return status.awakened_portrait || status.normal_portrait ||
      status.awakened_landscape || status.normal_landscape ||
      status.awakened_large || status.normal_large
  }
  if (state === 'missing_normal') return !status.normal_icon && !status.single_state
  return true
}

function matchesCardRelationState(card, state) {
  if (state === 'all') return true
  if (state === 'card_story') return Boolean(card?.scenario_entries?.length)
  if (state === 'release_series') return Boolean(card?.release_series)
  if (state === 'unrelated') return !card?.scenario_entries?.length && !card?.release_series
  return true
}

const currentIdolProfile = computed(() => {
  const profile = idolUnitData.value?.by_idol_code?.[currentCharacterId.value]
  if (!profile) return null
  const unit = archiveManifestData.value?.unit_membership_by_idol?.[currentCharacterId.value]
  return {
    ...profile,
    idol_code: currentCharacterId.value,
    unit_id: unit?.unit_id || profile.unit_id,
    unit_code: unit?.unit_code || profile.unit_code,
    unit_name: unit?.unit_name || profile.unit_name,
  }
})

const currentIdolStats = computed(() => {
  const id = currentCharacterId.value
  return {
    cards: cardsForCharacter(cardIndexData.value, cardMap.value, id).length,
    stories: categoryById('idol')?.characters?.[id]?.groups?.length || 0,
    chats: categoryById('idol_chat')?.individual?.[id]?.groups?.length || 0,
    phones: categoryById('idol_phone')?.individual?.[id]?.groups?.length || 0,
  }
})

const archiveShellVisible = computed(() => !['player', 'spine_lab'].includes(view.value))

const archiveSection = computed(() => {
  if (view.value === 'home') return 'home'
  if (view.value === 'archive_status') return 'resources'
  if (view.value === 'story_catalog') return 'stories'
  if (['unit_catalog', 'unit_detail'].includes(view.value)) return 'idols'
  if (currentCategoryId.value === 'cards' || ['cards', 'card_detail'].includes(view.value)) return 'cards'
  if (['idol_chat', 'idol_phone'].includes(currentCategoryId.value)) return 'interactions'
  if (currentCategoryId.value === 'idol') return 'idols'
  return 'stories'
})

const archiveTitle = computed(() => {
  if (view.value === 'home') return 'SideM Archive'
  if (view.value === 'archive_status') return '数据状态'
  if (view.value === 'story_catalog') return '故事目录'
  if (view.value === 'unit_catalog') return '组合资料'
  if (view.value === 'unit_detail') return currentArchiveUnit.value?.unit_name || '组合详情'
  if (view.value === 'idols') return categoryHeaderText.value
  if (view.value === 'idol_detail') return currentIdolProfile.value?.display_name || '偶像详情'
  if (view.value === 'groups') return groupTitle.value
  if (view.value === 'cards') return currentCardCharacterName.value
  if (view.value === 'card_detail') return currentCard.value?.title || currentCard.value?.resource_id || '卡片详情'
  if (view.value === 'episode_zero_units') return '第零话'
  if (view.value === 'episodes') return currentUnit.value?.unit_name || '章节'
  if (view.value === 'files') return currentGroup.value?.title || '剧情文件'
  return 'SideM Archive'
})

const archiveSearchable = computed(() => ['idols', 'groups', 'cards', 'files', 'story_catalog'].includes(view.value))

const archiveSearchPlaceholder = computed(() => {
  if (view.value === 'idols') return categoryFilterPlaceholder.value
  if (view.value === 'cards') return '搜索卡片标题、稀有度或资源 ID'
  if (view.value === 'groups') return '搜索章节标题或资源 ID'
  if (view.value === 'files') return '搜索剧情标题或资源 ID'
  if (view.value === 'story_catalog') return '搜索标题、资源 ID 或角色代码'
  return '搜索资料'
})

const archiveShowBack = computed(() => view.value !== 'home')

function idolDisplayName(id) {
  if (!id) return ''
  return idolUnitData.value?.by_idol_code?.[id]?.display_name ||
    IDOL_ID_TO_NAME[id] ||
    indexData.value?.characters?.[id] ||
    id
}

function currentArchiveRoute() {
  return {
    view: view.value,
    category: currentCategoryId.value,
    idol: currentCharacterId.value,
    group: currentGroup.value?.id || '',
    unit: (['unit_detail', 'player'].includes(view.value) && currentArchiveUnitCode.value)
      ? currentArchiveUnitCode.value
      : (currentUnit.value?.unit_code || currentUnit.value?.id || ''),
    unitFilter: currentIdolUnitFilter.value,
    storyType: currentStoryDomain.value,
    availability: currentStoryAvailability.value,
    sort: currentStorySort.value,
    episode: currentEpisodeId.value,
    card: currentCardId.value,
    rarity: currentCardRarity.value,
    assetState: currentCardAssetState.value,
    relationState: currentCardRelationState.value,
    query: filterQuery.value,
    scenario: view.value === 'player' ? currentScenarioFile.value : '',
    voice: view.value === 'player' ? currentPreviewCue.value : '',
    returnView: returnViewAfterPlayer.value,
  }
}

function syncArchiveRoute({ replace = false } = {}) {
  if (!archiveRouteReady || applyingArchiveRoute) return
  writeArchiveRoute(currentArchiveRoute(), { replace })
}

function commitView(nextView, options = {}) {
  view.value = nextView
  syncArchiveRoute(options)
}

function groupsForRoute(categoryId, idolId) {
  if (!categoryId) return []
  if (!idolId) return categoryById(categoryId)?.groups || []
  if (categoryId === 'idol_chat' || categoryId === 'idol_phone') {
    return categoryById(categoryId)?.individual?.[idolId]?.groups || []
  }
  return categoryById('idol')?.characters?.[idolId]?.groups || []
}

function resolveRouteGroup(route) {
  if (!route.group) return null
  return groupsForRoute(route.category, route.idol)
    .find(group => String(group.id) === route.group) || null
}

function resolveRouteUnit(route) {
  if (!route.unit) return null
  return episodeZeroUnits.value.find(unit =>
    String(unit.unit_code || unit.id) === route.unit,
  ) || null
}

function resolveRouteEpisode(unit, route) {
  if (!unit || !route.episode) return null
  return (unit.episodes || []).find(episode => String(episode.id) === route.episode) || null
}

function restoreVoicePreview(route) {
  const card = cardMap.value.get(route.card)
  if (!card || !route.voice) return false
  const cue = (card.home_voice_cues || []).find(item => item?.cue === route.voice) ||
    (card.voice_candidates?.unmapped_card_only || []).find(item => item === route.voice)
  if (!cue) return false
  currentScenario.value = buildCardVoicePreviewScenario(card, cue)
  currentScenarioFile.value = ''
  currentPreviewCue.value = route.voice
  returnViewAfterPlayer.value = route.returnView || 'card_detail'
  view.value = 'player'
  return true
}

async function applyArchiveRoute(route) {
  applyingArchiveRoute = true
  try {
    filterQuery.value = route.query || ''
    currentCategoryId.value = route.category || ''
    currentCharacterId.value = route.idol || ''
    currentCardId.value = route.card || ''
    currentCardRarity.value = route.rarity || 'all'
    currentCardAssetState.value = route.assetState || 'all'
    currentCardRelationState.value = route.relationState || 'all'
    currentIdolUnitFilter.value = route.unitFilter || ''
    currentStoryDomain.value = route.storyType || ''
    currentStoryAvailability.value = route.availability || 'all'
    currentStorySort.value = route.sort || 'domain'
    currentEpisodeId.value = route.episode || ''
    currentArchiveUnitCode.value = (
      ['unit_catalog', 'unit_detail'].includes(route.view) ||
      (route.view === 'player' && route.returnView === 'unit_detail')
    ) ? route.unit || '' : ''
    currentGroup.value = resolveRouteGroup(route)
    currentUnit.value = resolveRouteUnit(route)
    currentScenario.value = null
    currentScenarioFile.value = ''
    currentPreviewCue.value = ''
    returnViewAfterPlayer.value = route.returnView || 'files'

    const episode = resolveRouteEpisode(currentUnit.value, route)
    if (route.view === 'files' && episode) {
      currentGroup.value = {
        id: episode.id,
        title: episode.title,
        files: groupFileList(episode),
      }
    }

    if (route.view === 'player' && route.scenario) {
      await loadScenario(route.scenario, route.returnView || 'home', { syncRoute: false })
      return
    }
    if (route.view === 'player' && route.voice) {
      await storyViewerLoader()
      if (restoreVoicePreview(route)) return
    }
    if (route.view === 'spine_lab') await spineViewerLoader()

    if (route.view === 'unit_detail' && !currentArchiveUnit.value) view.value = 'unit_catalog'
    else if (route.view === 'idol_detail' && !currentIdolProfile.value) view.value = 'idols'
    else if (route.view === 'card_detail' && !currentCard.value) view.value = 'cards'
    else if (route.view === 'cards' && !currentCharacterId.value) view.value = 'idols'
    else if (route.view === 'files' && !currentGroup.value) view.value = currentCharacterId.value ? 'groups' : 'home'
    else if (route.view === 'episodes' && !currentUnit.value) view.value = 'episode_zero_units'
    else view.value = route.view || 'home'
  } finally {
    applyingArchiveRoute = false
  }
}

function goHome() {
  filterQuery.value = ''
  currentCategoryId.value = ''
  currentCharacterId.value = ''
  currentGroup.value = null
  currentUnit.value = null
  currentArchiveUnitCode.value = ''
  currentEpisodeId.value = ''
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  currentIdolUnitFilter.value = ''
  currentStoryDomain.value = ''
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  commitView('home')
}

function navigateArchiveSection(section) {
  const categoryBySection = {
    idols: 'idol',
    cards: 'cards',
    interactions: 'idol_chat',
  }
  if (section === 'home') goHome()
  else if (section === 'stories') openStoryCatalog()
  else if (section === 'resources') openArchiveStatus()
  else if (categoryBySection[section]) openCategoryById(categoryBySection[section])
}

function goArchiveBack() {
  const backByView = {
    idols: goHome,
    idol_detail: () => commitView('idols'),
    groups: goBackFromGroups,
    episode_zero_units: goHome,
    episodes: goBackToUnits,
    files: goBackToFiles,
    cards: goBackFromCards,
    card_detail: goBackToCards,
    archive_status: goHome,
    story_catalog: goHome,
    unit_catalog: () => commitView('idols'),
    unit_detail: () => {
      currentArchiveUnitCode.value = ''
      commitView('unit_catalog')
    },
  }
  const handler = backByView[view.value] || goHome
  handler()
}

async function openSpineLab() {
  loading.value = true
  preloadProgress.value = 100
  try {
    await spineViewerLoader()
    commitView('spine_lab')
  } finally {
    loading.value = false
  }
}

function openArchiveStatus() {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  commitView('archive_status')
}

function openStoryCatalog() {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  storyVisibleLimit.value = 80
  commitView('story_catalog')
}

function openUnitCatalog() {
  filterQuery.value = ''
  currentCategoryId.value = 'idol'
  currentCharacterId.value = ''
  currentArchiveUnitCode.value = ''
  commitView('unit_catalog')
}

function openArchiveUnit(unit) {
  if (!unit) return
  currentCategoryId.value = 'idol'
  currentCharacterId.value = ''
  currentArchiveUnitCode.value = String(unit.unit_code || unit.unit_id)
  commitView('unit_detail')
}

function openUnitFromIdol(idol) {
  const unit = (idolUnitData.value?.units || []).find(entry => String(entry.unit_code) === String(idol?.unit_code))
  if (unit) openArchiveUnit(unit)
}

function openUnitMember(member) {
  currentCategoryId.value = 'idol'
  currentCharacterId.value = member.idol_code
  currentArchiveUnitCode.value = ''
  commitView('idol_detail')
}

function openUnitStory(story) {
  if (story?.file && story.exists) loadScenario(story.file, 'unit_detail')
}

function openCatalogStory(entry) {
  if (entry?.file && entry.exists) loadScenario(entry.file, 'story_catalog')
}

function goBackToCards() {
  currentCardId.value = ''
  filterQuery.value = ''
  commitView('cards')
}

function goBackToUnits() {
  currentUnit.value = null
  currentEpisodeId.value = ''
  currentGroup.value = null
  commitView('episode_zero_units')
}

// Navigation.
function openCategoryById(categoryId) {
  const category = CATEGORIES.find(item => item.id === categoryId)
  if (category) openCategory(category)
}

function openCategory(cat) {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  currentUnit.value = null
  currentEpisodeId.value = ''
  currentCardId.value = ''
  currentIdolUnitFilter.value = ''
  if (cat.id === 'idol' || cat.id === 'idol_chat' || cat.id === 'idol_phone' || cat.id === 'cards') {
    currentCategoryId.value = cat.id
    currentCharacterId.value = ''
    currentGroup.value = null
    currentCardRarity.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    commitView('idols')
  } else if (cat.id === 'episode_zero') {
    currentCategoryId.value = 'episode_zero'
    commitView('episode_zero_units')
  } else {
    currentCategoryId.value = cat.id
    currentCharacterId.value = ''
    currentGroup.value = null
    commitView('groups')
  }
}

function openIdol(entry) {
  filterQuery.value = ''
  // Group chat entry in idol_chat grid: go directly to file view.
  if (entry._isGroup && entry._groupData) {
    currentCharacterId.value = entry.id
    currentCategoryId.value = 'idol_chat'
    currentGroup.value = entry._groupData.groups[0]
    commitView('files')
    return
  }
  if (currentCategoryId.value === 'cards') {
    currentCharacterId.value = entry.id
    currentCardId.value = ''
    currentCardRarity.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    filterQuery.value = ''
    commitView('cards')
    return
  }
  if (currentCategoryId.value === 'idol') {
    currentCharacterId.value = entry.id
    currentGroup.value = null
    commitView('idol_detail')
    return
  }
  currentCharacterId.value = entry.id
  currentCategoryId.value = currentCategoryId.value || 'idol'
  currentGroup.value = null
  commitView('groups')
}

function openIdolDomain(domain) {
  const categoryByDomain = {
    stories: 'idol',
    cards: 'cards',
    chat: 'idol_chat',
    phone: 'idol_phone',
  }
  const category = categoryByDomain[domain]
  if (!category) return
  currentCategoryId.value = category
  currentGroup.value = null
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  filterQuery.value = ''
  commitView(domain === 'cards' ? 'cards' : 'groups')
}

function openCard(card) {
  currentCardId.value = card.resource_id
  filterQuery.value = ''
  commitView('card_detail')
}

function openRelatedCard(card) {
  if (!card?.resource_id || !card?.character_id) return
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  filterQuery.value = ''
  commitView('card_detail')
}

function goBackFromCards() {
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  filterQuery.value = ''
  commitView('idols')
}

function openCardScenario(entry) {
  if (entry?.compiled_file) {
    loadScenario(entry.compiled_file, 'card_detail')
  }
}

async function previewCardVoice(cue) {
  const card = currentCard.value
  if (!card || !cue) return
  await openVoicePreview(card, cue, 'card_detail')
}

async function openVoicePreview(card, cue, returnView) {
  loading.value = true
  preloadProgress.value = 100
  try {
    await storyViewerLoader()
    currentScenario.value = buildCardVoicePreviewScenario(card, cue)
    currentScenarioFile.value = ''
    currentPreviewCue.value = typeof cue === 'string' ? cue : cue.cue
    returnViewAfterPlayer.value = returnView
    commitView('player')
  } finally {
    loading.value = false
  }
}

function buildCardVoicePreviewScenario(card, cue) {
  const cueId = typeof cue === 'string' ? cue : cue.cue
  const preview = typeof cue === 'object' ? cue.preview : null
  if (preview?.preview_step) {
    const step = JSON.parse(JSON.stringify(preview.preview_step))
    step.step_id = 1
    return {
      scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
      source_scenario_id: preview.scenario_id,
      source_compiled_file: preview.compiled_file,
      total_steps: 1,
      steps: [step],
    }
  }
  const charaId = card.character_id || card.resource_id?.slice(0, 6) || ''
  const voiceBase = card.voice_base || cueId.split('_').slice(0, 5).join('_')
  const model = `${charaId}_002_00`
  return {
    scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
    total_steps: 1,
    steps: [
      {
        step_id: 1,
        type: 'adv',
        chara_id: charaId,
        state: {
          bg: 'bg001_315pro_in_01',
          bg_effect: null,
          bg_transition: null,
          bg_effects: [],
          bg_profile: null,
          bgm: null,
          bgm_volume: 100,
          se: null,
          se_events: [],
          environmental: null,
          spines: [
            {
              id: charaId,
              model,
              face: 'face_default',
              anim: 'wait_loop',
              position: 0,
              visible: true,
              pos_x: 0,
              pos_y: 0,
              fade: { type: 'in', delay: 0, duration: 0 },
            },
          ],
          talk_mode: false,
          phone_mode: false,
          camera_zoom: null,
          screen_fade: null,
          screen_slide: null,
          screen_effects: [],
          bgm_stop_fade: null,
          environmental_volume: null,
          environmental_duck_target: null,
          camera_filter: null,
          bg_color: null,
          bg_dof: null,
          bg_color_transition: null,
          bg_dof_transition: null,
          text_disabled: false,
          image_icon: null,
        },
        dialogue: {
          speaker: currentCardCharacterName.value,
          text: `${card.title || card.resource_id}\n${cueId}`,
          text_jp: `${card.title || card.resource_id}\n${cueId}`,
          text_cn: '',
          voice: `${cueId}.m4a`,
          lip: {
            source: 'adxlip',
            path: `adxlip/${charaId}/${voiceBase}/${cueId}.json`,
          },
        },
      },
    ],
  }
}

function openGroup(group) {
  currentGroup.value = group
  currentEpisodeId.value = ''
  filterQuery.value = ''
  commitView('files')
}

function openScenarioEntry(entry) {
  if (entry?.file && !entry.missing) loadScenario(entry.file)
}

function openUnit(unit) {
  currentUnit.value = unit
  currentEpisodeId.value = ''
  filterQuery.value = ''
  commitView('episodes')
}

function openEpisodeFiles(ep) {
  // Create a synthetic group object from episode data
  currentGroup.value = { id: ep.id, title: ep.title, files: groupFileList(ep) }
  currentEpisodeId.value = String(ep.id)
  filterQuery.value = ''
  commitView('files')
}

function goBackFromGroups() {
  if (currentCharacterId.value) {
    commitView('idols')
  } else {
    goHome()
  }
}

function goBackToFiles() {
  if (currentUnit.value) {
    currentGroup.value = null
    currentEpisodeId.value = ''
    commitView('episodes')
  } else if (currentCategoryId.value === 'cards' && currentCardId.value) {
    commitView('card_detail')
  } else if (currentCategoryId.value === 'cards') {
    commitView('cards')
  } else if (currentCharacterId.value && (currentCategoryId.value === 'idol_chat' || currentCategoryId.value === 'idol_phone')) {
    currentGroup.value = null
    commitView('idols')
  } else if (currentCharacterId.value) {
    currentGroup.value = null
    commitView('groups')
  } else {
    currentGroup.value = null
    commitView('groups')
  }
}

function closePlayer() {
  currentScenario.value = null
  currentScenarioFile.value = ''
  currentPreviewCue.value = ''
  const returnView = returnViewAfterPlayer.value || 'files'
  returnViewAfterPlayer.value = 'files'
  commitView(returnView)
}

function onPlayerReady() {
  loading.value = false
}

function formatFileName(fn) {
  return fn.replace(/\.json$/, '').replace(/^[^_]+_[^_]+_scenario_/, '')
}

async function loadScenario(name, returnView = 'files', options = {}) {
  loading.value = true
  preloadProgress.value = 0
  try {
    const r = await fetch(`/data/compiled/${name}?v=${Date.now()}`, { cache: 'no-store' })
    const scenario = await r.json()

    // Preload all scenario assets before switching to player
    await Promise.all([
      storyViewerLoader(),
      Preloader.preloadScenario(scenario.steps || [], (pct) => {
        preloadProgress.value = pct
      }),
    ])

    currentScenario.value = scenario
    currentScenarioFile.value = name
    currentPreviewCue.value = ''
    returnViewAfterPlayer.value = returnView
    view.value = 'player'
    loading.value = false
    if (options.syncRoute !== false) syncArchiveRoute()
  } catch (err) {
    console.error('Failed to load:', err)
    loading.value = false
  }
}

onMounted(async () => {
  cardLayout.value = localStorage.getItem('sidem-archive-card-layout') === 'grid' ? 'grid' : 'compact'
  cardArtMode.value = localStorage.getItem('sidem-archive-card-art-mode') === 'framed' ? 'framed' : 'clean'
  const initialRoute = readArchiveRoute()
  const { data, errors } = await loadArchiveData()
  indexData.value = data.compiledIndex
  cardIndexData.value = data.cardIndex
  storyMasterData.value = data.storyMaster
  idolUnitData.value = data.idolUnit
  archiveManifestData.value = data.archiveManifest
  archiveVerificationData.value = data.archiveVerification
  for (const { key, error } of errors) {
    console.error(`[ArchiveData] Failed to load ${key}:`, error)
  }


  await applyArchiveRoute(initialRoute)
  archiveRouteReady = true
  writeArchiveRoute(currentArchiveRoute(), { replace: true })
  removeArchivePopState = onArchivePopState(route => {
    applyArchiveRoute(route).catch(error => {
      console.error('[ArchiveRoute] Failed to restore browser history:', error)
    })
  })
  removeSpineAnimationDebug = installSpineAnimationDebug()
})

watch([filterQuery, currentCardRarity, currentCardAssetState, currentCardRelationState, currentIdolUnitFilter, currentStoryDomain, currentStoryAvailability, currentStorySort], () => {
  syncArchiveRoute({ replace: true })
})

watch([filterQuery, currentStoryDomain, currentStoryAvailability, currentStorySort], () => {
  storyVisibleLimit.value = 80
})

watch(cardLayout, layout => {
  localStorage.setItem('sidem-archive-card-layout', layout)
})

watch(cardArtMode, mode => {
  localStorage.setItem('sidem-archive-card-art-mode', mode)
})

onBeforeUnmount(() => {
  removeArchivePopState?.()
  removeSpineAnimationDebug?.()
})
</script>

<style scoped>
#story-viewer {
  width: 100%; height: 100vh; color: #222;
  background: #f8f9fa; overflow: hidden;
}
</style>

<style>
/* Global reset: no page-level scrollbar */
html, body { margin: 0; padding: 0; height: 100%; overflow-x: hidden; overflow-y: hidden; }
*, *::before, *::after { box-sizing: border-box; }
#app { overflow-x: hidden; }
</style>
