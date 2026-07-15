<template>
  <article v-if="event" class="event-detail">
    <section class="event-identity">
      <div class="event-visual">
        <img class="event-banner" :src="getEventBannerUrl(event.event_code)" :alt="event.title" />
        <img class="event-logo" :src="eventLogoUrl" alt="" />
      </div>
      <div class="event-summary">
        <div class="event-kicker">
          <span>EVENT {{ event.event_code }}</span>
          <small>{{ eventTypeLabel }}</small>
          <small>{{ scopeLabel }}</small>
        </div>
        <h2>{{ masterEvent?.name || event.title }}</h2>
        <dl>
          <div><dt>活动开始</dt><dd>{{ formatDateTime(masterEvent?.start_at || event.release_at) }}</dd></div>
          <div><dt>活动结束</dt><dd>{{ formatDateTime(masterEvent?.end_at) }}</dd></div>
          <div><dt>展示结束</dt><dd>{{ formatDateTime(masterEvent?.display_end_at) }}</dd></div>
          <div><dt>活动形式</dt><dd>{{ eventTypeLabel }}</dd></div>
          <div v-if="masterEvent?.bgm_resource_id"><dt>活动 BGM</dt><dd>{{ masterEvent.bgm_resource_id }}</dd></div>
          <div><dt>故事章节</dt><dd>{{ masterEvent?.story_chapter_id || event.event_id }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="story-band" aria-labelledby="event-synopsis-title">
      <div>
        <span>故事简介</span>
        <h3 id="event-synopsis-title">{{ story?.preplaySynopsis?.title || event.title }}</h3>
        <p>{{ story?.preplaySynopsis?.text || '本地剧情文件已收录，可直接进入正式播放。' }}</p>
      </div>
      <button :disabled="!event.exists" @click="emit('play')">
        <Play :size="17" fill="currentColor" />
        <span>{{ event.exists ? '播放活动剧情' : '缺少剧情文件' }}</span>
      </button>
    </section>

    <section v-if="episodes.length" class="detail-section episode-section" aria-labelledby="event-episodes-title">
      <div class="section-heading">
        <div>
          <h3 id="event-episodes-title">活动剧情</h3>
          <p>从序章或指定 Episode 的正式剧情边界开始播放。</p>
        </div>
        <span class="episode-count">{{ episodes.length }} episodes</span>
      </div>
      <div class="episode-list">
        <button
          v-for="(episode, index) in episodes"
          :key="episode.id"
          :disabled="!event.exists"
          @click="emit('play-episode', episode)"
        >
          <span class="episode-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="episode-copy">
            <strong>{{ episode.label }}</strong>
            <small>{{ episode.resourceId }}</small>
          </span>
          <span class="episode-stats">
            <span>{{ episode.dialogueCount }} dialogues</span>
            <span>{{ episode.voiceCount }} voices</span>
          </span>
          <Play :size="16" fill="currentColor" />
        </button>
      </div>
    </section>

    <section class="detail-section reward-section" aria-labelledby="event-rewards-title">
      <div class="section-heading">
        <div>
          <h3 id="event-rewards-title">活动报酬卡</h3>
          <p>读取 masterdata 的剧情阅读报酬与累计 PT 报酬，不以同期发布时间代替获得方式。</p>
        </div>
        <span class="raw-badge">Raw · {{ rewardCards.length }}</span>
      </div>
      <div v-if="rewardCards.length" class="reward-grid">
        <button v-for="card in rewardCards" :key="card.card_resource_id" @click="emit('open-card', card)">
          <img :src="getCardIconUrl(card.card_resource_id, true)" :alt="card.card_title" />
          <div class="reward-copy">
            <span>{{ card.rarity }} · {{ idolName(card.character_id) }}</span>
            <strong>{{ card.card_title }}</strong>
            <ul>
              <li v-for="method in card.methods" :key="method.key">
                <BookOpen v-if="method.kind === 'story'" :size="13" />
                <Gauge v-else :size="13" />
                <span>{{ method.label }}</span>
              </li>
            </ul>
          </div>
          <ChevronRight :size="17" />
        </button>
      </div>
      <p v-else class="empty-copy">当前活动类型未在本地静态报酬表中检出卡片报酬。</p>
    </section>

    <section class="detail-section" aria-labelledby="event-cast-title">
      <div class="section-heading"><h3 id="event-cast-title">出演与归属</h3></div>
      <div class="cast-layout">
        <div class="idol-list">
          <button v-for="idol in idols" :key="idol.idol_code" @click="emit('open-idol', idol)">
            <img :src="`/assets/idols/icons/image_chara_icon_${idol.idol_code}.png`" :alt="idol.display_name || idol.idol_code" />
            <span>{{ idol.display_name || idol.idol_code }}</span>
          </button>
        </div>
        <div class="unit-list">
          <button v-for="unit in units" :key="unit.unit_id" @click="emit('open-unit', unit)">
            <img :src="getUnitLogoUrl(unit.unit_code)" alt="" />
            <span>{{ unit.unit_name }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="derivedOnlyCards.length" class="detail-section" aria-labelledby="event-related-title">
      <div class="section-heading">
        <div><h3 id="event-related-title">其他同期关联</h3><p>仅由开放时间与出演阵容推导，尚未在报酬表中确认获得方式。</p></div>
        <span class="derived-badge">Derived · {{ derivedOnlyCards.length }}</span>
      </div>
      <ArchiveRelationList layout="grid" :items="derivedRelationItems" @select="emit('open-card', $event.payload)" />
    </section>

    <section class="detail-section evidence-section" aria-labelledby="event-evidence-title">
      <div class="section-heading"><h3 id="event-evidence-title">资料来源</h3></div>
      <dl>
        <div><dt>活动实体</dt><dd>Raw · table 112</dd></div>
        <div><dt>活动详情</dt><dd>Raw · table {{ masterEvent?.event_type === 3 ? 124 : 113 }}</dd></div>
        <div><dt>累计 PT 报酬</dt><dd>Raw · table {{ masterEvent?.event_type === 3 ? 126 : 114 }}</dd></div>
        <div><dt>剧情阅读报酬</dt><dd>Raw · table 10 / 11 / 12 / 70</dd></div>
        <div><dt>剧情文件</dt><dd>{{ event.file }}</dd></div>
        <div><dt>归属判定</dt><dd>{{ event.classification_source }}</dd></div>
      </dl>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, ChevronRight, Gauge, Play } from '@lucide/vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { getEventBannerUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

const props = defineProps({
  event: { type: Object, default: null },
  masterEvent: { type: Object, default: null },
  story: { type: Object, default: null },
  episodes: { type: Array, default: () => [] },
  cards: { type: Array, default: () => [] },
  idols: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
})
const emit = defineEmits(['play', 'play-episode', 'open-card', 'open-idol', 'open-unit'])

const eventLogoUrl = computed(() => `/assets/events/logos/image_event_logo_${props.event?.event_code}.png`)
const eventTypeLabel = computed(() => ({
  theater: 'THEATER 累计 PT',
  tour: 'TOUR 累计 PT',
  carnival: '315 CARNIVAL',
  valentine: 'VALENTINE',
  whiteday: 'WHITEDAY',
}[props.masterEvent?.event_type_label] || '活动剧情'))
const scopeLabel = computed(() => ({
  fixed_unit_event: '固定组合团活',
  attribute_event: `${props.event?.attribute || ''} 属性团曲`.trim(),
  mixed_unit_event: '跨组合团活',
}[props.event?.event_scope] || '活动剧情'))

const rewardCards = computed(() => {
  const grouped = new Map()
  const add = reward => {
    const id = reward.card_resource_id
    if (!id) return
    if (!grouped.has(id)) grouped.set(id, { ...reward, methods: [] })
    const card = grouped.get(id)
    if (reward.source === 'event_story_read_reward') {
      card.methods.push({
        key: `story-${reward.episode_id}-${reward.availability}`,
        kind: 'story',
        label: `${reward.episode_title} 阅读报酬${reward.availability === 'in_event_term' ? '（活动期内）' : ''}`,
      })
    } else if (reward.reward_kind === 'card') {
      card.methods.push({ key: `point-card-${reward.required_points}`, kind: 'point', label: `${formatNumber(reward.required_points)} PT 获得卡片` })
    }
  }
  for (const reward of props.masterEvent?.story_reward_cards || []) add(reward)
  for (const reward of props.masterEvent?.point_reward_cards || []) add(reward)
  for (const card of grouped.values()) {
    const fragments = (props.masterEvent?.point_reward_cards || []).filter(reward =>
      reward.card_resource_id === card.card_resource_id && reward.reward_kind === 'card_fragment',
    )
    if (fragments.length) {
      card.methods.push({
        key: `fragments-${card.card_resource_id}`,
        kind: 'point',
        label: `${formatNumber(fragments[0].required_points)} PT 起，共 ${fragments.length} 次碎片报酬`,
      })
    }
  }
  return [...grouped.values()]
})
const rewardCardIds = computed(() => new Set(rewardCards.value.map(card => card.card_resource_id)))
const derivedOnlyCards = computed(() => props.cards.filter(card => !rewardCardIds.value.has(card.card_resource_id)))
const derivedRelationItems = computed(() => derivedOnlyCards.value.map(card => ({
  id: `card-${card.card_resource_id}`,
  kind: 'card',
  label: '同期关联卡',
  title: card.card_title,
  meta: `${card.character_name} · ${card.rarity}`,
  evidenceLabel: 'Derived',
  evidenceTone: 'derived',
  evidence: card.relation_type,
  statusLabel: '已建档',
  statusTone: 'available',
  resource: card.card_resource_id,
  imageUrl: getCardIconUrl(card.card_resource_id, true),
  imageAlt: card.card_title,
  payload: card,
})))

function idolName(id) {
  return props.idols.find(idol => idol.idol_code === id)?.display_name || id
}
function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}
function formatDateTime(timestamp) {
  if (!Number.isFinite(Number(timestamp))) return '未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo',
  }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
.event-detail { height: 100%; overflow-y: auto; background: #f5f7f8; color: #24313a; }
.event-identity { display: grid; grid-template-columns: minmax(420px, 1.4fr) minmax(280px, .6fr); gap: 28px; padding: 26px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe5e8; background: #fff; }
.event-visual { position: relative; align-self: start; overflow: hidden; aspect-ratio: 940 / 510; border: 1px solid #e1e6e8; border-radius: 6px; background: #e9eef0; }
.event-banner { display: block; width: 100%; height: 100%; object-fit: contain; }.event-logo { position: absolute; left: 20px; bottom: 16px; width: min(38%, 240px); max-height: 38%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,.28)); }
.event-summary { min-width: 0; padding-top: 4px; }.event-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: #16857d; font-size: .62rem; font-weight: 800; }.event-kicker small { padding: 3px 5px; border-radius: 3px; background: #eaf7f5; color: #277870; font-size: .53rem; }.event-summary h2 { margin: 11px 0 18px; font-size: 1.18rem; line-height: 1.45; }.event-summary dl { margin: 0; }.event-summary dl div { display: grid; grid-template-columns: 70px minmax(0,1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf0f2; font-size: .66rem; }.event-summary dt { color: #849097; }.event-summary dd { margin: 0; color: #36474f; font-variant-numeric: tabular-nums; }
.story-band { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 22px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #d7e6e4; background: #eaf6f4; }.story-band > div { min-width: 0; }.story-band > div > span { color: #147d76; font-size: .58rem; font-weight: 800; }.story-band h3 { margin: 7px 0 5px; font-size: .88rem; }.story-band p { max-width: 800px; margin: 0; color: #405159; font-size: .68rem; line-height: 1.75; white-space: pre-line; }.story-band > button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex: 0 0 auto; min-width: 142px; min-height: 40px; padding: 8px 13px; border: 1px solid #158f87; border-radius: 6px; background: #158f87; color: #fff; cursor: pointer; font: inherit; font-size: .68rem; }.story-band > button:disabled { border-color: #cbd3d6; background: #dfe5e7; color: #78848a; cursor: not-allowed; }
.detail-section { padding: 22px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #e1e6e8; background: #fff; }.detail-section + .detail-section { margin-top: 12px; }.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 14px; }.section-heading h3 { margin: 0; font-size: .86rem; }.section-heading p { margin: 4px 0 0; color: #849097; font-size: .59rem; }.raw-badge,.derived-badge { flex: 0 0 auto; padding: 4px 7px; border-radius: 4px; font-size: .58rem; font-weight: 700; }.raw-badge { background: #e5f6f3; color: #177970; }.derived-badge { background: #fff2d6; color: #8b6413; }
.episode-section { background: #f8fafb; }.episode-count { color: #6f7e85; font-size: .59rem; font-weight: 700; }.episode-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); border-top: 1px solid #dfe5e7; border-left: 1px solid #dfe5e7; }.episode-list button { display: grid; grid-template-columns: 32px minmax(0,1fr) auto 28px; align-items: center; gap: 9px; min-height: 58px; padding: 8px 10px; border: 0; border-right: 1px solid #dfe5e7; border-bottom: 1px solid #dfe5e7; background: #fff; color: #29383f; cursor: pointer; font: inherit; text-align: left; }.episode-list button:hover { background: #eff9f7; }.episode-list button:disabled { cursor: not-allowed; opacity: .55; }.episode-number { color: #17877f; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .62rem; font-weight: 800; }.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.episode-copy strong { font-size: .67rem; }.episode-copy small { overflow: hidden; color: #929ca1; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .48rem; text-overflow: ellipsis; white-space: nowrap; }.episode-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: #7d898f; font-size: .5rem; }.episode-list button > svg { color: #168a82; }
.reward-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }.reward-grid > button { display: grid; grid-template-columns: 72px minmax(0,1fr) 18px; align-items: center; gap: 10px; min-width: 0; min-height: 106px; padding: 8px; border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; color: #28363e; cursor: pointer; font: inherit; text-align: left; }.reward-grid > button:hover { border-color: #69beb7; background: #f4fbfa; }.reward-grid > button > img { width: 72px; aspect-ratio: 1; border-radius: 4px; object-fit: contain; }.reward-copy { min-width: 0; }.reward-copy > span { color: #168078; font-size: .55rem; font-weight: 700; }.reward-copy strong { display: block; overflow: hidden; margin: 4px 0 6px; font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }.reward-copy ul { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }.reward-copy li { display: flex; align-items: flex-start; gap: 4px; color: #69767e; font-size: .54rem; line-height: 1.35; }.reward-copy li svg { flex: 0 0 auto; margin-top: 1px; color: #248980; }.empty-copy { margin: 0; color: #7b878e; font-size: .66rem; }
.cast-layout { display: grid; grid-template-columns: 1fr auto; gap: 18px; }.idol-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(132px,1fr)); gap: 7px; }.unit-list { display: grid; gap: 7px; min-width: 180px; }.idol-list button,.unit-list button { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 52px; padding: 6px 9px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26323b; cursor: pointer; font: inherit; text-align: left; }.idol-list img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }.unit-list img { width: 70px; height: 38px; object-fit: contain; }.idol-list span,.unit-list span { overflow: hidden; font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }
.evidence-section { margin-bottom: 18px; }.evidence-section dl { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 24px; margin: 0; }.evidence-section dl div { display: grid; grid-template-columns: 90px minmax(0,1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid #edf0f2; }.evidence-section dt { color: #7d898f; font-size: .61rem; }.evidence-section dd { margin: 0; overflow-wrap: anywhere; color: #394a52; font-size: .63rem; }
@media (max-width: 900px) { .reward-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 760px) { .event-identity { grid-template-columns: 1fr; gap: 18px; padding: 16px; }.story-band { align-items: stretch; flex-direction: column; gap: 14px; padding: 18px 16px; }.detail-section { padding: 18px 16px; }.cast-layout { grid-template-columns: 1fr; }.unit-list { min-width: 0; }.evidence-section dl { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .episode-list { grid-template-columns: 1fr; }.episode-list button { grid-template-columns: 28px minmax(0,1fr) 26px; }.episode-stats { display: none; } }
@media (max-width: 520px) { .reward-grid { grid-template-columns: 1fr; }.event-summary h2 { font-size: 1rem; } }
</style>
