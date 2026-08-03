<template>
  <div class="typing-indicator" role="status" :aria-label="label">
    <span class="dot" v-for="i in 3" :key="i"></span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '…' },
})
</script>

<style scoped>
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  background: #ffffff;
  padding: 10px 14px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--player-ink-500);
  animation: typing-bounce 1.1s ease-in-out infinite;
}

.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-4px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
    opacity: 0.55;
  }
}
</style>
