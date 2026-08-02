<template>
  <div class="player-top-bar">
    <PlayerIconButton :title="uiText('player.back')" :aria-label="uiText('player.back')" @click="$emit('back')">
      <ChevronLeft :size="22" />
    </PlayerIconButton>

    <div class="bar-center">
      <div
        class="progress-capsule"
        role="progressbar"
        :aria-valuemin="1"
        :aria-valuemax="Math.max(1, total)"
        :aria-valuenow="current"
        :aria-label="uiText('player.progress')"
      >
        <span v-if="episodeLabel" class="episode-badge">{{ episodeLabel }}</span>
        <span class="step-counter">{{ current }} / {{ total }}</span>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" :style="{ width: progressPercent }" />
      </div>
    </div>

    <div class="bar-right">
      <button class="lang-btn" :title="uiText('player.language')" :aria-label="uiText('player.language')" @click="$emit('language')">
        {{ language }}
      </button>
      <PlayerIconButton :title="uiText('player.menu')" :aria-label="uiText('player.menu')" @click="$emit('menu')">
        <Menu :size="20" />
      </PlayerIconButton>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, Menu } from '@lucide/vue'
import PlayerIconButton from './PlayerIconButton.vue'
import { resolveUiText as uiText } from '../../localization/ui/UiTextResolver.js'

const props = defineProps({
  episodeLabel: { type: String, default: '' },
  current: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  language: { type: String, default: '' },
})

defineEmits(['back', 'language', 'menu'])

const progressPercent = computed(() => {
  if (!props.total) return '0%'
  return `${Math.min(100, Math.max(0, (props.current / props.total) * 100))}%`
})
</script>

<style scoped>
.player-top-bar {
  position: absolute;
  top: var(--player-space-4);
  left: var(--player-space-5);
  right: var(--player-space-5);
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  pointer-events: none;
}
.player-top-bar > * {
  pointer-events: auto;
}

.bar-center {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.progress-capsule {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--player-hit-min);
  padding: 0 var(--player-space-4);
  border: 1px solid var(--player-border-dark);
  border-radius: var(--player-radius-pill);
  background: var(--player-panel-dark);
  color: var(--player-paper);
}

.step-counter {
  font-size: var(--player-font-ui-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.episode-badge {
  color: var(--player-ink-950);
  background: var(--player-accent-soft);
  border: 1px solid var(--player-border-light);
  border-radius: var(--player-radius-pill);
  padding: 3px 10px;
  font-size: var(--player-font-ui-xs);
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.progress-track {
  width: 100%;
  height: 3px;
  border-radius: var(--player-radius-pill);
  background: rgba(250, 252, 252, 0.18);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--player-accent);
  transition: width var(--player-motion-base) var(--player-ease-standard);
}

.bar-right {
  display: flex;
  align-items: center;
  gap: var(--player-space-2);
}

.lang-btn {
  height: var(--player-hit-min);
  padding: 0 var(--player-space-4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--player-border-dark);
  border-radius: var(--player-radius-control);
  background: var(--player-panel-dark);
  color: var(--player-accent-soft);
  font-size: var(--player-font-ui-sm);
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    background var(--player-motion-fast) var(--player-ease-standard),
    transform var(--player-motion-fast) var(--player-ease-standard);
}
.lang-btn:hover {
  background: var(--player-panel-dark-hover);
  transform: translateY(-2px);
}
.lang-btn:active {
  transform: scale(0.98);
}
.lang-btn:focus-visible {
  outline: 2px solid var(--player-focus-outer);
  outline-offset: 2px;
}

@media (max-width: 699px) {
  .player-top-bar {
    top: calc(var(--player-space-2) + env(safe-area-inset-top));
    left: calc(var(--player-space-2) + env(safe-area-inset-left));
    right: calc(var(--player-space-2) + env(safe-area-inset-right));
  }
  .progress-capsule {
    height: 40px;
    padding: 0 var(--player-space-3);
    gap: 6px;
  }
  .episode-badge {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
