<template>
  <article v-if="unit" class="unit-detail" data-archive-scroll-container>
    <header class="unit-hero" :style="{ backgroundImage: `url(${getBgUrl(unit.representative_bg)})` }">
      <span class="unit-hero-shade" aria-hidden="true"></span>
      <div class="unit-hero-copy">
        <img class="unit-hero-logo" :src="getUnitLogoUrl(unit.unit_code)" alt="" />
        <h2>{{ unit.unit_name }}</h2>
        <p>{{ unit.unit_kana }}</p>
      </div>
      <span class="unit-swatch" :style="{ backgroundColor: unit.unit_color || '#23a99f' }" :title="unit.unit_color"></span>
    </header>

    <section class="unit-description">
      <p>{{ archiveNamedText('unit-profile', unit.description, 'description') }}</p>
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
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
void loadArchiveNames('profiles').catch(() => {})
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
/* Unit detail: the unit's own stage art as a cover image, then flat sections on paper. */
.unit-detail { display: grid; align-content: start; gap: var(--gs-space-section); height: 100%; padding: var(--gs-space-8); overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.unit-detail > * { width: 100%; max-width: var(--gs-content-width); margin-inline: auto; }
.unit-hero { position: relative; display: flex; align-items: flex-end; min-height: 240px; padding: var(--gs-space-8); overflow: hidden; border-radius: var(--gs-radius-media); background-position: center; background-size: cover; color: #fff; }
.unit-hero-shade { position: absolute; inset: 0; background: linear-gradient(0deg, rgb(19 33 58 / 82%), rgb(19 33 58 / 24%)); }
.unit-hero-copy { position: relative; z-index: 1; min-width: 0; max-width: 100%; }
.unit-hero-logo { display: block; width: min(220px, 55vw); height: 74px; margin-bottom: var(--gs-space-4); object-fit: contain; object-position: left center; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 45%)); }
.unit-hero h2 { margin: 0 0 var(--gs-space-2); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; overflow-wrap: anywhere; }
.unit-hero p { margin: 0; color: rgb(255 255 255 / 78%); font-family: var(--gs-font-jp); font-size: var(--gs-text-ui); overflow-wrap: anywhere; }
.unit-swatch { position: absolute; z-index: 1; top: var(--gs-space-6); right: var(--gs-space-6); width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 0 2px #fff; }
.unit-description p { max-width: 70ch; margin: 0; white-space: pre-wrap; color: var(--gs-ink-2); line-height: 1.9; overflow-wrap: anywhere; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading h3 { margin: 0; min-width: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.section-heading > span { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.section-command { display: inline-flex; flex: none; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.section-command svg { flex: none; }
/* Card counts read as one line of figures, not tiles. */
.unit-stat-grid { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-8); margin: var(--gs-space-4) 0 0; }
.unit-stat-grid > div { display: flex; flex-direction: row-reverse; align-items: baseline; gap: var(--gs-space-2); }
.unit-stat-grid dt { color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.unit-stat-grid dd { margin: 0; font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.unit-members { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 var(--gs-space-7); }
.unit-members :deep(.archive-idol-reference) { border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; }
.unit-members :deep(.idol-reference-copy strong) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.unit-members :deep(.idol-reference-copy small) { font-size: var(--gs-text-meta); white-space: normal; overflow-wrap: anywhere; }
.unit-songs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 var(--gs-space-7); }
.unit-songs button, .unit-stories button { display: grid; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.unit-songs button { grid-template-columns: 48px minmax(0, 1fr) auto; }
.unit-songs img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; }
.unit-songs button > svg, .unit-stories button > svg { margin: auto; color: var(--gs-ink-3); }
.unit-songs span, .unit-stories button > span { display: grid; min-width: 0; }
.unit-songs strong, .unit-stories strong { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.unit-stories { display: grid; }
.unit-stories button { grid-template-columns: 22px minmax(0, 1fr) auto; }
.unit-stories small { color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.unit-detail :deep(.relation-row) { border-radius: var(--gs-radius-control); }
.unit-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.unit-detail :deep(.relation-labels strong), .unit-detail :deep(.relation-labels small), .unit-detail :deep(.relation-meta) { font-size: var(--gs-text-meta); }
.unit-detail button:focus-visible, .unit-detail :deep(button.archive-idol-reference:focus-visible), .unit-detail :deep(.relation-row:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) {
  .section-command:hover { text-decoration: underline; }
  .unit-songs button:hover strong, .unit-stories button:hover strong { color: var(--gs-mint-ink); }
}
@media (max-width: 760px) {
  .unit-detail { gap: var(--gs-space-8); padding: var(--gs-space-5); }
  .unit-hero { min-height: 180px; padding: var(--gs-space-6); }
  .unit-hero h2 { font-size: var(--gs-text-section); }
  .section-command { min-height: var(--gs-control-touch); }
  .unit-members, .unit-songs { grid-template-columns: 1fr; }
  .unit-stories button { grid-template-columns: 20px minmax(0, 1fr); }
  .unit-stories button > small { grid-column: 2; }
}
</style>
