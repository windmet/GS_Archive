<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" @keydown.esc.prevent="emit('close')">
      <div v-for="tier in tiers" :key="tier.id" class="archive-drawer-items" :class="`is-${tier.id}`">
        <button
          v-for="item in tier.items"
          :key="item.id"
          type="button"
          :class="{ active: item.id === activeSection }"
          :aria-current="item.id === activeSection ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" class="archive-drawer-icon" :size="tier.id === 'collection' ? 18 : 22" :stroke-width="1.8" aria-hidden="true" />
          <span v-if="tier.id === 'tools'" class="archive-drawer-tool-copy"><b>{{ item.label }}</b><small v-if="item.blurb">{{ item.blurb }}</small></span>
          <span v-else>{{ item.label }}</span>
        </button>
      </div>
      <p class="archive-drawer-footer">
        <template v-for="item in footerItems" :key="item.id">
          <button type="button" :aria-current="item.id === activeSection ? 'page' : undefined" @click="emit('navigate', item.id)">{{ item.label }}</button>
          <span aria-hidden="true">·</span>
        </template>
        <button type="button" class="archive-drawer-top" :disabled="!canScrollTop" @click="scrollToTop">回到页顶</button>
        <span aria-hidden="true">·</span>
        <button type="button" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">{{ sectionLabel('about') }}</button>
      </p>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { ARCHIVE_SECTIONS, sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation, opened from the bar's third cell. It shows the sidebar's destination
// groups without their titles (each icon is already labelled), in three tiers: the catalogues a reader
// came for as tiles, the collection pages as compact rows, and the tools (LIVE, 摄影工作台) as cards that
// say what they open, since they are players and editors rather than lists. 回到页顶 and 关于本站 close it
// as a footer line. 事务所 and 资料馆 are the bar's own cells, so the drawer does not repeat them.
// 资源 (maintainer mode only) describes the archive's own build, so it joins the footer line.
const TIER_OF_GROUP = { collection: 'collection', live: 'tools', studio: 'tools', resources: 'footer' }
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)

const tierItems = id => props.groups.filter(group => (TIER_OF_GROUP[group.id] || 'core') === id)
  .flatMap(group => group.items.map(item => ({ ...item, icon: archiveNavigationIcons[item.id] || group.icon, blurb: ARCHIVE_SECTIONS[item.id]?.blurb || '' })))
const tiers = computed(() => ['core', 'collection', 'tools'].map(id => ({ id, items: tierItems(id) })))
const footerItems = computed(() => tierItems('footer'))

// The page scrolls inside the one archive scroll area (the same one view restoration reads).
const scrollArea = () => document.querySelector('[data-archive-scroll-container]')
const canScrollTop = ref(false)
function scrollToTop() {
  const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  scrollArea()?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  emit('close')
}

onMounted(() => {
  canScrollTop.value = (scrollArea()?.scrollTop || 0) > 0
  const target = sheet.value?.querySelector('[aria-current="page"]') || sheet.value?.querySelector('button')
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
/* Sits above the content and below the bar, so the bar's 收起 stays where the reader tapped. */
.archive-drawer-backdrop {
  position: fixed;
  inset: 0 0 calc(74px + env(safe-area-inset-bottom, 0px));
  z-index: 19;
  display: flex;
  align-items: flex-end;
  background: rgb(21 43 67 / 32%);
}
.archive-drawer {
  box-sizing: border-box;
  width: 100%;
  max-height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--gs-space-4) max(var(--gs-space-4), env(safe-area-inset-right, 0px)) var(--gs-space-2) max(var(--gs-space-4), env(safe-area-inset-left, 0px));
  border-radius: 16px 16px 0 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 12%);
}
.archive-drawer-items { display: grid; gap: var(--gs-space-1); }
.archive-drawer-items + .archive-drawer-items { margin-top: var(--gs-space-3); padding-top: var(--gs-space-3); border-top: 1px solid var(--gs-line); }
.archive-drawer-items.is-core { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.archive-drawer-items.is-collection { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.archive-drawer-items.is-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-2); }
.archive-drawer button {
  display: flex;
  align-items: center;
  gap: var(--gs-space-2);
  min-width: 0;
  min-height: var(--gs-control-touch);
  padding: 0 var(--gs-space-2);
  border: 0;
  border-radius: var(--gs-radius-control);
  background: none;
  color: var(--gs-ink);
  font: inherit;
  font-size: var(--gs-text-ui);
  text-align: left;
  cursor: pointer;
}
.archive-drawer button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archive-drawer button svg { flex: none; color: var(--gs-ink-2); }
/* Catalogue tiles: icon over label. */
.archive-drawer .is-core button { flex-direction: column; justify-content: center; gap: var(--gs-space-1); min-height: 64px; padding: var(--gs-space-2) 0; }
/* Tool cards: a tinted glyph, the name, and what it opens. */
.archive-drawer .is-tools button { gap: var(--gs-space-2); min-height: 60px; padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid var(--gs-line); background: var(--gs-paper); }
.archive-drawer .is-tools .archive-drawer-icon { box-sizing: content-box; padding: 6px; border-radius: 10px; background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.archive-drawer-tool-copy { display: grid; gap: 1px; }
.archive-drawer-tool-copy b { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; }
.archive-drawer .archive-drawer-tool-copy small { overflow: visible; color: var(--gs-ink-3); font-size: var(--gs-text-caption); line-height: 1.35; white-space: normal; }
/* Where the reader is: the current section carries the bar's mint. */
.archive-drawer button.active { background: var(--gs-mint-wash); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gs-mint) 40%, transparent); font-weight: var(--gs-weight-semibold); }
.archive-drawer button.active svg { color: var(--gs-mint-ink); }
.archive-drawer .is-tools button.active { border-color: transparent; }
.archive-drawer button:not(:disabled):active { background: var(--gs-mint-wash); }
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* Footer line: quiet and centred, each link still a full touch target. */
.archive-drawer-footer { display: flex; align-items: center; justify-content: center; gap: var(--gs-space-1); margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button { padding: 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button:disabled { opacity: .5; cursor: default; }
.archive-drawer .archive-drawer-footer button[aria-current='page'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
