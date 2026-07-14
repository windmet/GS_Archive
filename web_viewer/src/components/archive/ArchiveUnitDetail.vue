<template>
  <article v-if="unit" class="unit-detail">
    <header class="unit-hero" :style="{ backgroundImage: `url(${getBgUrl(unit.representative_bg)})` }">
      <span class="unit-hero-shade" aria-hidden="true"></span>
      <div class="unit-hero-copy">
        <img class="unit-hero-logo" :src="getUnitLogoUrl(unit.unit_code)" alt="" />
        <span>{{ unit.unit_code }}</span>
        <h2>{{ unit.unit_name }}</h2>
        <p>{{ unit.unit_kana }}</p>
      </div>
      <span class="unit-swatch" :style="{ backgroundColor: unit.unit_color || '#23a99f' }" :title="unit.unit_color"></span>
    </header>

    <section class="unit-description">
      <p>{{ unit.description }}</p>
    </section>

    <section class="unit-section unit-card-summary" aria-labelledby="unit-cards-title">
      <div class="section-heading">
        <h3 id="unit-cards-title">成员卡片</h3>
        <button class="section-command" @click="emit('open-cards')">
          <Images :size="16" />
          <span>查看卡片</span>
          <ChevronRight :size="15" />
        </button>
      </div>
      <dl class="unit-stat-grid">
        <div>
          <dt>全部</dt>
          <dd>{{ cardStats.total || 0 }}</dd>
        </div>
        <div>
          <dt>SSR</dt>
          <dd>{{ cardStats.rarity_counts?.SSR || 0 }}</dd>
        </div>
        <div>
          <dt>有卡片小剧情</dt>
          <dd>{{ cardStats.cards_with_story || 0 }}</dd>
        </div>
        <div>
          <dt>单卡面</dt>
          <dd>{{ cardStats.single_state || 0 }}</dd>
        </div>
      </dl>
    </section>

    <section class="unit-section" aria-labelledby="unit-members-title">
      <div class="section-heading">
        <h3 id="unit-members-title">成员</h3>
        <span>{{ members.length }}</span>
      </div>
      <div class="unit-members">
        <button v-for="member in members" :key="member.idol_code" @click="emit('open-idol', member)">
          <img :src="`/assets/idols/icons/image_chara_icon_${member.idol_code}.png`" :alt="member.display_name" />
          <span>{{ member.display_name }}</span>
        </button>
      </div>
    </section>

    <section class="unit-section" aria-labelledby="unit-events-title">
      <div class="section-heading">
        <h3 id="unit-events-title">固定组合团活</h3>
        <span>{{ eventRelations.team_events?.length || 0 }}</span>
      </div>
      <div class="unit-stories event-stories">
        <button v-for="event in eventRelations.team_events" :key="event.event_id" @click="emit('open-story', event)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ event.title }}</strong>
            <small>{{ event.series }} · {{ event.file }}</small>
          </span>
          <small>{{ event.characters.length }} members</small>
        </button>
      </div>
    </section>

    <section v-if="eventRelations.attribute_event_appearances?.length" class="unit-section" aria-labelledby="attribute-events-title">
      <div class="section-heading">
        <h3 id="attribute-events-title">属性团曲出演</h3>
        <span>{{ eventRelations.attribute_event_appearances.length }}</span>
      </div>
      <div class="unit-stories event-stories">
        <button v-for="event in eventRelations.attribute_event_appearances" :key="event.event_id" @click="emit('open-story', event)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ event.title }}</strong>
            <small>{{ event.attribute }} · {{ matchingMemberNames(event) }}</small>
          </span>
          <small>{{ event.file }}</small>
        </button>
      </div>
    </section>

    <section v-if="eventRelations.mixed_unit_appearances?.length" class="unit-section" aria-labelledby="mixed-events-title">
      <div class="section-heading">
        <h3 id="mixed-events-title">跨组合团活出演</h3>
        <span>{{ eventRelations.mixed_unit_appearances.length }}</span>
      </div>
      <div class="unit-stories event-stories">
        <button v-for="event in eventRelations.mixed_unit_appearances" :key="event.event_id" @click="emit('open-story', event)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ event.title }}</strong>
            <small>{{ matchingMemberNames(event) }}</small>
          </span>
          <small>{{ event.file }}</small>
        </button>
      </div>
    </section>

    <section class="unit-section" aria-labelledby="unit-stories-title">
      <div class="section-heading">
        <h3 id="unit-stories-title">组合剧情</h3>
        <span>{{ stories.length }}</span>
      </div>
      <div class="unit-stories">
        <button v-for="story in stories" :key="story.id" @click="emit('open-story', story)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ story.title }}</strong>
            <small>{{ story.resourceId }}</small>
          </span>
          <small>{{ story.summary?.step_count || 0 }} steps</small>
        </button>
      </div>
    </section>
  </article>
</template>

<script setup>
import { ChevronRight, Images, Play } from '@lucide/vue'
import { getBgUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  unit: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  stories: { type: Array, default: () => [] },
  cardStats: { type: Object, default: () => ({}) },
  eventRelations: {
    type: Object,
    default: () => ({ team_events: [], attribute_event_appearances: [], mixed_unit_appearances: [] }),
  },
})
const emit = defineEmits(['open-idol', 'open-story', 'open-cards'])

function matchingMemberNames(event) {
  const names = new Map(props.members.map(member => [member.idol_code, member.display_name]))
  return (event.matching_character_ids || []).map(idolCode => names.get(idolCode) || idolCode).join('、')
}
</script>

<style scoped>
.unit-detail { height: 100%; padding: 20px; overflow-y: auto; background: #f7f9fa; }
.unit-hero { position: relative; display: flex; align-items: flex-end; min-height: 220px; padding: 26px 28px; overflow: hidden; background-position: center; background-size: cover; color: #fff; }
.unit-hero-shade { position: absolute; inset: 0; background: rgba(15, 24, 31, 0.62); }
.unit-hero-copy { position: relative; z-index: 1; }
.unit-hero-logo { display: block; width: min(220px, 55vw); height: 74px; margin-bottom: 10px; object-fit: contain; object-position: left center; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)); }
.unit-hero-copy > span { color: #6bd6ce; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.67rem; }
.unit-hero h2 { margin: 7px 0 5px; font-size: 1.8rem; letter-spacing: 0; }
.unit-hero p { margin: 0; color: #d5dde2; font-size: 0.72rem; }
.unit-swatch { position: absolute; z-index: 1; top: 20px; right: 20px; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; }
.unit-description, .unit-section { margin-top: 12px; padding: 18px; border: 1px solid #dfe4e8; background: #fff; }
.unit-description p { margin: 0; white-space: pre-wrap; color: #46535c; font-size: 0.76rem; line-height: 1.75; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-heading h3 { margin: 0; font-size: 0.86rem; }
.section-heading span { color: #7a858e; font-size: 0.66rem; }
.section-command { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 5px 8px; border: 1px solid #cbd5da; border-radius: 5px; background: #fff; color: #247c77; cursor: pointer; font-size: 0.68rem; }
.section-command:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0; background: #e5e9ec; }
.unit-stat-grid > div { min-width: 0; padding: 12px; background: #f8fafb; }
.unit-stat-grid dt { overflow: hidden; color: #68747c; font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-stat-grid dd { margin: 5px 0 0; color: #233039; font-size: 1.12rem; font-weight: 700; }
.unit-members { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.unit-members button { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 52px; padding: 7px 9px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.unit-members button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-members img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.unit-members span { overflow: hidden; font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-stories { display: flex; flex-direction: column; gap: 6px; }
.unit-stories button { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 52px; padding: 7px 10px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.unit-stories button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-stories button > svg { color: #15978e; }
.unit-stories button > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.unit-stories strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-stories small { color: #7a858e; font-size: 0.63rem; }
.event-stories button > small { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 560px) {
  .unit-detail { padding: 10px; }
  .unit-hero { min-height: 170px; padding: 20px; }
  .unit-hero h2 { font-size: 1.45rem; }
  .unit-description, .unit-section { margin-top: 8px; padding: 14px; }
  .unit-members { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-stories button { grid-template-columns: 20px minmax(0, 1fr); }
  .unit-stories button > small { grid-column: 2; }
}
</style>
