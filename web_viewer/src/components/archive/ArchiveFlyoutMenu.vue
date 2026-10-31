<template>
  <Teleport to="body">
    <div class="archive-flyout-layer" @pointerdown.self="emit('close')">
      <ul ref="list" class="archive-flyout" role="menu" :aria-label="group.label" :style="position" @keydown="onKey">
        <li v-for="item in items" :key="item.id" role="presentation">
          <button type="button" role="menuitem" class="archive-flyout-item" :aria-current="item.id === current ? 'page' : undefined" @click="emit('select', item.id)">
            <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" /><span>{{ item.label }}</span>
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup>
import { Box } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { ARCHIVE_NAVIGATION_GROUPS } from '../../core/archiveNavigationGroups.js'
import { sectionLabel } from '../../core/archiveSections.js'

// A menu opened from a sidebar entry (图鉴): the entry does not navigate, this list does. It opens beside the entry,
// its rows share the filter menu's 44px choice row, and it closes on a choice, Esc, a click outside, a resize or a page change.
// The rows are the 图鉴 group of the one navigation dictionary, named and drawn like the sidebar's other entries;
// the row of `current` carries aria-current and the selected weight.
const props = defineProps({
  anchor: { type: Object, required: true },
  current: { type: String, default: '' },
})
const emit = defineEmits(['select', 'close'])
const group = ARCHIVE_NAVIGATION_GROUPS.find(entry => entry.id === 'collection')
const items = computed(() => group.ids.map(id => ({ id, label: sectionLabel(id), icon: archiveNavigationIcons[id] || Box })))
const list = ref(null)
const position = ref({})

function place() {
  const rect = props.anchor.getBoundingClientRect()
  // Beside the sidebar, not the entry: its padding differs between the 208px sidebar and the 58px rail.
  const edge = (props.anchor.closest('.archive-sidebar') || props.anchor).getBoundingClientRect().right
  const height = list.value?.offsetHeight || 0
  const top = Math.max(8, Math.min(rect.top, innerHeight - height - 8))
  position.value = { left: `${edge + 8}px`, top: `${top}px`, minWidth: '168px' }
}
function onDocumentKey(event) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  props.anchor.focus()
  emit('close')
}
function onKey(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const rows = [...list.value.querySelectorAll('.archive-flyout-item')], at = rows.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
  event.preventDefault()
  rows[next]?.focus()
}
const onResize = () => emit('close')
// The page changed under the menu (back button): it has nothing left to choose from.
watch(() => props.current, onResize)

onMounted(async () => {
  place()
  document.addEventListener('keydown', onDocumentKey, true)
  addEventListener('resize', onResize)
  await nextTick()
  place()
  list.value?.querySelector('[aria-current=page], .archive-flyout-item')?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKey, true)
  removeEventListener('resize', onResize)
})
</script>

<style scoped>
.archive-flyout-layer { position: fixed; inset: 0; z-index: 1200; }
.archive-flyout { position: fixed; box-sizing: border-box; margin: 0; padding: var(--gs-space-2); list-style: none; border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-console); animation: gs-fade-in var(--gs-motion-enter) var(--gs-ease-out) backwards; }
.archive-flyout-item { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; white-space: nowrap; cursor: pointer; }
.archive-flyout-item svg { flex: none; color: var(--gs-ink-3); }
.archive-flyout-item[aria-current='page'] { font-weight: var(--gs-weight-semibold); background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.archive-flyout-item[aria-current='page'] svg { color: inherit; }
@media (hover: hover) { .archive-flyout-item:not([aria-current='page']):hover { background: var(--gs-hover); } }
.archive-flyout-item:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .archive-flyout { animation: none; } }
</style>
