<template>
  <section class="screen list-screen">
    <ArchiveListHeader v-if="!embedded" :title="card?.title || card?.resource_id || 'Card'" @back="emit('back')" />
    <div v-if="card" class="card-detail">
      <section class="card-detail-head">
        <div class="card-art-comparison" :class="{ single: card.single_state }">
          <figure v-if="!card.single_state">
            <button
              v-if="assetStatus?.normal_portrait || assetStatus?.normal_icon"
              class="card-art-open"
              :disabled="!assetStatus?.normal_portrait"
              :title="assetStatus?.normal_portrait ? '查看普通卡面原图' : '只有缩略图资源'"
              @click="openLightbox(normalPortraitUrl)"
            >
              <img
                :src="assetStatus?.normal_portrait ? normalPortraitUrl : getCardIconUrl(card.resource_id, false)"
                :alt="`${card.title || card.resource_id} 普通`"
              />
              <Expand v-if="assetStatus?.normal_portrait" :size="17" />
            </button>
            <span v-else class="card-art-missing"><ImageOff :size="22" /></span>
            <figcaption>普通</figcaption>
          </figure>
          <figure>
            <button
              v-if="assetStatus?.awakened_portrait || assetStatus?.awakened_icon"
              class="card-art-open"
              :disabled="!assetStatus?.awakened_portrait"
              :title="assetStatus?.awakened_portrait ? '查看特训后卡面原图' : '只有缩略图资源'"
              @click="openLightbox(awakenedPortraitUrl)"
            >
              <img
                :src="assetStatus?.awakened_portrait ? awakenedPortraitUrl : getCardIconUrl(card.resource_id, true)"
                :alt="`${card.title || card.resource_id} 特训后`"
              />
              <Expand v-if="assetStatus?.awakened_portrait" :size="17" />
            </button>
            <span v-else class="card-art-missing"><ImageOff :size="22" /></span>
            <figcaption>{{ card.single_state ? '单卡面' : '特训后' }}</figcaption>
          </figure>
        </div>
        <div class="card-head-copy">
          <div class="card-detail-meta">
            <span class="card-rarity">{{ card.rarity || 'CARD' }}</span>
            <span>{{ card.resource_id }}</span>
            <span v-if="card.voice_base">{{ card.voice_base }}</span>
          </div>
          <h3>{{ card.title || card.resource_id }}</h3>
          <div class="card-detail-controls">
            <button
              class="card-nav-button"
              :disabled="!previousCard"
              :title="previousCard ? `上一张：${previousCard.title || previousCard.resource_id}` : '已经是第一张'"
              @click="emit('navigate-card', previousCard)"
            >
              <ChevronLeft :size="18" />
            </button>
            <div class="art-mode-control" aria-label="卡面边框模式">
              <button :class="{ active: artMode === 'clean' }" @click="emit('update:art-mode', 'clean')">无框</button>
              <button :class="{ active: artMode === 'framed' }" @click="emit('update:art-mode', 'framed')">带框</button>
            </div>
            <button
              class="card-nav-button"
              :disabled="!nextCard"
              :title="nextCard ? `下一张：${nextCard.title || nextCard.resource_id}` : '已经是最后一张'"
              @click="emit('navigate-card', nextCard)"
            >
              <ChevronRight :size="18" />
            </button>
          </div>
          <dl class="asset-status-grid">
            <div v-for="item in assetRows" :key="item.label" :class="{ missing: !item.available }">
              <component :is="item.available ? CheckCircle2 : CircleSlash" :size="15" />
              <dt>{{ item.label }}</dt>
              <dd>{{ item.available ? 'available' : 'missing' }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section v-if="card.release_series" class="card-detail-section card-relations">
        <h4>关联资料</h4>
        <div class="release-series">
          <div class="release-series-heading">
            <Layers3 :size="20" />
            <span>
              <strong>共通系列 · {{ card.release_series.title }}</strong>
              <small>
                {{ card.release_series.card_count }} 张卡 / {{ card.release_series.character_count }} 位偶像
                · 发布时间与标题完全一致
              </small>
            </span>
          </div>
          <div class="release-series-cards" :aria-label="`${card.release_series.title} 系列卡片`">
            <button
              v-for="seriesCard in seriesCards"
              :key="seriesCard.resource_id"
              :class="{ current: seriesCard.resource_id === card.resource_id }"
              :disabled="seriesCard.resource_id === card.resource_id"
              :title="seriesCard.character_name || seriesCard.resource_id"
              @click="emit('navigate-related-card', seriesCard)"
            >
              <img :src="getCardIconUrl(seriesCard.resource_id, true)" :alt="seriesCard.character_name || seriesCard.resource_id" loading="lazy" />
              <span>{{ seriesCard.character_name || seriesCard.character_id }}</span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="assetStatus?.normal_landscape || assetStatus?.awakened_landscape" class="card-detail-section">
        <h4>SSR 完整横图</h4>
        <div class="card-landscape-comparison">
          <figure v-if="assetStatus?.normal_landscape">
            <button class="card-art-open landscape" title="查看普通横图原图" @click="openLightbox(normalLandscapeUrl)">
              <img :src="normalLandscapeUrl" :alt="`${card.title || card.resource_id} 普通横图`" loading="lazy" />
              <Expand :size="17" />
            </button>
            <figcaption>普通</figcaption>
          </figure>
          <figure v-if="assetStatus?.awakened_landscape">
            <button class="card-art-open landscape" title="查看特训后横图原图" @click="openLightbox(awakenedLandscapeUrl)">
              <img :src="awakenedLandscapeUrl" :alt="`${card.title || card.resource_id} 特训后横图`" loading="lazy" />
              <Expand :size="17" />
            </button>
            <figcaption>特训后</figcaption>
          </figure>
        </div>
      </section>

      <section class="card-detail-section">
        <h4>卡面文本</h4>
        <div v-if="card.texts?.normal?.trim() && !card.single_state" class="card-text-block">
          <div class="card-text-heading">
            <strong>普通</strong>
            <div v-if="card.card_text_voices?.normal" class="card-text-voice">
              <audio controls preload="none" :src="voiceUrl(card.card_text_voices.normal)"></audio>
              <button class="voice-preview-btn" @click="emit('preview-voice', card.card_text_voices.normal)">Preview</button>
            </div>
          </div>
          <p>{{ card.texts.normal }}</p>
        </div>
        <div v-if="card.texts?.awakened" class="card-text-block">
          <div class="card-text-heading">
            <strong>{{ card.single_state ? '卡面台词' : '特训后' }}</strong>
            <div v-if="card.card_text_voices?.awakened" class="card-text-voice">
              <audio controls preload="none" :src="voiceUrl(card.card_text_voices.awakened)"></audio>
              <button class="voice-preview-btn" @click="emit('preview-voice', card.card_text_voices.awakened)">Preview</button>
            </div>
          </div>
          <p>{{ card.texts.awakened }}</p>
        </div>
        <div v-if="card.texts?.extra?.trim() && card.texts.extra !== '0'" class="card-text-block">
          <strong>短台词</strong>
          <p>{{ card.texts.extra }}</p>
        </div>
      </section>

      <section v-if="card.home_voice_cues?.length" class="card-detail-section">
        <h4>首页触摸语音</h4>
        <div class="voice-list">
          <div v-for="cue in card.home_voice_cues" :key="cue.cue" class="voice-row">
            <span>{{ cue.cue }}</span>
            <audio controls preload="none" :src="voiceUrl(cue.cue)"></audio>
            <button class="voice-preview-btn" @click="emit('preview-voice', cue)">Preview</button>
          </div>
        </div>
      </section>

      <section v-if="card.scenario_entries?.length" class="card-detail-section">
        <h4>卡片小剧情 / 电话</h4>
        <div class="scenario-link-list">
          <button
            v-for="entry in card.scenario_entries"
            :key="entry.resource_id"
            class="scenario-link-btn"
            :disabled="!entry.compiled_file"
            @click="emit('open-scenario', entry)"
          >
            <span>{{ entry['3'] || entry.resource_id }}</span>
            <small>{{ scenarioSubtitle(entry) }}</small>
          </button>
        </div>
      </section>

      <section v-if="card.voice_candidates?.unmapped_card_only?.length" class="card-detail-section">
        <h4>未归类卡面语音候选</h4>
        <div class="voice-list">
          <div v-for="cue in card.voice_candidates.unmapped_card_only" :key="cue" class="voice-row">
            <span>{{ cue }}</span>
            <audio controls preload="none" :src="voiceUrl(cue)"></audio>
            <button class="voice-preview-btn" @click="emit('preview-voice', cue)">Preview</button>
          </div>
        </div>
      </section>
    </div>
    <ArchiveImageLightbox
      :open="lightboxOpen"
      :items="lightboxItems"
      :initial-index="lightboxIndex"
      @close="lightboxOpen = false"
    />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleSlash, Expand, ImageOff, Layers3 } from '@lucide/vue'
import ArchiveImageLightbox from './ArchiveImageLightbox.vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import { getVoiceUrl } from '../../utils/AssetResolver.js'
import { getCardIconUrl, getCardLandscapeUrl, getCardPortraitUrl } from '../../utils/CardAssetResolver.js'

const props = defineProps({
  card: { type: Object, default: null },
  embedded: { type: Boolean, default: false },
  assetStatus: { type: Object, default: null },
  artMode: { type: String, default: 'clean' },
  previousCard: { type: Object, default: null },
  nextCard: { type: Object, default: null },
  seriesCards: { type: Array, default: () => [] },
})
const emit = defineEmits([
  'back',
  'preview-voice',
  'open-scenario',
  'navigate-card',
  'navigate-related-card',
  'update:art-mode',
])

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
const framedPortrait = computed(() => props.artMode === 'framed')
const normalPortraitUrl = computed(() => getCardPortraitUrl(props.card?.resource_id, false, framedPortrait.value))
const awakenedPortraitUrl = computed(() => getCardPortraitUrl(props.card?.resource_id, true, framedPortrait.value))
const normalLandscapeUrl = computed(() => getCardLandscapeUrl(props.card?.resource_id, false))
const awakenedLandscapeUrl = computed(() => getCardLandscapeUrl(props.card?.resource_id, true))

const lightboxItems = computed(() => {
  if (!props.card) return []
  const title = props.card.title || props.card.resource_id
  const items = []
  if (!props.card.single_state && props.assetStatus?.normal_portrait) {
    items.push({ label: `${title} · 普通${framedPortrait.value ? '带框' : '无框'}`, src: normalPortraitUrl.value })
  }
  if (props.assetStatus?.awakened_portrait) {
    items.push({
      label: `${title} · ${props.card.single_state ? '单卡面' : '特训后'}${framedPortrait.value ? '带框' : '无框'}`,
      src: awakenedPortraitUrl.value,
    })
  }
  if (props.assetStatus?.normal_landscape) {
    items.push({ label: `${title} · 普通横图`, src: normalLandscapeUrl.value })
  }
  if (props.assetStatus?.awakened_landscape) {
    items.push({ label: `${title} · 特训后横图`, src: awakenedLandscapeUrl.value })
  }
  return items
})

const assetRows = computed(() => props.card?.single_state
  ? [
      { label: '单卡面缩略图', available: props.assetStatus?.awakened_icon },
      { label: '单卡面无框图', available: props.assetStatus?.awakened_portrait },
    ]
  : [
      { label: '普通缩略图', available: props.assetStatus?.normal_icon },
      { label: '觉醒缩略图', available: props.assetStatus?.awakened_icon },
      { label: '普通无框卡面', available: props.assetStatus?.normal_portrait },
      { label: '觉醒无框卡面', available: props.assetStatus?.awakened_portrait },
      { label: '普通 SSR 横图', available: props.assetStatus?.normal_landscape },
      { label: '觉醒 SSR 横图', available: props.assetStatus?.awakened_landscape },
    ])

function voiceUrl(cue) {
  return cue ? getVoiceUrl(`${cue}.m4a`) : ''
}

function openLightbox(src) {
  const index = lightboxItems.value.findIndex(item => item.src === src)
  if (index < 0) return
  lightboxIndex.value = index
  lightboxOpen.value = true
}

function scenarioSubtitle(entry) {
  const parts = [entry?.resource_id].filter(Boolean)
  const summary = entry?.compiled_summary
  if (summary?.voice_count) parts.push(`${summary.voice_count} voices`)
  if (summary?.lip_count) parts.push(`${summary.lip_count} lips`)
  return parts.join(' · ')
}

</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.card-detail { max-width: 920px; margin: 0 auto; padding: 16px; }
.card-detail-head,
.card-detail-section { background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
.card-detail-head { display: grid; grid-template-columns: minmax(220px, 340px) minmax(0, 1fr); gap: 22px; }
.card-art-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.card-art-comparison.single { grid-template-columns: minmax(0, 1fr); max-width: 170px; }
.card-art-comparison figure { min-width: 0; margin: 0; }
.card-art-open { position: relative; display: block; width: 100%; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #fff; cursor: zoom-in; overflow: hidden; }
.card-art-open:disabled { cursor: default; }
.card-art-open img, .card-art-missing { display: grid; place-items: center; width: 100%; aspect-ratio: 4 / 5; border: 1px solid #e2e7ea; border-radius: 6px; background: #eef1f3; object-fit: contain; color: #8b969e; }
.card-art-open > svg { position: absolute; right: 7px; bottom: 7px; padding: 5px; width: 28px; height: 28px; border-radius: 4px; background: rgba(12, 19, 24, 0.68); opacity: 0; transition: opacity 140ms ease; }
.card-art-open:hover > svg, .card-art-open:focus-visible > svg { opacity: 1; }
.card-art-comparison figcaption { margin-top: 5px; color: #75808a; font-size: 0.66rem; text-align: center; }
.card-landscape-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.card-landscape-comparison figure { min-width: 0; margin: 0; }
.card-art-open.landscape img { display: block; width: 100%; aspect-ratio: 15 / 8; border: 1px solid #e2e7ea; border-radius: 6px; object-fit: cover; }
.card-landscape-comparison figcaption { margin-top: 5px; color: #75808a; font-size: 0.66rem; text-align: center; }
.card-head-copy { min-width: 0; }
.card-detail-head h3 { margin: 8px 0 0; font-size: 1.15rem; color: #222; }
.card-detail-controls { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.card-nav-button { display: grid; place-items: center; width: 34px; height: 32px; padding: 0; border: 1px solid #dce2e5; border-radius: 6px; background: #fff; color: #41515c; cursor: pointer; }
.card-nav-button:hover:not(:disabled) { border-color: #9ec8c3; background: #f1faf9; color: #147f77; }
.card-nav-button:disabled { color: #b7bfc4; cursor: not-allowed; }
.art-mode-control { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #dce2e5; border-radius: 6px; overflow: hidden; }
.art-mode-control button { min-width: 54px; height: 30px; padding: 0 10px; border: 0; border-right: 1px solid #dce2e5; background: #fff; color: #61717a; cursor: pointer; font-size: 0.72rem; }
.art-mode-control button:last-child { border-right: 0; }
.art-mode-control button.active { background: #e8f6f4; color: #147f77; font-weight: 700; }
.card-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #777; font-family: monospace; font-size: 0.78rem; }
.card-rarity {
  display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 24px;
  border-radius: 6px; background: #edf2ff; color: #3157a4; font-size: 0.72rem; font-weight: 700;
}
.asset-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 18px 0 0; }
.asset-status-grid div { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: center; gap: 2px 6px; min-width: 0; padding: 7px 8px; border: 1px solid #d8ebe8; border-radius: 6px; color: #168b83; }
.asset-status-grid div.missing { border-color: #e1e5e7; color: #8a949b; }
.asset-status-grid svg { grid-row: 1 / 3; }
.asset-status-grid dt { overflow: hidden; color: #39464f; font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
.asset-status-grid dd { margin: 0; font-size: 0.6rem; }
.card-detail-section h4 { margin: 0 0 10px; font-size: 0.92rem; color: #333; }
.card-relations { display: flex; flex-direction: column; gap: 10px; }
.card-relations h4 { margin-bottom: 0; }
.release-series-heading > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.release-series-heading strong { color: #2b3a42; font-size: 0.72rem; }
.release-series-heading small { color: #718088; font-size: 0.66rem; line-height: 1.4; }
.release-series { border-top: 1px solid #edf0f2; padding-top: 11px; }
.release-series-heading { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 10px; color: #5272a4; }
.release-series-cards { display: flex; gap: 7px; margin-top: 10px; padding-bottom: 4px; overflow-x: auto; overscroll-behavior-inline: contain; }
.release-series-cards button { flex: 0 0 74px; min-width: 0; padding: 5px; border: 1px solid #e1e6e9; border-radius: 6px; background: #fff; color: #4b5962; cursor: pointer; }
.release-series-cards button:hover:not(:disabled) { border-color: #9fc8c3; background: #f1faf9; }
.release-series-cards button.current { border-color: #65b8ae; background: #e9f7f5; }
.release-series-cards button:disabled { cursor: default; }
.release-series-cards img { display: block; width: 62px; height: 62px; border-radius: 4px; background: #eef1f3; object-fit: cover; }
.release-series-cards span { display: block; overflow: hidden; margin-top: 4px; font-size: 0.62rem; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.card-text-block { border-top: 1px solid #f0f0f0; padding-top: 10px; margin-top: 10px; }
.card-text-block:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
.card-text-block strong { display: block; margin-bottom: 6px; color: #3157a4; font-size: 0.78rem; }
.card-text-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
.card-text-heading strong { margin: 0; }
.card-text-voice { display: flex; align-items: center; gap: 8px; min-width: 0; }
.card-text-voice audio { width: min(300px, 32vw); height: 30px; }
.card-text-block p { margin: 0; white-space: pre-wrap; line-height: 1.65; color: #222; }
.voice-list, .scenario-link-list { display: flex; flex-direction: column; gap: 8px; }
.voice-row {
  display: grid; grid-template-columns: minmax(160px, 1fr) minmax(220px, 360px) auto;
  align-items: center; gap: 12px; padding: 8px 10px;
  border: 1px solid #f0f0f0; border-radius: 6px; background: #fafafa;
}
.voice-row span { font-family: monospace; font-size: 0.78rem; color: #555; overflow-wrap: anywhere; }
.voice-row audio { width: 100%; height: 32px; }
.voice-preview-btn {
  min-height: 30px; border: 1px solid #c8dcff; border-radius: 6px;
  background: #f5faff; color: #245b91; padding: 4px 10px; cursor: pointer;
  font-size: 0.74rem; white-space: nowrap;
}
.voice-preview-btn:hover { background: #e8f2ff; }
.scenario-link-btn {
  display: flex; flex-direction: column; gap: 3px; text-align: left;
  background: #fafafa; border: 1px solid #eee; border-radius: 6px;
  padding: 9px 10px; cursor: pointer; color: #333;
}
.scenario-link-btn:hover:not(:disabled) { background: #f0f4ff; border-color: #c8dcff; }
.scenario-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.scenario-link-btn small { color: #888; font-family: monospace; font-size: 0.72rem; }

@media (max-width: 700px) {
  .card-detail { padding: 10px; }
  .card-detail-head { grid-template-columns: 1fr; gap: 14px; }
  .voice-row { grid-template-columns: 1fr auto; }
  .voice-row audio { grid-column: 1 / -1; grid-row: 2; }
  .card-landscape-comparison { grid-template-columns: 1fr; }
  .card-text-heading { align-items: flex-start; flex-direction: column; }
  .card-text-voice { width: 100%; }
  .card-text-voice audio { width: 100%; }
}
</style>
