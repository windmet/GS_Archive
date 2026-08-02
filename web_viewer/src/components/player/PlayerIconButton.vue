<template>
  <button
    class="player-icon-btn"
    :class="{ 'is-active': active }"
    :title="title"
    :aria-label="ariaLabel || title"
    :aria-pressed="toggle ? active : undefined"
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
  toggle: { type: Boolean, default: false },
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
  border: 1px solid var(--player-control-border);
  border-radius: var(--player-radius-control);
  background: var(--player-control-surface);
  color: var(--player-control-ink);
  box-shadow: 0 4px 16px rgba(3, 12, 20, 0.16);
  cursor: pointer;
  transition:
    background var(--player-motion-fast) var(--player-ease-standard),
    transform var(--player-motion-fast) var(--player-ease-standard);
}

.player-icon-btn:hover:not(:disabled) {
  background: var(--player-control-surface-hover);
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
  border-color: var(--player-active-border);
  color: var(--player-active-text);
  background: var(--player-active-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 0 0 1px rgba(56, 184, 167, 0.18);
}

.player-icon-btn:focus-visible {
  outline: 2px solid var(--player-focus-outer);
  outline-offset: 2px;
}
</style>
