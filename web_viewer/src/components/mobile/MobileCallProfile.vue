<template>
  <div class="call-profile">
    <img v-if="avatarUrl && !avatarFailed" class="call-avatar" :src="avatarUrl" alt="" @error="avatarFailed = true" />
    <span v-else class="call-avatar call-avatar-placeholder" aria-hidden="true"></span>
    <span v-if="name" class="call-name-capsule" :style="capsuleStyle">{{ name }}</span>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getMobileIconUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  charaId: { type: String, default: '' },
  name: { type: String, default: '' },
  theme: { type: Object, default: null },
})

const avatarUrl = computed(() => (props.charaId ? getMobileIconUrl(props.charaId) : null))
const avatarFailed = ref(false)

watch(avatarUrl, () => { avatarFailed.value = false })

const capsuleStyle = computed(() => ({
  background: props.theme?.primary || 'var(--player-accent-strong)',
  color: props.theme?.onPrimary || '#ffffff',
}))
</script>

<style scoped>
.call-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 0 12px;
}

.call-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  object-fit: cover;
  background: #d8d3cf;
  flex-shrink: 0;
}

.call-avatar-placeholder {
  position: relative;
  overflow: hidden;
  background: linear-gradient(150deg, #c9c4c0, #9a938e);
}

.call-avatar-placeholder::before,
.call-avatar-placeholder::after {
  position: absolute;
  left: 50%;
  content: '';
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.68);
}

.call-avatar-placeholder::before {
  top: 20%;
  width: 34%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.call-avatar-placeholder::after {
  bottom: -10%;
  width: 72%;
  height: 48%;
  border-radius: 50% 50% 0 0;
}

.call-name-capsule {
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.28);
}

@media (max-width: 699px) {
  .call-avatar {
    width: 76px;
    height: 76px;
    border-width: 3px;
  }
  .call-name-capsule {
    height: 30px;
    padding: 0 13px;
    font-size: 0.82rem;
  }
}
</style>
