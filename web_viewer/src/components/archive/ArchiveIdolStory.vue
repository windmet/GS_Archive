<template>
  <article v-if="story" class="idol-story" :style="{ '--idol-accent': story.color }">
    <header class="story-header">
      <div class="idol-identity">
        <img :src="idolIcon(story.idol_code)" :alt="story.idol_name" />
        <div>
          <span>IDOL EPISODE</span>
          <h2>{{ story.idol_name }}</h2>
          <p>{{ story.unitName || '315 Production' }}</p>
        </div>
      </div>
      <div class="idol-controls">
        <button title="上一位偶像" @click="moveIdol(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span>偶像</span>
          <select :value="story.idol_code" @change="emit('select-idol', $event.target.value)">
            <option v-for="entry in idols" :key="entry.idolCode" :value="entry.idolCode">
              {{ entry.idolName }} · {{ entry.sectionCount }} 话
            </option>
          </select>
        </label>
        <button title="下一位偶像" @click="moveIdol(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <div class="story-summary">
      <div><strong>{{ story.sectionCount }}</strong><span>正式话目</span></div>
      <div><strong>{{ story.episodeCount }}</strong><span>剧情分段</span></div>
      <div><strong>{{ story.playableEpisodeCount }}</strong><span>可播放</span></div>
      <div><strong>{{ story.communicationCount }}</strong><span>解锁后通信</span></div>
    </div>

    <div class="section-list">
      <section v-for="(section, sectionIndex) in story.sections" :key="section.id" class="story-section">
        <div class="section-visual">
          <img :src="backgroundUrl(section.background_resource_id)" :alt="section.scenario_title" />
          <span>{{ String(sectionIndex + 1).padStart(2, '0') }}</span>
        </div>
        <div class="section-content">
          <header>
            <div>
              <small>{{ section.name }} · {{ releaseDate(section.open_at) }}</small>
              <h3>{{ section.scenario_title }}</h3>
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

          <p v-if="section.synopsis?.text" class="synopsis">{{ section.synopsis.text }}</p>

          <div class="section-meta">
            <span>{{ section.episodes.length }} 段</span>
            <span>{{ section.dialogueCount }} 对话</span>
            <span>{{ section.voiceCount }} 语音</span>
            <span v-if="section.products[0]">奖励 {{ section.products[0].amount }}</span>
          </div>

          <div class="episode-list">
            <button
              v-for="(episode, episodeIndex) in section.episodes"
              :key="episode.id"
              :disabled="!episode.exists"
              @click="emit('play-episode', { section, episode })"
            >
              <span class="episode-index">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
              <span class="episode-copy">
                <strong>{{ episode.name }}</strong>
                <small>{{ episode.dialogueCount }} dialogues · {{ episode.voiceCount }} voices</small>
              </span>
              <Play v-if="episode.exists" :size="15" fill="currentColor" />
              <FileWarning v-else :size="15" />
            </button>
          </div>

          <div v-if="section.communications.length" class="communication-strip">
            <span class="communication-icon"><PhoneCall :size="18" /></span>
            <div>
              <small>AFTER STORY</small>
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
  </article>
</template>

<script setup>
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FileWarning, PhoneCall, Play } from '@lucide/vue'
import { formatArchiveDate } from '../../data/idolCommunicationSelectors.js'

const props = defineProps({
  story: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  externalResources: { type: Array, default: () => [] },
})
const emit = defineEmits(['select-idol', 'play-section', 'play-episode', 'open-communication'])

function moveIdol(delta) {
  const index = props.idols.findIndex(entry => entry.idolCode === props.story?.idol_code)
  if (index < 0 || !props.idols.length) return
  emit('select-idol', props.idols[(index + delta + props.idols.length) % props.idols.length].idolCode)
}
function idolIcon(code) { return `/assets/idols/icons/image_chara_icon_${code}.png` }
function backgroundUrl(id) { return id ? `/assets/bg/${id}.png` : '/assets/stories/story_background.png' }
function releaseDate(value) { return formatArchiveDate(value) || '开放日未记录' }
function finalEpisodeName(section) {
  const target = section.communications[0]?.release_condition?.param_a
  return section.episodes.find(episode => Number(episode.id) === Number(target))?.name || '最终分段'
}
function externalResourcesForSection(sectionId) {
  return props.externalResources
    .filter(entry => Number(entry.sectionId) === Number(sectionId))
    .map(entry => entry.resource)
}
</script>

<style scoped>
.idol-story { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f4f6f7; color: #26343c; }
.story-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px max(24px, calc((100% - 1100px) / 2)); border-bottom: 1px solid #dce3e5; background: #fff; }
.idol-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }.idol-identity img { width: 68px; height: 68px; border: 3px solid var(--idol-accent); border-radius: 50%; object-fit: cover; }.idol-identity span { color: var(--idol-accent); font-size: .58rem; font-weight: 800; }.idol-identity h2 { margin: 3px 0; font-size: 1.35rem; }.idol-identity p { margin: 0; color: #748188; font-size: .64rem; }
.idol-controls { display: flex; align-items: end; gap: 6px; }.idol-controls > button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #d5dde0; border-radius: 5px; background: #fff; color: #4e5e65; cursor: pointer; }.idol-controls label { display: flex; flex-direction: column; gap: 4px; }.idol-controls label span { color: #7b888e; font-size: .56rem; }.idol-controls select { min-width: 250px; height: 34px; padding: 0 30px 0 10px; border: 1px solid #d5dde0; border-radius: 5px; background: #fff; color: #28363d; font: inherit; font-size: .67rem; }
.story-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: 1100px; margin: 18px auto 0; border: 1px solid #dce3e5; border-radius: 6px; background: #fff; }.story-summary div { display: flex; flex-direction: column; gap: 2px; padding: 12px 15px; border-right: 1px solid #e4e9eb; }.story-summary div:last-child { border-right: 0; }.story-summary strong { font-size: .9rem; }.story-summary span { color: #7b888e; font-size: .56rem; }
.section-list { max-width: 1100px; margin: 18px auto 40px; border-top: 1px solid #dbe2e4; }.story-section { display: grid; grid-template-columns: 230px minmax(0, 1fr); border-right: 1px solid #dbe2e4; border-bottom: 1px solid #dbe2e4; border-left: 1px solid #dbe2e4; background: #fff; }.section-visual { position: relative; min-height: 260px; overflow: hidden; background: #dfe5e7; }.section-visual img { width: 100%; height: 100%; object-fit: cover; }.section-visual > span { position: absolute; top: 14px; left: 14px; display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid rgba(255,255,255,.78); border-radius: 50%; background: rgba(24,36,42,.78); color: #fff; font-size: .7rem; font-weight: 800; }
.section-content { min-width: 0; padding: 18px 20px 20px; }.section-content > header { display: flex; align-items: start; justify-content: space-between; gap: 18px; }.section-content header small { color: var(--idol-accent); font-size: .57rem; font-weight: 700; }.section-content h3 { margin: 4px 0 0; font-size: 1rem; }.play-section { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 11px; border: 1px solid var(--idol-accent); border-radius: 5px; background: var(--idol-accent); color: #fff; cursor: pointer; font: inherit; font-size: .62rem; }.play-section:disabled { border-color: #d0d8db; background: #e3e8ea; color: #7f8b91; cursor: not-allowed; }
.section-external-resources { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.section-external-resources a { display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--idol-accent) 35%, #dfe6e8); border-radius: 5px; background: #f4faf9; color: var(--idol-accent); text-decoration: none; }.section-external-resources a:hover { background: #eaf7f5; }.section-external-resources span { display: flex; flex-direction: column; gap: 1px; }.section-external-resources strong { font-size: .59rem; }.section-external-resources small { color: #718187; font-size: .49rem; }
.synopsis { max-width: 760px; margin: 12px 0 0; color: #52636b; font-size: .65rem; line-height: 1.75; white-space: pre-line; }.section-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; color: #839096; font-size: .55rem; }
.episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 15px; background: #dfe5e7; }.episode-list button { display: grid; grid-template-columns: 30px minmax(0, 1fr) 18px; align-items: center; gap: 8px; min-height: 55px; padding: 8px 10px; border: 0; background: #fff; color: #2c3c44; cursor: pointer; font: inherit; text-align: left; }.episode-list button:hover:not(:disabled) { background: #edf8f7; }.episode-list button:disabled { background: #f4f6f7; color: #909ba0; cursor: not-allowed; }.episode-index { color: var(--idol-accent); font-size: .58rem; font-weight: 800; }.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.episode-copy strong { font-size: .65rem; }.episode-copy small { color: #859299; font-size: .51rem; }.episode-list svg { color: var(--idol-accent); }
.communication-strip { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 11px; margin-top: 15px; padding: 11px 12px; border-top: 1px solid #dfe6e8; border-bottom: 1px solid #dfe6e8; background: #f4faf9; }.communication-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--idol-accent); color: #fff; }.communication-strip > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }.communication-strip small { color: var(--idol-accent); font-size: .5rem; font-weight: 800; }.communication-strip strong { font-size: .67rem; }.communication-strip div span { color: #7c898f; font-size: .52rem; }.communication-strip > button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--idol-accent); cursor: pointer; font: inherit; font-size: .61rem; font-weight: 700; }
@media (max-width: 760px) { .story-header { align-items: start; flex-direction: column; padding: 14px 12px; }.idol-identity img { width: 56px; height: 56px; }.idol-controls { width: 100%; }.idol-controls label { flex: 1; }.idol-controls select { width: 100%; min-width: 0; }.story-summary { margin: 10px 12px 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }.story-summary div:nth-child(2) { border-right: 0; }.story-summary div:nth-child(-n+2) { border-bottom: 1px solid #e4e9eb; }.section-list { margin: 12px 10px 28px; }.story-section { grid-template-columns: 1fr; }.section-visual { min-height: 150px; max-height: 210px; }.section-content { padding: 14px 12px 16px; }.section-content > header { align-items: start; flex-direction: column; }.play-section { width: 100%; justify-content: center; }.episode-list { grid-template-columns: 1fr; }.communication-strip { grid-template-columns: 36px minmax(0, 1fr); }.communication-strip > button { grid-column: 1 / -1; justify-content: flex-end; } }
</style>
