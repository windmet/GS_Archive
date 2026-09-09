<template>
  <details class="archive-technical" data-technical-details>
    <summary>{{ label }}</summary>
    <div class="archive-technical-body">
      <slot />
      <pre v-if="evidence != null">{{ JSON.stringify(evidence, null, 2) }}</pre>
    </div>
  </details>
</template>

<script setup>
defineProps({
  label: { type: String, default: '资料来源 / 技术信息' },
  evidence: { type: [Object, Array], default: null },
})
</script>

<style scoped>
.archive-technical { min-width: 0; margin-top: 16px; border: 1px solid #dfe5e8; border-radius: 6px; background: #fff; color: #52616a; }
summary { padding: 14px 16px; min-height: 44px; box-sizing: border-box; cursor: pointer; font-size: .78rem; font-weight: 650; }
summary:focus-visible { outline: 2px solid #158f87; outline-offset: 2px; }
.archive-technical-body { padding: 0 16px 16px; overflow-wrap: anywhere; font-size: .75rem; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .7rem; line-height: 1.6; }
</style>
