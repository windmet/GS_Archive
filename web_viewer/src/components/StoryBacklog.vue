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
.backlog { position: absolute; inset: 5% 7%; z-index: 60; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,.45); border-radius: 12px; background: rgba(15,22,28,.96); color: #edf5f7; box-shadow: 0 24px 70px rgba(0,0,0,.55); }
header { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,.12); }
header div { display: flex; flex-direction: column; gap: 2px; }
header small { color: #69d9c7; font-size: .62rem; font-weight: 800; letter-spacing: .16em; }
header strong { font-size: 1rem; }
.close { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(255,255,255,.2); border-radius: 8px; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; }
.entries { min-height: 0; flex: 1; overflow-y: auto; padding: 12px 18px 28px; }
.entry { max-width: 920px; margin: 0 auto; padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,.11); }
.entry.current { background: rgba(105,217,199,.06); }
.entry-meta { display: flex; justify-content: space-between; color: #93a5ab; font-size: .62rem; letter-spacing: .05em; }
.speaker { display: block; margin-top: 8px; color: #69d9c7; font-size: .78rem; }
.text {
  margin: 6px 0 0;
  color: #f4f7f8;
  font-size: .88rem;
  --localized-primary-line-height: 1.65;
  --localized-secondary-color: #aebec3;
  --localized-secondary-size: .84em;
}
.choice { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid #69d9c7; background: rgba(105,217,199,.08); color: #cdeee9; font-size: .75rem; }
.choice-label { flex: 0 0 auto; line-height: 1.65; }
.choice-text { min-width: 0; flex: 1; --localized-primary-line-height: 1.65; --localized-secondary-color: #98c8c0; --localized-secondary-size: .86em; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.actions button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 11px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: rgba(255,255,255,.07); color: #e9f3f5; cursor: pointer; font: inherit; font-size: .7rem; }
.actions button:hover, .close:hover { background: rgba(105,217,199,.17); }
.empty { margin: 50px 0; color: #9babb0; text-align: center; }
@media (max-width: 700px) { .backlog { inset: 2%; } .entries { padding-inline: 10px; } }
</style>
