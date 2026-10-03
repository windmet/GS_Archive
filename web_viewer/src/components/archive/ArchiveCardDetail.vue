<template>
  <section class="screen list-screen" data-archive-scroll-container>
    <ArchiveListHeader v-if="!embedded" :title="displayCardTitle || '卡片详情'" @back="emit('back')" />
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
                :alt="`${displayCardTitle} 普通`"
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
                :alt="`${displayCardTitle} 特训后`"
              />
              <Expand v-if="assetStatus?.awakened_portrait" :size="17" />
            </button>
            <span v-else class="card-art-missing"><ImageOff :size="22" /></span>
            <figcaption>{{ card.single_state ? '单卡面' : '特训后' }}</figcaption>
          </figure>
        </div>
        <div class="card-head-copy">
          <div class="card-detail-meta">
            <span v-if="rawCandidateActive" class="card-raw-candidate">待核对卡面</span>
            <span class="card-rarity">{{ card.rarity || 'CARD' }}</span>
            <span v-if="card.gameplay?.attribute?.name" class="card-attribute">{{ card.gameplay.attribute.name }}</span>
          </div>
          <h3 :title="card.title">{{ displayCardTitle }}</h3>
          <div class="card-owner-block">
            <span>所属偶像</span>
            <ArchiveIdolReference :reference="ownerReference" :data-archive-focus-id="`card-owner:${card.resource_id}:head`" density="identity" @open="emit('open-idol', $event)" />
          </div>
          <div class="card-detail-controls">
            <button
              class="card-nav-button"
              :disabled="!previousCard"
              :title="previousCard ? `上一张：${archiveText('card', previousCard.title, 'title') || '卡片'}` : '已经是第一张'"
              @click="emit('navigate-card', previousCard)"
            >
              <ChevronLeft :size="18" />
            </button>
            <div class="art-mode-control" role="group" aria-label="卡面边框模式">
              <button :class="{ active: artMode === 'clean' }" :aria-pressed="artMode === 'clean'" @click="emit('update:art-mode', 'clean')">无框</button>
              <button :class="{ active: artMode === 'framed' }" :aria-pressed="artMode === 'framed'" @click="emit('update:art-mode', 'framed')">带框</button>
            </div>
            <button
              class="card-nav-button"
              :disabled="!nextCard"
              :title="nextCard ? `下一张：${archiveText('card', nextCard.title, 'title') || '卡片'}` : '已经是最后一张'"
              @click="emit('navigate-card', nextCard)"
            >
              <ChevronRight :size="18" />
            </button>
          </div>
        </div>
      </section>

      <section v-if="ownerReference || eventRelation || gashaRelation || card.release_series" class="card-detail-section card-relations">
        <h4>关联资料</h4>
        <div v-if="ownerReference" class="card-owner-relation">
          <span>所属偶像</span>
          <ArchiveIdolReference :reference="ownerReference" :data-archive-focus-id="`card-owner:${card.resource_id}:relation`" density="portrait" @open="emit('open-idol', $event)" />
        </div>
        <ArchiveRelationList v-if="relationItems.length" :items="relationItems" @select="openRelation" />
        <div v-if="card.release_series" class="release-series">
          <div class="release-series-cards" :aria-label="`${card.release_series.title} 系列卡片`">
            <button
              v-for="seriesCard in seriesCards"
              :key="seriesCard.resource_id"
              :class="{ current: seriesCard.resource_id === card.resource_id }"
              :disabled="seriesCard.resource_id === card.resource_id"
              :title="seriesCard.character_name || '姓名待确认'"
              @click="emit('navigate-related-card', seriesCard)"
            >
              <img :src="getCardIconUrl(seriesCard.resource_id, true)" :alt="seriesCard.character_name || '姓名待确认'" loading="lazy" />
              <span>{{ seriesCard.character_name || '姓名待确认' }}</span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="card.gameplay" class="card-detail-section">
        <h4>能力与技能</h4>
        <div class="gameplay-layout">
          <div class="parameter-panel">
            <div class="parameter-heading">
              <Activity :size="18" />
              <strong>{{ card.gameplay.attribute?.name || 'Unknown' }}</strong>
              <span><HeartPulse :size="15" /> Life {{ card.gameplay.life ?? '—' }}</span>
            </div>
            <table class="parameter-table">
              <thead>
                <tr><th>能力</th><th>初期</th><th>无凸最大</th><th>满凸最大</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in parameterRows" :key="row.label" :class="{ total: row.total }">
                  <th>{{ row.label }}</th>
                  <td>{{ formatNumber(row.initial) }}</td>
                  <td>{{ formatNumber(row.max_unlimit) }}</td>
                  <td>{{ formatNumber(row.max_limitbreak) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="skill-panel">
            <div v-if="card.gameplay.center_skill?.name" class="skill-row">
              <div class="skill-heading">
                <strong>中心效果 · {{ archiveText('center-skill', card.gameplay.center_skill.name) }}</strong>
                <span v-if="card.gameplay.center_skill.category?.name" class="skill-category">
                  {{ archiveText('center-skill', card.gameplay.center_skill.category.name) }}
                </span>
              </div>
              <p>{{ formatCardSkillDescription(archiveText('center-skill', card.gameplay.center_skill.description, 'description')) }}</p>
            </div>
            <div v-if="card.gameplay.skill?.name" class="skill-row">
              <div class="skill-heading">
                <div class="skill-title">
                  <strong>技能 · {{ archiveText('skill', card.gameplay.skill.name) }}</strong>
                  <span
                    v-if="card.gameplay.skill.category?.name"
                    class="skill-category"
                    :style="{ '--skill-category-color': card.gameplay.skill.category.color || '#168b83' }"
                  >
                    {{ archiveText('skill-category', card.gameplay.skill.category.name) }}
                  </span>
                </div>
                <select v-if="card.gameplay.skill.levels?.length" v-model.number="selectedSkillLevel" aria-label="技能等级">
                  <option v-for="level in card.gameplay.skill.levels" :key="level.level" :value="level.level">Lv.{{ level.level }}</option>
                </select>
              </div>
              <p>{{ presentCardSkillDescription(selectedSkill?.description) }}</p>
            </div>
            <div v-if="card.limitbreak_item?.name" class="limitbreak-item-row">
              <PackageOpen :size="19" />
              <div>
                <small>突破素材</small>
                <strong :title="card.limitbreak_item.name">{{ archiveText('item', card.limitbreak_item.name) }}</strong>
                <p>{{ archiveText('item', card.limitbreak_item.description, 'description') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="visibleCostumes.length" class="card-detail-section">
        <h4>关联衣装</h4>
        <div class="costume-list">
          <div v-for="group in visibleCostumes" :key="group.key" class="costume-group">
            <div class="costume-group-header">
              <Shirt :size="20" aria-hidden="true" />
              <h5 class="costume-group-title" :title="group.name">{{ archiveText('costume', group.name) || '衣装名称待确认' }}</h5>
            </div>
            <blockquote v-if="group.description" class="costume-flavor">
              <span class="authored-text">{{ group.description }}</span><span class="reflowed-text">{{ reflowCardCostumeFlavor(group.description) }}</span>
            </blockquote>
            <div class="costume-variants" aria-label="款式用途与状态">
              <div v-for="costume in group.costumes" :key="costume.key" class="costume-row" role="group" :title="costume.name" :aria-label="archiveText('costume', costume.name) || '衣装名称待确认'">
                <strong class="costume-variant-name">{{ group.costumes.length > 1 ? (costume.model_resource_id.endsWith('_01') ? '突破版（+）' : '通常版') : '用途' }}</strong>
                <div class="costume-conditions">
                  <span v-for="label in costume.labels" :key="label" class="costume-condition">{{ label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="assetStatus?.normal_landscape || assetStatus?.awakened_landscape" class="card-detail-section">
        <h4>SSR 完整横图</h4>
        <div class="card-landscape-comparison">
          <figure v-if="assetStatus?.normal_landscape">
            <button class="card-art-open landscape" title="查看普通横图原图" @click="openLightbox(normalLandscapeUrl)">
              <img :src="normalLandscapeUrl" :alt="`${displayCardTitle} 普通横图`" loading="lazy" />
              <Expand :size="17" />
            </button>
            <figcaption>普通</figcaption>
          </figure>
          <figure v-if="assetStatus?.awakened_landscape">
            <button class="card-art-open landscape" title="查看特训后横图原图" @click="openLightbox(awakenedLandscapeUrl)">
              <img :src="awakenedLandscapeUrl" :alt="`${displayCardTitle} 特训后横图`" loading="lazy" />
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
              <ArchiveVoiceRow :src="voiceUrl(card.card_text_voices.normal)" />
              <button v-if="cardVoicePreviewStep(card, card.card_text_voices.normal)" class="voice-preview-btn" @click="emit('preview-voice', card.card_text_voices.normal)">演出预览</button>
            </div>
          </div>
          <p><span class="authored-text">{{ presentProducerAddressingText(card.texts.normal) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.normal)) }}</span></p>
        </div>
        <div v-if="card.texts?.awakened" class="card-text-block">
          <div class="card-text-heading">
            <strong>{{ card.single_state ? '卡面台词' : '特训后' }}</strong>
            <div v-if="card.card_text_voices?.awakened" class="card-text-voice">
              <ArchiveVoiceRow :src="voiceUrl(card.card_text_voices.awakened)" />
              <button v-if="cardVoicePreviewStep(card, card.card_text_voices.awakened)" class="voice-preview-btn" @click="emit('preview-voice', card.card_text_voices.awakened)">演出预览</button>
            </div>
          </div>
          <p><span class="authored-text">{{ presentProducerAddressingText(card.texts.awakened) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.awakened)) }}</span></p>
        </div>
        <div v-if="card.texts?.extra?.trim() && card.texts.extra !== '0'" class="card-text-block">
          <strong>短台词</strong>
          <p><span class="authored-text">{{ presentProducerAddressingText(card.texts.extra) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.extra)) }}</span></p>
        </div>
      </section>

      <section v-if="card.home_voice_cues?.length" class="card-detail-section">
        <h4>首页触摸语音</h4>
        <div class="voice-list">
          <div v-for="(cue, index) in card.home_voice_cues" :key="cue.cue" class="voice-row">
            <div class="voice-copy">
              <strong>触摸语音 {{ index + 1 }}</strong>
              <p v-if="cue.preview?.text"><span class="authored-text">{{ presentProducerAddressingText(cue.preview.text) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(cue.preview.text)) }}</span></p>
            </div>
            <ArchiveVoiceRow :src="voiceUrl(cue.cue)" />
            <button v-if="cardVoicePreviewStep(card, cue)" class="voice-preview-btn" @click="emit('preview-voice', cue)">演出预览</button>
          </div>
        </div>
      </section>

      <section v-if="card.operational_voice_cues?.length" class="card-detail-section">
        <h4>演出语音</h4>
        <div class="voice-list">
          <div v-for="cue in card.operational_voice_cues" :key="cue.cue" class="voice-row">
            <div class="voice-copy">
              <div class="voice-label">
                <strong>{{ cue.label }}</strong>
                <small :class="`source-${cue.text_source}`">{{ cue.text?.trim() && cue.text.trim() !== '0' ? voiceSourceLabel(cue.text_source) : '仅音频' }}</small>
              </div>
              <p v-if="cue.text?.trim() && cue.text.trim() !== '0'"><span class="authored-text">{{ presentProducerAddressingText(cue.text) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(cue.text)) }}</span></p>
            </div>
            <ArchiveVoiceRow :src="voiceUrl(cue.cue)" />
            <button v-if="cardVoicePreviewStep(card, cue)" class="voice-preview-btn" @click="emit('preview-voice', cue)">演出预览</button>
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
            <span>{{ cardScenarioTitle(entry) }}</span>
            <small>{{ [entry.communication_label, scenarioSubtitle(entry)].filter(Boolean).join(' · ') }}</small>
          </button>
        </div>
      </section>

      <ArchiveTechnicalDetails :key="card.resource_id" :evidence="{ card, assetStatus, rawCandidateActive, eventRelation, gashaRelation }">
          <dl class="asset-status-grid">
            <div v-for="item in assetRows" :key="item.label" :class="{ missing: !item.available }">
              <component :is="item.available ? CheckCircle2 : CircleSlash" :size="15" />
              <dt>{{ item.label }}</dt>
              <dd>{{ item.available ? '已收录' : '未收录' }}</dd>
            </div>
          </dl>
        <section v-if="card.voice_candidates?.unmapped_card_only?.length" class="card-detail-section">
          <h4>未归类卡面语音候选</h4>
          <div class="voice-list">
            <div v-for="cue in card.voice_candidates.unmapped_card_only" :key="cue" class="voice-row">
              <span>{{ cue }}</span>
              <ArchiveVoiceRow :src="voiceUrl(cue)" />
              <button v-if="cardVoicePreviewStep(card, cue)" class="voice-preview-btn" @click="emit('preview-voice', cue)">演出预览</button>
            </div>
          </div>
        </section>
      </ArchiveTechnicalDetails>
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
import { reflowArchiveText } from '../../presentation/ArchiveText.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import ArchiveVoiceRow from './ArchiveVoiceRow.vue'
import { computed, ref, watch } from 'vue'
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, CircleSlash, Expand, HeartPulse, ImageOff, PackageOpen, Shirt } from '@lucide/vue'
import ArchiveImageLightbox from './ArchiveImageLightbox.vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { presentCardSkillDescription as formatCardSkillDescription } from '../../presentation/CardSkillDescriptionPresenter.js'
import {archiveText} from './useArchiveCardText.js'
import {gashaText} from './useArchiveGashaText.js'
const presentCardSkillDescription = source => formatCardSkillDescription(archiveText('skill', source, 'description'))
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { cardScenarioTitle } from '../../presentation/CardPresentation.js'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { cardVoicePreviewStep } from '../../data/cardVoicePreview.js'
import { getVoiceUrl } from '../../utils/AssetResolver.js'
import {
  getCardIconUrl,
  getCardLandscapeUrl,
  getCardPortraitUrl,
  isRawCardCandidate,
} from '../../utils/CardAssetResolver.js'
import { presentCardAssetRows, presentCardCostumeGroups, reflowCardCostumeFlavor } from '../../presentation/CardDetailSemantics.js'

const props = defineProps({
  card: { type: Object, default: null },
  ownerReference: { type: Object, default: null },
  embedded: { type: Boolean, default: false },
  assetStatus: { type: Object, default: null },
  artMode: { type: String, default: 'clean' },
  previousCard: { type: Object, default: null },
  nextCard: { type: Object, default: null },
  seriesCards: { type: Array, default: () => [] },
  eventRelation: { type: Object, default: null },
  gashaRelation: { type: Object, default: null },
})
const emit = defineEmits([
  'back',
  'preview-voice',
  'open-scenario',
  'navigate-card',
  'navigate-related-card',
  'open-event',
  'open-gasha',
  'open-idol',
  'update:art-mode',
])

const lightboxOpen = ref(false)
const displayCardTitle = computed(()=>archiveText('card',props.card?.title,'title') || '卡名待确认')
const lightboxIndex = ref(0)
const selectedSkillLevel = ref(1)
const framedPortrait = computed(() => props.artMode === 'framed')
const rawCandidateActive = computed(() => isRawCardCandidate(props.card?.resource_id))
const normalPortraitUrl = computed(() => getCardPortraitUrl(props.card?.resource_id, false, framedPortrait.value))
const awakenedPortraitUrl = computed(() => getCardPortraitUrl(props.card?.resource_id, true, framedPortrait.value))
const normalLandscapeUrl = computed(() => getCardLandscapeUrl(props.card?.resource_id, false))
const awakenedLandscapeUrl = computed(() => getCardLandscapeUrl(props.card?.resource_id, true))

watch(() => props.card?.resource_id, () => {
  selectedSkillLevel.value = props.card?.gameplay?.skill?.levels?.[0]?.level || 1
})

const selectedSkill = computed(() => props.card?.gameplay?.skill?.levels
  ?.find(level => level.level === selectedSkillLevel.value) || null)

const parameterRows = computed(() => {
  const gameplay = props.card?.gameplay
  if (!gameplay) return []
  return [
    { label: 'Appeal', ...gameplay.appeal, total: true },
    { label: 'Vo', ...(gameplay.parameters?.vocal || {}) },
    { label: 'Da', ...(gameplay.parameters?.dance || {}) },
    { label: 'Vi', ...(gameplay.parameters?.visual || {}) },
  ]
})

const visibleCostumes = computed(() => presentCardCostumeGroups(props.card?.costume_relations,
  costume => archiveText('costume', costume.description, 'description')))

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return 'unknown'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' })
    .format(new Date(timestamp * 1000))
}

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('zh-CN').format(value) : '—'
}

function voiceSourceLabel(sourceType) {
  if (sourceType === 'masterdata') return '原始文本'
  if (sourceType === 'curated') return '人工校对'
  return '仅音频'
}

const lightboxItems = computed(() => {
  if (!props.card) return []
  const title = displayCardTitle.value
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

const assetRows = computed(() => presentCardAssetRows(props.card, props.assetStatus))

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
  return entry?.compiled_file ? '可观看' : '暂未收录剧情'
}

function eventScopeLabel(event) {
  if (event.event_scope === 'fixed_unit_event') return '固定组合团活关联卡'
  if (event.event_scope === 'attribute_event') return `${event.attribute} 属性团曲关联卡`
  return '跨组合团活关联卡'
}

const relationItems = computed(() => {
  const items = []
  if (props.eventRelation) {
    items.push({
      id: `event-${props.eventRelation.event_id}`,
      kind: 'event',
      label: eventScopeLabel(props.eventRelation),
      title: props.eventRelation.title,
      meta: '同期发布且角色参演；获得方式待确认',
      evidenceLabel: 'Derived',
      evidenceTone: 'derived',
      evidence: props.eventRelation.relation_type,
      statusLabel: props.eventRelation.exists ? '可播放' : '缺少剧情',
      statusTone: props.eventRelation.exists ? 'available' : 'missing',
      resource: props.eventRelation.file,
      payload: props.eventRelation,
    })
  }
  if (props.gashaRelation) {
    items.push({
      id: `gasha-${props.gashaRelation.announcement_id}`,
      kind: 'gasha',
      label: '卡池 Pickup',
      title: gashaText(props.gashaRelation.title) || '卡池名称待确认',
      meta: `${formatDate(props.gashaRelation.start_at)} · ${props.gashaRelation.evidence_level === 'curated' ? '已核对关联' : '推定关联，获得方式待确认'}`,
      evidenceLabel: props.gashaRelation.evidence_level === 'curated' ? 'Confirmed' : 'Derived',
      evidenceTone: props.gashaRelation.evidence_level === 'curated' ? 'confirmed' : 'derived',
      evidence: props.gashaRelation.relation_type,
      statusLabel: '已建档',
      statusTone: 'available',
      payload: props.gashaRelation,
    })
  }
  if (props.card?.release_series) {
    items.push({
      id: `series-${props.card.release_series.series_id}`,
      kind: 'series',
      label: '共通系列',
      title: props.card.release_series.title,
      meta: `${props.card.release_series.card_count} 张卡 · ${props.card.release_series.character_count} 位偶像`,
      evidenceLabel: 'Exact',
      evidenceTone: 'raw',
      evidence: '发布时间与标题完全一致',
      statusLabel: '参考关系',
      statusTone: 'reference',
      actionable: false,
    })
  }
  return items
})

function openRelation(item) {
  if (item.kind === 'event') emit('open-event', item.payload)
  else if (item.kind === 'gasha') emit('open-gasha', item.payload)
}

</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.card-detail { container: card-detail / inline-size; min-width: 0; max-width: 920px; margin: 0 auto; padding: var(--gs-space-5); font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.card-detail button, .card-detail select { font-family: inherit; }
.card-detail button { font-weight: var(--gs-weight-semibold); }
.card-detail button:focus-visible, .card-detail select:focus-visible { outline: 3px solid var(--gs-color-accent); outline-offset: 2px; }
.card-detail .art-mode-control button:focus-visible { outline-offset: -3px; }
.card-detail .release-series-cards button:focus-visible { outline-offset: -3px; }
.card-detail-head,
.card-detail-section { background: #fff; border: 1px solid #e8e8e8; border-radius: var(--gs-radius-panel); padding: var(--gs-space-5); margin-bottom: var(--gs-space-4); }
.card-detail-head { display: grid; grid-template-columns: minmax(220px, 340px) minmax(240px, 1fr); gap: var(--gs-space-6); }
.card-art-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-3); }
.card-art-comparison.single { grid-template-columns: minmax(0, 1fr); max-width: 170px; }
.card-art-comparison figure { min-width: 0; margin: 0; }
.card-art-open { position: relative; display: block; width: 100%; padding: 0; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: #fff; cursor: zoom-in; overflow: hidden; }
.card-art-open:disabled { cursor: default; }
.card-art-open img, .card-art-missing { display: grid; place-items: center; width: 100%; aspect-ratio: 4 / 5; border: 1px solid #e2e7ea; border-radius: var(--gs-radius-control); background: #eef1f3; object-fit: contain; color: #8b969e; }
.card-art-open > svg { position: absolute; right: 7px; bottom: 7px; padding: 5px; width: 28px; height: 28px; border-radius: 4px; background: rgba(12, 19, 24, 0.68); opacity: 0; transition: opacity 140ms ease; }
.card-art-open:hover > svg, .card-art-open:focus-visible > svg { opacity: 1; }
.card-art-comparison figcaption { margin-top: var(--gs-space-2); color: #75808a; font-size: var(--gs-text-meta); text-align: center; }
.card-landscape-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-4); }
.card-landscape-comparison figure { min-width: 0; margin: 0; }
.card-art-open.landscape img { display: block; width: 100%; aspect-ratio: 15 / 8; border: 1px solid #e2e7ea; border-radius: 6px; object-fit: cover; }
.card-landscape-comparison figcaption { margin-top: var(--gs-space-2); color: #75808a; font-size: var(--gs-text-meta); text-align: center; }
.card-head-copy { min-width: 0; }
.card-detail-head h3 { margin: var(--gs-space-3) 0 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.4; overflow-wrap: anywhere; color: #222; }
.card-owner-block { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; margin-top: var(--gs-space-4); }
.card-owner-block > span, .card-owner-relation > span { flex: 0 0 auto; color: #71838a; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.card-detail-controls { display: flex; align-items: center; gap: var(--gs-space-3); margin-top: var(--gs-space-5); }
.card-nav-button { display: grid; flex: 0 0 var(--gs-control-compact); place-items: center; width: var(--gs-control-compact); height: var(--gs-control-compact); padding: 0; border: 1px solid #dce2e5; border-radius: var(--gs-radius-control); background: #fff; color: #41515c; cursor: pointer; }
.card-nav-button:hover:not(:disabled) { border-color: #9ec8c3; background: #f1faf9; color: #147f77; }
.card-nav-button:disabled { color: #b7bfc4; cursor: not-allowed; }
.art-mode-control { display: grid; flex: 0 0 auto; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #dce2e5; border-radius: var(--gs-radius-control); overflow: hidden; }
.art-mode-control button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 0; border-right: 1px solid #dce2e5; background: #fff; color: #61717a; cursor: pointer; font-size: var(--gs-text-ui); white-space: nowrap; }
.art-mode-control button:last-child { border-right: 0; }
.art-mode-control button.active { background: #e8f6f4; color: #147f77; font-weight: var(--gs-weight-semibold); }
.card-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); color: #777; font-family: monospace; font-size: var(--gs-text-meta); }
.card-raw-candidate { color: #985f00; background: #fff4d6; border: 1px solid #f0ca72; border-radius: var(--gs-radius-pill); padding: var(--gs-space-1) var(--gs-space-3); }
.card-rarity {
  display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 24px;
  border-radius: var(--gs-radius-control); background: #edf2ff; color: #3157a4; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-bold);
}
.card-attribute { padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid #efb9ac; border-radius: var(--gs-radius-control); background: #fff4f0; color: #a33f29; font-family: inherit; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.asset-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-3); margin: var(--gs-space-6) 0 0; }
.asset-status-grid div { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: center; gap: var(--gs-space-1) var(--gs-space-3); min-width: 0; padding: var(--gs-space-3); border: 1px solid #d8ebe8; border-radius: var(--gs-radius-control); color: #168b83; }
.asset-status-grid div.missing { border-color: #e1e5e7; color: #8a949b; }
.asset-status-grid svg { grid-row: 1 / 3; }
.asset-status-grid dt { overflow-wrap: anywhere; color: #39464f; font-size: var(--gs-text-meta); }
.asset-status-grid dd { margin: 0; font-size: var(--gs-text-meta); }
.card-detail-section h4 { margin: 0 0 var(--gs-space-4); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); color: #333; }
.card-relations { display: flex; flex-direction: column; gap: var(--gs-space-4); }
.card-relations h4 { margin-bottom: 0; }
.card-owner-relation { display: grid; gap: var(--gs-space-3); max-width: 360px; }
.gameplay-layout { display: grid; grid-template-columns: minmax(330px, 1.05fr) minmax(260px, 0.95fr); gap: var(--gs-space-5); }
.parameter-panel, .skill-panel { min-width: 0; }
.parameter-heading { display: flex; align-items: center; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); color: #a33f29; }
.parameter-heading strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.parameter-heading span { display: inline-flex; align-items: center; gap: var(--gs-space-2); margin-left: auto; color: #67747c; font-size: var(--gs-text-meta); }
.parameter-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
.parameter-table th, .parameter-table td { padding: var(--gs-space-3); border-bottom: 1px solid #edf0f2; text-align: right; font-size: var(--gs-text-meta); }
.parameter-table thead th { color: #7a858c; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.parameter-table th:first-child { text-align: left; }
.parameter-table tbody th { color: #46545d; font-weight: var(--gs-weight-semibold); }
.parameter-table tr.total th, .parameter-table tr.total td { background: #f4f8fa; color: #263941; font-weight: var(--gs-weight-bold); }
.skill-panel { display: flex; flex-direction: column; gap: var(--gs-space-4); }
.skill-row { padding: var(--gs-space-4) 0; border-bottom: 1px solid #edf0f2; }
.skill-row:first-child { padding-top: 0; }
.skill-row:last-child { padding-bottom: 0; border-bottom: 0; }
.skill-row strong { color: #2d4551; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.skill-row p { margin: var(--gs-space-3) 0 0; color: #4c5c64; font-size: var(--gs-text-body); line-height: 1.6; overflow-wrap: anywhere; }
.skill-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-4); min-width: 0; }
.skill-title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.skill-category {
  display: inline-flex; align-items: center; min-height: 20px; padding: var(--gs-space-1) var(--gs-space-3);
  border: 1px solid color-mix(in srgb, var(--skill-category-color, #168b83) 45%, white);
  border-radius: var(--gs-radius-pill); background: color-mix(in srgb, var(--skill-category-color, #168b83) 10%, white);
  color: color-mix(in srgb, var(--skill-category-color, #168b83) 75%, #263941);
  font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); line-height: 1.2;
}
.skill-heading select { flex: 0 0 auto; min-height: var(--gs-control-compact); max-width: 100%; padding: 0 var(--gs-space-7) 0 var(--gs-space-3); border: 1px solid #d7dfe3; border-radius: var(--gs-radius-field); background: #fff; color: #40515a; font-size: var(--gs-text-ui); }
.limitbreak-item-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: var(--gs-space-4); padding-top: var(--gs-space-4); border-top: 1px solid #edf0f2; color: #4d8d88; }
.limitbreak-item-row small { display: block; margin-bottom: var(--gs-space-1); color: #78878e; font-family: monospace; font-size: var(--gs-text-meta); }
.limitbreak-item-row strong { color: #2d4551; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.limitbreak-item-row p { margin: var(--gs-space-2) 0 0; white-space: pre-wrap; color: #4c5c64; font-size: var(--gs-text-body); line-height: 1.5; }
.costume-list { display: flex; flex-direction: column; }
.costume-group { min-width: 0; padding: var(--gs-space-4) 0; border-bottom: 1px solid #edf0f2; color: #58718a; }
.costume-group:last-child { border-bottom: 0; }
.costume-group-header { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.costume-group-header > svg { flex: 0 0 20px; }
.costume-group-title { min-width: 0; margin: 0; color: #293b45; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.costume-flavor { box-sizing: border-box; margin: var(--gs-space-4) 0; padding: 10px var(--gs-space-4); border-left: 2px solid #71b6aa; border-radius: 0 var(--gs-radius-field) var(--gs-radius-field) 0; background: #f3f8f6; white-space: pre-wrap; color: #4d5c64; font-size: var(--gs-text-ui); line-height: 1.6; overflow-wrap: anywhere; }
.costume-variants { display: grid; gap: 6px; margin-top: var(--gs-space-3); }
.costume-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-3); min-width: 0; }
.costume-variant-name { color: #40535b; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.costume-conditions { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); min-width: 0; }
.costume-condition { max-width: 100%; padding: 2px 6px; border-radius: var(--gs-radius-control); background: #eef3f1; color: #58706b; font-size: var(--gs-text-meta); line-height: 1.5; overflow-wrap: anywhere; }
.release-series { border-top: 1px solid #edf0f2; padding-top: var(--gs-space-4); }
.release-series-cards { display: flex; gap: var(--gs-space-3); margin-top: var(--gs-space-4); padding-bottom: var(--gs-space-2); overflow-x: auto; overscroll-behavior-inline: contain; }
.release-series-cards button { flex: 0 0 74px; min-width: 0; padding: var(--gs-space-2); border: 1px solid #e1e6e9; border-radius: var(--gs-radius-control); background: #fff; color: #4b5962; cursor: pointer; }
.release-series-cards button:hover:not(:disabled) { border-color: #9fc8c3; background: #f1faf9; }
.release-series-cards button.current { border-color: #65b8ae; background: #e9f7f5; }
.release-series-cards button:disabled { cursor: default; }
/* Preserve the archived series-icon crop and its established 74px entry width. */
.release-series-cards img { display: block; width: 62px; height: 62px; margin-inline: auto; border-radius: 4px; background: #eef1f3; object-fit: cover; }
.release-series-cards span { display: block; margin-top: var(--gs-space-2); font-size: var(--gs-text-meta); text-align: center; overflow-wrap: anywhere; }
.reflowed-text { display: none; }
.card-text-block { border-top: 1px solid #f0f0f0; padding-top: var(--gs-space-4); margin-top: var(--gs-space-4); }
.card-text-block:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
.card-text-block strong { display: block; margin-bottom: var(--gs-space-3); color: #3157a4; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.card-text-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-3); }
.card-text-heading strong { margin: 0; }
.card-text-voice { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.card-text-voice audio { width: min(300px, 32vw); height: 30px; }
.card-text-block p { margin: 0; white-space: pre-wrap; line-height: 1.65; color: #222; }
.voice-list, .scenario-link-list { display: flex; flex-direction: column; gap: var(--gs-space-3); }
.voice-row {
  display: grid; grid-template-columns: minmax(160px, 1fr) minmax(220px, 360px) auto;
  align-items: center; gap: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4);
  border: 1px solid #f0f0f0; border-radius: var(--gs-radius-control); background: #fafafa;
}
.voice-row > span { font-family: monospace; font-size: var(--gs-text-meta); color: #555; overflow-wrap: anywhere; }
.voice-row audio { width: 100%; height: 32px; }
.voice-copy { min-width: 0; }
.voice-copy strong { color: #344851; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.voice-copy p { margin: var(--gs-space-2) 0 0; white-space: pre-wrap; color: #4f5e66; font-size: var(--gs-text-body); line-height: 1.5; }
.voice-copy code { display: block; margin-top: var(--gs-space-2); color: #89949a; font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.voice-label { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); }
.voice-label small { padding: var(--gs-space-1) var(--gs-space-2); border-radius: var(--gs-radius-control); background: #eef2f4; color: #6b7980; font-size: var(--gs-text-meta); }
.voice-label small.source-masterdata { background: #e9f7f5; color: #197b73; }
.voice-label small.source-curated { background: #fff3d8; color: #8b6413; }
.voice-preview-btn {
  min-height: var(--gs-control-compact); border: 1px solid #c8dcff; border-radius: var(--gs-radius-control);
  background: #f5faff; color: #245b91; padding: var(--gs-space-2) var(--gs-space-4); cursor: pointer;
  font-size: var(--gs-text-ui); white-space: nowrap;
}
.voice-preview-btn:hover { background: #e8f2ff; }
.scenario-link-btn {
  display: flex; flex-direction: column; gap: var(--gs-space-2); text-align: left;
  min-height: var(--gs-control-normal); font-size: var(--gs-text-body);
  background: #fafafa; border: 1px solid #eee; border-radius: var(--gs-radius-control);
  padding: var(--gs-space-3) var(--gs-space-4); cursor: pointer; color: #333;
}
.scenario-link-btn:hover:not(:disabled) { background: #f0f4ff; border-color: #c8dcff; }
.scenario-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.scenario-link-btn span { overflow-wrap: anywhere; }
.scenario-link-btn small { color: #888; font-family: monospace; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.card-detail :deep(.archive-idol-reference) { gap: var(--gs-space-4); padding: var(--gs-space-3); }
.card-detail .card-owner-block :deep(.density-identity) { gap: var(--gs-space-3); padding: var(--gs-space-2); }
.card-detail :deep(.idol-reference-copy), .card-detail :deep(.relation-copy) { gap: var(--gs-space-2); }
.card-detail :deep(.relation-list) { gap: var(--gs-space-3); }
.card-detail :deep(.relation-row) { gap: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); font-weight: var(--gs-weight-semibold); }
.card-detail :deep(.relation-labels) { gap: var(--gs-space-2); }
.card-detail :deep(.relation-labels small) { padding: var(--gs-space-1) var(--gs-space-2); border-radius: var(--gs-radius-control); }
.card-detail .card-owner-block :deep(.idol-reference-copy strong), .card-detail .card-owner-relation :deep(.idol-reference-copy strong), .card-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.card-detail :deep(.idol-reference-copy small), .card-detail :deep(.relation-meta), .card-detail :deep(.relation-proof), .card-detail :deep(.relation-labels strong), .card-detail :deep(.relation-labels small) { font-size: var(--gs-text-meta); }
.card-detail :deep(.idol-reference-copy small), .card-detail :deep(.relation-meta), .card-detail :deep(.relation-proof) { font-weight: var(--gs-weight-regular); }
.card-detail :deep(.relation-copy code) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.card-detail .card-owner-block :deep(.idol-reference-copy strong), .card-detail .card-owner-relation :deep(.idol-reference-copy strong), .card-detail :deep(.idol-reference-copy small) { white-space: normal; text-overflow: clip; overflow-wrap: anywhere; }
.card-detail :deep(.density-identity .idol-reference-copy) { flex-wrap: wrap; gap: var(--gs-space-3); }
.card-detail :deep(.density-identity .idol-reference-copy small::before) { margin-right: var(--gs-space-3); }
.card-detail :deep(.relation-copy b) { white-space: normal; }
.card-detail :deep(.archive-technical) { margin-top: var(--gs-space-5); border-radius: var(--gs-radius-panel); }
.card-detail :deep(.archive-technical summary) { padding: var(--gs-space-5); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.card-detail :deep(.archive-technical summary:focus-visible) { outline: 3px solid var(--gs-color-accent); outline-offset: 2px; }
.card-detail :deep(.archive-technical-body) { padding: 0 var(--gs-space-5) var(--gs-space-5); font-size: var(--gs-text-body); }
.card-detail :deep(.archive-technical pre) { font-size: var(--gs-text-meta); }

/* Two ability columns need 606px, plus this section's 32px padding and 2px border. */
/* The header also reserves 240px for identity text and its roughly 208px touch controls. */
@container card-detail (max-width: 640px) { .card-detail-head, .gameplay-layout { grid-template-columns: minmax(0, 1fr); } }
@media (min-width: 701px) {
  /* A content-driven stack retains the desktop artwork's existing 340px column. */
  @container card-detail (max-width: 640px) { .card-art-comparison:not(.single) { max-width: 340px; } }
}
@container card-detail (max-width: 560px) { .voice-row { grid-template-columns: minmax(0, 1fr); }.voice-preview-btn { justify-self: start; } }
@media (max-width: 760px), (pointer: coarse) {
  .card-nav-button { width: var(--gs-control-touch); height: var(--gs-control-touch); flex: 0 0 var(--gs-control-touch); }
  .art-mode-control button, .voice-preview-btn, .skill-heading select, .scenario-link-btn { min-height: var(--gs-control-touch); }
  .skill-heading select { font-size: var(--gs-text-subtitle); }
}

@media (max-width: 700px) {
  .card-detail { padding: var(--gs-space-4); }
  .card-detail-head { grid-template-columns: 1fr; gap: var(--gs-space-5); }
  .authored-text { display: none; }
  .reflowed-text { display: inline; }
  .voice-row { grid-template-columns: minmax(0, 1fr); }
  .voice-copy p { line-height: 1.65; }
  .voice-preview-btn { justify-self: start; }
  .voice-row audio { grid-column: 1; }
  .card-landscape-comparison { grid-template-columns: 1fr; }
  .card-text-heading { align-items: flex-start; flex-direction: column; }
  .card-text-voice { width: 100%; }
  .card-text-voice audio { width: 100%; }
  .gameplay-layout { grid-template-columns: 1fr; }
  .parameter-table th, .parameter-table td { padding: var(--gs-space-3) var(--gs-space-2); }
}
</style>
