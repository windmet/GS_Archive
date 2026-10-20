<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" @keydown.esc.prevent="emit('close')">
      <div v-for="(tier, index) in tiers" :key="index" class="archive-drawer-items" :class="{ 'is-secondary': index > 0 }">
        <button
          v-for="item in tier"
          :key="item.id"
          type="button"
          :class="{ active: item.id === activeSection, 'is-about': item.id === 'about' }"
          :aria-current="item.id === activeSection ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" :size="index ? 20 : 24" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Info } from '@lucide/vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation, opened from the bar's third cell. It shows the sidebar's destination
// groups without their titles (each icon is already labelled): what a reader came for on top, the
// collection pages and tools beneath one rule, closed by 关于本站.
const SECONDARY_GROUPS = new Set(['collection', 'studio', 'resources'])
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)

const tiers = computed(() => {
  const items = secondary => props.groups.filter(group => SECONDARY_GROUPS.has(group.id) === secondary)
    .flatMap(group => group.items.map(item => ({ ...item, icon: archiveNavigationIcons[item.id] || group.icon })))
  return [items(false), [...items(true), { id: 'about', label: sectionLabel('about'), icon: Info }]]
})

onMounted(() => {
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
.archive-drawer-items { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-1); }
.archive-drawer-items.is-secondary { margin-top: var(--gs-space-3); padding-top: var(--gs-space-3); border-top: 1px solid var(--gs-line); }
.archive-drawer button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gs-space-1);
  min-width: 0;
  min-height: 64px;
  padding: var(--gs-space-2) 0;
  border: 0;
  border-radius: var(--gs-radius-control);
  background: none;
  color: var(--gs-ink);
  font: inherit;
  font-size: var(--gs-text-ui);
  cursor: pointer;
}
.archive-drawer .is-secondary button { min-height: 56px; font-size: var(--gs-text-meta); }
.archive-drawer button span { max-width: 100%; overflow-wrap: anywhere; text-align: center; }
.archive-drawer button svg { color: var(--gs-ink-2); }
.archive-drawer button.is-about { color: var(--gs-ink-3); }
.archive-drawer button.is-about svg { color: var(--gs-ink-3); }
/* Where the reader is: the current section carries the bar's mint. */
.archive-drawer button.active { background: var(--gs-mint-wash); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gs-mint) 40%, transparent); font-weight: var(--gs-weight-semibold); }
.archive-drawer button.active svg { color: var(--gs-mint-ink); }
.archive-drawer button:active { background: var(--gs-mint-wash); }
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
