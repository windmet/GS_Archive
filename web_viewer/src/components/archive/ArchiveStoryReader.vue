<template>
  <section ref="readerRoot" class="story-reader" :aria-busy="busy" aria-labelledby="reading-heading">
    <header class="reader-top"><button @click="emit('back')"><ArrowLeft :size="18" />返回</button><span>剧情阅读</span></header>
    <div class="reader-body">
      <h1 id="reading-heading" ref="heading" tabindex="-1">{{ title }}</h1>
      <p class="reader-subtitle">{{ episodeLabel }}</p>
      <details class="reader-segments"><summary>选择其他分段</summary><label class="reader-picker">分段<select :value="documentId" :disabled="state.status === 'loading'" @change="emit('select', $event.target.value)">
        <option v-if="!state.entries.some(e => e.document_id === documentId)" :value="documentId">{{ state.status === 'loading' ? '正在载入分段…' : '当前分段尚未收录' }}</option>
        <option v-for="entry in state.entries" :key="entry.document_id" :value="entry.document_id">{{ [entry.title || '剧情标题待确认', entry.episode_label].filter(Boolean).join(' · ') }}{{ entry.status === 'ready' ? '' : '（暂不支持阅读）' }}</option>
      </select></label></details>
      <div class="reader-toolbar"><div class="reader-languages" role="group" aria-label="正文语言">
        <button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.label }}</button>
      </div>
        <button v-if="state.status === 'ready'" ref="searchToggle" :aria-expanded="searchOpen" aria-controls="reader-search" @click="toggleSearch">篇内查找</button>
      </div>
      <button v-if="state.status === 'ready'" class="reader-full-play" :disabled="busy" @click="emit('play-document')">{{ busy ? '正在准备演出…' : '播放完整剧情（实验）' }}</button>
      <p v-if="notice" ref="playbackNotice" tabindex="-1" class="reader-notice" role="alert">{{ notice }} <button class="reader-play" :disabled="busy" @click="emit('refresh')">重新载入正文</button></p>
      <p v-if="state.status === 'loading'" role="status">正在载入正文…</p>
      <div v-else-if="state.status === 'error'" class="reader-feedback" role="alert"><h2>正文暂时无法载入</h2><p>请重试，或选择其他分段。</p><button @click="emit('retry')">重试</button><details><summary>加载详情</summary><p>{{ state.error }}</p></details></div>
      <p v-else-if="state.status === 'not-generated'" role="status">这个分段尚未生成阅读正文，请选择已有分段。</p>
      <p v-else-if="state.status === 'empty'" role="status">这个分段没有可显示的正文。</p>
      <div v-else-if="state.status === 'unsupported'" class="reader-feedback" role="status"><h2>这个分段暂不支持完整阅读</h2><p>部分分支或贴图消息无法可靠还原，正文尚未开放。</p><details><summary>分支与来源说明</summary><ul><li v-for="(control, i) in state.document.controls" :key="i">选项：<span v-for="(option, j) in choiceRows(control)" :key="j">{{ option.source_text }}{{ j < choiceRows(control).length - 1 ? ' ／ ' : '' }}</span></li></ul><p>选项目标已保留，分支结束位置未确认。</p></details></div>
      <template v-else-if="state.status === 'ready'">
        <form v-if="searchOpen" id="reader-search" class="reader-search" role="search" aria-label="篇内查找" @submit.prevent="moveMatch(1)" @keydown.esc.prevent="closeSearch">
          <label>篇内查找<input ref="searchInput" v-model="searchQuery" type="search" placeholder="查找当前显示的正文或说话人" /></label>
          <div class="reader-search-actions">
            <span role="status">{{ searchQuery.trim() ? (searchMatches.length ? `${matchIndex >= 0 ? `${matchIndex + 1} / ` : ''}${searchMatches.length} 处匹配` : '未找到匹配内容') : '仅查找当前分段' }}</span>
            <button type="button" :disabled="!searchMatches.length" @click="moveMatch(-1)">上一处</button>
            <button type="submit" :disabled="!searchMatches.length">下一处</button>
            <button type="button" @click="closeSearch">关闭查找</button>
          </div>
        </form>
        <p v-if="missingAnchor" class="reader-notice" role="status">原定位行已不存在，现显示本篇正文。</p>
        <p v-if="mode !== 'original' && fallbackCount" class="reader-notice" role="status">{{ fallbackCount }} 处暂无可用译文，已显示原文。</p>
        <p v-if="mode !== 'original' && localization.diagnostics.value?.code === 'translation_invalid'" class="reader-notice" role="status">译文暂时无法载入，原文仍可阅读。</p>
        <article class="reader-transcript" aria-label="剧情正文">
          <section v-for="item in presentedRows" :key="item.row.anchor.row_id" :id="`reading-${item.row.anchor.row_id}`" tabindex="-1" class="reader-row" :class="[`kind-${item.row.kind}`, { selected: anchor === item.row.anchor.row_id, 'search-match': searchMatchIds.has(item.row.anchor.row_id) }]">
            <img v-if="item.avatar" class="reader-avatar" :src="getCharaIconUrl(item.avatar)" alt="" loading="lazy" @error="$event.target.hidden = true" />
            <p v-if="item.view.speaker.display" class="reader-speaker">{{ item.view.speaker.display }}</p>
            <span v-if="item.row.kind === 'choice'" class="reader-kind">选项</span>
            <span v-if="item.row.kind === 'choice_detail'" class="reader-kind">选项附文</span>
            <p class="reader-primary" :lang="item.view.primary.locale">{{ item.view.primary.text }}</p>
            <p v-if="item.view.secondary" class="reader-secondary" :lang="item.view.secondary.locale">{{ item.view.secondary.text }}</p>
            <span v-if="mode !== 'original' && item.view.translation.stale" class="reader-kind">译文待更新</span>
          </section>
        </article>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import { createStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { readingAvatarEntity, readingPresentationSpeaker } from '../../../shared/reading/ReadingDocument.js'
import { getCharaIconUrl } from '../../utils/AssetResolver.js'

const props = defineProps({ state: { type: Object, required: true }, documentId: String, mode: String, anchor: String, notice: String, busy: Boolean })
const emit = defineEmits(['select', 'mode', 'back', 'retry', 'play-document', 'refresh', 'locate'])
const searchQuery = ref('')
const searchOpen = ref(false)
const searchInput = ref(null)
const searchToggle = ref(null)
async function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  await nextTick()
  searchToggle.value?.focus()
}
async function toggleSearch() {
  if (searchOpen.value) return closeSearch()
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}
const heading = ref(null)
const readerRoot = ref(null)
const playbackNotice = ref(null)
const modes = [{ id: 'original', label: '原文' }, { id: 'translation', label: '译文' }, { id: 'bilingual', label: '双语' }]
const document = computed(() => props.state.document)
// The localization context consumes text identities only, never compiled media.
const localizationInput = computed(() => document.value ? ({
  scenario_id: document.value.scenario_id, text_catalog_id: document.value.text_catalog_id,
  steps: document.value.rows.map(row => ({ dialogue: { speaker_identity: {
    kind: row.speaker.kind, entity_type: row.speaker.entityType, entity_id: row.speaker.entityId,
    source_name: row.speaker.sourceName,
  } } })),
}) : null)
const preferences = computed(() => ({ story_content_mode: props.mode, story_translation_locale: 'zh-CN', bilingual_primary: 'original' }))
const localization = createStoryLocalization({ compiledData: localizationInput, storyPreferences: preferences })
const title = computed(() => document.value?.presentation?.title || document.value?.rows.find(r => r.kind === 'title')?.source_text || '剧情阅读')
const episodeLabel = computed(() => document.value?.presentation?.episode_label || '')
const presentedRows = computed(() => (document.value?.rows || []).map(row => ({ row,
  avatar: readingAvatarEntity(row), view: localization.resolveUnit({ source: row.source_text,
    textRef: row.text_ref, speaker: readingPresentationSpeaker(row), inlineEntry: row.inline_translation }),
})))
const fallbackCount = computed(() => presentedRows.value.filter(item => item.view.translation.fallbackUsed).length)
const searchText = text => String(text || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
const searchMatches = computed(() => {
  const query = searchText(searchQuery.value)
  if (!query || props.state.status !== 'ready') return []
  return presentedRows.value.filter(item => [item.view.primary.text, item.view.secondary?.text, item.view.speaker.display]
    .some(text => searchText(text).includes(query)))
})
const searchMatchIds = computed(() => new Set(searchMatches.value.map(item => item.row.anchor.row_id)))
const matchIndex = computed(() => searchMatches.value.findIndex(item => item.row.anchor.row_id === props.anchor))
function moveMatch(direction) {
  const count = searchMatches.value.length
  if (!count) return
  const index = matchIndex.value < 0 ? (direction > 0 ? 0 : count - 1) : (matchIndex.value + direction + count) % count
  emit('locate', searchMatches.value[index].row.anchor.row_id)
}
watch(() => props.documentId, () => { searchQuery.value = ''; searchOpen.value = false })
const missingAnchor = computed(() => props.anchor && !document.value?.rows.some(r => r.anchor.row_id === props.anchor))
const choiceRows = control => document.value.rows.filter(r => r.kind === 'choice' && r.anchor.step_index === control.step_index)
watch(() => [props.state.status, props.documentId, props.anchor, props.notice], async () => {
  await nextTick()
  if (props.notice && playbackNotice.value) {
    playbackNotice.value.focus({ preventScroll: true })
    playbackNotice.value.scrollIntoView({ block: 'start' })
    return
  }
  if (props.state.status !== 'ready') return
  const target = props.anchor && globalThis.document.getElementById(`reading-${props.anchor}`)
  if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' }) }
  else { readerRoot.value?.scrollTo({ top: 0 }); heading.value?.focus({ preventScroll: true }) }
}, { immediate: true })
</script>

<style scoped>
.reader-search { margin: 20px 0; padding: 16px; background: #fff; border: 1px solid #cbd8df; border-radius: 12px; }
.reader-search label { display: flex; align-items: center; gap: 12px; font-size: 14px; white-space: nowrap; }
.reader-search input { min-width: 0; width: 100%; min-height: 44px; padding: 8px; font: inherit; border: 1px solid #becdd5; border-radius: 6px; }
.reader-search-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 13px; }
.reader-search-actions span { margin-right: auto; }
.reader-search-actions button:disabled { opacity: .45; cursor: default; }
.reader-row.search-match { background: #f0faf8; border-radius: 4px; }
.reader-notice[role="alert"] { scroll-margin-top: 20px; padding: 12px; border: 1px solid #d3dfe4; border-radius: 8px; outline: none; }
.reader-play { min-height: 44px; padding: 8px 12px; margin-top: 8px; border: 1px solid #cddde4; border-radius: 8px; background: #f5f9fb; color: #315a6b; font: inherit; font-size: 13px; cursor: pointer; }
.reader-play:disabled { opacity: .5; cursor: wait; }
.reader-play:focus-visible { outline: 2px solid #168f98; outline-offset: 3px; }
.story-reader { height: 100%; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #cbd8df transparent; background: #f3f7f7; color: #183846; font-family: Inter, "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif; }
.reader-top { height: 64px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #d7e1e6; position: relative; font-size: 17px; font-weight: 700; }
.reader-top button { position: absolute; left: 20px; display: flex; align-items: center; gap: 6px; }
button, select { font: inherit; font-size: 15px; color: inherit; cursor: pointer; }
button { min-height: 44px; border: 0; background: none; color: #16838d; }
button:focus-visible, select:focus-visible { outline: 3px solid #168f98; outline-offset: 3px; }
.reader-body { max-width: 1000px; margin: 0 auto; padding: 28px 24px 60px; }
h1 { margin: 0; font-size: 26px; line-height: 1.5; letter-spacing: -.5px; outline: none; }
.reader-subtitle { font-size: 14px; color: #6e808a; margin: 4px 0 22px; }
.reader-picker { display: flex; align-items: center; gap: 22px; white-space: nowrap; font-size: 15px; font-weight: 600; }
.reader-picker select { min-height: 44px; width: min(100%, 310px); min-width: 0; border: 1px solid #becdd5; border-radius: 6px; padding: 10px; background: #fff; font-weight: 400; }
.reader-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 18px 0 10px; }
.reader-languages { min-width: 210px; display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; border-radius: 6px; overflow: hidden; background: #edf1f4; }
.reader-languages button { font-size: 15px; border-right: 1px solid white; color: #183846; }
.reader-languages button[aria-pressed="true"] { background: #168f98; color: #fff; font-weight: 700; }
.reader-transcript { margin-top: 32px; }
.reader-segments { font-size: 14px; color: #60727e; }
.reader-segments summary { cursor: pointer; padding: 10px 0; }
.reader-full-play { padding: 10px 20px; border-radius: 8px; background: #16838d; color: white; }
.reader-full-play:disabled { opacity: .5; cursor: wait; }
.reader-row { position: relative; margin: 14px 0; padding: 24px 32px; background: #fff; border: 1px solid #e1eaea; border-radius: 12px; scroll-margin-top: 20px; outline: none; }
.reader-row.selected { border-color: #168f98; box-shadow: inset 3px 0 #168f98; }
.reader-primary, .reader-secondary { max-width: 42em; margin: 5px 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 17px; line-height: 1.9; }
.reader-secondary { color: #657986; font-size: 16px; }
.reader-speaker { color: #167e89; font-size: 15px; font-weight: 700; margin: 0 0 4px; }
.kind-title .reader-primary { font-weight: 700; font-size: 21px; line-height: 1.6; }
.kind-caption, .kind-narration, .kind-synopsis { background: #edf3f3; padding: 24px 32px; border-block: 1px solid #e3e9ed; color: #607a88; }
.kind-choice, .kind-choice_detail { border-left: 2px solid #9acbd0; padding-left: 32px; }
.reader-kind { font-size: 12px; color: #607a88; }
.reader-avatar { width: 36px; height: 36px; border-radius: 50%; float: left; margin: 0 12px 4px 0; object-fit: cover; }
.reader-notice, .reader-feedback { font-size: 14px; line-height: 1.8; color: #60727e; }
.reader-feedback h2 { font-size: 18px; color: #183846; }
.reader-feedback details { margin-top: 18px; overflow-wrap: anywhere; }
.reader-feedback summary { cursor: pointer; }
@media (max-width: 760px) { .reader-row { padding: 20px 18px; } .reader-search { padding: 12px; } .reader-search label { display: block; white-space: normal; } .reader-search input { box-sizing: border-box; margin-top: 8px; } .reader-languages { flex: 1; } .reader-body { padding: 24px 20px 40px; } h1 { font-size: 24px; } .reader-primary { font-size: 16px; } .reader-secondary { font-size: 15px; } .kind-title .reader-primary { font-size: 19px; } }
</style>
