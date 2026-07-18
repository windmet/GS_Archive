<template>
  <section class="backlog" role="dialog" aria-modal="true" aria-label="Backlog">
    <header>
      <div><small>STORY LOG</small><strong>剧情回看</strong></div>
      <button class="close" title="关闭" aria-label="关闭" @click="emit('close')"><X :size="21" /></button>
    </header>
    <div ref="listRef" class="entries">
      <p v-if="nodes.length === 0" class="empty">还没有可回看的对话。</p>
      <article v-for="node in nodes" :key="node.node_id" class="entry" :class="{ current: node.current }">
        <div class="entry-meta">
          <span>EP{{ String((node.episode_index ?? 0) + 1).padStart(2, '0') }} · STEP {{ node.step_id }}</span>
          <span v-if="node.current">当前</span>
        </div>
        <strong v-if="node.dialogue?.speaker" class="speaker">{{ node.dialogue.speaker }}</strong>
        <p class="text">{{ displayText(node.dialogue) }}</p>
        <p v-if="choiceText(node)" class="choice">选择：{{ choiceText(node) }}</p>
        <div class="actions">
          <button v-if="node.voice?.cue" @click="emit('replay-voice', node)"><Volume2 :size="16" />重放语音</button>
          <button v-if="!node.current" @click="emit('restore', node.node_id)"><Undo2 :size="16" />回到此处</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { Undo2, Volume2, X } from '@lucide/vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  languageMode: { type: String, default: 'JP' },
})
const emit = defineEmits(['close', 'restore', 'replay-voice'])
const listRef = ref(null)

function displayText(dialogue) {
  if (!dialogue) return ''
  if (props.languageMode === 'CN') return dialogue.text_cn || dialogue.text_jp || dialogue.text || ''
  if (props.languageMode === 'BILINGUAL') {
    return [dialogue.text_jp || dialogue.text, dialogue.text_cn].filter(Boolean).join('\n')
  }
  return dialogue.text_jp || dialogue.text || dialogue.text_cn || ''
}

function choiceText(node) {
  return node.selected_choices?.[node.step_index] || ''
}

onMounted(() => nextTick(() => {
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}))
</script>

<style scoped>
.backlog { position: absolute; inset: 5% 7%; z-index: 60; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,.45); border-radius: 12px; background: rgba(15,22,28,.96); color: #edf5f7; box-shadow: 0 24px 70px rgba(0,0,0,.55); }
header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,.12); }
header div { display: flex; flex-direction: column; gap: 2px; }
header small { color: #69d9c7; font-size: .62rem; font-weight: 800; letter-spacing: .16em; }
header strong { font-size: 1rem; }
.close { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(255,255,255,.2); border-radius: 8px; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; }
.entries { flex: 1; overflow-y: auto; padding: 12px 18px 28px; }
.entry { max-width: 920px; margin: 0 auto; padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,.11); }
.entry.current { background: rgba(105,217,199,.06); }
.entry-meta { display: flex; justify-content: space-between; color: #93a5ab; font-size: .62rem; letter-spacing: .05em; }
.speaker { display: block; margin-top: 8px; color: #69d9c7; font-size: .78rem; }
.text { margin: 6px 0 0; color: #f4f7f8; font-size: .88rem; line-height: 1.65; white-space: pre-wrap; }
.choice { margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid #69d9c7; background: rgba(105,217,199,.08); color: #cdeee9; font-size: .75rem; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.actions button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 11px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; background: rgba(255,255,255,.07); color: #e9f3f5; cursor: pointer; font: inherit; font-size: .7rem; }
.actions button:hover, .close:hover { background: rgba(105,217,199,.17); }
.empty { margin: 50px 0; color: #9babb0; text-align: center; }
@media (max-width: 700px) { .backlog { inset: 2%; } .entries { padding-inline: 10px; } }
</style>
