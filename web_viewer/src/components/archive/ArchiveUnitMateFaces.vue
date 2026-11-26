<template>
  <nav class="archive-unit-mates" :aria-label="`${unitName}成员`">
    <span class="archive-unit-mates-label">同组合<template v-if="unitName"> · {{ unitName }}</template></span>
    <div class="archive-unit-mates-list">
      <button v-for="mate in mates" :key="mate.idol_code" type="button" :class="{ 'is-current': mate.idol_code === current }"
        :aria-current="mate.idol_code === current ? 'page' : undefined" :aria-label="nameOf(mate)" :title="nameOf(mate)"
        @click="mate.idol_code !== current && emit('select', mate.idol_code)">
        <ArchiveIdolAvatar :idol-code="mate.idol_code" :accent-color="mate.color || ''"
          :ring="mate.idol_code === current ? 'selected' : 'group'" :size="36" decorative />
        <span class="archive-unit-mate-name">{{ nameOf(mate) }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

// An idol page's unit mates strip, seated cleanly beneath the hero banner across all viewports
// so every teammate keeps a full 44px touch target without overlapping or crowding the topbar language toggle.
// The current mate wears their own idol accent selected ring; teammates wear the quiet group ring.
const props = defineProps({
  mates: { type: Array, required: true },
  current: { type: String, default: '' },
  unitName: { type: String, default: '' },
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['select'])
const nameOf = mate => props.idolName(mate.idol_code, mate.display_name) || mate.display_name
</script>

<style scoped>
.archive-unit-mates { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3) var(--gs-space-5); padding: var(--gs-space-3) var(--gs-space-2); }
.archive-unit-mates-label { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); white-space: nowrap; }
.archive-unit-mates-list { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-3); min-width: 0; }
.archive-unit-mates button { display: inline-flex; align-items: center; gap: var(--gs-space-3); min-height: var(--gs-control-touch); padding: var(--gs-space-1) var(--gs-space-3) var(--gs-space-1) var(--gs-space-2); border: 0; border-radius: var(--gs-radius-pill); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.archive-unit-mates button.is-current { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); cursor: default; }
.archive-unit-mate-name { white-space: nowrap; }
.archive-unit-mates button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) {
  .archive-unit-mates button:not(.is-current):hover { background: var(--gs-hover); color: var(--gs-ink); }
}
@media (max-width: 760px) {
  .archive-unit-mates { flex-direction: column; align-items: flex-start; gap: var(--gs-space-2); padding: var(--gs-space-2) 0; }
  .archive-unit-mates-list { flex-wrap: nowrap; width: 100%; overflow-x: auto; gap: var(--gs-space-3); padding: var(--gs-space-2) var(--gs-space-2); margin-inline: calc(-1 * var(--gs-space-2)); scrollbar-width: none; }
  .archive-unit-mates-list::-webkit-scrollbar { display: none; }
  .archive-unit-mates button { flex: none; justify-content: center; min-width: var(--gs-control-touch); padding: var(--gs-space-1) var(--gs-space-2); }
  .archive-unit-mate-name { display: none; }
  .archive-unit-mates button.is-current { padding: var(--gs-space-1) var(--gs-space-3) var(--gs-space-1) var(--gs-space-2); background: var(--gs-surface); box-shadow: var(--gs-current-shadow); }
  .archive-unit-mates button.is-current .archive-unit-mate-name { display: inline; }
}
</style>
