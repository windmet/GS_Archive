<template>
  <div class="relation-list" :data-technical-details="showEvidence ? '' : undefined" :class="`layout-${layout}`">
    <component
      :is="item.actionable === false ? 'div' : 'button'"
      v-for="item in items"
      :key="item.id"
      class="relation-row"
      :data-archive-focus-id="item.actionable === false ? undefined : `relation:${item.id}`"
      :class="[`kind-${item.kind || 'record'}`, { static: item.actionable === false }]"
      :type="item.actionable === false ? undefined : 'button'"
      @click="select(item)"
    >
      <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.kind === 'card' ? archiveText('card',item.imageAlt,'title') : item.imageAlt || ''" loading="lazy" />
      <span v-else class="relation-icon" aria-hidden="true">
        <component :is="relationIcon(item.kind)" :size="19" :stroke-width="1.8" />
      </span>

      <span class="relation-copy">
        <span v-if="item.label || item.statusLabel || (showEvidence && item.evidenceLabel)" class="relation-labels">
          <strong>{{ item.label }}</strong>
          <small v-if="showEvidence && item.evidenceLabel" class="evidence" :class="`tone-${item.evidenceTone || 'derived'}`">
            {{ item.evidenceLabel }}
          </small>
          <small v-if="item.statusLabel" class="status" :class="`tone-${item.statusTone || 'available'}`">
            <CircleAlert v-if="item.statusTone === 'missing'" :size="12" aria-hidden="true" />{{ item.statusLabel }}
          </small>
        </span>
        <b :title="item.kind === 'card' ? item.title : undefined">{{ item.kind === 'card' ? archiveText('card',item.title,'title') : item.title }}</b>
        <small v-if="item.meta" class="relation-meta">{{ item.meta }}</small>
        <small v-if="showEvidence && item.evidence" class="relation-proof">{{ item.evidence }}</small>
        <code v-if="showEvidence && item.resource">{{ item.resource }}</code>
      </span>

      <ChevronRight v-if="item.actionable !== false" :size="17" class="relation-arrow" aria-hidden="true" />
    </component>
  </div>
  <ArchiveTechnicalDetails :key="evidenceItems.map(item => item.id).join('|')" v-if="!showEvidence && evidenceItems.length" label="关联资料来源" :evidence="evidenceItems" />
</template>

<script setup>
import { computed } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveText} from './useArchiveCardTitle.js'
import { BookOpenText, CalendarRange, ChevronRight, CircleAlert, Images, Layers3, Link2, Sparkles, UsersRound } from '@lucide/vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  layout: { type: String, default: 'stack' },
  showEvidence: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])
const evidenceItems = computed(() => props.items.filter(item => item.evidence || item.resource || item.evidenceLabel).map(({ id, title, evidenceLabel, evidence, resource }) => ({ id, title, evidenceLabel, evidence, resource })))

const ICONS = {
  card: Images,
  event: CalendarRange,
  gasha: Sparkles,
  series: Layers3,
  story: BookOpenText,
  unit: UsersRound,
}

function relationIcon(kind) {
  return ICONS[kind] || Link2
}

function select(item) {
  if (item.actionable !== false) emit('select', item)
}
</script>

<style scoped>
/* Related records: rows on paper separated by hairlines; the artwork or glyph leads each row. */
.relation-list { display: grid; gap: 0 var(--gs-space-7); }
.relation-list.layout-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
/* A banner takes 128px of the row, so banner grids use wider cells and the title keeps its line. */
.relation-list.layout-grid:has(> .relation-row.kind-event > img), .relation-list.layout-grid:has(> .relation-row.kind-gasha > img) { grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); }
.relation-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) 18px; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 72px; padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; color: var(--gs-ink); cursor: pointer; font: inherit; text-align: left; }
.relation-row.static { grid-template-columns: 48px minmax(0, 1fr); cursor: default; }
.relation-row > img { display: block; width: 48px; height: 48px; border-radius: var(--gs-radius-media); background: var(--gs-line); object-fit: contain; }
/* Event rows with a banner show it as the archive's event thumbnail (as on the portal), not a square. */
/* Event and gasha banners share the archive's banner thumbnail. */
.relation-row.kind-event:has(> img), .relation-row.kind-gasha:has(> img) { grid-template-columns: 128px minmax(0, 1fr) 18px; }
.relation-row.kind-event > img, .relation-row.kind-gasha > img { width: 128px; height: 72px; object-fit: cover; }
.relation-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.relation-copy { display: grid; gap: var(--gs-space-1); min-width: 0; }
.relation-labels { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gs-space-1) var(--gs-space-3); }
.relation-labels strong { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.relation-labels small { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.status.tone-available { color: var(--gs-mint-ink); }
.status.tone-missing { display: inline-flex; align-items: center; gap: 3px; color: var(--gs-critical); }
.status.tone-reference, .evidence { color: var(--gs-ink-3); }
.evidence.tone-derived, .evidence.tone-grouped { color: var(--gs-attr-mental); }
.relation-copy b { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.relation-meta, .relation-proof { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.relation-proof, .relation-copy code { overflow-wrap: anywhere; }
.relation-copy code { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.relation-arrow { color: var(--gs-ink-3); }
@media (hover: hover) { .relation-row:not(.static):hover b { color: var(--gs-mint-ink); } }
.relation-row:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (max-width: 560px) {
  .relation-list.layout-grid { grid-template-columns: minmax(0, 1fr); }
  .relation-row { grid-template-columns: 42px minmax(0, 1fr) 16px; }
  .relation-row.static { grid-template-columns: 42px minmax(0, 1fr); }
  .relation-row > img { width: 42px; height: 42px; }
  .relation-row.kind-event:has(> img), .relation-row.kind-gasha:has(> img) { grid-template-columns: 96px minmax(0, 1fr) 16px; }
  .relation-row.kind-event > img, .relation-row.kind-gasha > img { width: 96px; height: 54px; }
  /* Event names carry their subtitle at the end; let them use two lines instead of losing it. */
  .relation-row.kind-event .relation-copy b { display: -webkit-box; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .relation-icon { width: 34px; height: 34px; }
}
</style>
