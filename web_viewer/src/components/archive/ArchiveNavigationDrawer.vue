<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" @keydown.esc.prevent="emit('close')">
      <div v-for="tier in tiers" :key="tier.id" class="archive-drawer-items" :class="`is-${tier.id}`" :style="tier.id === 'tools' ? { '--tool-columns': tier.items.length + 2 > 3 ? 2 : 3 } : undefined">
        <button
          v-for="item in tier.items"
          :key="item.id"
          type="button"
          :class="{ active: item.id === activeSection }"
          :aria-current="item.id === activeSection ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" :size="tier.id === 'core' ? 24 : 18" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
        <template v-if="tier.id === 'tools'">
          <button type="button" class="archive-drawer-top" :disabled="!canScrollTop" @click="scrollToTop"><ArrowUpToLine :size="18" :stroke-width="1.8" aria-hidden="true" /><span>回到页顶</span></button>
          <button type="button" :class="{ active: activeSection === 'about' }" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')"><Info :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ sectionLabel('about') }}</span></button>
        </template>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowUpToLine, Info } from '@lucide/vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation, opened from the bar's third cell. It shows the sidebar's destination
// groups without their titles (each icon is already labelled), in three tiers: what a reader came for as
// large tiles, the collection pages as compact rows, then the tools with 回到页顶 and 关于本站.
// 事务所 and 资料馆 are the bar's own cells, so the drawer does not repeat them.
const TIER_OF_GROUP = { collection: 'collection', studio: 'tools', resources: 'tools' }
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)

const tiers = computed(() => ['core', 'collection', 'tools'].map(id => ({
  id,
  items: props.groups.filter(group => (TIER_OF_GROUP[group.id] || 'core') === id)
    .flatMap(group => group.items.map(item => ({ ...item, icon: archiveNavigationIcons[item.id] || group.icon }))),
})))

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
  padding: var(--gs-space-4) max(var(--gs-space-4), env(safe-area-inset-right, 0px)) var(--gs-space-4) max(var(--gs-space-4), env(safe-area-inset-left, 0px));
  border-radius: 16px 16px 0 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 12%);
}
.archive-drawer-items { display: grid; gap: var(--gs-space-1); }
.archive-drawer-items + .archive-drawer-items { margin-top: var(--gs-space-3); padding-top: var(--gs-space-3); border-top: 1px solid var(--gs-line); }
.archive-drawer-items.is-core { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.archive-drawer-items.is-collection { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.archive-drawer-items.is-tools { grid-template-columns: repeat(var(--tool-columns, 3), minmax(0, 1fr)); } /* maintainer mode adds 资源: two rows of two */
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
  cursor: pointer;
}
/* Core tiles: icon over label. Collection rows and tools: icon beside label. */
.archive-drawer .is-core button { flex-direction: column; justify-content: center; gap: var(--gs-space-1); min-height: 64px; padding: var(--gs-space-2) 0; }
.archive-drawer .is-tools button { justify-content: center; color: var(--gs-ink-2); font-size: var(--gs-text-meta); }
.archive-drawer button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archive-drawer button svg { flex: none; color: var(--gs-ink-2); }
.archive-drawer button:disabled { color: var(--gs-ink-3); cursor: default; }
.archive-drawer button:disabled svg { color: var(--gs-ink-3); }
/* Where the reader is: the current section carries the bar's mint. */
.archive-drawer button.active { background: var(--gs-mint-wash); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gs-mint) 40%, transparent); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.archive-drawer button.active svg { color: var(--gs-mint-ink); }
.archive-drawer button:not(:disabled):active { background: var(--gs-mint-wash); }
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
