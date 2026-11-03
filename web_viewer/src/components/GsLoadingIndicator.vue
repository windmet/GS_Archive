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
// Three sizes, one per scope (docs/GS_LOADING_SYSTEM_20261103.md):
//   badge  48 ring + Now Loading: a curtain over a whole screen or stage, in its bottom-right corner.
//   inline 22 ring in a floating chip: a page on its way, centred on the pane it will fill.
//   text   16 ring beside the copy: one part of a page still reading, where that part will appear.
defineProps({
  message: { type: String, required: true },
  variant: { type: String, default: 'badge', validator: value => ['badge', 'inline', 'text'].includes(value) },
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
  font-family: var(--gs-font-body);
  text-align: start;
}
/* Zero-specificity margins, so a caller's class can always place the indicator. */
:where(.gs-loading-indicator) { margin: 0; }
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
  white-space: nowrap;
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
/* A curtain's badge hangs from the bottom-right corner: the copy keeps to that edge and to one line,
   so a longer message never lifts or shifts the badge (the screen reader still gets the whole text). */
.gs-loading-indicator--badge { justify-items: end; text-align: end; }
.gs-loading-indicator--badge .gs-loading-indicator__message { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* The page chip is the only card of a pending page; ArchiveLoadNotice takes the same box when it fails. */
.gs-loading-indicator--inline { display: inline-grid; }
.gs-loading-indicator--inline .gs-loading-indicator__badge {
  gap: var(--gs-space-3);
  padding: var(--gs-space-4) var(--gs-space-5);
  border: 0;
  border-radius: var(--gs-radius-panel);
  background: var(--gs-surface);
  box-shadow: var(--gs-shadow-float);
}
.gs-loading-indicator--inline .gs-loading-indicator__ring {
  width: 1.375rem;
  height: 1.375rem;
  flex-basis: 1.375rem;
}
.gs-loading-indicator--inline .gs-loading-indicator__message { color: var(--gs-ink-2); line-height: 1.5; }
/* In place: no card; the ring stands in front of the line that will become the content. It replaces a
   status paragraph, so it keeps a paragraph's spacing unless the caller's class sets its own. */
:where(.gs-loading-indicator--text) { margin-block: 1em; }
.gs-loading-indicator--text .gs-loading-indicator__badge {
  gap: var(--gs-space-3);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
.gs-loading-indicator--text .gs-loading-indicator__ring {
  width: 1rem;
  height: 1rem;
  flex-basis: 1rem;
}
.gs-loading-indicator--text .gs-loading-indicator__track,
.gs-loading-indicator--text .gs-loading-indicator__arc { stroke-width: 7; }
.gs-loading-indicator--text .gs-loading-indicator__message { color: var(--gs-ink-3); font-size: var(--gs-text-ui); font-weight: 400; line-height: 1.5; }
.gs-loading-indicator--text.gs-loading-indicator--dark .gs-loading-indicator__message { color: var(--gs-loading-copy); }
@keyframes gs-loading-orbit { to { transform: rotate(360deg); } }
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
