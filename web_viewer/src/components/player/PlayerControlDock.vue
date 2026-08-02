<template>
  <div class="player-control-dock" role="toolbar" :aria-label="uiText('player.controls')">
    <PlayerIconButton :title="uiText('player.previous')" :aria-label="uiText('player.previous')" :disabled="previousDisabled" @click="$emit('previous')">
      <ChevronLeft :size="22" />
    </PlayerIconButton>
    <PlayerIconButton class="mode-btn" :title="uiText('player.settings.auto')" :aria-label="uiText('player.settings.auto')" :active="autoEnabled" toggle @click="$emit('auto')">
      <Play :size="18" /><span>AUTO</span>
    </PlayerIconButton>
    <PlayerIconButton :title="uiText('player.settings.backlog')" :aria-label="uiText('player.settings.backlog')" @click="$emit('backlog')">
      <BookOpenText :size="20" />
    </PlayerIconButton>
    <PlayerIconButton class="mode-btn" :title="uiText('player.settings.skip')" :aria-label="uiText('player.settings.skip')" :active="skipEnabled" toggle @click="$emit('skip')">
      <FastForward :size="18" /><span>SKIP</span>
    </PlayerIconButton>
    <PlayerIconButton :title="uiText('player.next')" :aria-label="uiText('player.next')" @click="$emit('next')">
      <ChevronRight :size="22" />
    </PlayerIconButton>
  </div>
</template>

<script setup>
import { BookOpenText, ChevronLeft, ChevronRight, FastForward, Play } from '@lucide/vue'
import PlayerIconButton from './PlayerIconButton.vue'
import { resolveUiText as uiText } from '../../localization/ui/UiTextResolver.js'

defineProps({
  autoEnabled: { type: Boolean, default: false },
  skipEnabled: { type: Boolean, default: false },
  previousDisabled: { type: Boolean, default: false },
})

defineEmits(['previous', 'auto', 'backlog', 'skip', 'next'])
</script>

<style scoped>
.player-control-dock {
  position: absolute;
  bottom: var(--player-dock-bottom);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--player-space-2);
  height: var(--player-dock-height);
  padding: 0 var(--player-space-2);
  border: 1px solid var(--player-control-border);
  border-radius: var(--player-radius-pill);
  background: var(--player-control-surface);
  box-shadow: var(--player-shadow-control);
}

.player-control-dock :deep(.player-icon-btn) {
  border-color: transparent;
  background: transparent;
  color: var(--player-control-ink);
  box-shadow: none;
}

.player-control-dock :deep(.player-icon-btn:hover:not(:disabled)) {
  background: rgba(24, 36, 43, 0.07);
}

.player-control-dock :deep(.player-icon-btn.is-active) {
  border-color: var(--player-active-border);
  background: var(--player-active-surface);
  color: var(--player-active-text);
  box-shadow: inset 0 0 0 1px rgba(56, 184, 167, 0.14);
}

.mode-btn {
  width: auto;
  padding: 0 14px;
  gap: 6px;
  font-size: var(--player-font-ui-xs);
  font-weight: 800;
  letter-spacing: 0.08em;
}

@media (max-width: 699px) {
  .player-control-dock {
    bottom: calc(var(--player-dock-bottom) + env(safe-area-inset-bottom));
    height: 48px;
    gap: var(--player-space-1);
  }
  .mode-btn {
    padding: 0 10px;
  }
}
</style>
