<template>
  <div class="archive-drawer-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer" aria-label="全部栏目" tabindex="-1" @keydown.esc.prevent="emit('close')">
      <ArchiveDirectoryGrid :groups="groups.filter(group => group.id !== 'resources')" :active-section="activeSection" @navigate="id => emit('navigate', id)" />
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
import ArchiveDirectoryGrid from './ArchiveDirectoryGrid.vue'
import { sectionLabel } from '../../core/archiveSections.js'

// The phone's whole-site navigation, opened from the bar's third cell or the archive home's 全部栏目 cell:
// the one directory grid (ArchiveDirectoryGrid, 线框减法册 L2) — icon cells, no rules — then 回到页顶 and
// 关于本站 as a footer line. 事务所 and 资料馆 are the bar's own cells, so the drawer does not repeat them;
// 资源 (maintainer mode only) joins the footer line.
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
  // Opened from the keyboard: focus lands on the current cell and shows its ring. A tap focuses the sheet
  // itself, so Esc and Tab still work without a ring drawn on the first cell.
  keyboard: Boolean,
})
const emit = defineEmits(['navigate', 'close'])
const sheet = ref(null)
const footerItems = computed(() => props.groups.filter(group => group.id === 'resources').flatMap(group => group.items))

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
  const current = sheet.value?.querySelector('.archive-directory-grid [aria-current="page"]')
  const target = props.keyboard ? current || sheet.value?.querySelector('button') : sheet.value
  target?.focus({ preventScroll: true })
  current?.scrollIntoView({ block: 'nearest' })
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
  border-radius: var(--gs-radius-panel); /* a floating layer; its foot meets the bar */
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 12%);
}
.archive-drawer:focus { outline: none; }
.archive-drawer button {
  min-height: var(--gs-control-touch);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}
.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* Footer line: quiet and centred, each link still a full touch target. */
.archive-drawer-footer { display: flex; align-items: center; justify-content: center; gap: var(--gs-space-1); margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button { padding: 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer .archive-drawer-footer button:disabled { opacity: .5; cursor: default; }
.archive-drawer .archive-drawer-footer button[aria-current='page'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
