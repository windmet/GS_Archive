<template>
  <div class="mobile-message-list" ref="listRef">
    <MobileMessageBubble v-for="(msg, i) in messages" :key="i" :message="msg" />
    <MobileTypingIndicator v-if="showTyping" />
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import MobileMessageBubble from './MobileMessageBubble.vue'
import MobileTypingIndicator from './MobileTypingIndicator.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  showTyping: { type: Boolean, default: false },
})

const listRef = ref(null)

function scrollToBottom() {
  const el = listRef.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => props.messages.length, () => nextTick(scrollToBottom))
watch(() => props.showTyping, () => nextTick(scrollToBottom))
</script>

<style scoped>
.mobile-message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 22px 28px;
}
</style>
