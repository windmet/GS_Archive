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
  const sourcePrimary = props.theme?.sourcePrimary
  if (!primary) return {}
  return {
    background: sourcePrimary && sourcePrimary !== primary
      ? `linear-gradient(90deg, ${primary} 0%, ${primary} 72%, ${sourcePrimary} 150%)`
      : primary,
    '--mobile-header-accent': props.theme?.accent || sourcePrimary || primary,
  }
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
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px 0;
  background: var(--player-accent-strong);
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.mobile-chat-header::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 8px;
  width: 72px;
  height: 4px;
  border-radius: 999px;
  transform: translateX(-50%);
  background: var(--mobile-header-accent, rgba(255, 255, 255, 0.58));
  opacity: 0.76;
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
  .mobile-chat-header {
    height: 68px;
    padding-top: 8px;
  }
}

@media (max-width: 699px) {
  .mobile-chat-header {
    height: 60px;
    padding-top: 0;
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .mobile-chat-header {
    height: 64px;
    padding-top: 6px;
  }
}
</style>
