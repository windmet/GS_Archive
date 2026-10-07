<template>
  <article v-if="story" class="idol-story" data-archive-scroll-container :style="{ '--idol-accent': story.color }">
    <header class="story-header">
      <div class="idol-identity">
        <ArchiveIdolAvatar :idol-code="story.idol_code" :size="64" :ring-width="3" :accent-color="story.color" decorative />
        <div>
          <h2>{{ story.idol_name }}</h2>
          <p>{{ story.unitName || '315 Production' }}</p>
        </div>
      </div>
      <div class="idol-controls">
        <button type="button" aria-label="上一位偶像" title="上一位偶像" @click="moveIdol(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span>偶像</span>
          <select :value="story.idol_code" @change="emit('select-idol', $event.target.value)">
            <option v-for="entry in idols" :key="entry.idolCode" :value="entry.idolCode">
              {{ entry.idolName }} · {{ entry.sectionCount }} 话
            </option>
          </select>
        </label>
        <button type="button" aria-label="下一位偶像" title="下一位偶像" @click="moveIdol(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <div class="section-list">
      <section
        v-for="(section, sectionIndex) in story.sections"
        :key="section.id"
        :ref="element => setSectionElement(element, section.id)"
        class="story-section"
        :class="{ focused: Number(section.id) === Number(focusedSectionId) }"
        :data-section-id="section.id"
      >
        <div class="section-visual">
          <img :src="backgroundUrl(section.background_resource_id)" alt="" loading="lazy" decoding="async" />
          <span aria-hidden="true">{{ String(sectionIndex + 1).padStart(2, '0') }}</span>
        </div>
        <div class="section-content">
          <header>
            <div>
              <small>{{ chapterLabel(section.name) }} · {{ releaseDate(section.open_at) }}</small>
              <h3>{{ presentProducerAddressingText(section.scenario_title) }}</h3>
              <div class="section-badges">
                <span v-if="sectionBirthdayAligned(section)">生日同期公开</span>
                <span v-if="section.sharedBirthdayEntries?.length" class="shared">也可从生日内容访问</span>
              </div>
            </div>
            <button
              class="play-section"
              :disabled="!section.playableEpisodeCount"
              title="连续播放本话"
              @click="emit('play-section', section)"
            >
              <Play :size="17" fill="currentColor" />
              <span>连续播放</span>
            </button>
          </header>

          <div v-if="externalResourcesForSection(section.id).length" class="section-external-resources">
            <a
              v-for="resource in externalResourcesForSection(section.id)"
              :key="resource.external_id"
              :href="resource.platform.canonical_url"
              target="_blank"
              rel="noopener noreferrer external"
            >
              <ExternalLink :size="16" />
              <span><strong>社区中文资源</strong><small>{{ resource.uploader.name }} · Bilibili</small></span>
            </a>
          </div>

          <p v-if="section.synopsis?.text" class="synopsis">{{ presentProducerAddressingText(section.synopsis.text) }}</p>

          <div class="section-meta">
            <span>{{ section.episodes.length }} 段</span>
            <span>{{ section.dialogueCount }} 对话</span>
            <span>{{ section.voiceCount }} 语音</span>
            <span v-if="section.products[0]">奖励 {{ section.products[0].amount }}</span>
          </div>

          <div class="episode-list">
            <div v-for="(episode, episodeIndex) in section.episodes" :key="episode.id" class="episode-entry">
            <button
              :disabled="!episode.exists"
              :class="{ focused: Number(episode.id) === Number(focusedEpisodeId) }"
              :data-episode-id="episode.id"
              @click="emit('play-episode', { section, episode })"
            >
              <span class="episode-index">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
              <span class="episode-copy">
                <strong>{{ presentIdolEpisodeLabel({ sourceName: episode.name }) }}</strong>
                <small>{{ episode.dialogueCount }} 段对白 · {{ episode.voiceCount }} 段语音</small>
              </span>
              <Play v-if="episode.exists" :size="15" fill="currentColor" />
              <FileWarning v-else :size="15" />
            </button>
            <button v-if="readingEntry(episode)" class="episode-read" :aria-label="`阅读 ${presentIdolEpisodeLabel({ sourceName: episode.name })}`" @click="emit('read-episode', { section, episode })">阅读</button>
            </div>
          </div>

          <div v-if="section.communications.length" class="communication-strip">
            <span class="communication-icon"><PhoneCall :size="18" /></span>
            <div>
              <small>后日谈</small>
              <strong>{{ section.communications[0].title }}</strong>
              <span>完成 {{ finalEpisodeName(section) }} 后开放</span>
            </div>
            <button @click="emit('open-communication', section.communications[0])">
              查看通信 <ArrowRight :size="15" />
            </button>
          </div>
        </div>
      </section>
    </div>
    <details class="story-extra"><summary>收录概况与生日内容</summary>
    <aside class="story-boundary">
      <Cake :size="19" />
      <div>
        <strong>个人故事 · 生日同期公开</strong>
        <p>个人故事按章节收录；独立的生日问候可前往生日档案查看。</p>
      </div>
      <button v-if="story.birthdayArchive?.entryCount" @click="emit('open-birthday')">
        查看生日档案 <ArrowRight :size="15" />
      </button>
    </aside>

    <div class="story-summary">
      <div><strong>{{ story.sectionCount }}</strong><span>章节</span></div>
      <div><strong>{{ story.episodeCount }}</strong><span>剧情分段</span></div>
      <div><strong>{{ story.playableEpisodeCount }}</strong><span>可播放</span></div>
      <div><strong>{{ story.communicationCount }}</strong><span>解锁后通信</span></div>
    </div>

    </details>
  </article>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { ArrowRight, Cake, ChevronLeft, ChevronRight, ExternalLink, FileWarning, PhoneCall, Play } from '@lucide/vue'
import { readyEpisodeReading } from '../../data/IdolStoryReading.js'
import { formatArchiveDate } from '../../data/idolCommunicationSelectors.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { chapterLabel } from '../../presentation/chapterLabel.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

const props = defineProps({
  story: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  readingEntries: { type: Array, default: () => [] },
  externalResources: { type: Array, default: () => [] },
  focusedSectionId: { type: [String, Number], default: '' },
  focusedEpisodeId: { type: [String, Number], default: '' },
})
const emit = defineEmits(['read-episode', 'select-idol', 'play-section', 'play-episode', 'open-communication', 'open-birthday'])
const focusedSectionElement = ref(null)
const readingEntry = episode => readyEpisodeReading(props.readingEntries, episode)

function setSectionElement(element, sectionId) {
  if (Number(sectionId) === Number(props.focusedSectionId)) focusedSectionElement.value = element
}
function revealFocusedSection() {
  nextTick(() => focusedSectionElement.value?.scrollIntoView({ block: 'start' }))
}
onMounted(revealFocusedSection)
watch(() => props.focusedSectionId, revealFocusedSection)

function moveIdol(delta) {
  const index = props.idols.findIndex(entry => entry.idolCode === props.story?.idol_code)
  if (index < 0 || !props.idols.length) return
  emit('select-idol', props.idols[(index + delta + props.idols.length) % props.idols.length].idolCode)
}
function backgroundUrl(id) { return id ? `/assets/bg/${id}.png` : '/assets/stories/story_background.png' }
function releaseDate(value) { return formatArchiveDate(value) || '开放日未记录' }
function sectionBirthdayAligned(section) {
  const match = String(props.story?.birthday || '').match(/(\d{1,2})月(\d{1,2})日/)
  if (!match || Number(section?.open_at || 0) < 946684800) return false
  const date = new Date(Number(section.open_at) * 1000)
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo',
  }).formatToParts(date)
  const month = Number(parts.find(part => part.type === 'month')?.value || 0)
  const day = Number(parts.find(part => part.type === 'day')?.value || 0)
  return month === Number(match[1]) && day === Number(match[2])
}
function finalEpisodeName(section) {
  const target = section.communications[0]?.release_condition?.param_a
  const sourceName = section.episodes.find(episode => Number(episode.id) === Number(target))?.name
  return sourceName ? presentIdolEpisodeLabel({ sourceName }) : '最终分段'
}
function externalResourcesForSection(sectionId) {
  return props.externalResources
    .filter(entry => Number(entry.sectionId) === Number(sectionId))
    .map(entry => entry.resource)
}
</script>

<style scoped>
/* Personal stories on paper: the idol's accent marks chapters and actions; everything else uses the shared tokens. */
.idol-story { --story-accent: var(--idol-accent, var(--gs-mint)); display: grid; align-content: start; gap: var(--gs-space-6); height: 100%; padding: var(--gs-space-8); overflow-x: hidden; overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink); }
.idol-story > * { width: 100%; max-width: var(--gs-content-width); margin-inline: auto; box-sizing: border-box; }
.story-header { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-6); padding-bottom: var(--gs-space-5); border-bottom: 1px solid var(--gs-line); }
.idol-identity { display: flex; align-items: center; gap: var(--gs-space-4); min-width: 0; }
.idol-identity h2 { margin: 0 0 var(--gs-space-1); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); }
.idol-identity p { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-controls { display: flex; align-items: end; gap: var(--gs-space-2); }
.idol-controls > button { display: grid; place-items: center; width: var(--gs-control-normal); height: var(--gs-control-normal); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); cursor: pointer; }
.idol-controls label { display: flex; flex-direction: column; gap: var(--gs-space-1); }
.idol-controls label span { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.idol-controls select { min-width: 250px; height: var(--gs-control-normal); padding: 0 30px 0 10px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-meta); }
.section-list { display: grid; gap: var(--gs-space-5); }
.story-section { display: grid; grid-template-columns: 230px minmax(0, 1fr); overflow: hidden; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); background: var(--gs-surface); }
.story-section.focused { box-shadow: inset 4px 0 var(--story-accent); }
.section-visual { position: relative; min-height: 260px; overflow: hidden; background: var(--gs-rule); }
.section-visual img { width: 100%; height: 100%; object-fit: cover; }
.section-visual > span { position: absolute; top: var(--gs-space-4); left: var(--gs-space-4); display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--gs-chrome) 82%, transparent); color: var(--gs-chrome-ink-active); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-heavy); }
.section-content { min-width: 0; padding: var(--gs-space-5) var(--gs-space-6) var(--gs-space-6); }
.section-content > header { display: flex; align-items: start; justify-content: space-between; gap: var(--gs-space-5); }
.section-content header small { color: var(--story-accent); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); }
.section-content h3 { margin: var(--gs-space-1) 0 0; font-size: var(--gs-text-subtitle); }
.play-section { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-play-bg); color: var(--gs-play-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); }
.play-section:disabled { background: var(--gs-rule); color: var(--gs-ink-3); cursor: not-allowed; }
.section-badges { display: flex; flex-wrap: wrap; gap: var(--gs-space-1); margin-top: var(--gs-space-2); }
.section-badges span { padding: 3px 6px; border-radius: var(--gs-radius-pill); background: color-mix(in srgb, var(--story-accent) 12%, var(--gs-surface)); color: var(--story-accent); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); }
.section-badges span.shared { background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.section-external-resources { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); margin-top: var(--gs-space-3); }
.section-external-resources a { display: inline-flex; align-items: center; gap: var(--gs-space-2); padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); text-decoration: none; }
.section-external-resources a:hover { background: var(--gs-mint-wash); }
.section-external-resources span { display: flex; flex-direction: column; gap: 1px; }
.section-external-resources strong { font-size: var(--gs-text-caption); }
.section-external-resources small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.synopsis { max-width: 70ch; margin: var(--gs-space-3) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.8; white-space: pre-line; }
.section-meta { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); margin-top: var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: var(--gs-space-4); border: 1px solid var(--gs-line); background: var(--gs-line); }
.episode-entry { display: grid; grid-template-columns: minmax(0, 1fr) auto; background: var(--gs-surface); }
.episode-list button { display: grid; grid-template-columns: 30px minmax(0, 1fr) 18px; align-items: center; gap: var(--gs-space-2); min-height: 55px; padding: var(--gs-space-2) var(--gs-space-3); border: 0; background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; font: inherit; text-align: left; }
.episode-list button:hover:not(:disabled), .episode-list button.focused { background: var(--gs-selected-bg); }
.episode-list button.focused { outline: 2px solid var(--story-accent); outline-offset: -2px; }
.episode-list button:disabled { background: var(--gs-paper); color: var(--gs-ink-3); cursor: not-allowed; }
.episode-list .episode-read { display: flex; justify-content: center; min-width: 54px; border-left: 1px solid var(--gs-line); color: var(--story-accent); font-weight: var(--gs-weight-semibold); }
.episode-index { color: var(--story-accent); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-heavy); }
.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.episode-copy strong { font-size: var(--gs-text-meta); }
.episode-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.episode-list svg { color: var(--story-accent); }
.communication-strip { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-3); margin-top: var(--gs-space-4); padding: var(--gs-space-3); border-radius: var(--gs-radius-control); background: var(--gs-mint-wash); }
.communication-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--story-accent); color: var(--gs-play-ink); }
.communication-strip > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.communication-strip small { color: var(--story-accent); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-heavy); }
.communication-strip strong { font-size: var(--gs-text-meta); }
.communication-strip div span { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.communication-strip > button { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-normal); border: 0; background: transparent; color: var(--gs-mint-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); }
.story-extra > summary { min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; box-sizing: border-box; cursor: pointer; color: var(--gs-ink-2); }
.story-boundary { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-3); padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); background: var(--gs-surface); color: var(--story-accent); }
.story-boundary > div { display: flex; flex-direction: column; gap: 3px; }
.story-boundary strong { color: var(--gs-ink); font-size: var(--gs-text-meta); }
.story-boundary p { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-caption); line-height: 1.6; }
.story-boundary button { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-mint-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); white-space: nowrap; }
.story-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); background: var(--gs-surface); }
.story-summary div { display: flex; flex-direction: column; gap: 2px; padding: var(--gs-space-3) var(--gs-space-4); border-right: 1px solid var(--gs-line); }
.story-summary div:last-child { border-right: 0; }
.story-summary strong { font-size: var(--gs-text-subtitle); }
.story-summary span { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
@media (max-width: 760px) {
  .idol-story { gap: var(--gs-space-4); padding: var(--gs-space-4) var(--gs-space-3); }
  .story-header { align-items: start; flex-direction: column; gap: var(--gs-space-4); }
  .idol-controls { width: 100%; }
  .idol-controls label { flex: 1; }
  .idol-controls select { width: 100%; min-width: 0; }
  .story-section { grid-template-columns: 1fr; }
  .section-visual { min-height: 150px; max-height: 210px; }
  .section-content { padding: var(--gs-space-4) var(--gs-space-3); }
  .section-content > header { align-items: start; flex-direction: column; }
  .play-section { width: 100%; justify-content: center; }
  .episode-list { grid-template-columns: 1fr; }
  .communication-strip { grid-template-columns: 36px minmax(0, 1fr); }
  .communication-strip > button { grid-column: 1 / -1; justify-content: flex-end; }
  .story-boundary { grid-template-columns: 22px minmax(0, 1fr); }
  .story-boundary button { grid-column: 1 / -1; justify-content: center; }
  .story-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .story-summary div:nth-child(2) { border-right: 0; }
  .story-summary div:nth-child(-n+2) { border-bottom: 1px solid var(--gs-line); }
}
</style>
