<template>
  <article v-if="unit" class="unit-detail" :style="themeStyle" data-archive-scroll-container>
    <!-- 人物幕 on the unit colour's wash: the logo, the name after a 3px colour bar, the reading and the
         profile; the members' group picture (the prequel banner) opens the unit's prequel. The paper stays
         light: the dark stage art is not a reading surface. -->
    <header class="unit-hero">
      <div class="unit-hero-copy">
        <img v-if="!logoFailed" class="unit-hero-logo" :src="getUnitLogoUrl(unit.unit_code)" alt="" decoding="async" @error="logoFailed = true" />
        <h2 class="unit-hero-name">{{ unit.unit_name }}</h2>
        <p lang="ja" class="unit-hero-kana">{{ unit.unit_kana }}</p>
        <p v-if="unitDescription" class="unit-hero-desc gs-flow">{{ unitDescription }}</p>
      </div>
      <button
        v-if="unitStoryBanner && !bannerError"
        type="button"
        class="unit-hero-photo"
        :aria-label="`阅读 ${unit.unit_name} 的组合前传`"
        :data-archive-focus-id="`unit-story-banner:${unit.unit_code}`"
        @click="emit('open-story', { domain: 'unit_story', section: String(unit.unit_id) })"
      >
        <img :src="unitStoryBanner" alt="" @error="bannerError = true" />
      </button>
    </header>

    <!-- Facts: four short numbers in a row; the card count opens the unit's cards. -->
    <dl class="unit-facts">
      <div><dt>成员</dt><dd><b>{{ members.length }}</b>位</dd></div>
      <div><dt>组合歌曲</dt><dd><b>{{ songs.length }}</b>首</dd></div>
      <div><dt>组合剧情</dt><dd><b>{{ stories.length }}</b>篇</dd></div>
      <div v-if="cardStats?.total">
        <dt>卡片</dt>
        <dd><button type="button" class="unit-facts-cards" :data-archive-focus-id="`unit-cards:${unit.unit_code}`" @click="emit('open-cards')"><b>{{ cardStats.total }}</b>张<small v-if="cardStats.rarity_counts?.SSR">SSR {{ cardStats.rarity_counts.SSR }}</small><ChevronRight :size="15" aria-hidden="true" /></button></dd>
      </div>
    </dl>

    <section class="unit-section" aria-labelledby="unit-members-title">
      <div class="section-heading">
        <h3 id="unit-members-title">成员</h3>
        <span>{{ members.length }}</span>
      </div>
      <div class="unit-members">
        <ArchiveIdolReference
          v-for="entry in memberReferences"
          :key="entry.member.idol_code"
          :reference="entry.reference"
          @open="emit('open-idol', entry.member)"
        />
      </div>
    </section>

    <div v-if="songs.length || stories.length" class="unit-content-split" :class="{ 'single-column': !songs.length || !stories.length }">
      <section v-if="songs.length" class="unit-section unit-songs-section" aria-labelledby="unit-songs-title">
        <div class="section-heading">
          <h3 id="unit-songs-title">组合歌曲</h3>
          <span>{{ songs.length }} 首</span>
        </div>
        <div class="unit-songs">
          <button
            v-for="song in songs"
            :key="song.song_code"
            :data-archive-focus-id="`unit-song:${unit.unit_code}:${song.song_code}`"
            @click="emit('open-song', song.song_code)"
          >
            <img v-if="song.jacket_url" :src="song.jacket_url" :alt="`${song.title} 封面`" />
            <Music v-else :size="20" aria-hidden="true" />
            <span>
              <strong>{{ song.title }}</strong>
            </span>
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section v-if="stories.length" class="unit-section unit-stories-section" aria-labelledby="unit-stories-title">
        <div class="section-heading">
          <h3 id="unit-stories-title">组合剧情</h3>
          <span>{{ stories.length }}</span>
        </div>
        <div class="unit-stories">
          <button
            v-for="story in stories"
            :key="story.id"
            :data-archive-focus-id="`unit-story:${unit.unit_code}:${story.id}`"
            @click="emit('open-story', story)"
          >
            <Play :size="15" fill="currentColor" />
            <span>
              <strong>{{ story.title }}</strong>
            </span>
            <small>查看剧情</small>
          </button>
        </div>
      </section>
    </div>

    <section v-if="allEventItems.length" class="unit-section" aria-labelledby="unit-events-title">
      <div class="section-heading">
        <h3 id="unit-events-title">活动与企划出演</h3>
        <div v-if="eventCategories.length > 1" class="unit-event-chips" role="group" aria-label="活动分类筛选">
          <button
            v-for="cat in eventCategories"
            :key="cat.key"
            type="button"
            class="event-filter-chip"
            :aria-pressed="activeEventCategory === cat.key"
            @click="activeEventCategory = cat.key"
          >
            <span>{{ cat.label }}</span>
            <small>{{ cat.count }}</small>
          </button>
        </div>
        <span v-else>{{ allEventItems.length }}</span>
      </div>
      <ArchiveRelationList :items="displayedEventItems" layout="grid" @select="emit('open-event', $event.payload)" />
    </section>

    <ArchiveTechnicalDetails
      :key="unit.unit_code"
      :evidence="{
        unit,
        songs: songs.map(song => ({ song_code: song.song_code, title: song.title, performance_mapping: song.performance_mapping })),
        stories: stories.map(story => ({ title: story.title, resourceId: story.resourceId, file: story.file, summary: story.summary })),
      }"
    />
  </article>
</template>

<script setup>
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
void loadArchiveNames('profiles').catch(() => {})
import { computed, ref, watch } from 'vue'
import { ChevronRight, Music, Play } from '@lucide/vue'
import { idolThemeProperties } from '../../presentation/idolStageLight.js'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { eventBannerUrl } from '../../data/eventResourceGraph.js'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { buildIdolReference } from '../../presentation/IdolReferencePresentation.js'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { reflowText } from '../../../shared/reading/ReadingTypography.js'
import { unitStoryBannerUrl } from '../../data/storyCollections.js'

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

const unitDescription = computed(() => {
  const raw = archiveNamedText('unit-profile', props.unit?.description, 'description')
  return reflowText(raw)
})

// The unit colour gives the hero its wash, ink and bar the same way an idol's colour does on the idol page.
const themeStyle = computed(() => idolThemeProperties(props.unit?.unit_color))
const logoFailed = ref(false)

const memberReferences = computed(() => props.members.map(member => {
  const reference = buildIdolReference(member.idol_code, props.identity, props.manifest, `unit:${props.unit?.unit_code || ''}`, { subtitle: 'cv' })
  return { member, reference: reference.actionable ? { ...reference, displayName: props.idolName(reference.idolCode, reference.displayName) || reference.displayName } : reference }
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
      imageUrl: eventBannerUrl(event),
      imageAlt: event.title,
      payload: event,
    }
  })
}

const teamEventItems = computed(() => relationItems(
  props.eventRelations?.team_events,
  '固定组合团活',
  event => [event.series, `${event.characters?.length || 0} 位成员`].filter(Boolean).join(' · '),
))
const attributeEventItems = computed(() => relationItems(
  props.eventRelations?.attribute_event_appearances,
  '属性团曲',
  event => [event.attribute, matchingMemberNames(event)].filter(Boolean).join(' · '),
))
const mixedEventItems = computed(() => relationItems(
  props.eventRelations?.mixed_unit_appearances,
  '跨组合混活',
  event => matchingMemberNames(event),
))

const allEventItems = computed(() => [
  ...teamEventItems.value,
  ...attributeEventItems.value,
  ...mixedEventItems.value,
])

const bannerError = ref(false)
const unitStoryBanner = computed(() => unitStoryBannerUrl(props.unit?.unit_code))

const activeEventCategory = ref('all')
watch(() => props.unit?.unit_code, () => {
  activeEventCategory.value = 'all'
  bannerError.value = false
  logoFailed.value = false
})

const eventCategories = computed(() => {
  const cats = [
    { key: 'all', label: '全部', count: allEventItems.value.length },
    { key: 'team', label: '固定组合团活', count: teamEventItems.value.length },
    { key: 'attribute', label: '属性团曲', count: attributeEventItems.value.length },
    { key: 'mixed', label: '跨组合混活', count: mixedEventItems.value.length },
  ]
  return cats.filter(cat => cat.count > 0)
})

const displayedEventItems = computed(() => {
  if (activeEventCategory.value === 'team') return teamEventItems.value
  if (activeEventCategory.value === 'attribute') return attributeEventItems.value
  if (activeEventCategory.value === 'mixed') return mixedEventItems.value
  return allEventItems.value
})
</script>

<style scoped>
/* Unit detail: the unit-colour hero, then flat sections on paper. One explicit shrinkable column, so a
   wide row inside cannot widen the page past a phone screen. */
.unit-detail { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: var(--gs-space-section); container: unit-detail / inline-size; height: 100%; padding: var(--gs-space-8); overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.unit-detail > * { width: 100%; max-width: var(--gs-content-width); margin-inline: auto; }
/* 人物幕: the unit colour's wash (light, like the idol page), copy on the left, the members' group
   picture on the right. The picture is the prequel banner, cropped to its people (its own logo sits at
   the right end, and the hero already shows the logo). */
.unit-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 40%); align-items: center; gap: var(--gs-space-7); min-height: 260px; padding: var(--gs-space-7) 0 var(--gs-space-7) var(--gs-space-8); overflow: clip; border-radius: var(--gs-radius-media); background: var(--gs-idol-wash); }
.unit-hero-copy { display: grid; justify-items: start; gap: var(--gs-space-2); min-width: 0; }
.unit-hero-logo { display: block; max-width: 180px; max-height: 72px; margin-bottom: var(--gs-space-3); object-fit: contain; object-position: left center; }
.unit-hero-name { margin: 0; padding-left: var(--gs-space-4); border-left: 3px solid var(--gs-idol); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; overflow-wrap: anywhere; }
.unit-hero-kana { margin: 0; padding-left: calc(var(--gs-space-4) + 3px); color: var(--gs-ink-2); font-size: var(--gs-text-ui); overflow-wrap: anywhere; }
.unit-hero-desc { margin: var(--gs-space-3) 0 0; max-width: 34em; color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
/* The banner carries a white rounded frame and its own logo at the right end: the image is scaled past
   the frame and the window sits on the people. */
.unit-hero-photo { align-self: stretch; min-width: 0; overflow: hidden; margin-block: calc(-1 * var(--gs-space-7)); padding: 0; border: 0; background: none; cursor: pointer; -webkit-mask-image: linear-gradient(90deg, transparent, black 18%); mask-image: linear-gradient(90deg, transparent, black 18%); }
.unit-hero-photo img { display: block; width: 100%; height: 100%; min-height: 200px; object-fit: cover; object-position: 30% center; scale: 1.08; }
/* Facts: four short numbers on one hairline row. */
.unit-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 var(--gs-space-7); margin: 0; border-top: 1px solid var(--gs-rule); }
.unit-facts > div { min-width: 0; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.unit-facts dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.unit-facts dd { display: flex; align-items: baseline; gap: 3px; margin: var(--gs-space-1) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.unit-facts b { color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); line-height: 1; font-variant-numeric: tabular-nums; }
.unit-facts-cards { display: inline-flex; align-items: baseline; gap: 3px; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; font: inherit; }
.unit-facts-cards small { margin-left: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.unit-facts-cards svg { align-self: center; color: var(--gs-ink-3); }
.section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading h3 { margin: 0; min-width: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.section-heading > span { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.unit-event-chips { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); }
.event-filter-chip { display: inline-flex; align-items: center; gap: 6px; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); cursor: pointer; transition: background var(--gs-motion-feedback) var(--gs-ease-out), border-color var(--gs-motion-feedback) var(--gs-ease-out), color var(--gs-motion-feedback) var(--gs-ease-out); }
.event-filter-chip small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); }
.event-filter-chip[aria-pressed="true"] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.event-filter-chip[aria-pressed="true"] small { color: inherit; }
.event-filter-chip:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.unit-members { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 var(--gs-space-5); }
.unit-members :deep(.idol-reference-copy strong), .unit-members :deep(.idol-reference-copy small) { white-space: normal; overflow-wrap: anywhere; }
.unit-content-split { display: grid; grid-template-columns: 55fr 45fr; gap: var(--gs-space-8); align-items: start; }
.unit-content-split.single-column { grid-template-columns: 1fr; }
.unit-songs { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0 var(--gs-space-5); }
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
  .unit-hero-photo:hover { opacity: .9; }
  .unit-facts-cards:hover b { color: var(--gs-ink-2); }
  .event-filter-chip:hover { background: var(--gs-mint-wash); border-color: var(--gs-mint-line); }
  .unit-songs button:hover strong, .unit-stories button:hover strong { color: var(--gs-ink-2); }
}
@container unit-detail (max-width: 980px) {
  .unit-content-split { grid-template-columns: 1fr; gap: var(--gs-space-section); }
}
@media (max-width: 760px) {
  .unit-detail { gap: var(--gs-space-8); padding: var(--gs-space-5); }
  /* Phones: the group picture runs edge to edge on top, the copy under it on the wash. */
  /* min-height stays auto: in the fixed-height page grid an explicit 0 lets the row collapse. */
  .unit-hero { grid-template-columns: 1fr; gap: var(--gs-space-4); min-height: auto; margin: calc(-1 * var(--gs-space-5)) calc(-1 * var(--gs-space-5)) 0; width: auto; max-width: none; padding: 0 var(--gs-space-5) var(--gs-space-6); border-radius: 0; }
  .unit-hero-photo { order: -1; margin: 0 calc(-1 * var(--gs-space-5)); -webkit-mask-image: none; mask-image: none; }
  .unit-hero-photo img { min-height: 0; height: auto; aspect-ratio: 446 / 150; object-position: center; scale: 1.08; }
  /* The whole banner shows here, with its own logo, so the separate logo steps aside (only while the banner is there). */
  .unit-hero:has(.unit-hero-photo) .unit-hero-logo { display: none; }
  .unit-hero-logo { max-width: 140px; max-height: 54px; }
  .unit-hero-name { font-size: var(--gs-text-section); }
  .unit-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-members, .unit-songs { grid-template-columns: 1fr; }
  .unit-stories button { grid-template-columns: 20px minmax(0, 1fr); }
  .unit-stories button > small { grid-column: 2; }
}
</style>
