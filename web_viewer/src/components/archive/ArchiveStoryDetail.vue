<template>
  <article v-if="story" class="story-detail">
    <header class="story-identity" :class="`domain-${story.domain}`">
      <div class="identity-visual">
        <img v-if="visualUrl" :src="visualUrl" :alt="story.sectionLabel || story.title" />
        <div v-else class="visual-fallback"><BookOpen :size="38" /></div>
      </div>
      <div class="identity-copy">
        <span class="domain-label">{{ story.domainLabel }}</span>
        <p class="hierarchy">{{ hierarchyLabel }}</p>
        <h2>{{ story.title }}</h2>
        <dl>
          <div><dt>资源</dt><dd>{{ story.resourceId }}</dd></div>
          <div><dt>演出</dt><dd>{{ story.playableStepCount }} steps · {{ story.summary?.voice_count || 0 }} voices</dd></div>
          <div v-if="story.rowCount > 1"><dt>段落</dt><dd>{{ story.rowCount }} parts</dd></div>
          <div v-if="releaseDate"><dt>开放</dt><dd>{{ releaseDate }}</dd></div>
        </dl>
      </div>
    </header>

    <section class="synopsis-band" :class="{ empty: !story.preplaySynopsis }">
      <div class="section-label"><AlignLeft :size="16" /><span>故事简介</span></div>
      <div v-if="story.preplaySynopsis" class="synopsis-copy">
        <h3>{{ story.preplaySynopsis.title || story.title }}</h3>
        <p>{{ story.preplaySynopsis.text }}</p>
      </div>
      <p v-else class="missing-copy">原始资料中没有独立的播放前简介。</p>
      <div class="story-actions">
        <button :disabled="!story.exists" @click="emit('play', story)">
          <Play :size="18" fill="currentColor" />
          <span>{{ story.exists ? '开始播放' : '缺少剧情文件' }}</span>
        </button>
        <a
          v-for="resource in externalResources"
          :key="resource.external_id"
          :href="resource.platform.canonical_url"
          target="_blank"
          rel="noopener noreferrer external"
        >
          <ExternalLink :size="16" />
          <span><strong>社区中文资源</strong><small>{{ resource.uploader.name }} · Bilibili</small></span>
        </a>
        <small v-if="story.preplaySynopsis && story.exists">播放将从正式标题演出开始</small>
      </div>
    </section>

    <section v-if="story.titleCards?.length" class="detail-section">
      <div class="section-heading"><div><span>EPISODE</span><h3>正式播放入口</h3></div><strong>{{ story.titleCards.length }}</strong></div>
      <div class="episode-list">
        <div v-for="(card, index) in story.titleCards" :key="`${card.episode_index}-${index}`">
          <span>{{ card.label || `EP${index + 1}` }}</span>
          <strong>{{ card.title || story.title }}</strong>
        </div>
      </div>
    </section>

    <section v-if="characters.length" class="detail-section">
      <div class="section-heading"><div><span>CAST</span><h3>登场角色</h3></div><strong>{{ characters.length }}</strong></div>
      <div class="character-list">
        <button v-for="character in characters" :key="character" :disabled="!isIdol(character)" @click="emit('open-idol', character)">
          <img v-if="isIdol(character)" :src="`/assets/idols/icons/image_chara_icon_${character}.png`" :alt="idolName(character)" />
          <span v-else class="character-placeholder">{{ character.slice(0, 1).toUpperCase() }}</span>
          <strong>{{ idolName(character) }}</strong>
        </button>
      </div>
    </section>

    <section v-if="relatedStories.length" class="detail-section related-section">
      <div class="section-heading"><div><span>COLLECTION</span><h3>{{ collectionTitle }}</h3></div><strong>{{ relatedStories.length }}</strong></div>
      <div class="related-list">
        <button v-for="entry in relatedStories" :key="entry.id" :class="{ current: entry.id === story.id }" @click="emit('select', entry)">
          <span>{{ entry.episodeLabel || entry.domainLabel }}</span>
          <strong>{{ entry.title }}</strong>
          <ArrowRight :size="16" />
        </button>
      </div>
    </section>

    <section class="source-strip">
      <span>Raw masterdata + compiled scenario</span>
      <code>{{ story.file }}</code>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { AlignLeft, ArrowRight, BookOpen, ExternalLink, Play } from '@lucide/vue'

const props = defineProps({
  story: { type: Object, default: null }, related: { type: Array, default: () => [] },
  visualUrl: { type: String, default: '' }, idolName: { type: Function, required: true },
  externalResources: { type: Array, default: () => [] },
})
const emit = defineEmits(['play', 'select', 'open-idol'])
const hierarchyLabel = computed(() => [props.story?.sectionLabel, props.story?.episodeLabel].filter(Boolean).join(' · ') || props.story?.domainLabel || '')
const releaseDate = computed(() => props.story?.releaseAt >= 1577836800 ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(props.story.releaseAt * 1000)) : '')
const characters = computed(() => (props.story?.characters || []).filter(character => /^\d{3}[a-z0-9]{3}$/i.test(character)))
const relatedStories = computed(() => props.related.slice(0, 24))
const collectionTitle = computed(() => props.story?.sectionLabel ? `${props.story.sectionLabel}的故事` : '同类故事')
function isIdol(character) { return /^\d{3}[a-z0-9]{3}$/i.test(character) }
</script>

<style scoped>
.story-detail { height: 100%; overflow-y: auto; background: #f5f7f8; color: #26343c; }
.story-identity { display: grid; grid-template-columns: minmax(360px, 1.15fr) minmax(300px, .85fr); gap: 28px; padding: 26px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe5e7; background: #fff; }
.identity-visual { align-self: start; overflow: hidden; aspect-ratio: 2.63 / 1; border: 1px solid #dde3e5; border-radius: 6px; background: #edf1f2; }
.identity-visual img { display: block; width: 100%; height: 100%; object-fit: contain; }.visual-fallback { display: grid; place-items: center; width: 100%; height: 100%; background: url('/assets/stories/story_background.png') center/cover; color: #167f78; }
.identity-copy { min-width: 0; padding-top: 3px; }.domain-label { color: #168c84; font-size: .62rem; font-weight: 800; }.hierarchy { margin: 7px 0 0; color: #6d7b83; font-size: .68rem; }.identity-copy h2 { margin: 5px 0 18px; font-size: 1.3rem; line-height: 1.45; }
.identity-copy dl { margin: 0; }.identity-copy dl div { display: grid; grid-template-columns: 54px minmax(0,1fr); gap: 9px; padding: 7px 0; border-bottom: 1px solid #edf0f1; font-size: .65rem; }.identity-copy dt { color: #879299; }.identity-copy dd { margin: 0; overflow-wrap: anywhere; color: #3a4b53; }
.synopsis-band { position: relative; padding: 24px max(220px, calc((100% - 760px) / 2)) 26px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dce4e5; background: #eaf6f4; }.section-label { display: flex; align-items: center; gap: 6px; color: #147c75; font-size: .62rem; font-weight: 800; }.synopsis-copy h3 { margin: 11px 0 7px; font-size: .92rem; }.synopsis-copy p, .missing-copy { max-width: 760px; margin: 0; color: #405159; font-size: .72rem; line-height: 1.85; white-space: pre-line; }.missing-copy { margin-top: 10px; color: #758188; }
.story-actions { position: absolute; top: 50%; right: max(24px, calc((100% - 1120px) / 2)); display: grid; gap: 7px; min-width: 184px; transform: translateY(-50%); }.story-actions > button,.story-actions > a { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 13px; border: 1px solid #158f87; border-radius: 6px; background: #158f87; color: #fff; cursor: pointer; font: inherit; font-size: .7rem; text-decoration: none; }.story-actions > button:disabled { border-color: #cbd3d6; background: #dfe5e7; color: #78848a; cursor: not-allowed; }.story-actions > a { justify-content: flex-start; border-color: #bedbd8; background: #fff; color: #166f69; }.story-actions > a span { display: flex; flex-direction: column; gap: 2px; }.story-actions > a strong { font-size: .64rem; }.story-actions > a small { color: #63817e; font-size: .52rem; }.story-actions > small { color: #66817e; font-size: .54rem; text-align: center; }
.detail-section { padding: 22px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #e1e6e8; background: #fff; }.detail-section + .detail-section { margin-top: 10px; }.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }.section-heading span { color: #168a82; font-size: .57rem; font-weight: 800; }.section-heading h3 { margin: 3px 0 0; font-size: .84rem; }.section-heading > strong { color: #7f8c93; font-size: .62rem; }
.episode-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 1px; background: #e2e7e9; }.episode-list > div { display: flex; flex-direction: column; gap: 4px; min-height: 58px; padding: 11px 13px; background: #f9fafb; }.episode-list span { color: #16857e; font-size: .58rem; }.episode-list strong { font-size: .7rem; }
.character-list { display: flex; flex-wrap: wrap; gap: 7px; }.character-list button { display: flex; align-items: center; gap: 8px; min-width: 132px; height: 48px; padding: 5px 10px 5px 5px; border: 1px solid #e0e5e7; border-radius: 6px; background: #fff; color: #2c3a42; cursor: pointer; font: inherit; text-align: left; }.character-list button:disabled { cursor: default; }.character-list img, .character-placeholder { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }.character-placeholder { display: grid; place-items: center; background: #e7edef; color: #718088; }.character-list strong { font-size: .65rem; }
.related-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; }.related-list button { display: grid; grid-template-columns: 72px minmax(0,1fr) 16px; align-items: center; gap: 9px; min-height: 48px; padding: 8px 10px; border: 1px solid #e0e5e7; border-radius: 5px; background: #fff; color: #2b3941; cursor: pointer; font: inherit; text-align: left; }.related-list button.current { border-color: #70c2bc; background: #eff9f8; }.related-list span { color: #17857e; font-size: .57rem; }.related-list strong { overflow: hidden; font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }.related-list svg { color: #7f8d94; }
.source-strip { display: flex; justify-content: space-between; gap: 18px; margin-top: 10px; padding: 15px max(24px, calc((100% - 1120px) / 2)) 22px; color: #879198; font-size: .58rem; }.source-strip code { overflow-wrap: anywhere; text-align: right; }
@media (max-width: 760px) { .story-identity { grid-template-columns: 1fr; gap: 16px; padding: 15px 12px 18px; }.identity-copy h2 { font-size: 1.05rem; }.synopsis-band { padding: 19px 13px; }.story-actions { position: static; width: 100%; margin-top: 16px; transform: none; }.detail-section { padding: 18px 12px; }.episode-list, .related-list { grid-template-columns: 1fr; }.source-strip { flex-direction: column; padding: 13px 12px 18px; }.source-strip code { text-align: left; } }
</style>
