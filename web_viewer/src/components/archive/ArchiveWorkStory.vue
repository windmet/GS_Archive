<template>
  <section class="work-page story-page" data-archive-scroll-container :style="{ '--gs-idol': idol?.color || 'var(--gs-mint)' }">
    <header class="work-header story-head">
      <div class="idol-heading">
        <ArchiveIdolAvatar v-if="idol?.idol_code" :idol-code="idol.idol_code" :accent-color="idol.color" :size="56" :ring-width="3" :alt="name(idol)" />
        <div>
          <h2>{{ idol ? name(idol) : '工作剧情' }}</h2>
          <ul v-if="idol" class="story-footprint" aria-label="收录">
            <li>{{ archiveNamedText('work', idol.work_type_name, 'type') }}</li>
            <li><b>{{ idol.short_stories.length }}</b>段短剧情</li>
            <li><b>{{ idol.scene_lines.length }}</b>句场景台词</li>
            <li><b>{{ totalVoices }}</b>段语音</li>
          </ul>
        </div>
      </div>
      <div class="idol-controls">
        <button class="story-icon-action" title="上一位偶像" aria-label="上一位偶像" @click="moveIdol(-1)"><ChevronLeft :size="18" /></button>
        <select aria-label="偶像" :value="idol?.idol_code" @change="emit('select-idol', $event.target.value)">
          <option v-for="entry in idols" :key="entry.idol_code" :value="entry.idol_code">
            {{ name(entry) }} · {{ shortType(entry.work_type_name) }}
          </option>
        </select>
        <button class="story-icon-action" title="下一位偶像" aria-label="下一位偶像" @click="moveIdol(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <div v-if="idol" class="work-body story-section">
      <nav class="story-chips" aria-label="工作内容">
        <button :aria-pressed="activeMode === 'stories'" @click="emit('update:mode', 'stories')">工作短剧情 <small>{{ idol.short_stories.length }}</small></button>
        <button :aria-pressed="activeMode === 'lines'" @click="emit('update:mode', 'lines')">场景台词 <small>{{ idol.scene_lines.length }}</small></button>
      </nav>

      <ul v-if="activeMode === 'stories'" class="story-rows work-rows">
        <!-- The row reads the story when a text version exists; the icon plays it. -->
        <li v-for="story in idol.short_stories" :key="story.id" class="story-row work-row">
          <component :is="readingByFile.has(story.compiled_file) ? 'button' : 'div'" class="work-row-main"
            v-bind="readingByFile.has(story.compiled_file) ? { type: 'button', 'aria-label': `阅读 ${workTitle(story)}`, onClick: () => emit('read', story.compiled_file) } : {}">
          <span class="story-row-thumb"><img :src="backgroundUrl(story.background_resource_id)" :alt="locationLabel(story)" loading="lazy" decoding="async" /></span>
          <span class="story-row-copy">
            <strong>{{ workTitle(story) }}</strong>
            <p>{{ presentProducerAddressingText(story.dialogue_preview) }}</p>
            <small>{{ [locationLabel(story), `${story.dialogue_count} 段对白`, `${story.voice_count} 段语音`].filter(Boolean).join(' · ') }}</small>
          </span>
          </component>
          <span class="work-actions">
            <button class="story-icon-action" :disabled="!story.compiled_exists" :aria-label="`播放 ${workTitle(story)}`" title="播放工作短剧情" @click="emit('play', story.compiled_file)"><Play :size="17" fill="currentColor" /></button>
          </span>
        </li>
      </ul>

      <ul v-else class="story-rows work-rows">
        <li v-for="line in idol.scene_lines" :key="line.id" class="story-row work-row">
          <component :is="readingByFile.has(line.compiled_file) ? 'button' : 'div'" class="work-row-main"
            v-bind="readingByFile.has(line.compiled_file) ? { type: 'button', 'aria-label': `阅读 ${locationLabel(line) || '场景台词'}`, onClick: () => emit('read', line.compiled_file) } : {}">
          <span class="story-row-thumb"><img :src="backgroundUrl(line.background_resource_id)" :alt="locationLabel(line)" loading="lazy" decoding="async" /></span>
          <span class="story-row-copy">
            <strong>{{ presentProducerAddressingText(line.dialogue_preview) }}</strong>
            <small v-if="locationLabel(line)">{{ locationLabel(line) }}</small>
          </span>
          </component>
          <span class="work-actions">
            <button class="story-icon-action" :disabled="!line.compiled_exists" aria-label="播放场景台词" title="播放场景台词" @click="emit('play', line.compiled_file)"><Play :size="17" fill="currentColor" /></button>
          </span>
        </li>
      </ul>
      <ArchiveTechnicalDetails :key="idol.idol_code" :evidence="sourceEvidence ? { idol, sourceEvidence } : idol" />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { ChevronLeft, ChevronRight, Play } from '@lucide/vue'
import '../../styles/archive-story.css'

const props = defineProps({ idol: { type: Object, default: null }, idols: { type: Array, default: () => [] },
  sourceEvidence: { type: Object, default: null },
  readingEntries: { type: Array, default: () => [] }, initialFile: { type: String, default: '' },
  mode: { type: String, default: 'stories' },
  idolName: { type: Function, default: () => '' } })
const emit = defineEmits(['read', 'select-idol', 'play', 'update:mode'])
const readingByFile = computed(() => new Map(props.readingEntries.filter(entry => entry.status === 'ready').map(entry => [entry.source_file, entry])))
const activeMode = computed(() => (props.mode === 'lines' || props.idol?.scene_lines.some(line => line.compiled_file === props.initialFile))
  ? 'lines' : 'stories')
const totalVoices = computed(() => [...(props.idol?.short_stories || []), ...(props.idol?.scene_lines || [])].reduce((sum, item) => sum + (item.voice_count || 0), 0))

function name(entry) { return props.idolName(entry.idol_code) || entry.display_name }
function moveIdol(delta) {
  const index = props.idols.findIndex(entry => entry.idol_code === props.idol?.idol_code)
  if (index < 0 || !props.idols.length) return
  const next = props.idols[(index + delta + props.idols.length) % props.idols.length]
  emit('select-idol', next.idol_code)
}
// Work labels (type and short-story titles) come from the profile overlay; the picker shows the type alone.
void loadArchiveNames('profiles').catch(() => {})
function shortType(name = '') { return archiveNamedText('work', name, 'type').replace(/のお仕事$| 工作$/, '') }
function workTitle(story) { return presentProducerAddressingText(archiveNamedText('work', story.title, 'title')) }
function backgroundUrl(id) { return id ? `/assets/bg/${id}.png` : '' }
// An unnamed location simply goes unmentioned.
// Locations are background names, already translated with the photo/background overlay.
void loadArchiveNames('photos').catch(() => {})
function locationLabel(entry) { return entry.background_name ? archiveNamedText('background', entry.background_name) : '' }
</script>

<style scoped>
.work-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-5); }
.idol-heading { display: flex; align-items: center; gap: var(--gs-space-5); min-width: 0; }
.idol-heading h2 { font-size: var(--gs-text-section); }
.idol-controls { display: flex; align-items: center; gap: var(--gs-space-2); }
.idol-controls select { min-width: 220px; min-height: var(--gs-control-normal); padding: 0 30px 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.work-body { padding-top: 0; }
.work-rows { grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); }
.work-row { --thumb: 96px; display: flex; align-items: center; gap: var(--gs-space-3); cursor: default; }
.work-row-main { display: grid; flex: 1; grid-template-columns: var(--thumb) minmax(0, 1fr); align-items: center; gap: var(--gs-space-4); min-width: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; }
button.work-row-main { cursor: pointer; }
button.work-row-main:hover .story-row-copy strong { color: var(--gs-mint-ink); }
.work-row .story-row-thumb { aspect-ratio: 4 / 3; }
.work-actions { display: flex; align-items: center; gap: var(--gs-space-2); }

@container story-page (max-width: 560px) {
  .work-rows { grid-template-columns: 1fr; }
  .idol-controls { width: 100%; }
  .idol-controls select { flex: 1; min-width: 0; min-height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .work-row { --thumb: 64px; }
  .work-row-main { align-items: start; }
}
</style>
