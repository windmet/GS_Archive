<template>
  <article v-if="unit" class="unit-detail" :style="themeStyle" data-archive-scroll-container>
    <!-- 人物幕, in the idol page's language: the unit colour's wash with a light to the lower right, the
         unit's own group picture (the game's image_unit_intro, never members pasted together) casting a
         flat shadow in the unit ink (色影), cut at the hips and fading out through the hero's lower edge.
         Without the picture the hero is the copy alone. -->
    <header class="unit-hero" :class="{ 'has-art': introUrl && !introFailed }">
      <div v-if="introUrl && !introFailed" class="unit-hero-art" :style="artStyle" aria-hidden="true">
        <img :src="introUrl" alt="" decoding="async" @load="readArtSize" @error="introFailed = true" />
      </div>
      <div class="unit-hero-copy">
        <img v-if="!logoFailed" class="unit-hero-logo" :src="getUnitLogoUrl(unit.unit_code)" alt="" decoding="async" @error="logoFailed = true" />
        <h2 class="unit-hero-name">{{ unit.unit_name }}<span lang="ja" class="unit-hero-kana">{{ unit.unit_kana }}</span></h2>
        <p v-if="unitDescription" class="unit-hero-desc gs-flow">{{ unitDescription }}</p>
      </div>
    </header>

    <!-- One row under the hero: the members (face and name) and what the page holds, each count a link. -->
    <section class="unit-overview" aria-label="成员与收录">
      <div class="unit-overview-cast">
        <h3 class="unit-overview-label">成员 <b>{{ members.length }}</b></h3>
        <div class="unit-members">
          <ArchiveIdolReference
            v-for="entry in memberReferences"
            :key="entry.member.idol_code"
            :reference="entry.reference"
            density="identity"
            @open="emit('open-idol', entry.member)"
          />
        </div>
      </div>
      <div class="unit-overview-holdings">
        <h3 class="unit-overview-label">收录</h3>
        <ul class="unit-holdings">
          <li v-if="songs.length"><button type="button" @click="jumpTo('unit-songs-title')">组合歌曲<b>{{ songs.length }}</b>首<ChevronRight :size="15" aria-hidden="true" /></button></li>
          <li v-if="stories.length"><button type="button" @click="jumpTo('unit-stories-title')">组合前传<b>{{ stories.length }}</b>话<ChevronRight :size="15" aria-hidden="true" /></button></li>
          <li v-if="cardStats?.total"><button type="button" :data-archive-focus-id="`unit-cards:${unit.unit_code}`" @click="emit('open-cards')">卡片<b>{{ cardStats.total }}</b>张<small v-if="cardStats.rarity_counts?.SSR">SSR {{ cardStats.rarity_counts.SSR }}</small><ChevronRight :size="15" aria-hidden="true" /></button></li>
        </ul>
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

      <!-- 组合前传 as the game lists it: the prequel's button art at its own size opens the collection,
           then the episodes by number. -->
      <section v-if="stories.length" class="unit-section unit-stories-section" aria-labelledby="unit-stories-title">
        <div class="section-heading">
          <h3 id="unit-stories-title">组合前传</h3>
          <span>{{ stories.length }} 话</span>
        </div>
        <button
          v-if="unitStoryBanner && !bannerError"
          type="button"
          class="unit-stories-cover"
          :aria-label="`${unit.unit_name} 组合前传合集`"
          :data-archive-focus-id="`unit-story-banner:${unit.unit_code}`"
          @click="emit('open-story', { domain: 'unit_story', section: String(unit.unit_id) })"
        >
          <img :src="unitStoryBanner" alt="" @error="bannerError = true" />
          <span>合集 <ChevronRight :size="15" aria-hidden="true" /></span>
        </button>
        <ol class="unit-stories">
          <li v-for="(story, index) in stories" :key="story.id">
            <button
              type="button"
              :data-archive-focus-id="`unit-story:${unit.unit_code}:${story.id}`"
              @click="emit('open-story', story)"
            >
              <span class="unit-story-number">{{ index + 1 }}</span>
              <strong :class="{ 'is-title-pending': storyTitle.pending() }">{{ storyTitle(story.file, story.title) }}</strong>
              <ChevronRight :size="16" aria-hidden="true" />
            </button>
          </li>
        </ol>
      </section>
    </div>

    <section v-if="allEventItems.length" class="unit-section" aria-labelledby="unit-events-title">
      <!-- With categories, the tabs' own rule is the section's one line (线框减法册 rule 2). -->
      <div class="section-heading" :class="{ 'has-tabs': eventCategories.length > 1 }">
        <h3 id="unit-events-title">活动与企划出演</h3>
        <span>{{ allEventItems.length }}</span>
      </div>
      <GsTabs v-if="eventCategories.length > 1" v-model="activeEventCategory" class="unit-event-tabs" aria-label="活动分类筛选" :options="eventCategories.map(cat => ({ value: cat.key, label: cat.label, count: cat.count }))" />
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
import { ChevronRight, Music } from '@lucide/vue'
import { idolThemeProperties } from '../../presentation/idolStageLight.js'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import GsTabs from '../gs/GsTabs.vue'
import { eventBannerUrl } from '../../data/eventResourceGraph.js'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { buildIdolReference } from '../../presentation/IdolReferencePresentation.js'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { reflowText } from '../../../shared/reading/ReadingTypography.js'
import { unitIntroImageUrl, unitStoryBannerUrl } from '../../data/storyCollections.js'
import { useStoryTitles } from './useReaderTitles.js'

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
const storyTitle = useStoryTitles()

// The group picture is cut at the hips: the frame shows its top ART_SHOWN, so the frame's ratio follows
// the picture's (read on load; the pictures run 496–828 wide by 537–704 tall).
const ART_SHOWN = 0.58
const introUrl = computed(() => unitIntroImageUrl(props.unit?.unit_code))
const introFailed = ref(false)
const artRatio = ref(600 / 680)
const artStyle = computed(() => ({ '--unit-art-ratio': artRatio.value, '--unit-art-frame': artRatio.value / ART_SHOWN, '--unit-art-shown': ART_SHOWN }))
function readArtSize(event) {
  const { naturalWidth, naturalHeight } = event.target
  if (naturalWidth && naturalHeight) artRatio.value = naturalWidth / naturalHeight
}

// Faces and names only: the reading and CV belong to each idol's own page.
const memberReferences = computed(() => props.members.map(member => {
  const reference = { ...buildIdolReference(member.idol_code, props.identity, props.manifest, `unit:${props.unit?.unit_code || ''}`), subtitle: '', unitName: '' }
  return { member, reference: reference.actionable ? { ...reference, displayName: props.idolName(reference.idolCode, reference.displayName) || reference.displayName } : reference }
}))

function jumpTo(headingId) {
  document.getElementById(headingId)?.closest('section')?.scrollIntoView({ block: 'start' })
}

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
  introFailed.value = false
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
/* 人物幕: the idol page's hero (ArchiveIdolDetail .idol-hero) with the unit colour: the wash lit to the
   lower right, the group picture top-aligned on the right, its flat shadow in the unit ink at 24% to the
   lower right, the cut at the hips sitting on the hero's lower edge and fading through its last 18%. */
.unit-hero { position: relative; display: flex; align-items: center; min-height: 300px; overflow: clip; padding: var(--gs-space-7) var(--gs-space-8); border-radius: var(--gs-radius-media); background: radial-gradient(circle at 78% 62%, var(--gs-surface) 0, var(--gs-idol-wash) 58%); }
.unit-hero-art { position: absolute; z-index: 1; top: var(--gs-space-6); right: var(--gs-space-6); bottom: 0; width: min(52%, calc((300px - var(--gs-space-6)) * var(--unit-art-frame))); -webkit-mask-image: linear-gradient(black 82%, transparent); mask-image: linear-gradient(black 82%, transparent); }
.unit-hero-art img { display: block; width: 100%; height: calc(100% / var(--unit-art-shown)); object-fit: contain; object-position: center top; filter: drop-shadow(6px 4px 0 color-mix(in oklab, var(--gs-idol-ink) 24%, transparent)); }
.unit-hero-copy { position: relative; z-index: 2; display: grid; justify-items: start; gap: var(--gs-space-2); min-width: 0; max-width: 34em; }
.unit-hero.has-art .unit-hero-copy { max-width: 44%; }
.unit-hero-logo { display: block; max-width: 180px; max-height: 72px; margin-bottom: var(--gs-space-3); object-fit: contain; object-position: left center; }
.unit-hero-name { margin: 0; padding-left: var(--gs-space-4); border-left: 3px solid var(--gs-idol); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; overflow-wrap: anywhere; }
.unit-hero-kana { margin-left: var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }
.unit-hero-desc { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
/* 成员 | 收录: one row on the paper, no rules, in the same 55 : 45 columns as the songs and prequel below. */
.unit-overview { display: grid; grid-template-columns: 55fr 45fr; gap: var(--gs-space-8); align-items: start; }
.unit-overview > div { min-width: 0; }
.unit-overview-label { margin: 0 0 var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.unit-overview-label b { margin-left: 2px; color: var(--gs-ink-2); font-family: var(--gs-font-stage); font-variant-numeric: tabular-nums; }
.unit-holdings { display: flex; flex-wrap: wrap; gap: 0 var(--gs-space-6); margin: 0; padding: 0; list-style: none; }
.unit-holdings button { display: inline-flex; align-items: center; gap: 3px; min-height: var(--gs-control-touch); padding: 0; border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); cursor: pointer; }
.unit-holdings b { margin-left: var(--gs-space-2); color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.unit-holdings small { margin-left: var(--gs-space-2); font-size: var(--gs-text-meta); }
.unit-holdings svg { align-self: center; }
.section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading h3 { margin: 0; min-width: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.section-heading > span { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.section-heading.has-tabs { margin-bottom: 0; border-bottom: 0; }
.unit-event-tabs { margin-bottom: var(--gs-space-4); }
.unit-members { display: flex; flex-wrap: wrap; gap: 0 var(--gs-space-2); margin-left: -5px; }
.unit-members :deep(.idol-reference-arrow) { display: none; }
.unit-content-split { display: grid; grid-template-columns: 55fr 45fr; gap: var(--gs-space-8); align-items: start; }
.unit-content-split.single-column { grid-template-columns: 1fr; }
.unit-songs { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0 var(--gs-space-5); }
.unit-songs button, .unit-stories button { display: grid; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.unit-songs button { grid-template-columns: 48px minmax(0, 1fr) auto; }
.unit-songs img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; }
.unit-songs button > svg, .unit-stories button > svg { margin: auto; color: var(--gs-ink-3); }
.unit-songs span, .unit-stories button > span { display: grid; min-width: 0; }
.unit-songs strong, .unit-stories strong { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
/* The game's prequel list entry is the 446×150 button art: here at half size, never stretched. */
.unit-stories-cover { display: flex; align-items: center; gap: var(--gs-space-4); margin: 0 0 var(--gs-space-2); padding: 0; border: 0; background: none; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.unit-stories-cover img { display: block; width: 223px; height: auto; aspect-ratio: 446 / 150; border-radius: var(--gs-radius-media); }
.unit-stories-cover span { display: inline-flex; align-items: center; gap: 2px; }
.unit-stories { display: grid; margin: 0; padding: 0; list-style: none; }
.unit-stories button { grid-template-columns: 28px minmax(0, 1fr) auto; width: 100%; }
.unit-story-number { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-variant-numeric: tabular-nums; }
.is-title-pending { visibility: hidden; }
.unit-detail :deep(.relation-row) { border-radius: var(--gs-radius-control); }
.unit-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.unit-detail :deep(.relation-labels strong), .unit-detail :deep(.relation-labels small), .unit-detail :deep(.relation-meta) { font-size: var(--gs-text-meta); }
.unit-detail button:focus-visible, .unit-detail :deep(button.archive-idol-reference:focus-visible), .unit-detail :deep(.relation-row:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) {
  .unit-stories-cover:hover img { opacity: .9; }
  .unit-holdings button:hover { color: var(--gs-ink-2); }
  .unit-songs button:hover strong, .unit-stories button:hover strong { color: var(--gs-ink-2); }
}
@container unit-detail (max-width: 980px) {
  .unit-content-split, .unit-overview { grid-template-columns: 1fr; gap: var(--gs-space-section); }
  .unit-overview { gap: var(--gs-space-4); }
}
@media (max-width: 760px) {
  .unit-detail { gap: var(--gs-space-8); padding: var(--gs-space-5); }
  /* Phones: the hero runs to the screen edges; the picture on top, as wide as the screen allows and at most
     240 tall, still cut at the hips. The logo and name step up into its faded lower edge, so no cut line
     shows and the copy follows the faces. min-height stays auto: in the fixed-height page grid an explicit
     0 lets the row collapse. */
  .unit-hero { display: block; min-height: auto; margin: calc(-1 * var(--gs-space-5)) calc(-1 * var(--gs-space-5)) 0; width: auto; max-width: none; padding: var(--gs-space-5) 0 var(--gs-space-6); border-radius: 0; }
  .unit-hero-art { position: relative; inset: auto; width: min(calc(100% - 2 * var(--gs-space-4)), calc(240px * var(--unit-art-frame))); aspect-ratio: var(--unit-art-frame); min-height: 0; overflow: clip; margin-inline: auto; -webkit-mask-image: linear-gradient(black 70%, transparent); mask-image: linear-gradient(black 70%, transparent); }
  .unit-hero-copy, .unit-hero.has-art .unit-hero-copy { max-width: none; padding-inline: var(--gs-space-5); }
  .unit-hero.has-art .unit-hero-copy { margin-top: -36px; }
  .unit-hero-logo { max-width: 140px; max-height: 52px; margin-bottom: var(--gs-space-2); }
  .unit-hero-name { font-size: var(--gs-text-section); }
  .unit-songs { grid-template-columns: 1fr; }
  .unit-stories-cover img { width: 168px; }
}
</style>
