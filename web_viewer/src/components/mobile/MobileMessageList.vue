<template>
  <div
    class="mobile-message-list"
    :class="{ 'reserve-choice-space': reserveChoiceSpace }"
    ref="listRef"
  >
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
  reserveChoiceSpace: { type: Boolean, default: false },
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 22px 28px;
}

@media (min-width: 700px) and (max-width: 1099px) {
  .mobile-message-list {
    padding: 16px 18px 24px;
  }
}

@media (max-width: 699px) {
  .mobile-message-list {
    /* Clear the floating control dock (14px + 52px) above the safe area */
    padding: 14px 12px calc(86px + env(safe-area-inset-bottom));
  }
  /* Keep the last message readable above the bottom choice sheet */
  .mobile-message-list.reserve-choice-space {
    padding-bottom: calc(182px + env(safe-area-inset-bottom));
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .mobile-message-list {
    padding-top: 12px;
    padding-bottom: 16px;
  }
}
</style>
