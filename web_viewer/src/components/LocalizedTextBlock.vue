<template>
  <span
    class="localized-text-block"
    :class="{ 'is-bilingual': content.bilingual }"
    :data-text-unit-id="content.unitId || undefined"
  >
    <span
      v-if="content.primary"
      class="localized-primary"
      :lang="content.primary.locale || undefined"
      :data-text-source="content.primary.source || undefined"
    >{{ content.primary.text }}</span>
    <span
      v-if="content.secondary"
      class="localized-secondary"
      :lang="content.secondary.locale || undefined"
      :data-text-source="content.secondary.source || undefined"
    >{{ content.secondary.text }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeLocalizedDisplay } from '../localization/story/LocalizedDisplay.js'

const props = defineProps({
  display: { type: [Object, String], default: null },
})

const content = computed(() => normalizeLocalizedDisplay(props.display))
</script>

<style scoped>
.localized-text-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.localized-primary,
.localized-secondary {
  display: block;
  min-width: 0;
  font-family: var(--localized-font-family, inherit);
}

.localized-primary {
  color: var(--localized-primary-color, inherit);
  font-size: var(--localized-primary-size, inherit);
  font-weight: var(--localized-primary-weight, inherit);
  line-height: var(--localized-primary-line-height, inherit);
}

.localized-secondary {
  margin-top: var(--localized-secondary-gap, 0.35em);
  color: var(--localized-secondary-color, currentColor);
  font-size: var(--localized-secondary-size, 0.82em);
  font-weight: var(--localized-secondary-weight, 500);
  line-height: var(--localized-secondary-line-height, 1.55);
  opacity: var(--localized-secondary-opacity, 0.78);
}
</style>
