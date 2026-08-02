<template>
  <section class="backlog" role="dialog" aria-modal="true" :aria-label="uiText('backlog.title')">
    <header>
      <div><small>STORY LOG</small><strong>{{ uiText('backlog.title') }}</strong></div>
      <button class="close" :title="uiText('backlog.close')" :aria-label="uiText('backlog.close')" @click="emit('close')"><X :size="21" /></button>
    </header>
    <div ref="listRef" class="entries">
      <p v-if="nodes.length === 0" class="empty">{{ uiText('backlog.empty') }}</p>
      <article v-for="item in displayNodes" :key="item.node.node_id" class="entry" :class="{ current: item.node.current }">
        <div class="entry-meta">
          <span>EP{{ String((item.node.episode_index ?? 0) + 1).padStart(2, '0') }} · STEP {{ item.node.step_id }}</span>
          <span v-if="item.node.current">{{ uiText('backlog.current') }}</span>
        </div>
        <strong v-if="item.dialogue.speaker" class="speaker">{{ item.dialogue.speaker }}</strong>
        <LocalizedTextBlock class="text" :display="item.dialogue" />
        <div v-if="item.choice" class="choice">
          <span class="choice-label">{{ uiText('backlog.choice', { text: '' }) }}</span>
          <LocalizedTextBlock class="choice-text" :display="item.choice" />
        </div>
        <div class="actions">
          <button v-if="item.node.voice?.cue" @click="emit('replay-voice', item.node)"><Volume2 :size="16" />{{ uiText('backlog.replayVoice') }}</button>
          <button v-if="!item.node.current" @click="emit('restore', item.node.node_id)"><Undo2 :size="16" />{{ uiText('backlog.restore') }}</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Undo2, Volume2, X } from '@lucide/vue'
import LocalizedTextBlock from './LocalizedTextBlock.vue'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'
import { resolveText } from '../utils/TextHelper.js'
import { resolveUiText as uiText } from '../localization/ui/UiTextResolver.js'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'restore', 'replay-voice'])
const listRef = ref(null)
const localization = useStoryLocalization()

function displayDialogue(dialogue) {
  if (!dialogue) return { speaker: '', text: '' }
  return localization?.resolveDialogue(dialogue) ?? resolveText(dialogue)
}

function choiceDisplay(node) {
  const selections = Object.entries(node.selected_choices || {})
  let selection = node.selected_choices?.[node.step_index]
  if (!selection && node.current && selections.length) {
    const latest = selections
      .filter(([stepIndex]) => Number(stepIndex) <= Number(node.step_index))
      .sort(([left], [right]) => Number(right) - Number(left))[0]
    selection = latest?.[1]
  }
  if (!selection) return null
  return localization?.resolveChoiceSelection(selection) || {
    text: (typeof selection === 'string' ? selection : selection.source_text) || '',
  }
}

const displayNodes = computed(() => props.nodes.map(node => ({
  node,
  dialogue: displayDialogue(node.dialogue),
  choice: choiceDisplay(node),
})))

onMounted(() => nextTick(() => {
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}))
</script>

<style scoped>
.backlog {
  position: absolute;
  inset: 5% 7%;
  z-index: 60;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: var(--player-radius-surface);
  background: var(--player-log-surface);
  color: var(--player-ink-900);
  box-shadow: 0 28px 80px rgba(3, 32, 25, 0.28);
  backdrop-filter: blur(18px) saturate(0.92);
}
header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--player-log-border);
  background: linear-gradient(105deg, var(--player-log-header), rgba(250, 253, 252, 0.96));
}
header div { display: flex; flex-direction: column; gap: 2px; }
header small { color: var(--player-log-accent); font-size: .62rem; font-weight: 800; letter-spacing: .16em; }
header strong { font-size: 1rem; }
.close {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--player-control-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--player-control-ink);
  box-shadow: 0 4px 14px rgba(3, 32, 25, 0.1);
  cursor: pointer;
}
.entries { min-height: 0; flex: 1; overflow-y: auto; padding: 16px 18px 28px; }
.entry {
  max-width: 920px;
  margin: 0 auto 10px;
  padding: 16px 18px;
  border: 1px solid rgba(24, 36, 43, 0.1);
  border-radius: 16px;
  background: var(--player-log-entry);
  box-shadow: 0 6px 18px rgba(3, 32, 25, 0.06);
}
.entry.current {
  border-color: var(--player-log-border);
  background: var(--player-log-entry-current);
  box-shadow: inset 4px 0 0 var(--player-nameplate-surface);
}
.entry-meta { display: flex; justify-content: space-between; color: var(--player-ink-500); font-size: .62rem; letter-spacing: .05em; }
.speaker { display: block; margin-top: 8px; color: var(--player-log-accent); font-size: .78rem; }
.text {
  margin: 6px 0 0;
  color: var(--player-ink-900);
  font-size: .88rem;
  --localized-primary-line-height: 1.65;
  --localized-secondary-color: var(--player-ink-700);
  --localized-secondary-size: .84em;
}
.choice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  padding: 8px 10px;
  border-left: 3px solid var(--player-nameplate-surface);
  border-radius: 0 10px 10px 0;
  background: rgba(16, 213, 131, 0.09);
  color: var(--player-log-accent);
  font-size: .75rem;
}
.choice-label { flex: 0 0 auto; line-height: 1.65; }
.choice-text { min-width: 0; flex: 1; --localized-primary-line-height: 1.65; --localized-secondary-color: var(--player-ink-700); --localized-secondary-size: .86em; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--player-control-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--player-control-ink);
  cursor: pointer;
  font: inherit;
  font-size: .7rem;
}
.actions button:hover, .close:hover { border-color: var(--player-active-border); background: var(--player-active-surface); color: var(--player-active-text); }
.actions button:focus-visible, .close:focus-visible { outline: 2px solid var(--player-focus-inner); box-shadow: 0 0 0 4px var(--player-focus-outer); }
.empty { margin: 50px 0; color: var(--player-ink-700); text-align: center; }
@media (max-width: 700px) {
  .backlog { inset: 2%; border-radius: 18px; }
  header { padding: 14px 16px; }
  .entries { padding: 10px; }
  .entry { padding: 14px; }
}
</style>
