<template>
  <nav
    v-if="items.length"
    class="archive-breadcrumb"
    :aria-label="accessibleLabel"
  >
    <ol>
      <template
        v-for="(item, index) in items"
        :key="`${index}-${item.label}`"
      >
        <li
          v-if="items.length > 3 && index === items.length - 2"
          class="mobile-ellipsis"
          aria-hidden="true"
        >…</li>
        <li :class="{ 'is-middle': items.length > 3 && index > 0 && index < items.length - 2 }">
          <a
            v-if="item.route"
            :href="itemHref(item)"
          >{{ item.label }}</a>
          <span v-else aria-current="page">{{ item.label }}</span>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { buildArchiveUrl } from '../../core/archiveRoute.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const accessibleLabel = computed(() => (
  `面包屑：${props.items.map(item => item.label).join('，')}`
))

function itemHref(item) {
  return buildArchiveUrl(window.location.href, item.route).href
}
</script>

<style scoped>
.archive-breadcrumb {
  min-width: 0;
  color: var(--archive-muted);
  font-size: 0.72rem;
  line-height: 1.2;
}

.archive-breadcrumb ol {
  display: flex;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.archive-breadcrumb li {
  display: flex;
  align-items: center;
  min-width: 0;
}

.archive-breadcrumb .mobile-ellipsis {
  display: none;
}

.archive-breadcrumb li + li::before {
  content: "/";
  flex: 0 0 auto;
  margin: 0 0.45rem;
  color: #a5afb8;
}

.archive-breadcrumb a,
.archive-breadcrumb span {
  display: block;
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-breadcrumb a {
  color: #177f79;
  text-decoration: none;
}

.archive-breadcrumb a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.archive-breadcrumb a:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--archive-accent);
  outline-offset: 2px;
}

.archive-breadcrumb [aria-current="page"] {
  color: var(--archive-muted);
}

@media (max-width: 760px) {
  .archive-breadcrumb {
    font-size: 0.68rem;
  }

  .archive-breadcrumb li.is-middle {
    display: none;
  }

  .archive-breadcrumb .mobile-ellipsis {
    display: flex;
  }
}
</style>
