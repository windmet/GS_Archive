<template>
  <div
    class="gs-loading-indicator"
    :class="[`gs-loading-indicator--${variant}`, `gs-loading-indicator--${tone}`]"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="gs-loading-indicator__badge" :aria-hidden="variant === 'badge' ? 'true' : undefined">
      <svg class="gs-loading-indicator__ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle class="gs-loading-indicator__track" cx="24" cy="24" r="18" />
        <circle class="gs-loading-indicator__arc" cx="24" cy="24" r="18" pathLength="100" />
      </svg>
      <span v-if="variant === 'badge'" class="gs-loading-indicator__brand">Now Loading</span>
      <span v-else class="gs-loading-indicator__message">{{ message }}</span>
    </div>
    <p v-if="variant === 'badge'" class="gs-loading-indicator__message">{{ message }}</p>
  </div>
</template>

<script setup>
// Presentation only: callers own visibility, readiness, cancellation and copy.
// The English brand is decorative; the caller's actual message is announced.
defineProps({
  message: { type: String, required: true },
  variant: { type: String, default: 'badge', validator: value => ['badge', 'inline'].includes(value) },
  tone: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
})
</script>

<style scoped>
.gs-loading-indicator {
  --gs-loading-ink: #183064;
  --gs-loading-track: #7b7e9c;
  --gs-loading-accent: #20d6b5;
  --gs-loading-copy: #365c60;
  box-sizing: border-box;
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans JP", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  text-align: start;
}
.gs-loading-indicator--dark { --gs-loading-copy: #e0ecef; }
.gs-loading-indicator__badge {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  max-width: 100%;
  padding: 0.4rem 0.8rem;
  border: 2px solid #fff;
  border-radius: 0.45rem;
  background:
    repeating-linear-gradient(132deg, transparent 0 4px, rgb(255 255 255 / 19%) 4px 5px),
    linear-gradient(155deg, #f4f5f8, #e5e8ed);
  color: var(--gs-loading-ink);
  box-shadow: 0 0 0 1px #b9c4cd, 0 3px 12px rgb(10 29 41 / 10%);
}
.gs-loading-indicator__ring {
  display: block;
  width: 3rem;
  height: 3rem;
  flex: 0 0 3rem;
  overflow: visible;
}
.gs-loading-indicator__track,
.gs-loading-indicator__arc {
  fill: none;
  stroke-width: 6;
}
.gs-loading-indicator__track { stroke: var(--gs-loading-track); }
.gs-loading-indicator__arc {
  stroke: var(--gs-loading-accent);
  stroke-linecap: round;
  stroke-dasharray: 18 82;
  transform-origin: 24px 24px;
  animation: gs-loading-orbit 1.15s linear infinite;
}
.gs-loading-indicator__brand {
  min-width: 0;
  font-family: "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.12;
  overflow-wrap: anywhere;
}
.gs-loading-indicator__message {
  min-width: 0;
  max-width: 100%;
  margin: 0;
  color: var(--gs-loading-copy);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.65;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: normal;
}
.gs-loading-indicator--inline { display: inline-grid; }
.gs-loading-indicator--inline .gs-loading-indicator__badge {
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-width: 1px;
  background: #f7fafb;
  border-color: #c9d7dc;
  box-shadow: 0 3px 12px rgb(10 29 41 / 9%);
}
.gs-loading-indicator--inline .gs-loading-indicator__ring {
  width: 1.375rem;
  height: 1.375rem;
  flex-basis: 1.375rem;
}
.gs-loading-indicator--inline .gs-loading-indicator__message { color: #294a59; }
@keyframes gs-loading-orbit { to { transform: rotate(360deg); } }
@media (max-width: 420px), (max-height: 420px) {
  .gs-loading-indicator--badge .gs-loading-indicator__ring {
    width: 2.5rem;
    height: 2.5rem;
    flex-basis: 2.5rem;
  }
  .gs-loading-indicator__brand { font-size: 1.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  .gs-loading-indicator__arc { animation: none; transform: rotate(24deg); }
}
@media (forced-colors: active) {
  .gs-loading-indicator__badge { border-color: CanvasText; background: Canvas; color: CanvasText; box-shadow: none; }
  .gs-loading-indicator__message { color: CanvasText; }
  .gs-loading-indicator__track { stroke: GrayText; }
  .gs-loading-indicator__arc { stroke: Highlight; }
}
</style>
