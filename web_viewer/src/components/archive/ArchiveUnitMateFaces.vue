<template>
  <nav class="archive-unit-mates" :class="{ 'is-crowded': mates.length > 3 }" :aria-label="`${unitName}成员`">
    <span class="archive-unit-mates-label" aria-hidden="true">同组合</span>
    <button v-for="mate in mates" :key="mate.idol_code" type="button" :class="{ 'is-current': mate.idol_code === current }"
      :aria-current="mate.idol_code === current ? 'page' : undefined" :aria-label="nameOf(mate)" :title="nameOf(mate)"
      @click="mate.idol_code !== current && emit('select', mate.idol_code)">
      <ArchiveIdolAvatar :idol-code="mate.idol_code" :size="30" :ring-width="0" :gap="0" decorative />
    </button>
  </nav>
</template>

<script setup>
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

// An idol page's unit, as faces at the right of the title row: one tap switches the page to that idol
// (booklet 2.0: 「全部偶像」 stays in the breadcrumb). The current face carries the one mint ring that says "now".
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
.archive-unit-mates { display: flex; flex: none; align-items: center; gap: var(--gs-space-2); margin-right: var(--gs-space-2); }
.archive-unit-mates-label { margin-right: var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.archive-unit-mates button { display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
.archive-unit-mates button.is-current { box-shadow: 0 0 0 2px var(--gs-paper), 0 0 0 4px var(--gs-mint); cursor: default; }
.archive-unit-mates button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 3px; }
@media (hover: hover) { .archive-unit-mates button:not(.is-current):hover { opacity: .85; } }
/* Phones: faces only; the bar has no room for the label. Four or five faces overlap into one strip
   so the page title keeps its room; the current face sits on top. The 4px inline padding keeps the
   current face's ring clear of the back arrow and the 「中 / 日」 toggle beside it. */
@media (max-width: 760px) {
  .archive-unit-mates { gap: 6px; margin-right: 0; padding-inline: 4px; }
  .archive-unit-mates-label { display: none; }
  .archive-unit-mates.is-crowded { gap: 0; }
  .archive-unit-mates.is-crowded button { position: relative; box-shadow: 0 0 0 2px var(--gs-paper); }
  .archive-unit-mates.is-crowded button + button { margin-left: -12px; }
  .archive-unit-mates.is-crowded button.is-current { z-index: 1; box-shadow: 0 0 0 2px var(--gs-paper), 0 0 0 4px var(--gs-mint); }
}
</style>
