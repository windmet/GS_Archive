<template>
  <div class="archive-shell" :class="{ 'is-compact-mobile': compactMobile, 'is-reader': activeSection === 'reader', 'is-tool': immersiveTool, 'is-home-focus': homeFocus && activeSection === 'home', 'has-inspector': hasInspector, 'is-home': activeSection === 'home', 'is-portal': activeSection === 'portal' || activeSection === 'reader' }">
    <aside class="archive-sidebar" aria-label="资料馆导航">
      <button type="button" class="archive-brand" :aria-current="activeSection === 'portal' ? 'page' : undefined" title="资料馆首页" @click="emit('navigate', 'portal')">
        <img :src="getBrandMarkUrl()" alt="" />
        <span class="archive-brand-text"><span class="archive-brand-name">{{ ARCHIVE_BRAND.mark }}</span><span class="archive-brand-sub">{{ ARCHIVE_BRAND.sub }}</span></span>
      </button>
      <slot name="sidebar-identity" />
      <nav ref="navRef" class="archive-nav" aria-label="档案栏目">
        <!-- One white slice marks the current destination and slides to the next one (selection, rule A). -->
        <span class="archive-nav-indicator" :class="{ 'is-ready': indicator.ready }" :style="{ width: indicator.width + 'px', height: indicator.height + 'px', transform: `translate(${indicator.left}px, ${indicator.top}px)`, opacity: indicator.show ? 1 : 0 }" aria-hidden="true"></span>
        <button type="button" class="archive-nav-link" :class="{ active: activeSection === 'home' }" :aria-current="activeSection === 'home' ? 'page' : undefined" @click="emit('navigate', 'home')">
          <Home :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ sectionLabel('home') }}</span>
        </button>
        <button type="button" class="archive-nav-link" :class="{ active: activeSection === 'portal' }" :aria-current="activeSection === 'portal' ? 'page' : undefined" @click="emit('navigate', 'portal')">
          <LayoutGrid :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ sectionLabel('portal') }}</span>
        </button>
        <template v-for="group in navigationGroups" :key="group.id">
          <hr v-if="group.id === 'live'" class="archive-nav-divider" />
          <button v-if="group.items.length === 1" type="button" class="archive-nav-link" :class="{ active: activeNavigationGroup === group.id }"
            :aria-current="activeNavigationGroup === group.id ? 'page' : undefined" @click="emit('navigate', group.items[0].id)">
            <component :is="group.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ group.label }}</span>
          </button>
          <template v-else>
            <!-- The catalogues a reader came for are one column, one click each, every section with its own glyph (the
                 phone drawer's tiles); a group is a cluster, named for assistive tech. 图鉴's six low-traffic sections
                 fold under their name and open in filled cells, as in the drawer: their names run two to four
                 characters, so the cells' edges, not the text, keep the columns. -->
            <div v-if="group.items.length === 2" class="archive-nav-cluster" role="group" :aria-label="group.label">
              <button v-for="item in group.items" :key="item.id" type="button" class="archive-nav-link" :class="{ active: navigationSection === item.id }" :aria-current="navigationSection === item.id ? 'page' : undefined" @click="emit('navigate', item.id)">
                <component :is="archiveNavigationIcons[item.id] || group.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ item.label }}</span>
              </button>
            </div>
            <div v-else class="archive-nav-fold" :class="{ 'is-active': activeNavigationGroup === group.id }">
              <button type="button" class="archive-nav-link" :aria-expanded="foldOpen(group)" :aria-controls="`archive-nav-fold-${group.id}`" @click="toggleFold(group)">
                <component :is="group.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ group.label }}</span>
                <ChevronDown class="archive-nav-fold-caret" :size="15" :stroke-width="2" aria-hidden="true" />
              </button>
              <div v-show="foldOpen(group)" :id="`archive-nav-fold-${group.id}`" class="archive-nav-cells" role="group" :aria-label="group.label">
                <button v-for="item in group.items" :key="item.id" type="button" :class="{ active: navigationSection === item.id }" :aria-current="navigationSection === item.id ? 'page' : undefined" @click="emit('navigate', item.id)">{{ item.label }}</button>
              </div>
            </div>
            <!-- The icon rail has no room for the sections: there the group is one icon that opens its first section,
                 and the page's sibling switch reaches the others. -->
            <button type="button" class="archive-nav-link archive-nav-rail" :class="{ active: activeNavigationGroup === group.id }" @click="openDestination(group)">
              <component :is="group.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ group.label }}</span>
            </button>
          </template>
        </template>
        <button type="button" class="archive-sidebar-about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">关于本站</button>
      </nav>
    </aside>

    <ArchivePageChrome v-if="!['portal', 'reader'].includes(activeSection)" class="archive-topbar" :can-go-back="showBack" back-class="archive-back" @back="emit('back')">
      <template #before-title>
        <div class="archive-mobile-brand">
          <img :src="getBrandMarkUrl()" alt="" />
          <span>{{ ARCHIVE_BRAND.mark }}</span><span class="archive-mobile-brand-sub">{{ ARCHIVE_BRAND.sub }}</span>
        </div>
      </template>
      <template #title>
        <div class="archive-heading">
          <ArchiveBreadcrumb :items="breadcrumbs" />
          <div class="archive-title-row">
            <h1>{{ title }}</h1>
            <nav v-if="siblingSections.length" class="archive-sibling-switch" aria-label="同组栏目">
              <button v-for="section in siblingSections" :key="section.id" type="button" @click="emit('navigate', section.id)">{{ section.label }}</button>
            </nav>
          </div>
        </div>
      </template>
      <template #actions>
        <div class="archive-header-actions">
        <button v-if="searchable" class="archive-search-toggle" type="button" aria-label="搜索目录" :aria-expanded="mobileSearchOpen" @click="mobileSearchOpen = !mobileSearchOpen"><Search :size="19" /></button>
        <label v-if="searchable" class="archive-search" :class="{ 'is-open': mobileSearchOpen }">
          <Search :size="17" aria-hidden="true" />
          <input
            :value="modelValue"
            :placeholder="searchPlaceholder"
            aria-label="搜索目录内容"
            @input="emit('update:modelValue', $event.target.value)"
          />
        </label>
        <ArchiveLanguageSwitch :compact-mobile="compactMobile" />
        </div>
      </template>
    </ArchivePageChrome>

    <main class="archive-content">
      <slot />
    </main>
    <div v-if="$slots.pending" class="archive-pending-layer">
      <slot name="pending" />
    </div>

    <aside v-if="hasInspector" class="archive-inspector">
      <slot name="inspector" />
    </aside>

    <ArchiveNavigationDrawer v-if="drawerOpen" id="archive-navigation-drawer" :groups="navigationGroups" :active-section="navigationSection" @navigate="navigateFromDrawer" @close="closeDrawer(true)" />
    <nav v-if="activeSection !== 'reader' && !immersiveTool" class="archive-mobile-nav" aria-label="移动资料馆导航">
      <button
        v-for="item in mobileNavigation"
        :key="item.id"
        type="button"
        :class="{ active: item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </button>
      <button
        ref="drawerToggle"
        type="button"
        class="archive-mobile-switch"
        :class="{ active: drawerCell.active, 'is-open': drawerOpen }"
        :aria-expanded="drawerOpen"
        aria-controls="archive-navigation-drawer"
        @click="drawerOpen ? closeDrawer(false) : drawerOpen = true"
      >
        <component :is="drawerCell.icon" :size="21" :stroke-width="1.8" aria-hidden="true" />
        <span class="archive-switch-label">{{ drawerCell.label }}<component :is="drawerOpen ? ChevronDown : ChevronUp" class="archive-switch-caret" :size="12" :stroke-width="2.4" aria-hidden="true" /></span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { BookOpen, Box, CalendarDays, ChevronDown, ChevronUp, Clapperboard, FolderOpen, Home, Info, Layers, LayoutGrid, Menu, Music, Search, Users, X } from '@lucide/vue'
import ArchiveBreadcrumb from './ArchiveBreadcrumb.vue'
import ArchivePageChrome from './ArchivePageChrome.vue'
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { getBrandMarkUrl } from '../../utils/AssetResolver.js'
import { ARCHIVE_NAVIGATION_GROUPS } from '../../core/archiveNavigationGroups.js'
import { ARCHIVE_BRAND, ARCHIVE_SECTIONS, sectionLabel } from '../../core/archiveSections.js'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  compactMobile: Boolean, homeFocus: Boolean, immersiveTool: Boolean,
  activeSection: { type: String, default: 'home' },
  title: { type: String, default: '' },
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: '搜索剧情、偶像或歌曲' },
  modelValue: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  hasInspector: { type: Boolean, default: false },
  breadcrumbs: { type: Array, default: () => [] },
  // The section whose own root page is showing (剧情, 组合, 卡池…); '' on detail and other pages.
  rootSection: { type: String, default: '' },
})
const mobileSearchOpen = ref(Boolean(props.modelValue))
watch(() => props.activeSection, () => { mobileSearchOpen.value = Boolean(props.modelValue) })
watch(() => props.modelValue, value => { if (value) mobileSearchOpen.value = true })

const emit = defineEmits(['navigate', 'back', 'update:modelValue'])

// Same destinations and labels as the portal; only the glyphs are shell-specific.
const groupIcons = { stories: BookOpen, people: Users, songs: Music, history: CalendarDays, collection: Box, live: Clapperboard, studio: Layers, resources: FolderOpen }
const navigationGroups = ARCHIVE_NAVIGATION_GROUPS.map(group => ({ ...group, icon: groupIcons[group.id] }))
const navigationSection = computed(() => props.activeSection === 'reader' ? 'stories' : props.activeSection)
const activeNavigationGroup = computed(() => navigationGroups.find(group => group.ids.includes(navigationSection.value))?.id || '')

// A root page names the other pages of its group beside its title (剧情 | 通信, 偶像 | 组合 | 卡片, 活动 | 卡池).
// Groups larger than three (图鉴) keep their sections to the sidebar.
const siblingSections = computed(() => {
  const groupId = ARCHIVE_SECTIONS[props.rootSection]?.groupId
  const group = groupId ? Object.values(ARCHIVE_SECTIONS).filter(section => section.groupId === groupId) : []
  return group.length > 1 && group.length <= 3 ? group.filter(section => section.id !== props.rootSection) : []
})

// 图鉴 stays open while one of its sections is showing; elsewhere it opens and closes in place without navigating.
const openFolds = ref(new Set())
const foldOpen = group => activeNavigationGroup.value === group.id || openFolds.value.has(group.id)
function toggleFold(group) {
  if (activeNavigationGroup.value === group.id) return
  const next = new Set(openFolds.value)
  next.has(group.id) ? next.delete(group.id) : next.add(group.id)
  openFolds.value = next
}

// On the icon rail a group opens its first section, and does nothing while one of its sections is open.
function openDestination(group) {
  if (activeNavigationGroup.value === group.id) return
  emit('navigate', group.items[0].id)
}

// Phone bar, 2+1: the two homes, then one cell that opens every destination. Away from the homes that cell
// names the current section, so the bar still says where the reader is. Three equal cells; only a caret
// beside its label says that this one opens a switcher rather than staying on the page.
const mobileNavigation = computed(() => [
  { id: 'home', label: sectionLabel('home'), icon: Home, active: !drawerOpen.value && props.activeSection === 'home' },
  { id: 'portal', label: sectionLabel('portal'), icon: LayoutGrid, active: !drawerOpen.value && props.activeSection === 'portal' },
])
// The drawer's code loads on first open; it holds the sidebar's destinations, nothing of its own.
const ArchiveNavigationDrawer = defineAsyncComponent(() => import('./ArchiveNavigationDrawer.vue'))
const drawerOpen = ref(false)
const drawerToggle = ref(null)
const drawerCell = computed(() => {
  if (drawerOpen.value) return { label: '收起', icon: X, active: true }
  const section = navigationSection.value
  if (section !== 'home' && section !== 'portal' && sectionLabel(section)) {
    return { label: sectionLabel(section), icon: archiveNavigationIcons[section] || Info, active: true }
  }
  return { label: '导航', icon: Menu, active: false }
})
function closeDrawer(returnFocus) {
  drawerOpen.value = false
  if (returnFocus) nextTick(() => drawerToggle.value?.focus())
}
function navigateFromDrawer(id) {
  drawerOpen.value = false
  emit('navigate', id)
}
watch(() => props.activeSection, () => { drawerOpen.value = false })

// The sliding current-item slice: measured from whichever visible destination is active (the icon rail's
// duplicate links are display:none and skipped). Re-measured when the route, a fold or the nav's size changes.
const navRef = ref(null)
const indicator = ref({ show: false, ready: false, left: 0, top: 0, width: 0, height: 0 })
function measureIndicator() {
  const nav = navRef.value
  const el = nav && [...nav.querySelectorAll('.archive-nav-link.active, .archive-nav-cells button.active')].find(node => node.offsetParent)
  if (!el) { indicator.value = { ...indicator.value, show: false }; return }
  indicator.value = { ...indicator.value, show: true, left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
  if (!indicator.value.ready) requestAnimationFrame(() => { indicator.value = { ...indicator.value, ready: true } })
}
let navObserver
watch([() => props.activeSection, navigationSection, openFolds], () => nextTick(measureIndicator), { flush: 'post' })
onMounted(() => {
  measureIndicator()
  if (typeof ResizeObserver === 'function' && navRef.value) { navObserver = new ResizeObserver(measureIndicator); navObserver.observe(navRef.value) }
  document.fonts?.ready?.then(measureIndicator)
})
onBeforeUnmount(() => navObserver?.disconnect())
</script>

<style scoped>
.archive-shell {
  --archive-sidebar: 188px;
  --archive-inspector: 0px;
  --archive-topbar-row: 60px;
  --archive-topbar: var(--archive-topbar-row);
  --archive-accent: var(--gs-mint-ink);
  --archive-accent-soft: var(--gs-mint-wash);
  --archive-ink: var(--gs-ink);
  --archive-muted: var(--gs-ink-3);
  --archive-border: var(--gs-line);
  --archive-safe-top: env(safe-area-inset-top, 0px);
  --archive-safe-left: env(safe-area-inset-left, 0px);
  --archive-safe-right: env(safe-area-inset-right, 0px);
  display: grid;
  grid-template-columns: var(--archive-sidebar) minmax(0, 1fr) var(--archive-inspector);
  grid-template-rows: var(--archive-topbar) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  background: var(--gs-paper);
  color: var(--archive-ink);
  font-family: var(--gs-font-body);
}
.archive-shell.has-inspector { --archive-inspector: min(340px, 28vw); }
.archive-shell.is-home { --archive-topbar: 0px; }
.archive-shell.is-home .archive-topbar { display: none; }
.archive-shell.is-home .archive-content { grid-row: 1 / 3; }
.archive-shell.is-portal { --archive-topbar: 0px; }
.archive-shell.is-portal .archive-topbar { display: none; }
.archive-shell.is-portal .archive-content { grid-row: 1 / 3; }

/* Paper sidebar: a hairline instead of a navy block. Navy stays on the tools' top bar and the dark stage.
   Three heights only: recessed paper-2, the paper itself, and the white slice for the current item. */
.archive-sidebar {
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* It spans both rows: without this its content height would be handed to the title row's auto track. */
  min-height: 0;
  border-right: 1px solid var(--gs-line);
  background: var(--gs-paper);
  color: var(--gs-ink-2);
}
/* The brand row is as tall as the page title row beside it, so their bottom hairlines are one line. */
.archive-brand {
  display: flex;
  align-items: center;
  gap: var(--gs-space-3);
  flex-shrink: 0;
  box-sizing: border-box;
  height: calc(var(--archive-topbar-row) + 1px);
  margin: 0 0 var(--gs-space-3);
  padding: 0 var(--gs-space-5);
  border: 0;
  border-bottom: 1px solid var(--gs-line);
  border-radius: 0;
  background: transparent;
  color: var(--gs-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.archive-brand img { flex: none; width: 26px; height: 20px; object-fit: contain; filter: brightness(0); }
.archive-brand-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.archive-brand-name { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-style: italic; font-weight: var(--gs-weight-bold); letter-spacing: .02em; line-height: 1; white-space: nowrap; }
.archive-brand-sub { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1; white-space: nowrap; }
/* The nav fills the sidebar and scrolls only if a short window still cannot hold it; its
   scrollbar is then thin and in the chrome colours (Windows draws a wide light track otherwise). */
.archive-nav { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; gap: var(--gs-space-1); min-height: 0; padding: 0 var(--gs-space-3) var(--gs-space-5); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--gs-line) transparent; }
.archive-nav-indicator { position: absolute; top: 0; left: 0; border-radius: var(--gs-radius-control); background: var(--gs-current-bg); box-shadow: var(--gs-current-shadow); pointer-events: none; }
.archive-nav-indicator.is-ready { transition: transform var(--gs-current-motion), width var(--gs-current-motion), height var(--gs-current-motion), opacity var(--gs-motion-feedback); }
@media (prefers-reduced-motion: reduce) { .archive-nav-indicator.is-ready { transition: none; } }
.archive-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--gs-space-4);
  width: 100%;
  min-height: var(--gs-control-toolbar);
  padding: 0 var(--gs-space-4);
  border: 0;
  border-radius: var(--gs-radius-control);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--gs-text-ui);
  text-align: left;
  cursor: pointer;
}
.archive-nav-link svg { flex: none; color: var(--gs-ink-3); }
/* Current = one level above the paper: ink text and icon, the slice behind it; weight and rules unchanged. */
.archive-nav-link.active { color: var(--gs-ink); }
.archive-nav-link.active svg { color: var(--gs-ink); }
/* Groups are clusters of ordinary links, a little apart from each other. */
.archive-nav-cluster { display: grid; gap: var(--gs-space-1); }
.archive-nav-cluster + .archive-nav-cluster, .archive-nav-cluster + .archive-nav-fold { margin-top: var(--gs-space-2); }
.archive-nav-fold { display: grid; gap: var(--gs-space-1); margin-top: var(--gs-space-2); }
.archive-nav-fold-caret { margin-left: auto; opacity: .7; transition: transform var(--gs-motion-feedback) var(--gs-motion-ease); }
.archive-nav-fold > .archive-nav-link[aria-expanded='true'] .archive-nav-fold-caret { transform: rotate(180deg); }
.archive-nav-fold.is-active > .archive-nav-link { color: var(--gs-ink); cursor: default; }
.archive-nav-fold.is-active > .archive-nav-link svg { color: var(--gs-ink); }
/* 图鉴's sections: filled cells two to a row, starting on the labels' axis (12 + 18 + 12 px). */
.archive-nav-cells { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-1) var(--gs-space-2); padding-left: 36px; }
.archive-nav-cells button {
  min-width: 0;
  min-height: var(--gs-control-compact);
  padding: 0 var(--gs-space-3);
  border: 0;
  border-radius: var(--gs-radius-control);
  position: relative;
  background: transparent;
  color: var(--gs-ink-2);
  font: inherit;
  font-size: var(--gs-text-meta);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.archive-nav-cells button.active { color: var(--gs-ink); }
.archive-nav-rail { display: none; }
.archive-nav-divider { margin: var(--gs-space-4) var(--gs-space-4); border: 0; border-top: 1px solid var(--gs-line); }
/* 关于本站 sits at the foot of the sidebar, quieter than the destinations above it. */
.archive-sidebar-about { flex-shrink: 0; margin: auto 0 0; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); text-align: left; cursor: pointer; }
.archive-sidebar-about:hover { background: var(--gs-hover); color: var(--gs-ink); }
.archive-sidebar-about[aria-current='page'] { background: var(--gs-current-bg); box-shadow: var(--gs-current-shadow); color: var(--gs-ink); }
/* Laptop and tablet heights: the whole sidebar, 图鉴 open, still fits without scrolling. */
@media (max-height: 880px) {
  .archive-nav-link { min-height: calc(var(--gs-control-compact) + var(--gs-space-2)); }
  .archive-nav-divider { margin-block: var(--gs-space-2); }
  .archive-sidebar-about { min-height: var(--gs-control-compact); }
}
@media (max-height: 680px) {
  .archive-nav-link { min-height: var(--gs-control-compact); }
}
/* A phone on its side (wide but short): the sidebar folds to an icon rail so the page keeps the
   width. Labels stay in the accessibility tree; a destination's sections are reached on its page. */
@media (min-width: 761px) and (max-height: 500px) {
  .archive-shell { --archive-sidebar: 64px; }
  .archive-brand { justify-content: center; padding: 0; }
  .archive-brand-name, .archive-brand-sub, .archive-nav-link span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .archive-sidebar :deep(.stage-idol-switch) { justify-content: center; width: auto; margin: 0 var(--gs-space-2) var(--gs-space-3); padding: var(--gs-space-2) 0; }
  .archive-sidebar :deep(.stage-idol-copy), .archive-sidebar :deep(.stage-idol-switch > svg) { display: none; }
  .archive-nav { padding: 0 var(--gs-space-2) var(--gs-space-3); }
  .archive-nav-link { justify-content: center; padding: 0; }
  .archive-nav-cluster, .archive-nav-fold { display: none; }
  .archive-nav-rail { display: flex; }
  .archive-nav-divider { margin-inline: var(--gs-space-2); }
  .archive-sidebar-about { padding: 0; font-size: var(--gs-text-caption); text-align: center; }
}
@media (hover: hover) {
  .archive-brand:hover { background: var(--gs-hover); }
  .archive-nav-link:not(.active):hover, .archive-nav-cells button:not(.active):hover { background: var(--gs-hover); color: var(--gs-ink); }
}
.archive-brand:focus-visible, .archive-nav-link:focus-visible, .archive-nav-cells button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.archive-topbar {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(260px, 460px);
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--archive-border);
  background: var(--gs-paper);
}
.archive-topbar h1 {
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archive-title-row { display: flex; align-items: baseline; gap: var(--gs-space-4); min-width: 0; }
.archive-sibling-switch { display: flex; flex: none; align-items: baseline; gap: var(--gs-space-1); }
.archive-sibling-switch button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.archive-sibling-switch button + button::before { content: "·"; margin-right: var(--gs-space-3); color: var(--gs-line); }
.archive-sibling-switch button:hover { color: var(--gs-mint-ink); }
.archive-sibling-switch button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.archive-heading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  min-width: 0;
}
.archive-topbar {
  --archive-back-ink: var(--gs-mint-ink);
}
.archive-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--gs-control-normal);
  min-width: 0;
  padding: 0 var(--gs-space-4);
  border: 1px solid var(--gs-line);
  border-radius: var(--gs-radius-control);
  color: var(--gs-ink-3);
  background: var(--gs-surface);
}
.archive-search:focus-within { border-color: var(--gs-ink-3); box-shadow: 0 0 0 var(--gs-focus-ring) var(--gs-mint); }
.archive-header-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; min-width:0; }
.archive-header-actions .archive-search { flex:1; }
.archive-search input {
  min-width: 0;
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--archive-ink);
  font: inherit;
  font-size: var(--gs-text-ui);
  font-weight: var(--gs-weight-regular);
}
.archive-content { grid-column: 2; min-width: 0; min-height: 0; overflow: hidden; background: var(--gs-paper); }
.archive-content :deep(.list-screen), .archive-content :deep(.home-screen) { height: 100%; }
/* A new page rises from a dimmed paper as it mounts (never from fully transparent: the bare paper
   between two pages is what reads as a blink); the old one is already gone, so nothing waits on it.
   Opacity only: a transform here would re-anchor the pages' fixed bars while it ran. The shell around
   this slot never animates. */
.archive-content > :deep(*) { animation: gs-page-in var(--gs-motion-page) var(--gs-ease-out) backwards; }
.archive-inspector {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid var(--archive-border);
  background: var(--gs-paper);
}
.archive-mobile-brand, .archive-mobile-nav { display: none; }
.archive-search-toggle { display:none; }

@media (min-width: 761px) {
  /* The language-only action group must not reserve a search-sized column.
     Allow wrapped page identity to grow its own row without covering content. */
  .archive-shell:not(.is-home):not(.is-portal):not(.is-home-focus) {
    grid-template-rows: minmax(var(--archive-topbar), auto) minmax(0, 1fr);
  }
  .archive-topbar {
    grid-template-columns: auto minmax(0, 1fr) max-content;
    /* 44px back button + 2 x 8 = the 60px brand row; a wrapped title still grows the row. */
    padding: var(--gs-space-3) 18px;
  }
  .archive-topbar:not(:has(.archive-back)) {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
  .archive-topbar:has(.archive-search) {
    grid-template-columns: auto minmax(0, 1fr) clamp(320px, 38%, 420px);
  }
  .archive-topbar:has(.archive-search):not(:has(.archive-back)) {
    grid-template-columns: minmax(0, 1fr) clamp(320px, 38%, 420px);
  }
  .archive-topbar h1 {
    white-space: normal;
    text-overflow: clip;
    overflow-wrap: anywhere;
  }
  .archive-heading :deep(.archive-breadcrumb ol) { flex-wrap: wrap; row-gap: 4px; }
  .archive-heading :deep(.archive-breadcrumb li) { max-width: 100%; }
  .archive-heading :deep(.archive-breadcrumb a),
  .archive-heading :deep(.archive-breadcrumb span) {
    min-width: 0;
    white-space: normal;
    text-overflow: clip;
    overflow-wrap: anywhere;
  }
}

/* Phones reach a group's other pages from the navigation drawer. */
@media (max-width: 760px) { .archive-sibling-switch { display: none; } }
@media (max-width: 760px) {
  .archive-shell, .archive-shell.has-inspector {
    --archive-sidebar: 0px;
    --archive-inspector: 0px;
    --archive-topbar: calc(124px + var(--archive-safe-top));
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--archive-topbar) minmax(0, 1fr) calc(74px + env(safe-area-inset-bottom, 0px));
  }
  .archive-shell.is-home { --archive-topbar: 0px; }
  .archive-shell.is-reader { grid-template-rows: minmax(0,1fr); }
  .archive-shell.is-reader .archive-content, .archive-shell.is-reader .archive-pending-layer { grid-row:1; }
  .archive-sidebar { display: none; }
  .archive-topbar {
    grid-column: 1;
    grid-row: 1;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: 52px 60px;
    gap: 0 10px;
    padding: var(--archive-safe-top) max(16px, var(--archive-safe-right)) 8px max(16px, var(--archive-safe-left));
  }
  .archive-mobile-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    font-size: var(--gs-text-subtitle);
    font-weight: var(--gs-weight-bold);
  }
  .archive-mobile-brand img { width: 31px; height: 24px; object-fit: contain; }
  .archive-topbar :deep(.archive-back) { grid-row: 1; grid-column: 1; }
  .archive-topbar:has(.archive-back) .archive-mobile-brand { grid-column: 2; }
  .archive-heading { grid-row: 2; grid-column: 1; gap: 4px; }
  .archive-topbar h1 { font-size: var(--gs-text-section); }
  .archive-search { grid-row: 2; grid-column: 2; height: var(--gs-control-touch); }
  .archive-search input { font-size: var(--gs-text-subtitle); }
  .archive-header-actions { display:contents; }
  .archive-header-actions :deep(.archive-language-switch) { grid-row:1; grid-column:2; justify-self:end; }
  .archive-topbar .archive-mobile-brand { display:none; }
  .archive-topbar:not(:has(.archive-search)) .archive-heading { grid-column: 1 / -1; }
  .archive-content { grid-column: 1; grid-row: 2; padding-bottom: 0; }
  .archive-inspector { display: none; }
  .archive-mobile-nav {
    grid-column: 1;
    grid-row: 3;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--archive-border);
    background: var(--gs-surface);
    z-index: 20;
  }
  .archive-mobile-nav button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--gs-ink-3);
    font: inherit;
    font-size: var(--gs-text-meta);
    min-height: 44px;
    cursor: pointer;
  }
  .archive-mobile-nav button.active { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
  .archive-mobile-nav button.active svg { color: var(--gs-mint-ink); }
  .archive-mobile-nav button:active { background: var(--gs-mint-wash); }
  .archive-mobile-nav button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -4px; }
  /* The caret hangs off the label, so the label stays centred under its icon like the two tabs. */
  .archive-switch-label { position: relative; white-space: nowrap; }
  .archive-switch-caret { position: absolute; top: 50%; left: 100%; margin: -6px 0 0 2px; opacity: .65; }
}
/* Same grid cell as content: never cover the separate mobile navigation row.
   Explicitly place main as well: leaving it auto-placed would push it to a new
   row when this overlapping item reserves row 2. Do not make main positioned;
   that would change containing blocks for its existing absolute descendants. */
.archive-content { grid-row: 2; }
.archive-pending-layer {
  grid-column: 2; grid-row: 2; z-index: 25;
  display: flex; align-items: center; justify-content: center;
  min-width: 0; min-height: 0; padding: 18px;
  pointer-events: none;
}
.archive-pending-layer :deep(.gs-loading-indicator) {
  max-width: 100%; pointer-events: none;
  padding: 18px 24px; border-radius: 14px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 8px 32px rgb(22 47 56 / 12%);
  animation: gs-archive-pending-in 120ms ease-out 140ms both;
}
.archive-shell.is-home .archive-pending-layer,
.archive-shell.is-portal .archive-pending-layer { grid-row: 1 / 3; }
@keyframes gs-archive-pending-in { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 760px) {
  .archive-pending-layer {
    grid-column: 1;
    padding: 12px max(12px, var(--archive-safe-right)) 12px max(12px, var(--archive-safe-left));
  }
}
@media (prefers-reduced-motion: reduce) {
  .archive-pending-layer :deep(.gs-loading-indicator) { animation: none; }
}
.archive-shell.is-home-focus { --archive-sidebar: 0px; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.archive-shell.is-home-focus .archive-sidebar, .archive-shell.is-home-focus .archive-topbar, .archive-shell.is-home-focus .archive-mobile-nav { display: none; }
.archive-shell.is-home-focus .archive-content { grid-column: 1; grid-row: 1; }
.archive-shell.is-home-focus .archive-pending-layer { grid-column: 1; grid-row: 1; }
@media (pointer: coarse) {
  .archive-search { height: var(--gs-control-touch); }
  .archive-search input { font-size: var(--gs-text-subtitle); }
}
</style>

<style scoped>
@media(max-width:760px) {
.archive-shell.is-tool { --archive-topbar: calc(62px + var(--archive-safe-top)); grid-template-rows: var(--archive-topbar) minmax(0,1fr); }
.is-tool .archive-topbar { display: flex; padding: var(--archive-safe-top) max(12px, var(--archive-safe-right)) 0 max(12px, var(--archive-safe-left)); gap: 12px; }
.is-tool .archive-mobile-brand, .is-tool .archive-heading :deep(.archive-breadcrumb) { display: none; }
.is-tool .archive-heading { min-width: 0; }
.is-tool .archive-topbar h1 { font-size: 16px; }
.is-tool .archive-header-actions { margin-left:auto; }
}
</style>

<style scoped>
@media(max-width:760px) {
 .archive-shell.is-compact-mobile:not(.is-home):not(.is-portal):not(.is-reader) { --archive-topbar:calc(48px + var(--archive-safe-top)); }
 /* Search is an in-flow row: 44px hit area plus 8px separation below it. */
 .archive-shell.is-compact-mobile:not(.is-home):not(.is-portal):not(.is-reader):has(.archive-search.is-open) { --archive-topbar:calc(48px + var(--gs-control-touch) + var(--gs-space-3) + var(--archive-safe-top)); }
 .is-compact-mobile .archive-topbar {display:grid;grid-template-columns:44px minmax(0,1fr) 44px 48px;grid-template-rows:48px;gap:0;padding:var(--archive-safe-top) max(10px,var(--archive-safe-right)) 0 max(10px,var(--archive-safe-left));}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) {grid-template-columns:44px minmax(0,1fr) 48px;}
 .is-compact-mobile .archive-heading {grid-column:2;grid-row:1;min-width:0;text-align:center;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) .archive-heading {grid-column:2;}
 /* A long entity name wraps to a second line inside the 48px bar instead of being cut off. */
 .is-compact-mobile .archive-topbar h1 {display:-webkit-box;font-size:var(--gs-text-subtitle);line-height:1.3;overflow:hidden;white-space:normal;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2;}
 .is-compact-mobile .archive-heading {align-self:center;}
 .is-compact-mobile .archive-heading :deep(.archive-breadcrumb),.is-compact-mobile :deep(.archive-back span) {display:none;}
 .is-compact-mobile .archive-topbar :deep(.archive-back) {width:44px;padding:0;}
 .is-compact-mobile .archive-header-actions :deep(.archive-language-switch) {grid-column:4;grid-row:1;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) :deep(.archive-language-switch) {grid-column:3;}
 .is-compact-mobile .archive-search-toggle {display:grid;place-items:center;grid-column:3;grid-row:1;width:44px;height:44px;padding:0;border:0;background:transparent;color:#52777b;cursor:pointer;}
 .is-compact-mobile .archive-search {display:none;grid-column:1/-1;grid-row:2;height:var(--gs-control-touch);width:100%;margin-bottom:var(--gs-space-3);}
 .is-compact-mobile .archive-search.is-open {display:flex;animation:gs-fade-in var(--gs-motion-enter) var(--gs-ease-out) backwards;}
}
</style>
