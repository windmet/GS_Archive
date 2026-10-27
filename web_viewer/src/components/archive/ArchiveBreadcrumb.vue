<template>
  <nav v-if="parents.length" class="archive-breadcrumb" :aria-label="accessibleLabel">
    <ol>
      <li v-for="(item, index) in parents" :key="`${index}-${item.label}`">
        <a v-if="item.route" :href="itemHref(item)">{{ item.label }}</a>
        <span v-else>{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { buildPublicArchiveUrl } from '../../core/archiveRoute.js'

// The title row names the page itself and the sidebar names the archive, so only the levels between them are
// listed, each followed by a slash. Three or more collapse their middle into an ellipsis; the whole path stays
// in the accessible name.
const props = defineProps({
  items: { type: Array, default: () => [] },
})

const parents = computed(() => {
  const between = props.items.slice(1, -1)
  return between.length > 2 ? [between[0], { label: '…' }, between[between.length - 1]] : between
})
const accessibleLabel = computed(() => `面包屑：${props.items.map(item => item.label).join('，')}`)

function itemHref(item) {
  return buildPublicArchiveUrl(window.location.href, item.route).href
}
</script>

<style scoped>
.archive-breadcrumb { flex: 0 1 auto; min-width: 0; color: var(--gs-ink-3); font-size: 13px; line-height: 1.2; }
.archive-breadcrumb ol { display: flex; align-items: center; min-width: 0; margin: 0; padding: 0; list-style: none; }
.archive-breadcrumb li { display: flex; align-items: center; min-width: 0; }
.archive-breadcrumb li::after { content: "/"; flex: 0 0 auto; margin: 0 var(--gs-space-3); color: var(--gs-rule); }
.archive-breadcrumb a, .archive-breadcrumb span { display: block; overflow: hidden; color: inherit; text-overflow: ellipsis; white-space: nowrap; }
.archive-breadcrumb a { text-decoration: none; }
.archive-breadcrumb a:hover { color: var(--gs-ink); }
.archive-breadcrumb a:focus-visible { border-radius: var(--gs-radius-control); outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }
@media (max-width: 760px) { .archive-breadcrumb { font-size: 12px; } }
</style>
