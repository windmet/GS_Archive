<template>
  <div class="archive-directory-grid">
    <section v-for="section in sections" :key="section.id" class="directory-section" :class="`is-${section.id}`" :aria-label="section.label || undefined">
      <h2 v-if="section.label">{{ section.label }}</h2>
      <div class="directory-cells">
        <button
          v-for="item in section.items"
          :key="item.id"
          type="button"
          :class="{ active: item.id === activeSection }"
          :aria-current="item.id === activeSection ? 'page' : undefined"
          :data-archive-focus-id="focusPrefix ? `${focusPrefix}:${item.id}` : undefined"
          @click="emit('navigate', item.id)"
        >
          <component :is="item.icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <ArrowUpRight v-if="section.id === 'tools'" class="directory-go" :size="14" aria-hidden="true" />
        </button>
        <button v-if="section.more" type="button" class="directory-more" :data-archive-focus-id="focusPrefix ? `${focusPrefix}:all` : undefined" aria-haspopup="dialog" @click="emit('more')">
          <LayoutGrid :size="22" :stroke-width="1.8" aria-hidden="true" />
          <span>全部栏目</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowUpRight, LayoutGrid } from '@lucide/vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'

// The archive's one table of contents (线框减法册 L2): four columns of icon cells, 66px tall, the icon above
// the name, no rules. The phone drawer shows it whole in three sections (资料目录 · 图鉴 · 工具) told apart
// by 20px of space and a 12px grey name; the archive home shows `pick` (its common destinations) as one
// unnamed section whose last cell, 全部栏目, emits `more` to open that same drawer.
// The current destination sits on the sidebar's inset slice; no bold, no rule.
const TOOL_GROUPS = new Set(['live', 'studio'])
const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
  pick: { type: Array, default: null },
  focusPrefix: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'more'])

const withIcon = (item, group) => ({ ...item, icon: archiveNavigationIcons[item.id] || group.icon })
const sections = computed(() => {
  if (props.pick) {
    const items = props.groups.flatMap(group => group.items.map(item => withIcon(item, group)))
    return [{ id: 'pick', label: '', more: true, items: props.pick.map(id => items.find(item => item.id === id)).filter(Boolean) }]
  }
  const of = test => props.groups.filter(test).flatMap(group => group.items.map(item => withIcon(item, group)))
  return [
    { id: 'core', label: '资料目录', items: of(group => group.id !== 'collection' && !TOOL_GROUPS.has(group.id) && group.id !== 'resources') },
    { id: 'collection', label: '图鉴', items: of(group => group.id === 'collection') },
    { id: 'tools', label: '工具', items: of(group => TOOL_GROUPS.has(group.id)) },
  ].filter(section => section.items.length)
})
</script>

<style scoped>
.directory-section + .directory-section { margin-top: 20px; }
.directory-section > h2 { margin: 0 0 var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); letter-spacing: .04em; }
.directory-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.is-tools .directory-cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.directory-cells button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 66px;
  padding: var(--gs-space-1) 2px;
  border: 0;
  border-radius: var(--gs-radius-control);
  background: none;
  color: var(--gs-ink);
  font: inherit;
  font-size: var(--gs-text-ui);
  cursor: pointer;
}
.is-tools .directory-cells button { flex-direction: row; gap: var(--gs-space-2); }
.directory-cells button span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.directory-cells button svg { flex: none; color: var(--gs-ink-2); }
.directory-cells .directory-go { color: var(--gs-ink-3); }
.directory-cells button.active { background: var(--gs-current-bg-inset); }
.directory-cells button:active { background: var(--gs-hover); }
.directory-cells button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .directory-cells button:not(.active):hover { background: var(--gs-hover); } }
</style>
