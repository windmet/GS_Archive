<template>
  <button
    class="player-icon-btn"
    :class="{ 'is-active': active }"
    :title="title"
    :aria-label="ariaLabel || title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  ariaLabel: { type: String, default: null },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
</script>

<style scoped>
.player-icon-btn {
  width: var(--player-hit-min);
  height: var(--player-hit-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--player-border-dark);
  border-radius: var(--player-radius-control);
  background: var(--player-panel-dark);
  color: var(--player-paper);
  cursor: pointer;
  transition:
    background var(--player-motion-fast) var(--player-ease-standard),
    transform var(--player-motion-fast) var(--player-ease-standard);
}

.player-icon-btn:hover:not(:disabled) {
  background: var(--player-panel-dark-hover);
  transform: translateY(-2px);
}

.player-icon-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.player-icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.player-icon-btn.is-active {
  border-color: var(--player-accent-line);
  color: var(--player-accent-soft);
  background: rgba(56, 184, 167, 0.18);
}

.player-icon-btn:focus-visible {
  outline: 2px solid var(--player-focus-outer);
  outline-offset: 2px;
}
</style>
