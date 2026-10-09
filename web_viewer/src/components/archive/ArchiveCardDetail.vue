<template>
  <section class="screen list-screen" data-archive-scroll-container>
    <ArchiveListHeader v-if="!embedded" :title="displayCardTitle || '卡片详情'" @back="emit('back')" />
    <div v-if="card" class="card-detail">
      <section class="card-hero" :class="`is-${stage.layout}`">
        <figure class="card-stage">
          <div v-if="stage.items.length" class="card-stage-rail" :style="{ '--stage-count': stage.items.length }">
            <button v-for="item in stage.items" :key="item.src" class="card-stage-art" :class="{ 'is-landscape': item.landscape }" type="button"
              :disabled="item.thumbnail" :title="item.thumbnail ? '只有缩略图资源' : `查看${item.label}原图`" @click="openLightbox(item.src)">
              <span class="card-stage-frame">
                <img :src="item.src" :alt="`${displayCardTitle} ${item.label}`" />
                <Expand v-if="!item.thumbnail" :size="17" aria-hidden="true" />
              </span>
              <span v-if="item.caption" class="card-stage-caption">{{ item.caption }}</span>
            </button>
          </div>
          <span v-else class="card-stage-missing"><ImageOff :size="24" aria-hidden="true" /><span>暂无卡面图像</span></span>
          <figcaption v-if="heroFrames.length > 1 || landscapeStates.length > 1 || stage.layout !== 'landscape'" class="card-stage-controls">
            <div v-if="heroFrames.length > 1" class="card-tabs" role="group" aria-label="画幅">
              <button v-for="frame in heroFrames" :key="frame.id" type="button" :aria-pressed="activeHeroFrame === frame.id" @click="heroFrame = frame.id">{{ frame.label }}</button>
            </div>
            <div v-if="stage.layout === 'landscape' && landscapeStates.length > 1" class="card-tabs" role="group" aria-label="卡面状态">
              <button v-for="state in landscapeStates" :key="state.id" type="button" :aria-pressed="activeLandscapeState === state.id" @click="heroState = state.id">{{ state.label }}</button>
            </div>
            <div v-if="stage.layout !== 'landscape' && !stage.items[0]?.thumbnail" class="card-tabs art-mode-control" role="group" aria-label="卡面边框模式">
              <button type="button" :aria-pressed="artMode === 'clean'" @click="emit('update:art-mode', 'clean')">无框</button>
              <button type="button" :aria-pressed="artMode === 'framed'" @click="emit('update:art-mode', 'framed')">带框</button>
            </div>
          </figcaption>
        </figure>
        <div class="card-identity">
          <div class="card-heading">
            <div class="card-marks">
              <span class="card-rarity">{{ card.rarity || 'CARD' }}</span>
              <span v-if="card.gameplay?.attribute?.name" class="card-attribute" :data-attribute="attributeKey">{{ attributeLabel(card.gameplay.attribute.name) }}</span>
              <span v-if="rawCandidateActive" class="card-raw-candidate">待核对卡面</span>
            </div>
            <h3 :title="card.title">{{ displayCardTitle }}</h3>
            <p v-if="card.title && card.title !== displayCardTitle" class="card-original-title" lang="ja">{{ card.title }}</p>
          </div>
          <div class="card-facts">
            <ArchiveIdolReference v-if="ownerReference" class="card-owner" :reference="ownerReference" :data-archive-focus-id="`card-owner:${card.resource_id}:head`" density="identity" @open="emit('open-idol', $event)" />
            <p v-if="card.gameplay" class="card-metaline">
              <span v-if="Number.isFinite(card.gameplay.life)"><b>{{ card.gameplay.life }}</b>Life</span>
              <span v-if="card.gameplay.center_skill?.name">中心效果 {{ archiveText('center-skill', card.gameplay.center_skill.name) }}</span>
              <span v-if="card.gameplay.skill?.name">技能 {{ archiveText('skill', card.gameplay.skill.name) }}</span>
            </p>
            <nav class="card-stepper" aria-label="同偶像卡片">
              <button class="card-step" type="button" :disabled="!previousCard" :title="previousCard ? archiveText('card', previousCard.title, 'title') || '卡片' : '已经是第一张'" @click="emit('navigate-card', previousCard)"><ChevronLeft :size="18" aria-hidden="true" />上一张</button>
              <button class="card-step" type="button" :disabled="!nextCard" :title="nextCard ? archiveText('card', nextCard.title, 'title') || '卡片' : '已经是最后一张'" @click="emit('navigate-card', nextCard)">下一张<ChevronRight :size="18" aria-hidden="true" /></button>
            </nav>
          </div>
        </div>
      </section>

      <section v-if="relationItems.length || card.release_series" class="card-detail-section card-relations">
        <h4>关联资料</h4>
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
                <div class="skill-title">
                  <small class="skill-kind">中心效果</small>
                  <strong>{{ centerSkillName }}</strong>
                  <span v-if="centerSkillCategory" class="skill-category">{{ centerSkillCategory }}</span>
                </div>
              </div>
              <p>{{ formatCardSkillDescription(archiveText('center-skill', card.gameplay.center_skill.description, 'description')) }}</p>
            </div>
            <div v-if="card.gameplay.skill?.name" class="skill-row">
              <div class="skill-heading">
                <div class="skill-title">
                  <small class="skill-kind">技能</small>
                  <strong>{{ skillName }}</strong>
                  <span
                    v-if="skillCategory"
                    class="skill-category"
                    :style="{ '--skill-category-color': card.gameplay.skill.category.color || '#168b83' }"
                  >
                    {{ skillCategory }}
                  </span>
                </div>
                <select v-if="card.gameplay.skill.levels?.length" v-model.number="selectedSkillLevel" aria-label="技能等级">
                  <option v-for="level in card.gameplay.skill.levels" :key="level.level" :value="level.level">Lv.{{ level.level }}</option>
                </select>
              </div>
              <p>{{ presentCardSkillDescription(selectedSkill?.description) }}</p>
            </div>
            <div v-if="resolvedLimitbreakMaterial || card.limitbreak_item?.name" class="limitbreak-item-row" :class="{ 'limitbreak-item-resolved': resolvedLimitbreakMaterial }">
              <template v-if="resolvedLimitbreakMaterial">
                <button
                  class="limitbreak-item-open"
                  type="button"
                  :data-archive-focus-id="`card-material:${card.resource_id}:${resolvedLimitbreakMaterial.key}`"
                  @click="emit('open-entity', resolvedLimitbreakMaterial.key)"
                >
                  <span class="limitbreak-item-image" aria-hidden="true">
                    <img v-if="resolvedLimitbreakMaterial.image?.url && !limitbreakImageFailed" :key="`${card.resource_id}:${resolvedLimitbreakMaterial.image.url}`" :src="resolvedLimitbreakMaterial.image.url" alt="" loading="lazy" @error="onLimitbreakImageError" />
                    <PackageOpen v-else :size="22" />
                  </span>
                  <span class="limitbreak-item-copy">
                    <small>突破素材</small>
                    <strong :title="resolvedLimitbreakMaterial.nameJa">{{ archiveText('item', resolvedLimitbreakMaterial.nameJa) }}</strong>
                  </span>
                  <ChevronRight :size="17" aria-hidden="true" />
                </button>
                <p v-if="resolvedLimitbreakMaterial.description">{{ archiveText('item', resolvedLimitbreakMaterial.description, 'description') }}</p>
              </template>
              <template v-else>
                <PackageOpen :size="19" />
                <div>
                  <small>突破素材</small>
                  <strong :title="card.limitbreak_item.name">{{ archiveText('item', card.limitbreak_item.name) }}</strong>
                  <p>{{ archiveText('item', card.limitbreak_item.description, 'description') }}</p>
                </div>
              </template>
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
              <small v-if="group.flavor.heading" class="costume-setting-heading">{{ group.flavor.heading }}</small>
              <span class="authored-text">{{ group.flavor.authoredBody }}</span><span class="reflowed-text">{{ group.flavor.reflowedBody }}</span>
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
          <p lang="ja"><span class="authored-text">{{ presentProducerAddressingText(card.texts.normal) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.normal)) }}</span></p>
        </div>
        <div v-if="card.texts?.awakened" class="card-text-block">
          <div class="card-text-heading">
            <strong>{{ card.single_state ? '卡面台词' : '特训后' }}</strong>
            <div v-if="card.card_text_voices?.awakened" class="card-text-voice">
              <ArchiveVoiceRow :src="voiceUrl(card.card_text_voices.awakened)" />
              <button v-if="cardVoicePreviewStep(card, card.card_text_voices.awakened)" class="voice-preview-btn" @click="emit('preview-voice', card.card_text_voices.awakened)">演出预览</button>
            </div>
          </div>
          <p lang="ja"><span class="authored-text">{{ presentProducerAddressingText(card.texts.awakened) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.awakened)) }}</span></p>
        </div>
        <div v-if="card.texts?.extra?.trim() && card.texts.extra !== '0'" class="card-text-block">
          <strong>短台词</strong>
          <p lang="ja"><span class="authored-text">{{ presentProducerAddressingText(card.texts.extra) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(card.texts.extra)) }}</span></p>
        </div>
      </section>

      <section v-if="card.home_voice_cues?.length" class="card-detail-section">
        <h4>首页触摸语音</h4>
        <div class="voice-list">
          <div v-for="(cue, index) in card.home_voice_cues" :key="cue.cue" class="voice-row">
            <div class="voice-copy">
              <strong>触摸语音 {{ index + 1 }}</strong>
              <p v-if="cue.preview?.text" lang="ja"><span class="authored-text">{{ presentProducerAddressingText(cue.preview.text) }}</span><span class="reflowed-text">{{ reflowArchiveText(presentProducerAddressingText(cue.preview.text)) }}</span></p>
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

      <section v-if="communicationRows.length" class="card-detail-section">
        <h4>通信</h4>
        <div class="scenario-link-list">
          <button
            v-for="row in communicationRows"
            :key="row.id"
            class="scenario-link-btn"
            :disabled="!row.compiled_file"
            @click="emit('open-scenario', row)"
          >
            <span>{{ row.title }}</span>
            <small>{{ row.compiled_file ? row.label : `${row.label} · 暂未收录` }}</small>
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
import { CheckCircle2, ChevronLeft, ChevronRight, CircleSlash, Expand, ImageOff, PackageOpen, Shirt } from '@lucide/vue'
import ArchiveImageLightbox from './ArchiveImageLightbox.vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { presentCardSkillDescription as formatCardSkillDescription } from '../../presentation/CardSkillDescriptionPresenter.js'
import {archiveText} from './useArchiveCardText.js'
import {gashaText} from './useArchiveGashaText.js'
const presentCardSkillDescription = source => formatCardSkillDescription(archiveText('skill', source, 'description'))
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { cardCommunicationLabel, cardScenarioTitle } from '../../presentation/CardPresentation.js'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { eventBannerUrl } from '../../data/eventResourceGraph.js'
import { cardVoicePreviewStep } from '../../data/cardVoicePreview.js'
import { getVoiceUrl } from '../../utils/AssetResolver.js'
import {
  getCardIconUrl,
  getCardLandscapeUrl,
  getCardPortraitUrl,
  isRawCardCandidate,
} from '../../utils/CardAssetResolver.js'
import { presentCardAssetRows, presentCardCostumeGroups, presentCardCostumeFlavor } from '../../presentation/CardDetailSemantics.js'
import { attributeLabel, attributeKey as attributeKeyOf } from '../../presentation/AttributeLabel.js'

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
  limitbreakMaterial: { type: Object, default: null },
})
// What the card opens in 通信: calls after limit break, training or acquisition, and the chat
// after scouting it. None of these is an ADV story.
const communicationRows = computed(() => (props.card?.scenario_entries || []).map(entry => ({
  id: entry.resource_id, title: cardScenarioTitle(entry), compiled_file: entry.compiled_file,
  label: cardCommunicationLabel(entry),
})))
const emit = defineEmits([
  'back',
  'preview-voice',
  'open-scenario',
  'navigate-card',
  'navigate-related-card',
  'open-event',
  'open-gasha',
  'open-idol',
  'open-entity',
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

// The stage shows the card's artwork at once: both portraits side by side (普通 / 特训后), a
// single-state portrait beside the title, or — for SSR — the landscape of the chosen state.
const heroState = ref('normal'), heroFrame = ref('landscape')
const landscapeStates = computed(() => {
  const status = props.assetStatus || {}
  return [status.normal_landscape && { id: 'normal', label: '普通' }, status.awakened_landscape && { id: 'awakened', label: '特训后' }].filter(Boolean)
})
const activeLandscapeState = computed(() => landscapeStates.value.find(state => state.id === heroState.value)?.id || landscapeStates.value[0]?.id || '')
const heroFrames = computed(() => {
  const status = props.assetStatus || {}
  return [
    (status.normal_landscape || status.awakened_landscape) && { id: 'landscape', label: '横图' },
    (status.normal_portrait || status.awakened_portrait) && { id: 'portrait', label: '卡面' },
  ].filter(Boolean)
})
const activeHeroFrame = computed(() => heroFrames.value.some(frame => frame.id === heroFrame.value) ? heroFrame.value : heroFrames.value[0]?.id || 'portrait')
const stage = computed(() => {
  const status = props.assetStatus || {}, single = Boolean(props.card?.single_state)
  if (activeHeroFrame.value === 'landscape' && activeLandscapeState.value) {
    const awakened = activeLandscapeState.value === 'awakened'
    return { layout: 'landscape', items: [{ src: awakened ? awakenedLandscapeUrl.value : normalLandscapeUrl.value, label: awakened ? '特训后横图' : '普通横图', landscape: true }] }
  }
  const portraits = [
    !single && status.normal_portrait && { src: normalPortraitUrl.value, label: '普通卡面', caption: '普通' },
    status.awakened_portrait && { src: awakenedPortraitUrl.value, label: single ? '卡面' : '特训后卡面', caption: single ? '' : '特训后' },
  ].filter(Boolean)
  if (portraits.length) return { layout: portraits.length > 1 ? 'pair' : 'single', items: portraits }
  const icons = props.card ? [
    !single && status.normal_icon && { src: getCardIconUrl(props.card.resource_id, false), label: '普通缩略图', caption: '普通', thumbnail: true },
    status.awakened_icon && { src: getCardIconUrl(props.card.resource_id, true), label: '缩略图', caption: single ? '' : '特训后', thumbnail: true },
  ].filter(Boolean) : []
  return { layout: icons.length > 1 ? 'pair' : 'single', items: icons }
})
const attributeKey = computed(() => attributeKeyOf(props.card?.gameplay?.attribute?.name))

watch(() => props.card?.resource_id, () => {
  selectedSkillLevel.value = props.card?.gameplay?.skill?.levels?.[0]?.level || 1
  heroState.value = props.card?.single_state ? 'awakened' : 'normal'
  heroFrame.value = 'landscape'
}, { immediate: true })

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
  costume => archiveText('costume', costume.description, 'description')).map(group => ({
    ...group, flavor: presentCardCostumeFlavor(group.description, group.sourceDescription),
  })))

// Many skills are named after their own category; the tag only speaks when it adds something.
const distinctLabel = (name, label) => label && label.replace(/\s+/gu, '') !== String(name || '').replace(/\s+/gu, '') ? label : ''
const centerSkillName = computed(() => archiveText('center-skill', props.card?.gameplay?.center_skill?.name))
const centerSkillCategory = computed(() => distinctLabel(centerSkillName.value,
  archiveText('center-skill', props.card?.gameplay?.center_skill?.category?.name)))
const skillName = computed(() => archiveText('skill', props.card?.gameplay?.skill?.name))
const skillCategory = computed(() => distinctLabel(skillName.value,
  archiveText('skill-category', props.card?.gameplay?.skill?.category?.name)))

const resolvedLimitbreakMaterial = computed(() => {
  const item = props.limitbreakMaterial, id = props.card?.limitbreak_item_id
  // A delayed or unmapped context must never navigate to another card's item.
  return Number.isInteger(id) && id > 0 && item?.referenceStatus === 'resolved-entity' &&
    item.kind === 'item' && item.id === id && item.key === `item:${id}` &&
    typeof item.nameJa === 'string' && item.nameJa.trim()
    ? item : null
})
const limitbreakImageFailed = ref(false)
watch(() => [props.card?.resource_id, resolvedLimitbreakMaterial.value?.key, resolvedLimitbreakMaterial.value?.image?.url],
  () => { limitbreakImageFailed.value = false })

function onLimitbreakImageError(event) {
  if (event.target?.getAttribute('src') === resolvedLimitbreakMaterial.value?.image?.url) limitbreakImageFailed.value = true
}

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
      imageUrl: eventBannerUrl(props.eventRelation),
      imageAlt: props.eventRelation.title,
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
/* Card detail: one artwork hero, an identity column, then flat sections under hairlines. */
.list-screen { height: 100%; padding: 0; overflow-x: hidden; overflow-y: auto; background: var(--gs-paper); }
.card-detail { container: card-detail / inline-size; display: grid; gap: var(--gs-space-section); min-width: 0; max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-8) var(--gs-space-8) var(--gs-space-9); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.card-detail button, .card-detail select { font-family: inherit; }
.card-detail button:focus-visible, .card-detail select:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

/* Hero: a stage that shows the artwork at once, then the identity beneath it.
   Portraits are 4:5 and SSR landscapes 16:9; the stage height follows the window. */
.card-hero { --stage-h: clamp(320px, calc(100svh - 300px), 560px); display: grid; gap: var(--gs-space-7); min-width: 0; }
.card-hero.is-single { grid-template-columns: minmax(0, calc(var(--stage-h) * .8)) minmax(0, 1fr); gap: var(--gs-space-8); align-items: start; }
.card-stage { display: grid; gap: var(--gs-space-4); min-width: 0; margin: 0; }
.card-stage-rail { display: grid; grid-template-columns: repeat(var(--stage-count, 1), minmax(0, calc(var(--stage-h) * .8))); justify-content: center; gap: var(--gs-space-5); min-width: 0; }
.is-landscape .card-stage-rail { grid-template-columns: minmax(0, calc(var(--stage-h) * 16 / 9)); }
.is-single .card-stage-rail { justify-content: stretch; grid-template-columns: minmax(0, 1fr); }
.card-stage-art { display: grid; gap: var(--gs-space-3); justify-items: center; min-width: 0; padding: 0; border: 0; background: none; color: var(--gs-ink-3); font: inherit; cursor: zoom-in; }
.card-stage-art:disabled { cursor: default; }
.card-stage-frame { position: relative; display: block; width: 100%; border-radius: var(--gs-radius-media); background: var(--gs-line); overflow: hidden; }
.card-stage-frame img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: contain; }
.card-stage-art.is-landscape .card-stage-frame img { aspect-ratio: 16 / 9; object-fit: cover; }
.card-stage-frame > svg { position: absolute; right: var(--gs-space-3); bottom: var(--gs-space-3); padding: 6px; width: 30px; height: 30px; border-radius: var(--gs-radius-control); background: rgb(19 33 58 / 64%); color: #fff; opacity: 0; transition: opacity var(--gs-motion-feedback) var(--gs-motion-ease); }
.card-stage-art:hover .card-stage-frame > svg, .card-stage-art:focus-visible .card-stage-frame > svg { opacity: 1; }
.card-stage-caption { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: .04em; }
.card-stage-missing { display: grid; place-items: center; gap: var(--gs-space-3); aspect-ratio: 16 / 9; border-radius: var(--gs-radius-media); background: var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.card-stage-controls { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--gs-space-3) var(--gs-space-7); }
.is-single .card-stage-controls { justify-content: start; }
.card-tabs { display: flex; gap: var(--gs-space-5); border-bottom: 1px solid var(--gs-line); }
.card-tabs button { min-height: var(--gs-control-normal); margin-bottom: -1px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--gs-ink-3); font-size: var(--gs-text-ui); cursor: pointer; }
.card-tabs button[aria-pressed="true"] { border-bottom-color: var(--gs-mint); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }

/* Identity: heading on the left, owner/facts on the right under a wide stage; stacked beside a single portrait. */
.card-identity { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: var(--gs-space-6) var(--gs-space-8); align-items: start; min-width: 0; }
.is-single .card-identity { grid-template-columns: minmax(0, 1fr); }
.card-heading, .card-facts { display: grid; gap: var(--gs-space-4); align-content: start; min-width: 0; }
.card-facts { gap: var(--gs-space-5); }
.card-marks { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-3) var(--gs-space-5); }
.card-rarity { font-family: var(--gs-font-stage); font-size: var(--gs-text-title); font-style: italic; font-weight: var(--gs-weight-bold); line-height: 1; letter-spacing: .02em; }
.card-attribute { display: inline-flex; align-items: center; gap: var(--gs-space-2); color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.card-attribute::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.card-attribute[data-attribute="physical"] { color: var(--gs-attr-physical); }
.card-attribute[data-attribute="intelli"] { color: var(--gs-attr-intelli); }
.card-attribute[data-attribute="mental"] { color: var(--gs-attr-mental); }
.card-raw-candidate { color: var(--gs-critical); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.card-identity h3 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; overflow-wrap: anywhere; text-wrap: balance; }
.card-original-title { margin: calc(-1 * var(--gs-space-2)) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-body); }
.card-identity :deep(.card-owner) { padding: var(--gs-space-4) 0; border: 0; border-top: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; }
.card-metaline { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-6); margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.card-metaline b { margin-right: var(--gs-space-2); color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.card-stepper { display: flex; gap: var(--gs-space-3); }
.card-step { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font-size: var(--gs-text-ui); cursor: pointer; }
.card-step:disabled { color: var(--gs-ink-3); background: transparent; cursor: default; }
@media (hover: hover) { .card-step:hover:not(:disabled) { border-color: var(--gs-ink-3); } }

/* Sections */
.card-detail-section { display: grid; gap: var(--gs-space-5); min-width: 0; }
.card-detail-section h4 { margin: 0; padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.release-series-cards { display: flex; gap: var(--gs-space-3); padding-bottom: var(--gs-space-2); overflow-x: auto; overscroll-behavior-inline: contain; }
.release-series-cards button { flex: 0 0 74px; min-width: 0; padding: var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.release-series-cards button.current { background: var(--gs-mint-wash); color: var(--gs-ink); }
.release-series-cards button:disabled { cursor: default; }
/* Preserve the archived series-icon crop and its established 74px entry width. */
.release-series-cards img { display: block; width: 62px; height: 62px; margin-inline: auto; border-radius: var(--gs-radius-media); background: var(--gs-line); object-fit: cover; }
.release-series-cards span { display: block; margin-top: var(--gs-space-2); font-size: var(--gs-text-meta); text-align: center; overflow-wrap: anywhere; }
@media (hover: hover) { .release-series-cards button:hover:not(:disabled) { background: var(--gs-mint-wash); } }

/* Abilities and skills */
.gameplay-layout { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: var(--gs-space-8); }
.parameter-panel, .skill-panel { min-width: 0; }
.parameter-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
.parameter-table th, .parameter-table td { padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); text-align: right; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }
.parameter-table td { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); }
.parameter-table thead th { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.parameter-table th:first-child { text-align: left; }
.parameter-table tbody th { color: var(--gs-ink-2); }
.parameter-table tr.total th, .parameter-table tr.total td { color: var(--gs-ink); font-weight: var(--gs-weight-bold); }
.skill-panel { display: grid; align-content: start; }
.skill-row { display: grid; gap: var(--gs-space-2); padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.skill-row:first-child { padding-top: 0; }
.skill-row strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); line-height: 1.4; overflow-wrap: anywhere; }
.skill-row p { margin: 0; color: var(--gs-ink-2); line-height: 1.7; overflow-wrap: anywhere; }
.skill-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--gs-space-4); min-width: 0; }
.skill-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-1) var(--gs-space-3); min-width: 0; }
/* The kind sits above its name as a small eyebrow, so the name itself is never prefixed. */
.skill-kind { flex-basis: 100%; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); line-height: 1.5; }
/* The game's own skill-category colour, kept as a small semantic mark. */
.skill-category { display: inline-flex; align-items: center; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.skill-category::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--skill-category-color, var(--gs-mint)); }
.skill-heading select { flex: 0 0 auto; min-height: var(--gs-control-compact); max-width: 100%; padding: 0 var(--gs-space-7) 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font-size: var(--gs-text-ui); }
.limitbreak-item-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); }
.limitbreak-item-row small { display: block; margin-bottom: var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.limitbreak-item-row strong { color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.limitbreak-item-row p { margin: var(--gs-space-2) 0 0; white-space: pre-wrap; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.7; }
.limitbreak-item-resolved { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-2); }
/* Same reading as the item catalogue: a white icon well on paper; mint only on hover. */
.limitbreak-item-open { display: grid; grid-template-columns: 56px minmax(0, 1fr) 16px; align-items: center; gap: var(--gs-space-4); width: calc(100% + 2 * var(--gs-space-3)); min-height: var(--gs-control-touch); margin: 0 calc(-1 * var(--gs-space-3)); padding: var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-3); text-align: left; cursor: pointer; transition: background var(--gs-motion-feedback); }
.limitbreak-item-open:hover { background: var(--gs-mint-wash); }
.limitbreak-item-open:hover strong, .limitbreak-item-open:hover > svg { color: var(--gs-mint-ink); }
.limitbreak-item-image { display: grid; place-items: center; width: 56px; height: 56px; overflow: hidden; border-radius: var(--gs-radius-media); background: var(--gs-surface); color: var(--gs-mint-ink); }
.limitbreak-item-image img { display: block; width: 44px; height: 44px; object-fit: contain; }
.limitbreak-item-copy { min-width: 0; }
.limitbreak-item-copy strong { display: block; line-height: 1.5; }
.limitbreak-item-resolved p { margin: 0; overflow-wrap: anywhere; }

/* Costumes */
.costume-list { display: grid; }
.costume-group { min-width: 0; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); }
.costume-group:first-child { padding-top: 0; }
.costume-group:last-child { border-bottom: 0; }
.costume-group-header { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.costume-group-header > svg { flex: 0 0 20px; }
.costume-group-title { min-width: 0; margin: 0; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.costume-flavor { margin: var(--gs-space-4) 0; padding: var(--gs-space-1) 0 var(--gs-space-1) var(--gs-space-5); border-left: 2px solid var(--gs-mint); white-space: pre-wrap; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.8; overflow-wrap: anywhere; }
.costume-setting-heading { display: block; margin-bottom: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.costume-variants { display: grid; gap: var(--gs-space-2); margin-top: var(--gs-space-3); }
.costume-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-3); min-width: 0; }
.costume-variant-name { color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.costume-conditions { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-4); min-width: 0; }
.costume-condition { color: var(--gs-ink-3); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }

/* Card lines, voices and stories */
.reflowed-text { display: none; }
.card-text-block { display: grid; gap: var(--gs-space-3); padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.card-text-block:first-of-type { padding-top: 0; }
.card-text-block > strong, .card-text-heading strong { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.card-text-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-4); }
.card-text-voice { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.card-text-voice audio { width: min(300px, 32vw); height: 32px; }
.card-text-block p { margin: 0; padding-left: var(--gs-space-5); border-left: 2px solid var(--gs-mint); white-space: pre-wrap; line-height: 2; }
.voice-list, .scenario-link-list { display: grid; }
.voice-row { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(220px, 340px) auto; align-items: center; gap: var(--gs-space-4); padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); }
.voice-row > span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.voice-row audio { width: 100%; height: 32px; }
.voice-copy { min-width: 0; }
.voice-copy strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.voice-copy p { margin: var(--gs-space-2) 0 0; white-space: pre-wrap; color: var(--gs-ink-2); line-height: 1.7; }
.voice-label { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); }
.voice-label small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.voice-label small.source-curated { color: var(--gs-mint-ink); }
.voice-preview-btn, .scenario-link-btn { border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; }
.voice-preview-btn { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); font-size: var(--gs-text-ui); white-space: nowrap; }
.scenario-link-list { gap: 0; }
.scenario-link-btn { display: grid; gap: var(--gs-space-1); min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; text-align: left; font-size: var(--gs-text-body); }
.scenario-link-btn:disabled { color: var(--gs-ink-3); cursor: default; }
.scenario-link-btn span { font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.scenario-link-btn small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (hover: hover) {
  .voice-preview-btn:hover, .limitbreak-item-open:hover { border-color: var(--gs-ink-3); }
  .scenario-link-btn:hover:not(:disabled) span { color: var(--gs-mint-ink); }
}

/* Maintainer asset checklist inside the sources disclosure */
.asset-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-2) var(--gs-space-6); margin: 0; }
.asset-status-grid div { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-3); min-width: 0; color: var(--gs-mint-ink); }
.asset-status-grid div.missing { color: var(--gs-ink-3); }
.asset-status-grid dt { overflow-wrap: anywhere; color: var(--gs-ink-2); font-size: var(--gs-text-meta); }
.asset-status-grid dd { margin: 0; font-size: var(--gs-text-meta); }

/* Shared references */
.card-detail :deep(.relation-row) { border-radius: var(--gs-radius-control); }
.card-detail :deep(.idol-reference-copy strong), .card-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.card-detail :deep(.idol-reference-copy small), .card-detail :deep(.relation-meta), .card-detail :deep(.relation-labels strong), .card-detail :deep(.relation-labels small) { font-size: var(--gs-text-meta); }

@container card-detail (max-width: 760px) {
  .card-hero, .card-hero.is-single, .card-identity, .gameplay-layout { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-6); }
  /* Narrow: portraits become a swipeable strip that peeks at the next state. */
  .is-pair .card-stage-rail { display: flex; justify-content: start; gap: var(--gs-space-4); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; margin-inline: calc(-1 * var(--gs-space-5)); padding-inline: var(--gs-space-5); scroll-padding-inline: var(--gs-space-5); }
  .is-pair .card-stage-rail::-webkit-scrollbar { display: none; }
  .is-pair .card-stage-art { flex: 0 0 84%; scroll-snap-align: start; }
  .is-single .card-stage-rail { max-width: 420px; }
  .card-stage-controls, .is-single .card-stage-controls { justify-content: start; }
  .voice-row { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-2); }
  .voice-preview-btn { justify-self: start; }
}
@media (max-width: 760px) {
  .card-detail { gap: var(--gs-space-8); padding: var(--gs-space-5) var(--gs-space-5) var(--gs-space-9); }
  .card-identity h3 { font-size: var(--gs-text-section); }
  .authored-text { display: none; }
  .reflowed-text { display: inline; }
  .card-tabs button, .card-step, .voice-preview-btn, .skill-heading select { min-height: var(--gs-control-touch); }
  .skill-heading select { font-size: var(--gs-text-subtitle); }
  .card-text-voice, .card-text-voice audio { width: 100%; }
  .asset-status-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .card-stage-frame > svg { transition: none; } }
</style>
