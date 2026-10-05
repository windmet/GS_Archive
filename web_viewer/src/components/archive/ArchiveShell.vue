<template>
  <div class="archive-shell" :class="{ 'is-compact-mobile': compactMobile, 'is-reader': activeSection === 'reader', 'is-tool': immersiveTool, 'is-home-focus': homeFocus && activeSection === 'home', 'has-inspector': hasInspector, 'is-home': activeSection === 'home', 'is-portal': activeSection === 'portal' || activeSection === 'reader' }">
    <aside class="archive-sidebar" aria-label="资料馆导航">
      <div class="archive-brand">
        <img :src="getBrandMarkUrl()" alt="" />
        <span>SideM<br />Archive</span>
      </div>
      <nav class="archive-nav" aria-label="档案栏目">
        <button
          v-for="item in primaryNavigation.filter(item => item.id === 'home')"
          :key="item.id"
          :class="{ active: (activeSection === item.id || (activeSection === 'reader' && item.id === 'stories')) }"
          :aria-current="(activeSection === item.id || (activeSection === 'reader' && item.id === 'stories')) ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
        <button type="button" class="archive-overview-link" :class="{ active: activeSection === 'portal' }" :aria-current="activeSection === 'portal' ? 'page' : undefined" @click="emit('navigate', 'portal')"><LayoutGrid :size="19" :stroke-width="1.8" aria-hidden="true" /><span>资料馆</span></button>
        <div v-for="group in navigationGroups" :key="group.id" class="archive-nav-group" :class="{ 'is-active': activeNavigationGroup === group.id }" role="group" :aria-labelledby="`nav-${group.id}`">
          <h2>
            <button :id="`nav-${group.id}`" type="button" class="archive-nav-group-trigger" :aria-expanded="openNavigationGroup === group.id" :aria-controls="`nav-items-${group.id}`" @click="openNavigationGroup = openNavigationGroup === group.id ? '' : group.id">
              <component :is="group.icon" :size="19" :stroke-width="1.8" aria-hidden="true" /><span>{{ group.label }}</span><ChevronDown class="archive-nav-chevron" :size="14" aria-hidden="true" />
            </button>
          </h2>
          <div v-show="openNavigationGroup === group.id" :id="`nav-items-${group.id}`" class="archive-nav-group-items">
            <button v-for="item in group.items" :key="item.id" type="button" :class="{ active: navigationSection === item.id }" :aria-current="navigationSection === item.id ? 'page' : undefined" @click="emit('navigate', item.id)">
              <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" /><span>{{ item.label }}</span>
            </button>
          </div>
        </div>
      </nav>
    </aside>

    <ArchivePageChrome v-if="!['portal', 'reader'].includes(activeSection)" class="archive-topbar" :can-go-back="showBack" back-class="archive-back" @back="emit('back')">
      <template #before-title>
        <div class="archive-mobile-brand">
          <img :src="getBrandMarkUrl()" alt="" />
          <span>SideM Archive</span>
        </div>
      </template>
      <template #title>
        <div class="archive-heading">
          <ArchiveBreadcrumb :items="breadcrumbs" />
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

    <nav v-if="activeSection !== 'reader' && !immersiveTool" class="archive-mobile-nav" aria-label="移动资料馆导航">
      <button
        v-for="item in primaryNavigation"
        :key="item.id"
        :class="{ active: (activeSection === item.id || (activeSection === 'reader' && item.id === 'stories')) }"
        :aria-current="(activeSection === item.id || (activeSection === 'reader' && item.id === 'stories')) ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.8" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { Home, LayoutGrid, Search, Users, CalendarDays, Camera, ChevronDown } from '@lucide/vue'
import ArchiveBreadcrumb from './ArchiveBreadcrumb.vue'
import ArchivePageChrome from './ArchivePageChrome.vue'
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { getBrandMarkUrl } from '../../utils/AssetResolver.js'
import { ARCHIVE_NAVIGATION_GROUPS } from '../../core/archiveNavigationGroups.js'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { computed, ref, watch } from 'vue'

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
const mobileSearchOpen = ref(Boolean(props.modelValue))
watch(() => props.activeSection, () => { mobileSearchOpen.value = Boolean(props.modelValue) })
watch(() => props.modelValue, value => { if (value) mobileSearchOpen.value = true })

const emit = defineEmits(['navigate', 'back', 'update:modelValue'])

// Same hierarchy and labels as the portal; only the group glyphs are shell-specific.
const groupIcons = { core: Users, records: CalendarDays, tools: Camera }
const navigationGroups = ARCHIVE_NAVIGATION_GROUPS.map(group => ({
  ...group,
  icon: groupIcons[group.id],
  items: group.items.map(item => ({ ...item, icon: archiveNavigationIcons[item.id] })),
}))
const navigationSection = computed(() => props.activeSection === 'reader' ? 'stories' : props.activeSection)
const activeNavigationGroup = computed(() => navigationGroups.find(group => group.ids.includes(navigationSection.value))?.id || '')
const openNavigationGroup = ref('')
watch(() => props.activeSection, () => { openNavigationGroup.value = activeNavigationGroup.value }, { immediate: true })
const primaryNavigation = [
  { id: 'home', label: '偶像主页', icon: Home },
  { id: 'portal', label: '资料馆', icon: LayoutGrid },
]
</script>

<style scoped>
.archive-shell {
  --archive-sidebar: 156px;
  --archive-inspector: 0px;
  --archive-topbar: 76px;
  --archive-accent: #18a79d;
  --archive-accent-soft: #eaf8f6;
  --archive-ink: #18212b;
  --archive-muted: #68727d;
  --archive-border: #dfe4e8;
  --archive-safe-top: env(safe-area-inset-top, 0px);
  --archive-safe-left: env(safe-area-inset-left, 0px);
  --archive-safe-right: env(safe-area-inset-right, 0px);
  display: grid;
  grid-template-columns: var(--archive-sidebar) minmax(0, 1fr) var(--archive-inspector);
  grid-template-rows: var(--archive-topbar) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  background: #fff;
  color: var(--archive-ink);
  font-family: var(--gs-font-directory);
}
.archive-shell.has-inspector { --archive-inspector: min(340px, 28vw); }
.archive-shell.is-home { --archive-topbar: 0px; }
.archive-shell.is-home .archive-topbar { display: none; }
.archive-shell.is-home .archive-content { grid-row: 1 / 3; }
.archive-shell.is-portal { --archive-topbar: 0px; }
.archive-shell.is-portal .archive-topbar { display: none; }
.archive-shell.is-portal .archive-content { grid-row: 1 / 3; }
.archive-shell.is-home .archive-sidebar { background: #183548; }
.archive-shell.is-home .archive-nav button.active { background: rgba(33,183,197,.13); }
.archive-shell.is-home .archive-nav button.active::before { background: #21b7c5; }
.archive-sidebar {
  grid-row: 1 / -1;
  background: #17212b;
  color: #dbe2e7;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.archive-brand {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 18px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.05;
}
.archive-brand img { width: 34px; height: 26px; object-fit: contain; filter: brightness(0) invert(1); }
.archive-nav {display:flex;flex-direction:column;gap:0;padding:6px;min-height:0;overflow-y:auto;}
.archive-nav-group {padding-top:4px;}
.archive-nav-group h2 {margin:0;padding:0;}
.archive-nav button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 36px;
  flex-shrink: 0;
  padding: 0 14px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #aeb8c0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}
@media (hover: hover) and (pointer: fine) {
  .archive-nav button:hover { background: #222f3a; color: #fff; }
}
.archive-nav button:active { background: #2a3742; color: #fff; }
.archive-nav button.active { background: #2a3742; color: #fff; }
.archive-nav button.active::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  background: #35c2b8;
}
.archive-nav .archive-nav-group-trigger {min-height:44px;padding:0 10px;gap:9px;color:#d3dfe6;font-size:13px;font-weight:650;}
.archive-nav-group-trigger > span {flex:1;min-width:0;}
.archive-nav .archive-nav-chevron {flex:none;transform:rotate(-90deg);color:#8096a4;}
.archive-nav-group-trigger[aria-expanded=true] .archive-nav-chevron {transform:none;}
.archive-nav-group.is-active .archive-nav-group-trigger {color:#5bd4c6;background:#203340;}
.archive-nav-group-items {padding:4px 0;}
.archive-nav .archive-nav-group-items button {padding-left:20px;gap:9px;}
.archive-nav button:focus-visible {outline:3px solid #35c2b8;outline-offset:-3px;}
@media(pointer:coarse){.archive-nav button{min-height:44px;}}
.archive-topbar {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(260px, 460px);
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--archive-border);
  background: #fff;
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
.archive-heading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  min-width: 0;
}
.archive-topbar {
  --archive-back-ink: #168f87;
}
.archive-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--gs-control-normal);
  min-width: 0;
  padding: 0 var(--gs-space-4);
  border: 1px solid #d7dde2;
  border-radius: var(--gs-radius-control);
  color: #8a949e;
  background: #fff;
}
.archive-search:focus-within { border-color: #34b9b0; box-shadow: 0 0 0 2px rgba(24,167,157,0.12); }
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
.archive-content { grid-column: 2; min-width: 0; min-height: 0; overflow: hidden; background: #fff; }
.archive-content :deep(.list-screen), .archive-content :deep(.home-screen) { height: 100%; }
.archive-inspector {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid var(--archive-border);
  background: #fbfcfc;
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
    padding: 12px 18px;
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
    font-size: 1.05rem;
    font-weight: 750;
  }
  .archive-mobile-brand img { width: 31px; height: 24px; object-fit: contain; }
  .archive-topbar :deep(.archive-back) { grid-row: 1; grid-column: 1; }
  .archive-topbar:has(.archive-back) .archive-mobile-brand { grid-column: 2; }
  .archive-heading { grid-row: 2; grid-column: 1; gap: 4px; }
  .archive-topbar h1 { font-size: 1.15rem; }
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--archive-border);
    background: #fff;
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
    color: #69747e;
    font: inherit;
    font-size: 0.8rem;
    min-height: 44px;
    cursor: pointer;
  }
  .archive-mobile-nav button.active { color: var(--archive-accent); }
  .archive-mobile-nav button:active { background: var(--archive-accent-soft); }
  .archive-mobile-nav button:focus-visible { outline: 3px solid var(--archive-accent); outline-offset: -5px; }
  .archive-mobile-nav button + button { border-left: 1px solid #e5eeee; }
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
 .is-compact-mobile .archive-topbar h1 {font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 .is-compact-mobile .archive-heading :deep(.archive-breadcrumb),.is-compact-mobile :deep(.archive-back span) {display:none;}
 .is-compact-mobile .archive-topbar :deep(.archive-back) {width:44px;padding:0;}
 .is-compact-mobile .archive-header-actions :deep(.archive-language-switch) {grid-column:4;grid-row:1;}
 .is-compact-mobile .archive-topbar:not(:has(.archive-search)) :deep(.archive-language-switch) {grid-column:3;}
 .is-compact-mobile .archive-search-toggle {display:grid;place-items:center;grid-column:3;grid-row:1;width:44px;height:44px;padding:0;border:0;background:transparent;color:#52777b;cursor:pointer;}
 .is-compact-mobile .archive-search {display:none;grid-column:1/-1;grid-row:2;height:var(--gs-control-touch);width:100%;margin-bottom:var(--gs-space-3);}
 .is-compact-mobile .archive-search.is-open {display:flex;}
}
</style>
