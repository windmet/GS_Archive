<template>
  <article v-if="idol" class="idol-detail" data-archive-scroll-container>
    <header class="idol-profile-header">
      <ArchiveIdolAvatar class="idol-portrait" :idol-code="idol.idol_code" :accent-color="idol.color" :size="104" :ring-width="3" :alt="displayedIdolName" />
      <div class="idol-identity">
        <h2>{{ displayedIdolName }}<span v-if="idol.color" class="idol-color" :style="{ backgroundColor: idol.color }" :title="`代表色 ${idol.color}`"></span></h2>
        <p>{{ idol.name_fields?.kana || idol.cv || '' }}</p>
        <button v-if="idol.unit_code" class="idol-unit-link" :data-archive-focus-id="`idol-unit:${idol.idol_code}`" @click="emit('open-unit', idol)">
          <UsersRound :size="15" />
          <span>{{ idol.unit_name }}</span>
          <ChevronRight :size="14" />
        </button>
      </div>
      <ArchiveIdolSwitcher
        class="profile-switcher"
        :idols="idols"
        :selected-idol="selectedIdol"
        @select="emit('select-idol', $event)"
      />
    </header>

    <section class="idol-facts" aria-label="偶像档案">
      <dl>
        <div v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value || '—' }}</dd>
        </div>
      </dl>
    </section>

    <section class="idol-related" aria-labelledby="idol-related-title">
      <div class="section-heading">
        <h3 id="idol-related-title">关联资料</h3>
      </div>
      <div class="related-grid">
        <button v-for="item in related" :key="item.id" :data-archive-focus-id="`idol-domain:${idol.idol_code}:${item.id}`" @click="emit('open-domain', item.id)">
          <component :is="item.icon" :size="20" :stroke-width="1.8" />
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.count }}</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </section>

    <!-- Honors as the plates the game shows. The idol's own honors decode from the honor id; ranking
         honors name the idol in an event's ranking configuration. Each plate opens the honor page. -->
    <section v-if="honors.length" class="idol-related idol-honors" aria-labelledby="idol-honors-title">
      <div class="section-heading"><h3 id="idol-honors-title">称号</h3><span>{{ honors.length }} 个</span></div>
      <section v-for="group in honorGroups" :key="group.id" class="honor-group" :aria-label="group.title">
        <h4>{{ group.title }}<small>{{ group.note }}</small></h4>
        <ul class="honor-plates">
          <li v-for="honor in group.honors" :key="honor.key">
            <button type="button" :data-archive-focus-id="`idol-honor:${idol.idol_code}:${honor.key}`" :title="honor.nameJa" @click="emit('open-honor',honor.key)">
              <span class="honor-plate"><img v-if="honor.image?.url" :src="honor.image.url" :alt="honorTitle(honor)" loading="lazy" decoding="async" /><Medal v-else :size="20" aria-hidden="true" /></span>
              <span class="honor-caption"><strong>{{ honorTitle(honor) }}</strong><small>{{ honorMeta(honor) }}</small></span>
            </button>
          </li>
        </ul>
      </section>
    </section>

    <section v-if="songs.length" class="idol-songs" aria-labelledby="idol-songs-title">
      <div class="section-heading">
        <h3 id="idol-songs-title">演唱歌曲</h3>
        <span>{{ songs.length }} 首</span>
      </div>
      <div class="song-links">
        <button v-for="entry in songs" :key="entry.song.song_code" :data-archive-focus-id="`idol-song:${idol.idol_code}:${entry.song.song_code}`" @click="emit('open-song', entry.song.song_code)">
          <img v-if="entry.song.jacket_url" :src="entry.song.jacket_url" :alt="`${entry.song.title} 封面`" />
          <Music v-else :size="20" aria-hidden="true" />
          <span>
            <strong>{{ entry.song.title }}</strong>

          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section v-if="events.length" class="idol-events" aria-labelledby="idol-events-title">
      <div class="section-heading">
        <h3 id="idol-events-title">相关活动</h3>
        <span>{{ events.length }} 场 · 参演活动</span>
      </div>
      <ArchiveRelationList :items="eventItems" @select="emit('open-event', $event.payload)" />
    </section>

    <section v-if="idol.hobby || idol.specialty" class="idol-notes" aria-label="兴趣与特技">
      <div v-if="idol.hobby">
        <h3>兴趣</h3>
        <p>{{ profileText('hobby') }}</p>
      </div>
      <div v-if="idol.specialty">
        <h3>特技</h3>
        <p>{{ profileText('specialty') }}</p>
      </div>
    </section>
    <ArchiveTechnicalDetails :key="idol.idol_code" :evidence="{ idol, songs: songs.map(entry => ({ song_code: entry.song.song_code, title: entry.song.title, evidenceLabel: entry.evidenceLabel, performance_mapping: entry.song.performance_mapping })) }" />
  </article>
</template>

<script setup>
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
import { computed } from 'vue'
import { BookOpenText, ChevronRight, Images, Camera, Medal, MessageSquareText, Music, Phone, UsersRound } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveText} from './useArchiveCollectionText.js'
import { fesHonorMonth } from '../../presentation/HonorIdentity.mjs'
import { honorBondSource } from '../../presentation/HonorBondSource.mjs'
import ArchiveRelationList from './ArchiveRelationList.vue'
import ArchiveIdolSwitcher from './ArchiveIdolSwitcher.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

const props = defineProps({
  idol: { type: Object, default: null },
  honors: {type:Array,default:()=>[]},
  photo: {type:Object,default:null},
  stats: { type: Object, default: () => ({}) },
  events: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  idols: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  idolName: { type: Function, default: () => '' },
})

const emit = defineEmits(['open-domain', 'open-unit', 'open-event', 'open-song', 'select-idol','open-honor'])
// Bond honors (担当 at bond Lv.50, the catchphrase at Lv.100) come first, then FES achievements, then
// event rankings. FES names are internal condition labels, so their plate gets a readable title.
const HONOR_GROUPS = [
  { id: 'bond', title: '羁绊称号', note: '偶像羁绊奖励 · 用户转述来源', kinds: ['tantou', 'catchphrase'] },
  { id: 'fes', title: 'FES 成就', note: 'FES 限定卡的换装与满破', kinds: ['fes-change', 'fes-limitbreak'] },
]
const honorGroups = computed(() => [
  ...HONOR_GROUPS.map(group => ({ ...group, honors: props.honors.filter(honor => group.kinds.includes(honor.kind)) })),
  { id: 'ranking', title: '活动排名', note: '按活动排名配置中的偶像编号关联', honors: props.honors.filter(honor => honor.group === 'ranking') },
].filter(group => group.honors.length))
function honorTitle(honor) {
  if (honor.kind === 'fes-change') return 'FES 限定卡换装'
  if (honor.kind === 'fes-limitbreak') return 'FES 限定卡满破'
  return archiveText('honor', honor.nameJa)
}
const rankLabel = source => source.upperRank === source.lowerRank ? `第 ${source.upperRank} 名` : `第 ${source.upperRank}–${source.lowerRank} 名`
function honorMeta(honor) {
  if (honor.kind?.startsWith('fes-')) return `${fesHonorMonth(honor)} FES`
  if (honor.group === 'idol') { const bond = honorBondSource(honor); return bond ? `羁绊 Lv.${bond.level}` : '专属称号' }
  return (honor.sources || []).map(source => [source.event?.title, rankLabel(source)].filter(Boolean).join(' · ')).join('；')
}

const displayedIdolName = computed(() => props.idol
  ? props.idolName(props.idol.idol_code, props.idol.display_name) || props.idol.display_name
  : '')

void loadArchiveNames('profiles').catch(() => {})
const profileText = field => props.idol?.[field] ? archiveNamedText('idol-profile', props.idol[field], field) : ''
const facts = computed(() => [
  { label: '年龄', value: props.idol?.age ? `${props.idol.age}岁` : '' },
  { label: '生日', value: props.idol?.birthday },
  { label: '身高', value: props.idol?.height ? `${props.idol.height} cm` : '' },
  { label: '体重', value: props.idol?.weight ? `${props.idol.weight} kg` : '' },
  { label: '出身', value: profileText('birthplace') },
  { label: 'CV', value: props.idol?.cv },
  { label: '前职', value: profileText('former_job') },
  { label: '组合', value: props.idol?.unit_name },
])

const communicationCount = (value, unit) => value == null
  ? '尚未确认'
  : `${value} ${unit}`
const related = computed(() => [
  { id: 'stories', label: '个人故事', count: communicationCount(props.stats.stories, '篇'), icon: BookOpenText },
  { id: 'cards', label: '卡片', count: `${props.stats.cards || 0} 张`, icon: Images },
  { id: 'chat', label: '个人聊天', count: communicationCount(props.stats.chats, '条'), icon: MessageSquareText },
  ...(props.photo?[{id:'photos',label:'摄影姿势与语音',count:`${props.photo.faceCount} 表情 · ${props.photo.poseCount} 姿势 · ${props.photo.cueCount} 语音`,icon:Camera}]:[]),
  { id: 'phone', label: '电话通信', count: communicationCount(props.stats.phones, '条'), icon: Phone },
])

const eventItems = computed(() => props.events.map(event => {
  const confirmed = String(event.relation_type || '').startsWith('confirmed_')
  return {
    id: `event-${event.event_id}`,
    kind: 'event',
    label: eventScopeLabel(event),
    title: event.title,
    meta: [event.series, formatDate(event.release_at)].filter(Boolean).join(' · '),
    evidenceLabel: confirmed ? 'Confirmed' : 'Derived',
    evidenceTone: confirmed ? 'confirmed' : 'derived',
    evidence: event.classification_source,
    statusLabel: event.exists ? '可播放' : '缺少剧情',
    statusTone: event.exists ? 'available' : 'missing',
    resource: event.file,
    payload: event,
  }
}))

function eventScopeLabel(event) {
  if (event.event_scope === 'fixed_unit_event') return '固定组合团活'
  if (event.event_scope === 'attribute_event') return `${event.attribute || ''} 属性团曲`.trim()
  return '跨组合团活'
}

function formatDate(timestamp) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
/* Idol detail: identity on paper (the idol colour lives in the avatar ring), then flat sections. */
.idol-detail { container: idol-detail / inline-size; display: grid; align-content: start; gap: var(--gs-space-section); min-width: 0; height: 100%; overflow-y: auto; padding: var(--gs-space-8); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.idol-detail > * { width: 100%; max-width: var(--gs-content-width); margin-inline: auto; }
.idol-detail button { font-family: inherit; }
.idol-detail :deep(button:focus-visible), .idol-detail :deep(select:focus-visible), .idol-detail :deep(summary:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

.idol-profile-header { display: grid; grid-template-columns: 104px minmax(0, 1fr) minmax(0, 360px); align-items: center; gap: var(--gs-space-7); }
.idol-identity { display: grid; gap: var(--gs-space-2); min-width: 0; overflow-wrap: anywhere; }
.idol-identity h2 { display: flex; align-items: center; gap: var(--gs-space-4); margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; }
.idol-identity p { margin: 0; color: var(--gs-ink-3); font-family: var(--gs-font-jp); font-size: var(--gs-text-ui); }
.idol-color { flex: none; width: 12px; height: 12px; border-radius: 50%; }
.idol-unit-link { display: inline-flex; align-items: center; justify-self: start; gap: var(--gs-space-2); min-height: var(--gs-control-compact); margin-top: var(--gs-space-3); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.idol-unit-link svg { flex: 0 0 auto; }
.profile-switcher { gap: var(--gs-space-3); min-width: 0; }
.profile-switcher :deep(button) { flex-basis: var(--gs-control-normal); width: var(--gs-control-normal); height: var(--gs-control-normal); border-radius: var(--gs-radius-control); }
.profile-switcher :deep(label span) { font-size: var(--gs-text-meta); }
.profile-switcher :deep(select) { min-width: 0; height: var(--gs-control-normal); padding: 0 var(--gs-space-8) 0 var(--gs-space-4); border-radius: var(--gs-radius-control); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }

.idol-facts dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 var(--gs-space-7); margin: 0; border-top: 1px solid var(--gs-rule); }
.idol-facts dl div { min-width: 0; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.idol-facts dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-facts dd { margin: var(--gs-space-1) 0 0; overflow-wrap: anywhere; white-space: pre-line; font-weight: var(--gs-weight-medium); }

.section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading h3, .idol-notes h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.section-heading span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.related-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-7); }
.related-grid button { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); text-align: left; cursor: pointer; }
.related-grid button > svg:first-child { color: var(--gs-ink-3); }
.related-grid button > svg:last-child { color: var(--gs-ink-3); }
.related-grid span { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-1) var(--gs-space-4); min-width: 0; overflow-wrap: anywhere; }
.related-grid strong { font-weight: var(--gs-weight-semibold); }
.related-grid small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 var(--gs-space-7); }
.song-links button { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-width: 0; padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); text-align: left; cursor: pointer; }
.song-links img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; }
.song-links button > svg { margin: auto; color: var(--gs-ink-3); }
.song-links span { display: grid; min-width: 0; }
.song-links strong { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.idol-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-8); }
.idol-notes h3 { padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.idol-notes p { margin: var(--gs-space-4) 0 0; color: var(--gs-ink-2); line-height: 1.8; overflow-wrap: anywhere; }
.honor-group + .honor-group { margin-top: var(--gs-space-6); }
.honor-group h4 { display: flex; align-items: baseline; gap: var(--gs-space-3); margin: 0 0 var(--gs-space-3); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.honor-group h4 small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
/* Plates keep the game's 228x46 / 232x60 proportions; the caption says where each one comes from. */
.honor-plates { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: var(--gs-space-4) var(--gs-space-6); margin: 0; padding: 0; list-style: none; }
.honor-plates button { display: grid; gap: var(--gs-space-2); width: 100%; min-width: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.honor-plate { display: flex; align-items: center; height: 60px; color: var(--gs-ink-3); }
.honor-plate img { display: block; max-width: 100%; max-height: 60px; object-fit: contain; object-position: left center; }
.honor-caption { display: grid; gap: 2px; min-width: 0; }
.honor-caption strong { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.honor-caption small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.idol-detail :deep(.relation-row) { border-radius: var(--gs-radius-control); }
.idol-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.idol-detail :deep(.relation-labels strong), .idol-detail :deep(.relation-labels small), .idol-detail :deep(.relation-meta) { font-size: var(--gs-text-meta); }

@media (hover: hover) {
  .idol-unit-link:hover { text-decoration: underline; }
  .related-grid button:hover strong, .song-links button:hover strong, .honor-plates button:hover strong { color: var(--gs-mint-ink); }
}
@container idol-detail (max-width: 800px) {
  .idol-profile-header { grid-template-columns: 104px minmax(0, 1fr); }
  .profile-switcher { grid-column: 1 / -1; width: 100%; }
}
@media (max-width: 900px) { .idol-facts dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .idol-detail { gap: var(--gs-space-8); padding: var(--gs-space-5); }
  .idol-profile-header { grid-template-columns: 78px minmax(0, 1fr); gap: var(--gs-space-5); }
  .idol-portrait { --idol-avatar-override-size: 78px; }
  .idol-identity h2 { font-size: var(--gs-text-section); }
  .idol-unit-link { min-height: var(--gs-control-touch); }
  .profile-switcher :deep(button) { flex-basis: var(--gs-control-touch); width: var(--gs-control-touch); height: var(--gs-control-touch); }
  .profile-switcher :deep(select) { height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .related-grid, .song-links, .idol-notes { grid-template-columns: 1fr; gap: 0; }
  .idol-notes { gap: var(--gs-space-7); }
}
</style>
