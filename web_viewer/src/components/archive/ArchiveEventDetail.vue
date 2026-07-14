<template>
  <article v-if="event" class="event-detail">
    <div class="event-visual">
      <img :src="getEventBannerUrl(event.event_code)" :alt="event.title" />
    </div>

    <header class="event-header">
      <div>
        <span>{{ event.series }}</span>
        <h2>{{ event.title }}</h2>
        <p>{{ scopeLabel }} · {{ formatDate(event.release_at) }} · EVENT {{ event.event_id }}</p>
      </div>
      <button :disabled="!event.exists" @click="emit('play')">
        <Play :size="17" fill="currentColor" />
        <span>{{ event.exists ? '播放活动剧情' : '缺少剧情文件' }}</span>
      </button>
    </header>

    <section class="event-section" aria-labelledby="event-idols-title">
      <div class="section-heading">
        <h3 id="event-idols-title">参与偶像</h3>
        <span>{{ idols.length }}</span>
      </div>
      <div class="idol-list">
        <button v-for="idol in idols" :key="idol.idol_code" @click="emit('open-idol', idol)">
          <img :src="`/assets/idols/icons/image_chara_icon_${idol.idol_code}.png`" :alt="idol.display_name || idol.idol_code" />
          <span>{{ idol.display_name || idol.idol_code }}</span>
        </button>
      </div>
    </section>

    <section class="event-section" aria-labelledby="event-units-title">
      <div class="section-heading">
        <h3 id="event-units-title">参与组合</h3>
        <span>{{ units.length }}</span>
      </div>
      <div class="unit-list">
        <button v-for="unit in units" :key="unit.unit_id" @click="emit('open-unit', unit)">
          <img :src="getUnitLogoUrl(unit.unit_code)" alt="" />
          <span>{{ unit.unit_name }}</span>
        </button>
      </div>
    </section>

    <section class="event-section" aria-labelledby="event-cards-title">
      <div class="section-heading">
        <h3 id="event-cards-title">活动关联卡片</h3>
        <span>{{ cards.length }}</span>
      </div>
      <div class="card-list">
        <button v-for="card in cards" :key="card.card_resource_id" @click="emit('open-card', card)">
          <img :src="getCardIconUrl(card.card_resource_id, true)" :alt="card.card_title" />
          <span>
            <strong>{{ card.card_title }}</strong>
            <small>{{ card.character_name }} · {{ card.rarity }}</small>
            <code>{{ card.card_resource_id }}</code>
          </span>
          <ChevronRight :size="16" />
        </button>
      </div>
    </section>

    <section class="event-evidence" aria-labelledby="event-evidence-title">
      <h3 id="event-evidence-title">关系证据</h3>
      <dl>
        <div><dt>剧情文件</dt><dd>{{ event.file }}</dd></div>
        <div><dt>活动范围</dt><dd>{{ event.event_scope }}</dd></div>
        <div><dt>归属依据</dt><dd>{{ event.classification_source }}</dd></div>
        <div><dt>关系类型</dt><dd>{{ event.relation_type }}</dd></div>
      </dl>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, Play } from '@lucide/vue'
import { getEventBannerUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

const props = defineProps({
  event: { type: Object, default: null },
  cards: { type: Array, default: () => [] },
  idols: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
})
const emit = defineEmits(['play', 'open-card', 'open-idol', 'open-unit'])

const scopeLabel = computed(() => ({
  fixed_unit_event: '固定组合团活',
  attribute_event: `${props.event?.attribute || ''} 属性团曲`.trim(),
  mixed_unit_event: '跨组合团活',
}[props.event?.event_scope] || '活动剧情'))

function formatDate(timestamp) {
  if (!timestamp) return '日期未记录'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
.event-detail { height: 100%; overflow-y: auto; background: #f5f7f8; color: #24313a; }
.event-visual { width: 100%; aspect-ratio: 16 / 6; overflow: hidden; background: #111820; }
.event-visual img { display: block; width: 100%; height: 100%; object-fit: contain; }
.event-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 26px; border-bottom: 1px solid #dfe5e8; background: #fff; }
.event-header > div { min-width: 0; }
.event-header span { color: #168e86; font-size: 0.68rem; font-weight: 700; }
.event-header h2 { margin: 5px 0; font-size: 1.35rem; letter-spacing: 0; }
.event-header p { margin: 0; color: #6f7b84; font-size: 0.7rem; }
.event-header > button { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; min-height: 38px; padding: 7px 12px; border: 1px solid #15978e; border-radius: 6px; background: #15978e; color: #fff; cursor: pointer; font: inherit; font-size: 0.72rem; }
.event-header > button:disabled { border-color: #cbd3d8; background: #e4e8eb; color: #7b858d; cursor: not-allowed; }
.event-section, .event-evidence { margin: 12px 18px 0; padding: 17px; border: 1px solid #dfe4e7; background: #fff; }
.event-evidence { margin-bottom: 18px; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 11px; }
.section-heading h3, .event-evidence h3 { margin: 0; font-size: 0.84rem; }
.section-heading > span { color: #78838c; font-size: 0.65rem; }
.idol-list, .unit-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 7px; }
.idol-list button, .unit-list button { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 54px; padding: 7px 9px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26323b; cursor: pointer; font: inherit; text-align: left; }
.idol-list button:hover, .unit-list button:hover, .card-list button:hover { border-color: #6fc5be; background: #f2fbfa; }
.idol-list img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.unit-list img { width: 70px; height: 40px; object-fit: contain; }
.idol-list span, .unit-list span { overflow: hidden; font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
.card-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 7px; }
.card-list button { display: grid; grid-template-columns: 54px minmax(0, 1fr) 18px; align-items: center; gap: 10px; min-width: 0; min-height: 68px; padding: 7px 9px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26323b; cursor: pointer; text-align: left; }
.card-list img { width: 54px; height: 54px; object-fit: contain; }
.card-list button > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.card-list strong { overflow: hidden; font-size: 0.73rem; text-overflow: ellipsis; white-space: nowrap; }
.card-list small, .card-list code { color: #74808a; font-size: 0.62rem; }
.event-evidence dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 12px 0 0; background: #e3e8eb; }
.event-evidence dl > div { min-width: 0; padding: 10px; background: #f8fafb; }
.event-evidence dt { color: #75818a; font-size: 0.62rem; }
.event-evidence dd { margin: 4px 0 0; overflow-wrap: anywhere; font-size: 0.68rem; }
@media (max-width: 600px) {
  .event-visual { aspect-ratio: 16 / 8; }
  .event-header { align-items: stretch; flex-direction: column; gap: 14px; padding: 18px 14px; }
  .event-header > button { justify-content: center; width: 100%; }
  .event-section, .event-evidence { margin: 8px 9px 0; padding: 13px; }
  .event-evidence { margin-bottom: 9px; }
  .idol-list, .unit-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .card-list { grid-template-columns: minmax(0, 1fr); }
  .event-evidence dl { grid-template-columns: minmax(0, 1fr); }
}
</style>
