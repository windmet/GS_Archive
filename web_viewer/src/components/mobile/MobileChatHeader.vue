<template>
  <div class="mobile-chat-header" :style="headerStyle">
    <span class="header-title" :style="titleStyle">{{ title }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  theme: { type: Object, default: null },
  isGroup: { type: Boolean, default: false },
})

const headerStyle = computed(() => {
  const primary = props.theme?.primary
  return primary ? { background: primary } : {}
})

const titleStyle = computed(() => {
  const onPrimary = props.theme?.onPrimary
  return onPrimary ? { color: onPrimary } : {}
})
</script>

<style scoped>
.mobile-chat-header {
  position: relative;
  z-index: 20;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: var(--player-accent-strong);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.header-title {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (min-width: 700px) and (max-width: 1099px) {
  .mobile-chat-header { height: 58px; }
}

@media (max-width: 699px) {
  .mobile-chat-header {
    height: calc(56px + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .mobile-chat-header {
    height: 56px;
  }
}
</style>
