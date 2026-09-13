<template>
  <component
    :is="reference?.actionable ? 'button' : 'span'"
    class="archive-idol-reference"
    :class="`density-${density}`"
    :type="reference?.actionable ? 'button' : undefined"
    :aria-label="reference?.actionable ? `查看${reference.displayName}的偶像资料` : undefined"
    @click="reference?.actionable && emit('open', reference.idolCode)"
  >
    <span class="idol-reference-art" aria-hidden="true">
      <img v-if="imageSrc" :src="imageSrc" alt="" loading="lazy" @error="advanceImage" />
      <span v-else>{{ reference?.displayName?.slice(0, 1) || '?' }}</span>
    </span>
    <span class="idol-reference-copy">
      <strong>{{ reference?.displayName || '姓名待确认' }}</strong>
      <small v-if="reference?.unitName">{{ reference.unitName }}</small>
    </span>
    <ChevronRight v-if="reference?.actionable" class="idol-reference-arrow" :size="18" aria-hidden="true" />
  </component>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ChevronRight } from '@lucide/vue'

const props = defineProps({
  reference: { type: Object, default: null },
  density: { type: String, default: 'compact', validator: value => ['compact', 'portrait', 'visual'].includes(value) },
})
const emit = defineEmits(['open'])
const imageIndex = ref(0)
const imageUrls = computed(() => (props.reference?.imageCandidates || []).map(candidate => candidate.url).filter(Boolean))
const imageSrc = computed(() => imageUrls.value[imageIndex.value] || '')
watch(() => `${props.reference?.idolCode || ''}|${imageUrls.value.join('|')}`, () => { imageIndex.value = 0 })

function advanceImage() {
  if (imageIndex.value < imageUrls.value.length) imageIndex.value += 1
}
</script>

<style scoped>
.archive-idol-reference { --reference-size: 44px; display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 52px; padding: 6px 8px; border: 1px solid #dce8e8; border-radius: 12px; background: #f8fbfb; color: #29444b; font: inherit; text-align: left; }
button.archive-idol-reference { cursor: pointer; }
button.archive-idol-reference:hover { border-color: #89c9c2; background: #eff9f7; }
button.archive-idol-reference:focus-visible { outline: 3px solid #37a9a1; outline-offset: 2px; }
.density-portrait { --reference-size: 64px; min-height: 78px; }
.density-visual { --reference-size: 96px; min-height: 110px; }
.idol-reference-art { display: grid; flex: 0 0 var(--reference-size); place-items: center; width: var(--reference-size); height: var(--reference-size); border-radius: 50%; background: #e7f0f0; color: #63848a; font-weight: 700; overflow: hidden; }
.idol-reference-art img { width: 100%; height: 100%; object-fit: cover; }
.idol-reference-copy { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.idol-reference-copy strong, .idol-reference-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.idol-reference-copy strong { font-size: .82rem; }.idol-reference-copy small { color: #70848a; font-size: .67rem; }
.idol-reference-arrow { flex: 0 0 auto; color: #23867e; }
</style>
