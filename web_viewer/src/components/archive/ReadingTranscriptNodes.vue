<template>
  <template v-for="node in nodes" :key="node.kind === 'row' ? node.item.row.anchor.row_id : node.key">
    <ReadingTranscriptRow v-if="node.kind === 'row'" :item="node.item" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="searchMatchIds" />
    <div v-else-if="node.kind === 'continuation'" v-show="!node.retryIndices.includes(selection[node.choice] ?? 0)" class="branch-continuation">
      <ReadingTranscriptNodes :nodes="node.nodes" :selection="selection" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="searchMatchIds" @select="emit('select', $event)" />
    </div>
    <section v-else class="reader-branch" aria-label="制作人选择分支">
      <header class="branch-header"><span>制作人选择</span><span>点击选项，切换对话反应</span></header>
      <div class="branch-choices" role="tablist" aria-label="分支选项">
        <button v-for="option in node.options" :key="option.index" type="button" role="tab" class="branch-choice reader-row"
          :id="`reading-${option.choice.row.anchor.row_id}`" :data-option-index="option.index"
          :aria-selected="selected(node) === option.index" :tabindex="selected(node) === option.index ? 0 : -1"
          :aria-controls="`branch-panel-${node.key}-${option.index}`"
          :class="{ 'search-match': searchMatchIds.has(option.choice.row.anchor.row_id) }"
          @click="emit('select', { choice: node.choice, index: option.index })" @keydown="moveTab($event, node, option.index)">
          <span v-for="alias in option.choice.anchorAliases" :key="alias" :id="`reading-${alias}`" class="reader-anchor-alias" aria-hidden="true"></span>
          <span class="branch-option-text"><span class="branch-primary" :lang="option.choice.view.primary.locale">{{ reflowReadingText(option.choice.view.primary.text, option.choice.view.primary.locale) }}</span><span v-if="option.choice.view.secondary" class="branch-secondary" :lang="option.choice.view.secondary.locale">{{ reflowReadingText(option.choice.view.secondary.text, option.choice.view.secondary.locale) }}</span></span>
        </button>
      </div>
      <div :id="`branch-panel-${node.key}-${selected(node)}`" role="tabpanel" :aria-labelledby="`reading-${node.options[selected(node)].choice.row.anchor.row_id}`" class="branch-panel">
        <ReadingTranscriptNodes :nodes="node.options[selected(node)].nodes" :selection="selection" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="searchMatchIds" @select="emit('select', $event)" />
        <p v-if="node.options[selected(node)].retry" class="branch-hint">此答案会返回当前问题重答。请选择其他答案，查看继续的剧情。<button type="button" class="retry-question" @click="focusChoices($event)">返回选项</button></p>
        <p v-else-if="node.options[selected(node)].shared" class="branch-hint">此选项共用下方后续正文。</p>
        <p v-else-if="node.options[selected(node)].terminal" class="branch-hint">此分支结束后，本段完结。</p>
      </div>
    </section>
  </template>
</template>
<script setup>
import { nextTick } from 'vue'
import ReadingTranscriptRow from './ReadingTranscriptRow.vue'
import { reflowReadingText } from '../../../shared/reading/ReadingTypography.js'
const props = defineProps({ nodes: Array, selection: Object, mode: String, anchor: String, idolDirectory: Array, searchMatchIds: Set })
const emit = defineEmits(['select'])
const selected = node => props.selection[node.choice] ?? 0
function focusChoices(event) { event.currentTarget.closest('.reader-branch')?.querySelector('[role=tab][aria-selected=true]')?.focus() }
async function moveTab(event, node, index) {
  const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!direction && !['Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? node.options.length - 1 : (index + direction + node.options.length) % node.options.length
  const list = event.currentTarget.parentElement
  emit('select', { choice: node.choice, index: target })
  await nextTick()
  list.querySelector(`[data-option-index="${target}"]`)?.focus()
}
</script>
<style scoped>
.reader-branch { min-width:0; margin:18px 0; padding:14px; border:1px solid var(--reader-border); border-left:3px solid var(--reader-accent); border-radius:10px; background:var(--reader-bg-card); }
.branch-header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 18px; margin-bottom:12px; color:var(--reader-text-sub); font-size:12px; }
.branch-header span:first-child { font-weight:600; color:var(--reader-accent-text); }
.branch-choices { display:flex; flex-wrap:wrap; gap:8px; }
.branch-choice { position:relative; flex:1 1 180px; min-width:0; min-height:44px; padding:10px 14px; border:1px solid var(--reader-border); border-radius:18px; background:var(--reader-bg-page); color:var(--reader-text-main); font:inherit; text-align:start; cursor:pointer; scroll-margin-top:20px; overflow-wrap:anywhere; }
.branch-choice[aria-selected=true] { background:var(--reader-active); color:var(--reader-on-accent); border-color:var(--reader-active); font-weight:600; }
.branch-choice:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:3px; }
.branch-choice.search-match { box-shadow:inset 0 0 0 2px var(--reader-accent); }
.branch-option-text, .branch-primary, .branch-secondary { display:block; }
.branch-primary { line-height:1.6; white-space:pre-wrap; }
.branch-secondary { margin-top:3px; color:var(--reader-text-sub); font-size:.9em; line-height:1.6; white-space:pre-wrap; }
.branch-choice[aria-selected=true] .branch-secondary { color:inherit; opacity:.88; }
.branch-panel { margin-top:14px; border-top:1px dashed var(--reader-border); }
.branch-panel :deep(.reader-row.selected), .branch-panel :deep(.reader-row.search-match) { box-shadow:none; }
.branch-hint { margin:12px 0 0; color:var(--reader-text-sub); font-size:13px; }
.retry-question { margin-left:8px; padding:6px 10px; border:1px solid var(--reader-border); border-radius:6px; background:var(--reader-bg-page); color:var(--reader-accent-text); cursor:pointer; }
.reader-anchor-alias { position:absolute; inset:0 auto auto 0; width:0; height:0; overflow:hidden; }
@media(max-width:760px) { .branch-choices { flex-direction:column; } .branch-choice { flex:auto; width:100%; border-radius:12px; } .reader-branch { padding:12px; } }
</style>
