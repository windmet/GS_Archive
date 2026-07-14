<template>
  <div class="relation-list" :class="`layout-${layout}`">
    <component
      :is="item.actionable === false ? 'div' : 'button'"
      v-for="item in items"
      :key="item.id"
      class="relation-row"
      :class="[`kind-${item.kind || 'record'}`, { static: item.actionable === false }]"
      :type="item.actionable === false ? undefined : 'button'"
      @click="select(item)"
    >
      <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.imageAlt || ''" loading="lazy" />
      <span v-else class="relation-icon" aria-hidden="true">
        <component :is="relationIcon(item.kind)" :size="19" :stroke-width="1.8" />
      </span>

      <span class="relation-copy">
        <span class="relation-labels">
          <strong>{{ item.label }}</strong>
          <small v-if="item.evidenceLabel" class="evidence" :class="`tone-${item.evidenceTone || 'derived'}`">
            {{ item.evidenceLabel }}
          </small>
          <small v-if="item.statusLabel" class="status" :class="`tone-${item.statusTone || 'available'}`">
            {{ item.statusLabel }}
          </small>
        </span>
        <b>{{ item.title }}</b>
        <small v-if="item.meta" class="relation-meta">{{ item.meta }}</small>
        <small v-if="item.evidence" class="relation-proof">{{ item.evidence }}</small>
        <code v-if="item.resource">{{ item.resource }}</code>
      </span>

      <ChevronRight v-if="item.actionable !== false" :size="17" class="relation-arrow" aria-hidden="true" />
    </component>
  </div>
</template>

<script setup>
import { BookOpenText, CalendarRange, ChevronRight, Images, Layers3, Link2, Sparkles, UsersRound } from '@lucide/vue'

defineProps({
  items: { type: Array, default: () => [] },
  layout: { type: String, default: 'stack' },
})
const emit = defineEmits(['select'])

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
.relation-list { display: grid; gap: 8px; }
.relation-list.layout-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.relation-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 72px;
  padding: 9px 10px;
  border: 1px solid #dfe5e8;
  border-radius: 6px;
  background: #fff;
  color: #26343c;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.relation-row:hover { border-color: #75c5bf; background: #f3faf9; }
.relation-row.static { grid-template-columns: 48px minmax(0, 1fr); cursor: default; }
.relation-row.static:hover { border-color: #dfe5e8; background: #fff; }
.relation-row > img { display: block; width: 48px; height: 48px; border-radius: 4px; background: #edf1f3; object-fit: contain; }
.relation-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: #e9f6f4; color: #17877f; }
.kind-gasha .relation-icon { background: #fff3d9; color: #9a6a13; }
.kind-series .relation-icon { background: #edf1f8; color: #526fa0; }
.kind-card .relation-icon { background: #f1edf8; color: #73599d; }
.relation-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.relation-labels { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.relation-labels strong { color: #52616a; font-size: 0.61rem; }
.relation-labels small { padding: 2px 5px; border-radius: 3px; font-size: 0.54rem; font-weight: 700; }
.evidence.tone-raw { background: #eaf1f8; color: #486785; }
.evidence.tone-derived { background: #fff1d6; color: #8d6515; }
.evidence.tone-grouped { background: #eeeaf8; color: #68528d; }
.evidence.tone-confirmed { background: #e6f6ef; color: #247457; }
.evidence.tone-missing { background: #f3e9e9; color: #8b5454; }
.status.tone-available { background: #e7f6f4; color: #187c74; }
.status.tone-missing { background: #f4e9e9; color: #8e5555; }
.status.tone-reference { background: #eef1f3; color: #68747c; }
.relation-copy b { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.relation-meta, .relation-proof { color: #748089; font-size: 0.61rem; line-height: 1.35; }
.relation-proof { color: #8a949a; overflow-wrap: anywhere; }
.relation-copy code { color: #929ca2; font-size: 0.57rem; overflow-wrap: anywhere; }
.relation-arrow { color: #8e9aa1; }

@media (max-width: 560px) {
  .relation-list.layout-grid { grid-template-columns: minmax(0, 1fr); }
  .relation-row { grid-template-columns: 42px minmax(0, 1fr) 16px; padding: 8px; }
  .relation-row.static { grid-template-columns: 42px minmax(0, 1fr); }
  .relation-row > img { width: 42px; height: 42px; }
  .relation-icon { width: 34px; height: 34px; }
}
</style>
