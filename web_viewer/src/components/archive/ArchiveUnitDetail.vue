<template>
  <article v-if="unit" class="unit-detail" data-archive-scroll-container>
    <header class="unit-hero" :style="{ backgroundImage: `url(${getBgUrl(unit.representative_bg)})` }">
      <span class="unit-hero-shade" aria-hidden="true"></span>
      <div class="unit-hero-copy">
        <img class="unit-hero-logo" :src="getUnitLogoUrl(unit.unit_code)" alt="" />
        <span>UNIT ARCHIVE</span>
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
        <button class="section-command" :data-archive-focus-id="`unit-cards:${unit.unit_code}`" @click="emit('open-cards')">
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
        <ArchiveIdolReference v-for="entry in memberReferences" :key="entry.member.idol_code" :reference="entry.reference" @open="emit('open-idol', entry.member)" />
      </div>
    </section>

    <section v-if="songs.length" class="unit-section" aria-labelledby="unit-songs-title">
      <div class="section-heading">
        <h3 id="unit-songs-title">组合歌曲</h3>
        <span>{{ songs.length }} 首</span>
      </div>
      <div class="unit-songs">
        <button v-for="song in songs" :key="song.song_code" :data-archive-focus-id="`unit-song:${unit.unit_code}:${song.song_code}`" @click="emit('open-song', song.song_code)">
          <img v-if="song.jacket_url" :src="song.jacket_url" :alt="`${song.title} 封面`" />
          <Music v-else :size="20" aria-hidden="true" />
          <span>
            <strong>{{ song.title }}</strong>

          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section class="unit-section" aria-labelledby="unit-events-title">
      <div class="section-heading">
        <h3 id="unit-events-title">固定组合团活</h3>
        <span>{{ eventRelations.team_events?.length || 0 }}</span>
      </div>
      <ArchiveRelationList :items="teamEventItems" layout="grid" @select="emit('open-event', $event.payload)" />
    </section>

    <section v-if="eventRelations.attribute_event_appearances?.length" class="unit-section" aria-labelledby="attribute-events-title">
      <div class="section-heading">
        <h3 id="attribute-events-title">属性团曲出演</h3>
        <span>{{ eventRelations.attribute_event_appearances.length }}</span>
      </div>
      <ArchiveRelationList :items="attributeEventItems" layout="grid" @select="emit('open-event', $event.payload)" />
    </section>

    <section v-if="eventRelations.mixed_unit_appearances?.length" class="unit-section" aria-labelledby="mixed-events-title">
      <div class="section-heading">
        <h3 id="mixed-events-title">跨组合团活出演</h3>
        <span>{{ eventRelations.mixed_unit_appearances.length }}</span>
      </div>
      <ArchiveRelationList :items="mixedEventItems" layout="grid" @select="emit('open-event', $event.payload)" />
    </section>

    <section class="unit-section" aria-labelledby="unit-stories-title">
      <div class="section-heading">
        <h3 id="unit-stories-title">组合剧情</h3>
        <span>{{ stories.length }}</span>
      </div>
      <div class="unit-stories">
        <button v-for="story in stories" :key="story.id" :data-archive-focus-id="`unit-story:${unit.unit_code}:${story.id}`" @click="emit('open-story', story)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ story.title }}</strong>

          </span>
          <small>查看剧情</small>
        </button>
      </div>
    </section>
    <ArchiveTechnicalDetails :key="unit.unit_code" :evidence="{ unit, songs: songs.map(song => ({ song_code: song.song_code, title: song.title, performance_mapping: song.performance_mapping })), stories: stories.map(story => ({ title: story.title, resourceId: story.resourceId, file: story.file, summary: story.summary })) }" />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, Images, Music, Play } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { buildIdolReference } from '../../presentation/IdolReferencePresentation.js'
import { getBgUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  unit: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  identity: { type: Object, default: null },
  idolName: { type: Function, default: () => '' },
  manifest: { type: Object, default: null },
  stories: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  cardStats: { type: Object, default: () => ({}) },
  eventRelations: {
    type: Object,
    default: () => ({ team_events: [], attribute_event_appearances: [], mixed_unit_appearances: [] }),
  },
})
const emit = defineEmits(['open-idol', 'open-story', 'open-event', 'open-cards', 'open-song'])
const memberReferences = computed(() => props.members.map(member => {
  const reference = buildIdolReference(member.idol_code, props.identity, props.manifest, `unit:${props.unit?.unit_code || ''}`)
  return { member, reference: reference.actionable ? {...reference, displayName: props.idolName(reference.idolCode) || reference.displayName} : reference }
}))

function matchingMemberNames(event) {
  const names = new Map(props.members.map(member => [member.idol_code, props.idolName(member.idol_code) || member.display_name]))
  return (event.matching_character_ids || []).map(idolCode => names.get(idolCode) || '姓名待确认').join('、')
}

function relationItems(events, label, meta) {
  return (events || []).map(event => {
    const confirmed = String(event.relation_type || '').startsWith('confirmed_')
    return {
      id: `event-${event.event_id}`,
      kind: 'event',
      label,
      title: event.title,
      meta: meta(event),
      evidenceLabel: confirmed ? 'Confirmed' : 'Derived',
      evidenceTone: confirmed ? 'confirmed' : 'derived',
      evidence: event.classification_source || event.relation_type,
      statusLabel: event.exists ? '可播放' : '缺少剧情',
      statusTone: event.exists ? 'available' : 'missing',
      resource: event.file,
      payload: event,
    }
  })
}

const teamEventItems = computed(() => relationItems(
  props.eventRelations.team_events,
  '固定组合团活',
  event => [event.series, `${event.characters?.length || 0} 位成员`].filter(Boolean).join(' · '),
))
const attributeEventItems = computed(() => relationItems(
  props.eventRelations.attribute_event_appearances,
  '属性团曲出演',
  event => [event.attribute, matchingMemberNames(event)].filter(Boolean).join(' · '),
))
const mixedEventItems = computed(() => relationItems(
  props.eventRelations.mixed_unit_appearances,
  '跨组合团活出演',
  event => matchingMemberNames(event),
))
</script>

<style scoped>
.unit-detail { height: 100%; padding: var(--gs-space-6); overflow-y: auto; background: #f7f9fa; font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
/* Keep the existing hero framing, logo geometry and image crop. */
.unit-hero { position: relative; display: flex; align-items: flex-end; min-height: 220px; padding: 26px 28px; overflow: hidden; background-position: center; background-size: cover; color: #fff; }
.unit-hero-shade { position: absolute; inset: 0; background: rgba(15, 24, 31, 0.62); }
.unit-hero-copy { position: relative; z-index: 1; min-width: 0; max-width: 100%; }
.unit-hero-logo { display: block; width: min(220px, 55vw); height: 74px; margin-bottom: var(--gs-space-4); object-fit: contain; object-position: left center; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)); }
.unit-hero-copy > span { color: #6bd6ce; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: var(--gs-text-caption); }
.unit-hero h2 { margin: var(--gs-space-3) 0 var(--gs-space-2); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.4; letter-spacing: 0; overflow-wrap: anywhere; }
.unit-hero p { margin: 0; color: #d5dde2; font-size: var(--gs-text-meta); line-height: 1.6; overflow-wrap: anywhere; }
.unit-swatch { position: absolute; z-index: 1; top: 20px; right: 20px; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; }
.unit-description, .unit-section { margin-top: var(--gs-space-4); padding: var(--gs-space-5); border: 1px solid #dfe4e8; background: #fff; }
.unit-description p { margin: 0; white-space: pre-wrap; color: #46535c; font-size: var(--gs-text-body); line-height: 1.75; overflow-wrap: anywhere; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-4); }
.section-heading h3 { margin: 0; min-width: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); line-height: 1.4; overflow-wrap: anywhere; }
.section-heading > span { color: #7a858e; font-size: var(--gs-text-meta); }
.section-command { display: inline-flex; flex: none; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid #cbd5da; border-radius: var(--gs-radius-control); background: #fff; color: #247c77; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.section-command span { font: inherit; }
.section-command svg { flex: none; }
.section-command:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0; background: #e5e9ec; }
.unit-stat-grid > div { min-width: 0; padding: var(--gs-space-4); background: #f8fafb; }
.unit-stat-grid dt { color: #68747c; font-size: var(--gs-text-meta); line-height: 1.5; overflow-wrap: anywhere; }
.unit-stat-grid dd { margin: var(--gs-space-2) 0 0; color: #233039; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-bold); }
.unit-members { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gs-space-3); }
.unit-members :deep(.archive-idol-reference) { gap: var(--gs-space-3); padding: var(--gs-space-3); border-radius: var(--gs-radius-panel); }
.unit-members :deep(.idol-reference-copy) { gap: var(--gs-space-2); }
/* Complete member identities remain readable through the existing grid changes. */
.unit-members :deep(.idol-reference-copy strong) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.55; white-space: normal; text-overflow: clip; overflow-wrap: anywhere; }
.unit-members :deep(.idol-reference-copy small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: 1.5; white-space: normal; text-overflow: clip; overflow-wrap: anywhere; }
.unit-members :deep(.idol-reference-arrow) { flex: none; }
.unit-songs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-3); }
.unit-songs button { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-height: 58px; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #e0e5e8; border-radius: var(--gs-radius-control); background: #fff; color: #26313a; cursor: pointer; font: inherit; text-align: left; }
.unit-songs button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-songs img { width: 44px; height: 44px; border-radius: var(--gs-radius-control); object-fit: cover; }
.unit-songs button > svg:first-child { margin: auto; color: #15978e; }
.unit-songs button > svg:last-child { color: #9ca5ad; }
.unit-songs span { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.unit-songs strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.unit-songs small { color: #7a858e; font-size: var(--gs-text-meta); }
.unit-stories { display: flex; flex-direction: column; gap: var(--gs-space-3); }
.unit-stories button { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-3); min-height: 52px; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #e0e5e8; border-radius: var(--gs-radius-control); background: #fff; color: #26313a; cursor: pointer; font: inherit; text-align: left; }
.unit-stories button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-stories button > svg { color: #15978e; }
.unit-stories button > span { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.unit-stories strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.unit-stories small { color: #7a858e; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.unit-detail :deep(.relation-list) { gap: var(--gs-space-3); }
.unit-detail :deep(.relation-row) { gap: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); }
.unit-detail :deep(.relation-copy) { gap: var(--gs-space-2); }
.unit-detail :deep(.relation-labels) { gap: var(--gs-space-2); }
.unit-detail :deep(.relation-labels strong), .unit-detail :deep(.relation-labels small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.unit-detail :deep(.relation-labels small) { padding: var(--gs-space-1) var(--gs-space-2); border-radius: var(--gs-radius-control); }
.unit-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; white-space: normal; overflow-wrap: anywhere; }
.unit-detail :deep(.relation-meta), .unit-detail :deep(.relation-proof), .unit-detail :deep(.relation-copy code) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.unit-detail :deep(.archive-technical) { margin-top: var(--gs-space-5); border-radius: var(--gs-radius-panel); font-family: var(--gs-font-directory); }
.unit-detail :deep(.archive-technical > summary) { padding: var(--gs-space-5); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.unit-detail :deep(.archive-technical-body) { padding: 0 var(--gs-space-5) var(--gs-space-5); font-size: var(--gs-text-body); }
.unit-detail :deep(.archive-technical pre) { font-size: var(--gs-text-meta); }
.unit-detail button:focus-visible, .unit-detail :deep(button.archive-idol-reference:focus-visible), .unit-detail :deep(.relation-row:focus-visible), .unit-detail :deep(.archive-technical > summary:focus-visible) { outline: var(--gs-focus-ring) solid #37a9a1; outline-offset: var(--gs-focus-offset); }

@media (max-width: 760px), (pointer: coarse) {
  .section-command { min-height: var(--gs-control-touch); }
}

@media (max-width: 560px) {
  .unit-detail { padding: var(--gs-space-4); }
  .unit-hero { min-height: 170px; padding: var(--gs-space-6); }
  .unit-description, .unit-section { margin-top: var(--gs-space-3); }
  .unit-members { grid-template-columns: 1fr; }
  .unit-songs { grid-template-columns: 1fr; }
  .unit-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-stories button { grid-template-columns: 20px minmax(0, 1fr); }
  .unit-stories button > small { grid-column: 2; }
}
</style>
