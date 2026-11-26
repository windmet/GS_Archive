<template>
  <section class="archive-search-page" data-archive-scroll-container aria-labelledby="global-search-heading">
    <div class="search-shell">
      <header class="search-header">
        <h2 id="global-search-heading" class="search-visually-hidden">全站搜索</h2>
        <form class="search-form" role="search" @submit.prevent="submitImmediate">
          <Search :size="20" aria-hidden="true" />
          <input
            ref="inputRef"
            type="search"
            :value="localQuery"
            placeholder="搜索偶像、组合、卡片、歌曲、剧情、活动、卡池或图鉴…"
            aria-label="全站搜索关键词"
            autocomplete="off"
            @input="onInput($event.target.value)"
          />
          <button v-if="localQuery" type="button" class="search-clear" aria-label="清空搜索" @click="clearQuery">
            <X :size="18" aria-hidden="true" />
          </button>
          <button type="submit" class="search-submit">搜索</button>
        </form>

        <nav class="search-tabs" role="tablist" aria-label="按类别筛选搜索结果">
          <button
            v-for="tab in GLOBAL_SEARCH_TABS"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeDomain === tab.id"
            @click="selectDomain(tab.id)"
          >
            <span>{{ tab.label }}</span>
            <small v-if="hasQuery && tabCount(tab.id) !== null">{{ formatCount(tabCount(tab.id)) }}</small>
          </button>
        </nav>
      </header>

      <div v-if="!hasQuery" class="search-empty-guide">
        <p class="search-guide-lead">一站检索全站档案：覆盖偶像、组合、卡片、歌曲、剧情、活动、卡池，以及按需载入的道具、服装、货币与称号图鉴。</p>
        <div v-if="quickTerms.length" class="search-quick-row">
          <span>试试搜索</span>
          <button v-for="term in quickTerms" :key="term" type="button" @click="applyQuickTerm(term)">{{ term }}</button>
        </div>
      </div>

      <template v-else>
        <p v-if="loadingNotice" class="search-status" role="status">{{ loadingNotice }}</p>
        <ArchiveErrorNote v-if="loadError" class="search-error">
          {{ loadError }}
          <button type="button" @click="retryLoad">重试</button>
        </ArchiveErrorNote>

        <template v-if="activeDomain === 'all'">
          <div v-if="visibleAllGroups.length" class="search-groups">
            <section
              v-for="group in visibleAllGroups"
              :key="group.id"
              class="search-group"
              :aria-labelledby="`search-group-${group.id}`"
            >
              <header class="search-group-head">
                <h3 :id="`search-group-${group.id}`">
                  {{ group.label }}
                  <small>{{ formatCount(group.rows.length) }} 条</small>
                </h3>
                <button v-if="group.rows.length > GROUP_PREVIEW_LIMIT" type="button" @click="selectDomain(group.id)">
                  查看全部 {{ formatCount(group.rows.length) }} 条
                  <ChevronRight :size="15" aria-hidden="true" />
                </button>
              </header>
              <ul class="search-result-list">
                <li v-for="item in group.rows.slice(0, GROUP_PREVIEW_LIMIT)" :key="item.key">
                  <button type="button" class="search-result-row" @click="emit('open-result', item)">
                    <ArchiveIdolAvatar v-if="item.domain === 'idols'" :idol-code="item.idolCode" :accent-color="item.accentColor" ring="identity" :size="40" decorative />
                    <span v-else-if="item.domain === 'units' && item.image?.url" class="search-unit-thumb" aria-hidden="true">
                      <img :src="item.image.url" alt="" loading="lazy" decoding="async" />
                    </span>
                    <DomainMediaPreview v-else-if="item.image?.url" class="search-row-media" :binding="item.image" :name="item.label" compact />
                    <span v-else class="search-row-icon" aria-hidden="true">
                      <component :is="domainIcon(item.domain)" :size="20" />
                    </span>
                    <span class="search-row-copy">
                      <strong>{{ item.label }}</strong>
                      <small v-if="item.subtitle">{{ item.domain === 'stories' ? formatStorySubtitle(item.subtitle) : item.subtitle }}</small>
                    </span>
                    <ArrowUpRight class="search-row-arrow" :size="16" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </section>
          </div>

          <section v-if="!collectionLoaded && !collectionLoading" class="search-collection-prompt">
            <div>
              <strong>还要检索图鉴吗？</strong>
              <p>道具、服装、货币与称号索引体积较大，按需载入以免拖慢常用检索。</p>
            </div>
            <button type="button" @click="ensureCollectionLoaded">展开搜索图鉴</button>
          </section>

          <p v-if="!visibleAllGroups.length && !primaryLoading && !collectionLoading && !loadError" class="search-no-results" role="status">
            没有找到与「{{ trimmedQuery }}」匹配的档案，试试换个关键词、假名或偶像简称。
          </p>
        </template>

        <template v-else>
          <div v-if="activeDomainRows.length" class="search-single-domain">
            <p class="search-single-summary">{{ activeTabLabel }}共匹配 {{ formatCount(activeDomainRows.length) }} 条</p>
            <ul class="search-result-list">
              <li v-for="item in activeDomainRows.slice(0, visibleLimit)" :key="item.key">
                <button type="button" class="search-result-row" @click="emit('open-result', item)">
                  <ArchiveIdolAvatar v-if="item.domain === 'idols'" :idol-code="item.idolCode" :accent-color="item.accentColor" ring="identity" :size="40" decorative />
                  <span v-else-if="item.domain === 'units' && item.image?.url" class="search-unit-thumb" aria-hidden="true">
                    <img :src="item.image.url" alt="" loading="lazy" decoding="async" />
                  </span>
                  <DomainMediaPreview v-else-if="item.image?.url" class="search-row-media" :binding="item.image" :name="item.label" compact />
                  <span v-else class="search-row-icon" aria-hidden="true">
                    <component :is="domainIcon(item.domain)" :size="20" />
                  </span>
                  <span class="search-row-copy">
                    <strong>{{ item.label }}</strong>
                    <small v-if="item.subtitle">{{ item.domain === 'stories' ? formatStorySubtitle(item.subtitle) : item.subtitle }}</small>
                  </span>
                  <ArrowUpRight class="search-row-arrow" :size="16" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <button v-if="activeDomainRows.length > visibleLimit" type="button" class="search-more" @click="visibleLimit += PAGE_STEP">
              继续显示（已展示 {{ formatCount(visibleLimit) }} / {{ formatCount(activeDomainRows.length) }} 条）
            </button>
          </div>
          <p v-else-if="!loadingNotice && !loadError" class="search-no-results" role="status">
            「{{ activeTabLabel }}」中没有找到与「{{ trimmedQuery }}」匹配的条目。
          </p>
        </template>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ArrowUpRight, Box, ChevronRight, Search, X } from '@lucide/vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import {
  buildExtendedDomainResults,
  GLOBAL_SEARCH_COLLECTION_DOMAINS,
  GLOBAL_SEARCH_PRIMARY_DOMAINS,
  GLOBAL_SEARCH_TABS,
} from '../../presentation/ArchiveGlobalSearch.js'
import { archiveText as collectionArchiveText } from './useArchiveCollectionText.js'
import { archiveText as costumeArchiveText } from './useArchiveCostumeText.js'
import { useStoryTitles } from './useReaderTitles.js'
import { chapterLabel } from '../../presentation/chapterLabel.js'

const GROUP_PREVIEW_LIMIT = 8
const PAGE_STEP = 60

const props = defineProps({
  query: { type: String, default: '' },
  domain: { type: String, default: 'all' },
  bootstrap: { type: Object, required: true },
  client: { type: Object, required: true },
  preferredIdol: { type: Object, default: null },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
  cardTitle: { type: Function, default: text => text },
  cardSearch: { type: Function, default: text => text },
  songTitle: { type: Function, default: text => text },
  gashaTitle: { type: Function, default: text => text },
})

const emit = defineEmits(['update:query', 'update:domain', 'open-result'])

const inputRef = ref(null)
const localQuery = ref(props.query || '')
const activeDomain = computed(() => GLOBAL_SEARCH_TABS.some(tab => tab.id === props.domain) ? props.domain : 'all')
const trimmedQuery = computed(() => localQuery.value.trim())
const hasQuery = computed(() => Boolean(trimmedQuery.value))
const visibleLimit = ref(PAGE_STEP)

const rowsByDomain = shallowRef({})
const primaryLoaded = ref(false)
const primaryLoading = ref(false)
const collectionLoaded = ref(false)
const collectionLoading = ref(false)
const loadError = ref('')
let syncTimer = 0
let primaryController = null
let collectionController = null
let disposed = false

watch(() => props.query, value => {
  const next = value || ''
  if (next !== localQuery.value) localQuery.value = next
})
watch([trimmedQuery, activeDomain], () => { visibleLimit.value = PAGE_STEP })

const quickTerms = computed(() => {
  const terms = []
  if (props.preferredIdol) {
    const name = props.idolName(props.preferredIdol.id, props.preferredIdol.name) || props.preferredIdol.name
    if (name) terms.push(name)
    if (props.preferredIdol.unitName) terms.push(props.preferredIdol.unitName)
  }
  for (const fallback of ['GROWING', 'SSR', 'FES', 'Jupiter', 'High×Joker']) {
    if (!terms.includes(fallback)) terms.push(fallback)
  }
  return terms.slice(0, 6)
})

function onInput(value) {
  const next = String(value || '').slice(0, 120)
  localQuery.value = next
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => { emit('update:query', next) }, 160)
}

function submitImmediate() {
  clearTimeout(syncTimer)
  emit('update:query', localQuery.value)
  if (trimmedQuery.value) void ensurePrimaryLoaded()
}

function clearQuery() {
  clearTimeout(syncTimer)
  localQuery.value = ''
  emit('update:query', '')
  inputRef.value?.focus({ preventScroll: true })
}

function applyQuickTerm(term) {
  clearTimeout(syncTimer)
  localQuery.value = term
  emit('update:query', term)
}

function selectDomain(id) {
  emit('update:domain', id)
  if (id === 'collection' && hasQuery.value) void ensureCollectionLoaded()
}

async function fetchDomainRows(domain, signal) {
  const descriptor = props.bootstrap?.domains?.[domain]
  if (!descriptor) return []
  const index = await props.client.load(descriptor, { signal, priority: 'foreground' })
  const pages = Array.isArray(index?.searchPages) && index.searchPages.length
    ? index.searchPages
    : (Array.isArray(index?.pages) ? index.pages : [])
  const loaded = await Promise.all(pages.map(page => props.client.load(page, { signal, priority: 'foreground' })))
  return loaded.flatMap(page => page?.rows || page?.entries || [])
}

async function ensurePrimaryLoaded() {
  if (primaryLoaded.value || primaryLoading.value || disposed) return
  primaryController?.abort()
  const controller = primaryController = new AbortController()
  primaryLoading.value = true
  loadError.value = ''
  try {
    const domains = GLOBAL_SEARCH_PRIMARY_DOMAINS.filter(domain => domain !== 'idols')
    const entries = await Promise.all(domains.map(async domain => [domain, await fetchDomainRows(domain, controller.signal)]))
    if (disposed || controller.signal.aborted) return
    rowsByDomain.value = { ...rowsByDomain.value, ...Object.fromEntries(entries) }
    primaryLoaded.value = true
  } catch (cause) {
    if (disposed || controller.signal.aborted) return
    loadError.value = '部分全站检索索引暂时无法载入，请重试。'
  } finally {
    if (!disposed && primaryController === controller) primaryLoading.value = false
  }
}

async function ensureCollectionLoaded() {
  if (collectionLoaded.value || collectionLoading.value || disposed) return
  collectionController?.abort()
  const controller = collectionController = new AbortController()
  collectionLoading.value = true
  loadError.value = ''
  try {
    const entries = await Promise.all(GLOBAL_SEARCH_COLLECTION_DOMAINS.map(async domain => [domain, await fetchDomainRows(domain, controller.signal)]))
    if (disposed || controller.signal.aborted) return
    rowsByDomain.value = { ...rowsByDomain.value, ...Object.fromEntries(entries) }
    collectionLoaded.value = true
  } catch (cause) {
    if (disposed || controller.signal.aborted) return
    loadError.value = '图鉴检索索引暂时无法载入，请重试。'
  } finally {
    if (!disposed && collectionController === controller) collectionLoading.value = false
  }
}

function retryLoad() {
  loadError.value = ''
  if (!primaryLoaded.value) void ensurePrimaryLoaded()
  if (activeDomain.value === 'collection' && !collectionLoaded.value) void ensureCollectionLoaded()
}

watch([hasQuery, activeDomain], ([active, domain]) => {
  if (!active) return
  void ensurePrimaryLoaded()
  if (domain === 'collection') void ensureCollectionLoaded()
}, { immediate: true })

function translateCollectionItem(kind, sourceName) {
  if (!sourceName) return ''
  if (kind === 'costumes') return costumeArchiveText('costume', sourceName)
  const singular = { items: 'item', honors: 'honor', currencies: 'currency' }[kind] || kind
  return collectionArchiveText(singular, sourceName)
}

const storyTitle = useStoryTitles()
const formatStorySubtitle = text => String(text || '').split(' · ').map(chapterLabel).join(' · ')

const groupedResults = computed(() => buildExtendedDomainResults({
  query: trimmedQuery.value,
  rowsByDomain: rowsByDomain.value,
  bootstrap: props.bootstrap,
  idolName: props.idolName,
  idolSearch: props.idolSearch,
  cardTitle: props.cardTitle,
  cardSearch: props.cardSearch,
  songTitle: props.songTitle,
  storyTitle: (file, source) => storyTitle(file, source),
  gashaTitle: props.gashaTitle,
  collectionText: translateCollectionItem,
}))

const totalMatches = computed(() => Object.values(groupedResults.value).reduce((sum, list) => sum + list.length, 0))
const visibleAllGroups = computed(() => GLOBAL_SEARCH_TABS
  .filter(tab => tab.id !== 'all')
  .map(tab => ({ id: tab.id, label: tab.label, rows: groupedResults.value[tab.id] || [] }))
  .filter(group => group.rows.length > 0))

const activeDomainRows = computed(() => groupedResults.value[activeDomain.value] || [])
const activeTabLabel = computed(() => GLOBAL_SEARCH_TABS.find(tab => tab.id === activeDomain.value)?.label || '全部')
const loadingNotice = computed(() => {
  if (primaryLoading.value && collectionLoading.value) return '正在载入全站与图鉴检索索引…'
  if (primaryLoading.value) return '正在检索卡片、歌曲、剧情、活动与卡池…'
  if (collectionLoading.value) return '正在载入图鉴索引（道具 · 服装 · 货币 · 称号）…'
  return ''
})

function tabCount(id) {
  if (id === 'all') return totalMatches.value
  if (id === 'collection' && !collectionLoaded.value) return null
  if (!['idols', 'units', 'collection'].includes(id) && !primaryLoaded.value) return null
  return (groupedResults.value[id] || []).length
}

function domainIcon(domain) {
  if (domain === 'collection') return Box
  return archiveNavigationIcons[domain] || Search
}

function formatCount(value) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

onMounted(() => {
  if (!hasQuery.value) inputRef.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(syncTimer)
  primaryController?.abort()
  collectionController?.abort()
})
</script>

<style scoped>
.archive-search-page { height: 100%; overflow-x: hidden; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
.search-shell { box-sizing: border-box; width: 100%; max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-7) var(--gs-space-8) var(--gs-space-9); display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-6); }
.search-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.search-header { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-4); min-width: 0; }
.search-form { box-sizing: border-box; width: 100%; min-width: 0; display: flex; align-items: center; gap: var(--gs-space-3); min-height: var(--gs-control-touch); padding: var(--gs-space-2) var(--gs-space-2) var(--gs-space-2) var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-1); color: var(--gs-ink-3); }
.search-form:focus-within { border-color: var(--gs-mint); outline: var(--gs-focus-ring) solid color-mix(in srgb, var(--gs-mint) 25%, transparent); outline-offset: 0; }
.search-form input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-subtitle); }
.search-form input:focus-visible { outline: none; }
.search-clear { flex: none; display: grid; place-items: center; width: var(--gs-control-normal); height: var(--gs-control-normal); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-3); cursor: pointer; }
.search-submit { flex: none; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-5); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-action-bg); color: var(--gs-action-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); white-space: nowrap; cursor: pointer; }
.search-tabs { display: flex; gap: var(--gs-space-2); min-width: 0; max-width: 100%; overflow-x: auto; padding: var(--gs-space-1) 0; scrollbar-width: none; }
.search-tabs::-webkit-scrollbar { display: none; }
.search-tabs button { flex: none; display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.search-tabs button small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.search-tabs button[aria-selected="true"] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.search-tabs button[aria-selected="true"] small { color: inherit; }

.search-empty-guide { display: grid; gap: var(--gs-space-4); padding: var(--gs-space-6) 0; }
.search-guide-lead { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: var(--gs-leading-body); }
.search-quick-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2); }
.search-quick-row span { margin-right: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.search-quick-row button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }

.search-status, .search-single-summary { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.search-error { display: flex; align-items: center; gap: var(--gs-space-3); }
.search-error button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; cursor: pointer; }
.search-groups { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-7); min-width: 0; }
.search-group { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-2); min-width: 0; }
.search-group-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--gs-space-4); padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-rule); }
.search-group-head h3 { display: inline-flex; align-items: baseline; gap: var(--gs-space-2); margin: 0; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-bold); }
.search-group-head h3 small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.search-group-head button { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-compact); padding: 0 var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); cursor: pointer; }

.search-result-list { display: grid; margin: 0; padding: 0; list-style: none; }
.search-result-list li { border-bottom: 1px solid var(--gs-line); }
.search-result-row { display: flex; align-items: center; gap: var(--gs-space-4); width: 100%; min-width: 0; min-height: 58px; padding: var(--gs-space-3) var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.search-row-media { margin: 0; }
.search-unit-thumb, .search-row-icon { display: grid; flex: none; place-items: center; width: 44px; height: 44px; border-radius: var(--gs-radius-media); background: var(--gs-surface); color: var(--gs-ink-3); overflow: hidden; }
.search-unit-thumb img { width: 100%; height: 100%; object-fit: contain; padding: var(--gs-space-1); box-sizing: border-box; }
.search-row-copy { display: grid; gap: 2px; flex: 1; min-width: 0; }
.search-row-copy strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.search-row-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.search-row-arrow { flex: none; color: var(--gs-ink-3); }

.search-collection-prompt { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-4); padding: var(--gs-space-4) var(--gs-space-5); border-radius: var(--gs-radius-control); background: var(--gs-paper-2); }
.search-collection-prompt strong { display: block; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.search-collection-prompt p { margin: var(--gs-space-1) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.search-collection-prompt button, .search-more { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-5); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.search-single-domain { display: grid; gap: var(--gs-space-3); }
.search-more { justify-self: center; margin-top: var(--gs-space-3); }
.search-no-results { margin: var(--gs-space-6) 0; color: var(--gs-ink-3); font-size: var(--gs-text-body); text-align: center; }

@media (hover: hover) {
  .search-result-row:hover { background: var(--gs-hover); }
  .search-result-row:hover .search-row-copy strong, .search-result-row:hover .search-row-arrow { color: var(--gs-mint-ink); }
  .search-quick-row button:hover, .search-tabs button:not([aria-selected="true"]):hover, .search-collection-prompt button:hover, .search-more:hover { border-color: var(--gs-selected-line); background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
  .search-clear:hover, .search-group-head button:hover { background: var(--gs-hover); }
}
@media (max-width: 760px) {
  .search-shell { padding: var(--gs-space-4) var(--gs-space-5) var(--gs-space-8); gap: var(--gs-space-5); }
  .search-form { min-height: var(--gs-control-touch); }
  .search-tabs button { min-height: var(--gs-control-touch); }
  .search-result-row { min-height: 60px; padding: var(--gs-space-3) 0; }
}
</style>
