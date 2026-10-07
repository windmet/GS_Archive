<template>
  <!-- Personal stories use the story-family programme layout: an idol head, then one row per
       chapter that opens to its art, synopsis, watch actions, episodes and the follow-up call. -->
  <article v-if="story" class="idol-story story-page" data-archive-scroll-container :style="{ '--idol-accent': story.color }">
    <header class="story-head idol-story-head">
      <ArchiveIdolAvatar :idol-code="story.idol_code" :size="72" :ring-width="3" :accent-color="story.color" decorative />
      <div class="idol-story-copy">
        <h2>{{ idolName(story.idol_code, story.idol_name) }}</h2>
        <ul class="story-footprint" aria-label="收录">
          <li><b>{{ story.sectionCount }}</b>话</li>
          <li><b>{{ story.episodeCount }}</b>段剧情</li>
          <li v-if="story.communicationCount"><b>{{ story.communicationCount }}</b>段后日谈通信</li>
          <li>{{ story.unitName || '315 Production' }}</li>
        </ul>
      </div>
      <div class="idol-switcher">
        <button type="button" class="story-icon-action" aria-label="上一位偶像" title="上一位偶像" @click="moveIdol(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span class="visually-hidden">偶像</span>
          <select :value="story.idol_code" aria-label="切换偶像" @change="emit('select-idol', $event.target.value)">
            <option v-for="entry in idols" :key="entry.idolCode" :value="entry.idolCode">
              {{ idolName(entry.idolCode, entry.idolName) }} · {{ entry.sectionCount }} 话
            </option>
          </select>
        </label>
        <button type="button" class="story-icon-action" aria-label="下一位偶像" title="下一位偶像" @click="moveIdol(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <section class="story-section chapter-section" aria-labelledby="idol-story-title">
      <div class="story-section-head">
        <h3 id="idol-story-title">个人故事</h3>
        <small>{{ story.sectionCount }} 话</small>
      </div>

      <ol class="chapter-list">
        <li
          v-for="(section, sectionIndex) in story.sections"
          :key="section.id"
          :ref="element => setSectionElement(element, section.id)"
          class="chapter-row"
          :class="{ expanded: isExpanded(section), unavailable: !section.playableEpisodeCount, focused: Number(section.id) === Number(focusedSectionId) }"
          :data-section-id="section.id"
        >
          <button type="button" class="chapter-toggle" :aria-expanded="isExpanded(section)" @click="toggleSection(section)">
            <span class="chapter-number">{{ String(sectionIndex + 1).padStart(2, '0') }}</span>
            <span class="chapter-identity">
              <small>{{ chapterLabel(section.name) }} · {{ releaseDate(section.open_at) }}<template v-if="sectionBirthdayAligned(section)"> · <em>生日同期公开</em></template></small>
              <strong>{{ presentProducerAddressingText(section.scenario_title) }}</strong>
            </span>
            <span class="chapter-stats">{{ section.episodes.length }} 段 · {{ section.voiceCount }} 段语音</span>
            <ChevronUp v-if="isExpanded(section)" :size="18" aria-hidden="true" />
            <ChevronDown v-else :size="18" aria-hidden="true" />
          </button>

          <div v-if="isExpanded(section)" class="chapter-panel">
            <div class="chapter-lead">
            <img class="chapter-art" :src="backgroundUrl(section.background_resource_id)" alt="" loading="lazy" decoding="async" />
            <div class="chapter-lead-copy">
            <p v-if="section.synopsis?.text" class="chapter-synopsis-text">{{ presentProducerAddressingText(section.synopsis.text) }}</p>
            <p v-if="section.sharedBirthdayEntries?.length" class="story-note">这一话也可以从生日档案进入。</p>

            <div class="chapter-actions" aria-label="本话观看方式">
              <button type="button" class="story-action primary" :disabled="!firstReading(section)" @click="readSection(section)"><BookOpen :size="16" />阅读本话</button>
              <button type="button" class="story-action" :disabled="!section.playableEpisodeCount" @click="emit('play-section', section)"><Play :size="15" fill="currentColor" />连播演出</button>
              <a
                v-for="resource in externalResourcesForSection(section.id)"
                :key="resource.external_id"
                class="story-action"
                :href="resource.platform.canonical_url"
                target="_blank"
                rel="noopener noreferrer external"
                :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
              >
                <ExternalLink :size="15" />社区中文 · {{ resource.uploader.name }}
              </a>
            </div>
            </div>
            </div>

            <ol class="episode-list">
              <li v-for="(episode, episodeIndex) in section.episodes" :key="episode.id" class="episode-entry" :class="{ focused: Number(episode.id) === Number(focusedEpisodeId) }">
                <button
                  v-if="readingEntry(episode)"
                  type="button"
                  class="episode-reading-main"
                  :data-episode-id="episode.id"
                  :aria-label="`阅读 ${presentIdolEpisodeLabel({ sourceName: episode.name })}`"
                  @click="emit('read-episode', { section, episode })"
                >
                  <span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
                  <span class="episode-copy"><strong>{{ presentIdolEpisodeLabel({ sourceName: episode.name }) }}</strong><small>{{ episode.dialogueCount }} 段对白 · {{ episode.voiceCount }} 段语音</small></span>
                </button>
                <div v-else class="episode-reading-main" :data-episode-id="episode.id">
                  <span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
                  <span class="episode-copy"><strong>{{ presentIdolEpisodeLabel({ sourceName: episode.name }) }}</strong><small>{{ episode.exists ? '暂无文字版，可观看演出' : '暂未收录' }}</small></span>
                </div>
                <button type="button" class="story-icon-action" :disabled="!episode.exists" :aria-label="`播放 ${presentIdolEpisodeLabel({ sourceName: episode.name })}`" :title="`播放 ${presentIdolEpisodeLabel({ sourceName: episode.name })}`" @click="emit('play-episode', { section, episode })">
                  <Play v-if="episode.exists" :size="17" fill="currentColor" /><FileWarning v-else :size="17" />
                </button>
              </li>
            </ol>

            <button v-if="section.communications.length" type="button" class="story-row follow-up-call" @click="emit('open-communication', section.communications[0])">
              <span class="follow-up-icon"><PhoneCall :size="18" /></span>
              <span class="story-row-copy">
                <strong>后日谈 · {{ section.communications[0].title }}</strong>
                <small>完成 {{ finalEpisodeName(section) }} 后开放的通信</small>
              </span>
              <ChevronRight :size="18" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ol>
    </section>

    <section v-if="story.birthdayArchive?.entryCount" class="story-section" aria-label="生日内容">
      <button type="button" class="story-row" @click="emit('open-birthday')">
        <span class="follow-up-icon"><Cake :size="18" /></span>
        <span class="story-row-copy">
          <strong>生日档案</strong>
          <small>独立的生日问候收在生日档案；与生日同期公开的个人故事留在这里。</small>
        </span>
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </section>
  </article>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { BookOpen, Cake, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, FileWarning, PhoneCall, Play } from '@lucide/vue'
import { readyEpisodeReading } from '../../data/IdolStoryReading.js'
import { formatArchiveDate } from '../../data/idolCommunicationSelectors.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { chapterLabel } from '../../presentation/chapterLabel.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import '../../styles/archive-story.css'

const props = defineProps({
  story: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  readingEntries: { type: Array, default: () => [] },
  externalResources: { type: Array, default: () => [] },
  focusedSectionId: { type: [String, Number], default: '' },
  focusedEpisodeId: { type: [String, Number], default: '' },
  // The reader's-language name (App's idolDisplayName); falls back to the source name.
  idolName: { type: Function, default: (_code, sourceName) => sourceName },
})
const emit = defineEmits(['read-episode', 'select-idol', 'play-section', 'play-episode', 'open-communication', 'open-birthday'])
const focusedSectionElement = ref(null)
const readingEntry = episode => readyEpisodeReading(props.readingEntries, episode)

// One chapter is open at a time: the focused one (arriving from a call or the player), else the first.
const expandedSectionId = ref('')
const openSectionId = () => String(props.focusedSectionId || props.story?.sections?.[0]?.id || '')
const isExpanded = section => String(section.id) === expandedSectionId.value
function toggleSection(section) { expandedSectionId.value = isExpanded(section) ? '' : String(section.id) }
watch(() => [props.story?.idol_code, props.focusedSectionId], () => { expandedSectionId.value = openSectionId() }, { immediate: true })

const firstReading = section => section.episodes.find(readingEntry)
function readSection(section) {
  const episode = firstReading(section)
  if (episode) emit('read-episode', { section, episode })
}

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
/* Rows, actions and footprint come from archive-story.css; only the idol head, the chapter art
   and the follow-up call are particular to this page. The idol accent marks the open chapter. */
.idol-story-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-6); }
.idol-story-copy { min-width: 0; }
.idol-story-copy h2 { overflow-wrap: anywhere; }
.idol-switcher { display: flex; align-items: center; gap: var(--gs-space-1); }
.idol-switcher select { min-width: 220px; height: var(--gs-control-normal); padding: 0 30px 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.chapter-row.expanded .chapter-number { color: var(--idol-accent, var(--gs-mint-ink)); }
.chapter-identity small em { color: var(--idol-accent, var(--gs-mint-ink)); font-style: normal; font-weight: var(--gs-weight-semibold); }
.chapter-row.focused { box-shadow: inset 3px 0 var(--idol-accent, var(--gs-mint)); }
/* Text and actions first; the chapter's background is a picture beside them, not a banner. */
.chapter-lead { display: grid; grid-template-columns: minmax(0, 1fr) 260px; align-items: start; gap: var(--gs-space-6); margin: var(--gs-space-1) 0 var(--gs-space-2); }
.chapter-lead-copy { grid-column: 1; grid-row: 1; min-width: 0; }
.chapter-art { grid-column: 2; grid-row: 1; display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-media); background: var(--gs-rule); }
/* The synopsis is a quotation on the paper: a 2px rule in the idol's colour, no tinted box. */
.chapter-synopsis-text { max-width: 46em; margin: 0 0 var(--gs-space-4); padding-left: var(--gs-space-5); border-left: 2px solid var(--idol-accent, var(--gs-mint)); color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.85; white-space: pre-line; }
.episode-entry.focused .episode-copy strong { color: var(--gs-mint-ink); }
button.episode-reading-main { border: 0; background: none; cursor: pointer; font: inherit; text-align: left; }
button.episode-reading-main:hover strong { color: var(--gs-mint-ink); }
.follow-up-call { --thumb: 40px; margin-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); }
.follow-up-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.story-section > .story-row { --thumb: 40px; border-top: 1px solid var(--gs-line); }
@container story-page (max-width: 760px) {
  .idol-story-head { grid-template-columns: auto minmax(0, 1fr); gap: var(--gs-space-4); }
  .idol-switcher { grid-column: 1 / -1; min-width: 0; }
  /* A select sizes to its longest option; let it shrink to the row instead. */
  .idol-switcher label { flex: 1 1 0; min-width: 0; }
  .idol-switcher select { width: 100%; min-width: 0; }
  .chapter-lead { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-4); }
  .chapter-art { grid-column: 1; grid-row: 1; max-height: 180px; }
  .chapter-lead-copy { grid-row: 2; }
}
</style>
