<template>
  <nav class="archive-unit-mates" :aria-label="`${unitName}成员`">
    <span class="archive-unit-mates-label">同组合<template v-if="unitName"> · {{ unitName }}</template></span>
    <div class="archive-unit-mates-list">
      <button v-for="mate in mates" :key="mate.idol_code" type="button" :class="{ 'is-current': mate.idol_code === current }"
        :aria-current="mate.idol_code === current ? 'page' : undefined" :aria-label="nameOf(mate)" :title="nameOf(mate)"
        @click="mate.idol_code !== current && emit('select', mate.idol_code)">
        <ArchiveIdolAvatar :idol-code="mate.idol_code" :accent-color="mate.color || ''"
          :ring="mate.idol_code === current ? 'selected' : 'group'" :size="36" decorative />
        <span class="archive-unit-mate-track">
          <span class="archive-unit-mate-name">{{ nameOf(mate) }}</span>
        </span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

// Breathable expandable face strip beneath the idol hero: unselected teammates stay compact circles
// while the active idol smoothly unfolds into an elevated name capsule (0fr -> 1fr grid transition).
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
.archive-unit-mates { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-5); padding: var(--gs-space-2) 0; }
.archive-unit-mates-label { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); white-space: nowrap; }
.archive-unit-mates-list { display: flex; flex-wrap: nowrap; align-items: center; gap: var(--gs-space-3); min-width: 0; overflow-x: auto; padding: var(--gs-space-2); margin: calc(-1 * var(--gs-space-2)); scrollbar-width: none; }
.archive-unit-mates-list::-webkit-scrollbar { display: none; }
.archive-unit-mates button { display: inline-flex; flex: none; align-items: center; min-height: var(--gs-control-touch); padding: var(--gs-space-1); border: 0; border-radius: var(--gs-radius-pill); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; transition: background-color var(--gs-motion-enter) var(--gs-ease-out), box-shadow var(--gs-motion-enter) var(--gs-ease-out), padding var(--gs-motion-enter) var(--gs-ease-out), transform var(--gs-motion-feedback) var(--gs-ease-out); }
.archive-unit-mates button.is-current { padding: var(--gs-space-1) var(--gs-space-4) var(--gs-space-1) var(--gs-space-1); background: var(--gs-surface); box-shadow: var(--gs-current-shadow); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); cursor: default; }
.archive-unit-mate-track { display: grid; grid-template-columns: 0fr; opacity: 0; margin-left: 0; transition: grid-template-columns var(--gs-motion-enter) var(--gs-ease-out), opacity var(--gs-motion-feedback) var(--gs-ease-out), margin-left var(--gs-motion-enter) var(--gs-ease-out); }
.archive-unit-mates button.is-current .archive-unit-mate-track { grid-template-columns: 1fr; opacity: 1; margin-left: var(--gs-space-3); }
.archive-unit-mate-name { overflow: hidden; white-space: nowrap; }
.archive-unit-mates button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) and (pointer: fine) {
  .archive-unit-mates button:not(.is-current):hover { transform: translateY(-1px); background: var(--gs-hover); }
}
@media (prefers-reduced-motion: reduce) {
  .archive-unit-mates button, .archive-unit-mate-track { transition: none; }
}
@media (max-width: 760px) {
  .archive-unit-mates { flex-direction: column; align-items: flex-start; gap: var(--gs-space-2); }
  .archive-unit-mates-list { width: calc(100% + 2 * var(--gs-space-2)); }
}
</style>
