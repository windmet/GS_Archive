<template>
  <div class="archive-shell" :class="{ 'is-compact-mobile': compactMobile, 'is-rail': railMode, 'is-reader': activeSection === 'reader', 'is-tool': immersiveTool, 'is-home-focus': homeFocus && activeSection === 'home', 'has-inspector': hasInspector, 'has-subnav': hasSubnav, 'is-home': activeSection === 'home', 'is-portal': activeSection === 'portal' || activeSection === 'reader' }">
    <aside class="archive-sidebar" aria-label="资料馆导航">
      <button type="button" class="archive-brand" :aria-current="activeSection === 'portal' ? 'page' : undefined" title="资料馆首页" @click="emit('navigate', 'portal')">
        <img :src="getBrandMarkUrl()" alt="" />
        <span class="archive-brand-text"><span class="archive-brand-name">{{ ARCHIVE_BRAND.mark }}</span><span class="archive-brand-sub">{{ ARCHIVE_BRAND.sub }}</span></span>
      </button>
      <!-- 担当 and the destinations scroll together: on a window too short for both, nothing slides under a fixed row. -->
      <div class="archive-sidebar-scroll">
        <slot name="sidebar-identity" />
        <nav ref="navRef" class="archive-nav" aria-label="档案栏目">
          <!-- One white slice marks the current destination and slides to the next one (selection, rule A). -->
          <span class="archive-nav-indicator" :class="{ 'is-ready': indicator.ready }" :style="{ width: indicator.width + 'px', height: indicator.height + 'px', transform: `translate(${indicator.left}px, ${indicator.top}px)`, opacity: indicator.show ? 1 : 0 }" aria-hidden="true"></span>
          <template v-for="entry in sidebarEntries" :key="entry.id">
            <hr v-if="entry.divider" class="archive-nav-divider" />
            <div class="archive-nav-cluster" role="group" :aria-label="entry.label">
              <button v-for="item in entry.items" :key="item.id" type="button" class="archive-nav-link" :class="{ active: item.active }" :title="railMode ? item.label : undefined" :aria-current="item.active ? 'page' : undefined" :aria-haspopup="item.menu && 'menu'" :aria-expanded="item.menu && !!flyout" @click="item.menu ? flyout = flyout ? null : $event.currentTarget : emit('navigate', item.target)">
                <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ item.label }}</span>
              </button>
            </div>
          </template>
        </nav>
      </div>
      <div class="archive-sidebar-foot">
        <button v-if="!forcedRail" type="button" class="archive-sidebar-toggle" :aria-label="railMode ? '展开侧栏' : '收起侧栏'" :title="railMode ? '展开侧栏' : '收起侧栏'" :aria-expanded="!railMode" @click="toggleSidebar">
          <component :is="railMode ? PanelLeftOpen : PanelLeftClose" :size="18" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <button type="button" class="archive-sidebar-about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">关于本站</button>
      </div>
    </aside>

    <ArchivePageChrome v-if="!['portal', 'reader'].includes(activeSection)" class="archive-topbar" :can-go-back="backVisible" :back-label="backLabel" back-icon-only back-class="archive-back" @back="emit('back')">
      <template #before-title>
        <div class="archive-mobile-brand">
          <img :src="getBrandMarkUrl()" alt="" />
          <span>{{ ARCHIVE_BRAND.mark }}</span><span class="archive-mobile-brand-sub">{{ ARCHIVE_BRAND.sub }}</span>
        </div>
      </template>
      <template #title>
        <div class="archive-heading">
          <ArchiveBreadcrumb :items="breadcrumbs" @follow="emit('follow', $event)" />
          <h1>{{ title }}</h1>
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
        <div v-if="$slots['header-actions']" class="archive-page-actions"><slot name="header-actions" /></div>
        <ArchiveLanguageSwitch :compact-mobile="compactMobile" />
        </div>
      </template>
    </ArchivePageChrome>

    <ArchiveFlyoutMenu v-if="flyout" :anchor="flyout" :current="navigationSection" @select="flyout = null; emit('navigate', $event)" @close="flyout = null" />

    <div v-if="hasSubnav" class="archive-subnav"><slot name="subnav" /></div>

    <main class="archive-content">
      <slot />
    </main>
    <div v-if="$slots.pending" class="archive-pending-layer">
      <slot name="pending" />
    </div>

    <aside v-if="hasInspector" class="archive-inspector">
      <slot name="inspector" />
    </aside>

    <ArchiveNavigationDrawer v-if="drawerOpen" id="archive-navigation-drawer" :groups="navigationGroups" :active-section="navigationSection" :keyboard="drawerByKeyboard" @navigate="navigateFromDrawer" @close="closeDrawer(true)" />
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
        @click="drawerOpen ? closeDrawer(false) : openNavigationDrawer($event)"
      >
        <component :is="drawerCell.icon" :size="21" :stroke-width="1.8" aria-hidden="true" />
        <span class="archive-switch-label">{{ drawerCell.label }}<component :is="drawerOpen ? ChevronDown : ChevronUp" class="archive-switch-caret" :size="12" :stroke-width="2.4" aria-hidden="true" /></span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { BookOpen, Box, CalendarDays, ChevronDown, ChevronUp, Clapperboard, FolderOpen, Home, Info, Layers, LayoutGrid, Menu, Music, PanelLeftClose, PanelLeftOpen, Search, Users, UsersRound, X } from '@lucide/vue'
import ArchiveBreadcrumb from './ArchiveBreadcrumb.vue'
import ArchivePageChrome from './ArchivePageChrome.vue'
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { getBrandMarkUrl } from '../../utils/AssetResolver.js'
import { ARCHIVE_NAVIGATION_GROUPS } from '../../core/archiveNavigationGroups.js'
import { ARCHIVE_BRAND, sectionLabel } from '../../core/archiveSections.js'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots, watch } from 'vue'

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
})
const slots = useSlots()
const hasSubnav = computed(() => Boolean(slots.subnav) && !['portal', 'reader', 'home'].includes(props.activeSection))
const mobileSearchOpen = ref(Boolean(props.modelValue))
watch(() => props.activeSection, () => { mobileSearchOpen.value = Boolean(props.modelValue) })
watch(() => props.modelValue, value => { if (value) mobileSearchOpen.value = true })

const emit = defineEmits(['navigate', 'follow', 'back', 'update:modelValue'])

// Same destinations and labels as the portal; only the glyphs are shell-specific.
const groupIcons = { stories: BookOpen, people: Users, songs: Music, history: CalendarDays, collection: Box, live: Clapperboard, studio: Layers, resources: FolderOpen }
const navigationGroups = ARCHIVE_NAVIGATION_GROUPS.map(group => ({ ...group, icon: groupIcons[group.id] }))
const navigationSection = computed(() => props.activeSection === 'reader' ? 'stories' : props.activeSection)
const activeNavigationGroup = computed(() => navigationGroups.find(group => group.ids.includes(navigationSection.value))?.id || '')

function readStored(key) { try { return localStorage.getItem(key) || '' } catch { return '' } }
function writeStored(key, value) { try { localStorage.setItem(key, value) } catch { /* private window */ } }

// Back appears below a section's own page, where a parent exists; phones always keep it (their bar has no sidebar).
const parentCrumbs = computed(() => props.breadcrumbs.slice(1, -1))
const backVisible = computed(() => props.showBack && (isPhone.value || parentCrumbs.value.length > 0))
const backLabel = computed(() => parentCrumbs.value.length ? `返回${parentCrumbs.value[parentCrumbs.value.length - 1].label}` : '返回')

// The sidebar: one entry per destination. 图鉴 is one entry that opens a menu of its categories instead of navigating
// (the categories are also the page's own tabs); 偶像 / 组合 / 卡片 sit together. Everything else is the shared group list.
const flyout = ref(null)
const sidebarEntries = computed(() => [
  { id: 'top', label: '资料馆', items: [{ id: 'home', label: sectionLabel('home'), icon: Home, target: 'home', active: props.activeSection === 'home' }, { id: 'portal', label: sectionLabel('portal'), icon: LayoutGrid, target: 'portal', active: props.activeSection === 'portal' }] },
  ...navigationGroups.map(group => {
    const items = group.id === 'collection'
      ? [{ id: 'collection', label: group.label, icon: Box, menu: true, active: activeNavigationGroup.value === 'collection' }]
      : (group.id === 'people' ? ['idols', 'units', 'cards'] : group.ids).map(id => ({ id, label: sectionLabel(id), icon: id === 'units' ? UsersRound : archiveNavigationIcons[id] || group.icon, target: id, active: navigationSection.value === id }))
    return { id: group.id, label: group.label, divider: group.id === 'live', items }
  }),
])

// Expanded 208 / rail 58. Chosen once, remembered on this device; until then wide windows open, narrower ones fold.
const SIDEBAR_KEY = 'sidem:archive-sidebar'
const storedSidebar = ref(['rail', 'full'].includes(readStored(SIDEBAR_KEY)) ? readStored(SIDEBAR_KEY) : '')
const wideWindow = ref(true), forcedRail = ref(false), isPhone = ref(false)
const railMode = computed(() => forcedRail.value || (storedSidebar.value ? storedSidebar.value === 'rail' : !wideWindow.value))
function toggleSidebar() {
  storedSidebar.value = railMode.value ? 'full' : 'rail'
  writeStored(SIDEBAR_KEY, storedSidebar.value)
}
const stopQueries = []
function track(query, target) {
  if (typeof matchMedia !== 'function') return
  const list = matchMedia(query)
  const update = () => { target.value = list.matches }
  update()
  list.addEventListener?.('change', update)
  stopQueries.push(() => list.removeEventListener?.('change', update))
}
track('(min-width: 1101px)', wideWindow)
track('(min-width: 761px) and (max-height: 500px)', forcedRail)
track('(max-width: 760px)', isPhone)
onBeforeUnmount(() => stopQueries.forEach(stop => stop()))

// Phone bar, 2+1: the two homes, then one cell that opens every destination. Away from the homes that cell
// names the current section, so the bar still says where the reader is. Three equal cells; only a caret
// beside its label says that this one opens a switcher rather than staying on the page.
const mobileNavigation = computed(() => [
  { id: 'home', label: sectionLabel('home'), icon: Home, active: !drawerOpen.value && props.activeSection === 'home' },
  { id: 'portal', label: sectionLabel('portal'), icon: LayoutGrid, active: !drawerOpen.value && props.activeSection === 'portal' },
])
// The drawer's code loads on first open; it holds the sidebar's destinations, nothing of its own.
const ArchiveNavigationDrawer = defineAsyncComponent(() => import('./ArchiveNavigationDrawer.vue'))
// The sidebar menu loads on first open, like the drawer.
const ArchiveFlyoutMenu = defineAsyncComponent(() => import('./ArchiveFlyoutMenu.vue'))
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
// The bar's cell and the archive home's 全部栏目 cell open the same drawer (线框减法册 L2). A keyboard click
// (detail 0) puts focus on the current cell; Esc returns focus to whichever control opened it.
const drawerByKeyboard = ref(false)
let drawerOpener = null
function openNavigationDrawer(event) {
  drawerByKeyboard.value = event?.detail === 0
  drawerOpener = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
  drawerOpen.value = true
}
provide('openNavigationDrawer', openNavigationDrawer)
function closeDrawer(returnFocus) {
  drawerOpen.value = false
  if (returnFocus) nextTick(() => (drawerOpener?.isConnected ? drawerOpener : drawerToggle.value)?.focus())
}
function navigateFromDrawer(id) {
  drawerOpen.value = false
  emit('navigate', id)
}
watch(() => props.activeSection, () => { drawerOpen.value = false })

// The sliding current-item slice: measured from the active destination. Re-measured when the route, the
// rail state or the nav's size changes (and when the width transition ends).
const navRef = ref(null)
const indicator = ref({ show: false, ready: false, left: 0, top: 0, width: 0, height: 0 })
function measureIndicator() {
  const nav = navRef.value
  const el = nav && [...nav.querySelectorAll('.archive-nav-link.active')].find(node => node.offsetParent)
  if (!el) { indicator.value = { ...indicator.value, show: false }; return }
  indicator.value = { ...indicator.value, show: true, left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
  if (!indicator.value.ready) requestAnimationFrame(() => { indicator.value = { ...indicator.value, ready: true } })
}
let navObserver
watch([() => props.activeSection, navigationSection, railMode], () => nextTick(measureIndicator), { flush: 'post' })
onMounted(() => {
  measureIndicator()
  if (typeof ResizeObserver === 'function' && navRef.value) { navObserver = new ResizeObserver(measureIndicator); navObserver.observe(navRef.value) }
  document.fonts?.ready?.then(measureIndicator)
})
onBeforeUnmount(() => navObserver?.disconnect())
</script>

<style scoped>
.archive-shell {
  --archive-sidebar: 208px;
  --archive-inspector: 0px;
  --archive-topbar-row: 60px;
  /* The title row is the brand row: 60px plus the shared hairline, never taller. */
  --archive-topbar: calc(var(--archive-topbar-row) + 1px);
  --archive-nav-row: 40px;
  --archive-identity-row: 52px;
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
  transition: grid-template-columns 180ms var(--gs-ease-out);
}
.archive-shell.is-rail { --archive-sidebar: 58px; }
.archive-shell.has-inspector { --archive-inspector: min(340px, 28vw); }
.archive-shell.is-home { --archive-topbar: 0px; }
.archive-shell.is-home .archive-topbar { display: none; }
.archive-shell.is-home .archive-content { grid-row: 1 / 3; }
.archive-shell.is-portal { --archive-topbar: 0px; }
.archive-shell.is-portal .archive-topbar { display: none; }
.archive-shell.is-portal .archive-content { grid-row: 1 / 3; }

/* Paper sidebar: a hairline instead of a navy block. Navy stays on the tools' top bar and the dark stage.
   Three heights only: recessed paper-2, the paper itself, and the white slice for the current item.
   Every x position is measured from a 58px rail (icon centre 29) so folding only removes the text. */
.archive-sidebar {
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* It spans both rows: without this its content height would be handed to the title row's track. */
  min-height: 0;
  overflow: hidden;
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
/* 担当 and the destinations share one scroller; it scrolls only if a short window cannot hold both. Its scrollbar is
   thin and in the chrome colours (Windows draws a wide light track otherwise). */
.archive-sidebar-scroll { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--gs-line) transparent; }
.archive-nav { position: relative; display: flex; flex: none; flex-direction: column; gap: var(--gs-space-1); padding: 0 var(--gs-space-3) var(--gs-space-4); }
.archive-nav-indicator { position: absolute; top: 0; left: 0; border-radius: var(--gs-radius-control); background: var(--gs-current-bg); box-shadow: var(--gs-current-shadow); pointer-events: none; }
.archive-nav-indicator.is-ready { transition: transform var(--gs-current-motion), width var(--gs-current-motion), height var(--gs-current-motion), opacity var(--gs-motion-feedback); }
.archive-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--gs-space-4);
  width: 100%;
  box-sizing: border-box;
  min-height: var(--archive-nav-row);
  padding: 0 var(--gs-space-4);
  border: 0;
  border-radius: var(--gs-radius-control);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--gs-text-ui);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.archive-nav-link svg { flex: none; color: var(--gs-ink-3); }
/* An entry that opens a menu says so with a caret on its right edge; the icon rail has no room for it. */
.archive-nav-link[aria-haspopup]::after { content: ''; width: 7px; height: 7px; margin-left: auto; border: solid currentcolor; border-width: 2px 2px 0 0; opacity: .6; transform: rotate(45deg); }
.archive-nav-link[aria-expanded='true']:not(.active) { background: var(--gs-hover); }
.is-rail .archive-nav-link[aria-haspopup]::after { display: none; }
/* Current = one level above the paper: ink text and icon, the slice behind it; weight and rules unchanged. */
.archive-nav-link.active { color: var(--gs-ink); }
.archive-nav-link.active svg { color: var(--gs-ink); }
/* Groups carry no heading, so they carry no extra gap either: every row sits the same 4px from the next and
   the one rule before the tools is the only break (an unlabelled 8px between groups read as uneven spacing). */
.archive-nav-cluster { display: grid; gap: var(--gs-space-1); }
.archive-nav-divider { margin: var(--gs-space-4) var(--gs-space-4); border: 0; border-top: 1px solid var(--gs-line); }
/* The foot: fold button on the rail's icon axis, 关于本站 beside it, quieter than the destinations above. */
.archive-sidebar-foot { display: flex; flex: none; align-items: center; gap: var(--gs-space-2); padding: var(--gs-space-3) var(--gs-space-3) var(--gs-space-3) 13px; }
.archive-sidebar-toggle { display: grid; flex: none; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-3); cursor: pointer; }
.archive-sidebar-about { flex: none; min-height: 32px; padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); text-align: left; white-space: nowrap; cursor: pointer; }
.archive-sidebar-toggle:hover, .archive-sidebar-about:hover { background: var(--gs-hover); color: var(--gs-ink); }
.archive-sidebar-about[aria-current='page'] { background: var(--gs-current-bg); box-shadow: var(--gs-current-shadow); color: var(--gs-ink); }
/* Window height sets the row height: the whole sidebar must hold without scrolling down to 688px. */
@media (max-height: 880px) {
  .archive-shell { --archive-nav-row: 36px; }
  .archive-nav-divider { margin-block: var(--gs-space-2); }
}
@media (max-height: 720px) {
  .archive-shell { --archive-nav-row: 32px; --archive-identity-row: 44px; }
  .archive-nav { padding-bottom: var(--gs-space-3); }
  .archive-nav-divider { margin-block: var(--gs-space-1); }
}
/* Rail: the text leaves (kept for assistive tech); icons, avatar and mark stay where they were. */
.is-rail .archive-brand-text, .is-rail .archive-nav-link span, .is-rail .archive-sidebar-about { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.is-rail .archive-sidebar :deep(.stage-idol-copy), .is-rail .archive-sidebar :deep(.stage-idol-caret) { display: none; }
.is-rail .archive-nav-divider { margin-inline: var(--gs-space-3); }
@media (hover: hover) {
  .archive-brand:hover { background: var(--gs-hover); }
  .archive-nav-link:not(.active):hover { background: var(--gs-hover); color: var(--gs-ink); }
}
.archive-brand:focus-visible, .archive-nav-link:focus-visible, .archive-sidebar-toggle:focus-visible, .archive-sidebar-about:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .archive-shell { transition: none; } .archive-nav-indicator.is-ready { transition: none; } }
/* The title row: back, parents, title on one 60px line; actions on the right. */
.archive-topbar {
  grid-column: 2 / -1;
  display: flex;
  align-items: center;
  gap: var(--gs-space-3);
  box-sizing: border-box;
  height: var(--archive-topbar);
  min-width: 0;
  padding: 0 var(--gs-space-6) 0 var(--gs-gutter);
  border-bottom: 1px solid var(--archive-border);
  background: var(--gs-paper);
  --archive-back-ink: var(--gs-ink-2);
}
.archive-topbar:has(.archive-back) { padding-left: var(--gs-space-5); }
.archive-topbar :deep(.archive-back) { flex: none; width: 36px; min-width: 36px; height: 36px; min-height: 36px; padding: 0; border-radius: var(--gs-radius-control); }
.archive-heading { display: flex; flex: 1 1 auto; align-items: center; min-width: 0; }
.archive-topbar h1 {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.archive-header-actions { display: flex; flex: 0 1 clamp(260px, 38%, 440px); align-items: center; justify-content: flex-end; gap: 10px; min-width: 0; }
.archive-header-actions .archive-search { flex: 1; }
.archive-page-actions { display: flex; flex: none; align-items: center; }
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
.archive-subnav { grid-column: 2; grid-row: 2; min-width: 0; }
.archive-shell.has-subnav { grid-template-rows: var(--archive-topbar) 44px minmax(0, 1fr); }
.archive-shell.has-subnav .archive-content, .archive-shell.has-subnav .archive-pending-layer { grid-row: 3; }
.archive-shell.has-subnav .archive-inspector { grid-row: 3; }
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
    display: grid;
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
  .archive-heading { grid-row: 2; grid-column: 1; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px; }
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
  .archive-mobile-nav button.active svg { color: var(--gs-ink); }
  .archive-mobile-nav button:active { background: var(--gs-hover); }
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
/* Full-page modes: home focus, and the reader, which is its own page like LIVE and the photo studio
   (its header carries the way back, so the archive sidebar and topbar step aside at every width). */
.archive-shell.is-home-focus, .archive-shell.is-reader { --archive-sidebar: 0px; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.archive-shell.is-home-focus .archive-sidebar, .archive-shell.is-home-focus .archive-topbar, .archive-shell.is-home-focus .archive-mobile-nav,
.archive-shell.is-reader .archive-sidebar, .archive-shell.is-reader .archive-topbar { display: none; }
.archive-shell.is-home-focus .archive-content, .archive-shell.is-reader .archive-content { grid-column: 1; grid-row: 1; }
.archive-shell.is-home-focus .archive-pending-layer, .archive-shell.is-reader .archive-pending-layer { grid-column: 1; grid-row: 1; }
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
 .is-compact-mobile .archive-heading {grid-column:2;grid-row:1;min-width:0;text-align:left;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) .archive-heading {grid-column:2;}
 /* One line, left-aligned after the back arrow (线框减法册 L1): a long entity name ends in an ellipsis;
    the full name is the page's own heading below the bar. */
 .is-compact-mobile .archive-topbar h1 {display:block;font-size:var(--gs-text-subtitle);line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
 .is-compact-mobile .archive-heading {align-self:center;}
 .is-compact-mobile .archive-heading :deep(.archive-breadcrumb),.is-compact-mobile :deep(.archive-back span) {display:none;}
 .is-compact-mobile .archive-topbar :deep(.archive-back) {width:44px;padding:0;}
 .is-compact-mobile .archive-header-actions :deep(.archive-language-switch) {grid-column:4;grid-row:1;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) :deep(.archive-language-switch) {grid-column:3;}
 /* A detail page's own actions (previous / next, the unit's faces) take a column before the language switch. */
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)):has(.archive-page-actions) {grid-template-columns:44px minmax(0,1fr) auto auto;column-gap:var(--gs-space-1);}
 .is-compact-mobile .archive-topbar .archive-page-actions {grid-column:3;grid-row:1;}
 .is-compact-mobile .archive-topbar :deep(.archive-page-actions > *) {margin-right:0;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)):has(.archive-page-actions) :deep(.archive-language-switch) {grid-column:4;}
 .is-compact-mobile .archive-search-toggle {display:grid;place-items:center;grid-column:3;grid-row:1;width:44px;height:44px;padding:0;border:0;background:transparent;color:#52777b;cursor:pointer;}
 .is-compact-mobile .archive-search {display:none;grid-column:1/-1;grid-row:2;height:var(--gs-control-touch);width:100%;margin-bottom:var(--gs-space-3);}
 .is-compact-mobile .archive-search.is-open {display:flex;animation:gs-fade-in var(--gs-motion-enter) var(--gs-ease-out) backwards;}
}
</style>

<style scoped>
@media (max-width: 760px) {
  .archive-shell.has-subnav { grid-template-rows: var(--archive-topbar) 44px minmax(0, 1fr) calc(74px + env(safe-area-inset-bottom, 0px)); }
  .archive-subnav { grid-column: 1; }
  .archive-shell.has-subnav .archive-mobile-nav { grid-row: 4; }
  .archive-shell.has-subnav .archive-pending-layer { grid-column: 1; }
}
</style>
