<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" @keydown.esc.prevent="emit('close')">
      <div class="archive-drawer-groups">
      <section v-for="group in groups" :key="group.id" class="archive-drawer-group" :style="{ '--drawer-span': Math.min(group.items.length, 4) }">
        <h2>{{ group.label }}</h2>
        <div class="archive-drawer-items">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            :class="{ active: item.id === activeSection }"
            :aria-current="item.id === activeSection ? 'page' : undefined"
            @click="emit('navigate', item.id)"
          >
            <component :is="archiveNavigationIcons[item.id] || group.icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </section>
      </div>
      <button type="button" class="archive-drawer-about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">{{ sectionLabel('about') }}</button>
    </nav>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation: the sidebar's destination groups, opened from the bar's third cell.
defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)

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
  padding: var(--gs-space-4) max(var(--gs-space-4), env(safe-area-inset-right, 0px)) var(--gs-space-3) max(var(--gs-space-4), env(safe-area-inset-left, 0px));
  border-radius: 16px 16px 0 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 12%);
}
/* Groups share one four-column grid, each as wide as its sections, so one-section groups sit side by side. */
.archive-drawer-groups { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-3) 0; }
.archive-drawer-group { grid-column: span var(--drawer-span); min-width: 0; }
.archive-drawer h2 { margin: 0 0 var(--gs-space-1); padding-inline: var(--gs-space-2); overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.archive-drawer-items { display: grid; grid-template-columns: repeat(var(--drawer-span), minmax(0, 1fr)); }
.archive-drawer button {
  border: 0;
  border-radius: var(--gs-radius-control);
  background: none;
  color: var(--gs-ink);
  font: inherit;
  cursor: pointer;
}
.archive-drawer-items button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gs-space-1);
  min-width: 0;
  min-height: 60px;
  padding: var(--gs-space-2) 0;
  font-size: var(--gs-text-ui);
}
.archive-drawer-items button span { max-width: 100%; overflow-wrap: anywhere; text-align: center; }
.archive-drawer-items button svg { color: var(--gs-ink-2); }
.archive-drawer button.active { background: var(--gs-mint-wash); font-weight: var(--gs-weight-semibold); }
.archive-drawer button.active svg { color: var(--gs-mint-ink); }
.archive-drawer button:active { background: var(--gs-mint-wash); }
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.archive-drawer .archive-drawer-about { display: block; min-height: var(--gs-control-touch); margin-top: var(--gs-space-2); padding: 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
