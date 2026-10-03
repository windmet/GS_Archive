<template>
  <article v-if="idol" class="idol-detail" data-archive-scroll-container>
    <header class="idol-profile-header">
      <ArchiveIdolAvatar class="idol-portrait" :idol-code="idol.idol_code" :accent-color="idol.color" :size="104" :ring-width="3" :alt="displayedIdolName" />
      <div class="idol-identity">
        <span class="idol-code">偶像档案</span>
        <h2>{{ displayedIdolName }}</h2>
        <p>{{ idol.name_fields?.kana || idol.cv || '' }}</p>
        <button v-if="idol.unit_code" class="idol-unit-link" :data-archive-focus-id="`idol-unit:${idol.idol_code}`" @click="emit('open-unit', idol)">
          <UsersRound :size="15" />
          <span>{{ idol.unit_name }}</span>
          <ChevronRight :size="14" />
        </button>
      </div>
      <span v-if="idol.color" class="idol-color" :style="{ backgroundColor: idol.color }" :title="idol.color"></span>
      <ArchiveIdolSwitcher
        class="profile-switcher"
        :idols="idols"
        :selected-idol="selectedIdol"
        dark
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
        <span>已收录</span>
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

    <section v-if="honors.length" class="idol-related" aria-labelledby="idol-honors-title">
      <div class="section-heading"><h3 id="idol-honors-title">关联排名称号</h3><span>{{ honors.length }} 条 · 已知来源</span></div>
      <div class="related-grid"><button v-for="honor in honors" :key="honor.key" :data-archive-focus-id="`idol-honor:${idol.idol_code}:${honor.key}`" @click="emit('open-honor',honor.key)"><Medal :size="20"/><span><strong :title="honor.nameJa">{{ archiveText('honor',honor.nameJa) }}</strong><small>{{ honor.sources.map(source=>source.event?.title).filter(Boolean).join(' · ') }}</small></span><ChevronRight :size="18" aria-hidden="true"/></button></div>
      <p class="idol-honor-note">按历史排名配置中的偶像编号关联；未推断持有或其他称号的归属。</p>
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
        <p>{{ idol.hobby }}</p>
      </div>
      <div v-if="idol.specialty">
        <h3>特技</h3>
        <p>{{ idol.specialty }}</p>
      </div>
    </section>
    <ArchiveTechnicalDetails :key="idol.idol_code" :evidence="{ idol, songs: songs.map(entry => ({ song_code: entry.song.song_code, title: entry.song.title, evidenceLabel: entry.evidenceLabel, performance_mapping: entry.song.performance_mapping })) }" />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpenText, ChevronRight, Images, Camera, Medal, MessageSquareText, Music, Phone, UsersRound } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveText} from './useArchiveCollectionText.js'
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

const displayedIdolName = computed(() => props.idol
  ? props.idolName(props.idol.idol_code, props.idol.display_name) || props.idol.display_name
  : '')

const facts = computed(() => [
  { label: '年龄', value: props.idol?.age ? `${props.idol.age}岁` : '' },
  { label: '生日', value: props.idol?.birthday },
  { label: '身高', value: props.idol?.height ? `${props.idol.height} cm` : '' },
  { label: '体重', value: props.idol?.weight ? `${props.idol.weight} kg` : '' },
  { label: '出身', value: props.idol?.birthplace },
  { label: 'CV', value: props.idol?.cv },
  { label: '前职', value: props.idol?.former_job },
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
.idol-detail {
  container: idol-detail / inline-size;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: var(--gs-space-7);
  background: #f7f9fa;
  font-family: var(--gs-font-directory);
  font-size: var(--gs-text-body);
  font-weight: var(--gs-weight-regular);
}
.idol-detail button { font-family: inherit; font-weight: var(--gs-weight-semibold); }
.idol-detail :deep(button:focus-visible),
.idol-detail :deep(select:focus-visible),
.idol-detail :deep(summary:focus-visible) {
  outline: var(--gs-focus-ring) solid #16978e;
  outline-offset: var(--gs-focus-offset);
}
.idol-profile-header :deep(button:focus-visible),
.idol-profile-header :deep(select:focus-visible) { outline-color: #58cec5; }
.idol-profile-header {
  position: relative;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) minmax(0, 360px);
  align-items: center;
  gap: var(--gs-space-6);
  min-height: 152px;
  padding: var(--gs-space-7);
  border-bottom: 3px solid #2bb8ae;
  background: #17212b;
  color: #fff;
}
.idol-portrait { box-shadow: 0 0 0 1px rgba(255, 255, 255, .85); }
.idol-identity { min-width: 0; overflow-wrap: anywhere; }
.idol-code { color: #58cec5; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.idol-identity h2 { margin: var(--gs-space-3) 0 var(--gs-space-2); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.4; letter-spacing: 0; }
.idol-identity p { margin: 0; color: #aeb9c2; font-size: var(--gs-text-meta); }
.idol-unit-link { display: inline-flex; align-items: center; gap: var(--gs-space-3); min-height: var(--gs-control-compact); max-width: 100%; margin-top: var(--gs-space-4); padding: 0 var(--gs-space-3); border: 1px solid #42515d; border-radius: var(--gs-radius-control); background: #22303b; color: #dce5e9; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.idol-unit-link span { min-width: 0; }
.idol-unit-link svg { flex: 0 0 auto; }
.idol-color { position: absolute; right: var(--gs-space-7); top: var(--gs-space-7); width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.8); border-radius: 50%; }
.profile-switcher { gap: var(--gs-space-3); min-width: 0; margin-right: var(--gs-space-8); }
.profile-switcher :deep(button) { flex-basis: var(--gs-control-normal); width: var(--gs-control-normal); height: var(--gs-control-normal); border-radius: var(--gs-radius-control); font-family: inherit; }
.profile-switcher :deep(label) { gap: var(--gs-space-2); }
.profile-switcher :deep(label span) { font-size: var(--gs-text-meta); }
.profile-switcher :deep(select) { min-width: 0; height: var(--gs-control-normal); padding: 0 var(--gs-space-8) 0 var(--gs-space-4); border-radius: var(--gs-radius-field); font-family: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.idol-facts, .idol-related, .idol-songs, .idol-events, .idol-notes { min-width: 0; margin-top: var(--gs-space-6); padding: var(--gs-space-6); border: 1px solid #dfe4e8; background: #fff; }
.idol-facts dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.idol-facts dl div { min-width: 0; padding: var(--gs-space-4) var(--gs-space-5); border-left: 1px solid #e5e9ec; }
.idol-facts dl div:nth-child(4n + 1) { border-left: 0; }
.idol-facts dt { color: #7b858e; font-size: var(--gs-text-meta); }
.idol-facts dd { margin: var(--gs-space-2) 0 0; overflow-wrap: anywhere; white-space: pre-line; font-size: var(--gs-text-body); font-weight: var(--gs-weight-medium); }
.section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-4); }
.section-heading h3, .idol-notes h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.section-heading span { color: #7b858e; font-size: var(--gs-text-meta); }
.related-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-3); }
.related-grid button {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--gs-space-3);
  min-width: 0;
  min-height: 62px;
  padding: var(--gs-space-4);
  border: 1px solid #dfe4e8;
  border-radius: var(--gs-radius-control);
  background: #fff;
  color: #26313a;
  cursor: pointer;
  text-align: left;
}
.related-grid button > svg:first-child { color: #16978e; }
.related-grid button > svg:last-child { color: #9ca5ad; }
.related-grid span { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; overflow-wrap: anywhere; }
.related-grid strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.related-grid small { color: #7b858e; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.song-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-3); }
.song-links button { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 58px; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #dfe4e8; border-radius: var(--gs-radius-control); background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.song-links img { width: 44px; height: 44px; border-radius: var(--gs-radius-control); object-fit: cover; }
.song-links button > svg:first-child { margin: auto; color: #16978e; }
.song-links button > svg:last-child { color: #9ca5ad; }
.song-links span { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.song-links strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.song-links small { color: #7b858e; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.idol-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-7); }
.idol-notes p { margin: var(--gs-space-3) 0 0; color: #4f5b64; font-size: var(--gs-text-body); line-height: 1.7; overflow-wrap: anywhere; }
.idol-honor-note { margin: var(--gs-space-4) 0 0; color: #70848a; font-size: var(--gs-text-body); line-height: 1.7; }

.idol-detail :deep(.relation-list) { gap: var(--gs-space-3); }
.idol-detail :deep(.relation-row) { gap: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); font-family: inherit; }
.idol-detail :deep(.relation-copy) { gap: var(--gs-space-2); }
.idol-detail :deep(.relation-labels) { gap: var(--gs-space-2); }
.idol-detail :deep(.relation-labels strong),
.idol-detail :deep(.relation-labels small),
.idol-detail :deep(.relation-meta),
.idol-detail :deep(.relation-proof),
.idol-detail :deep(.relation-copy code) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.idol-detail :deep(.relation-labels small) { padding: var(--gs-space-1) var(--gs-space-2); }
.idol-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.idol-detail :deep(.archive-technical) { margin-top: var(--gs-space-5); border-radius: var(--gs-radius-control); }
.idol-detail :deep(.archive-technical summary) { min-height: var(--gs-control-normal); padding: var(--gs-space-4) var(--gs-space-5); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.idol-detail :deep(.archive-technical-body) { padding: 0 var(--gs-space-5) var(--gs-space-5); font-size: var(--gs-text-meta); }
.idol-detail :deep(.archive-technical pre) { font-size: var(--gs-text-meta); }

@media (hover: hover) and (pointer: fine) {
  .idol-unit-link:hover { border-color: #58cec5; }
  .related-grid button:hover, .song-links button:hover { border-color: #75cbc5; background: #f0fbfa; }
}

/* 104px portrait + 40px gaps + 200px identity + 360px selector + 48px padding = 752px. */
/* Stack the selector before that identity column becomes narrow; keep both portrait sizes. */
@container idol-detail (max-width: 800px) {
  .idol-profile-header { grid-template-columns: 104px minmax(0, 1fr); }
  .profile-switcher { grid-column: 1 / -1; width: 100%; margin: 0; }
}

@media (max-width: 760px), (pointer: coarse) {
  .idol-unit-link { min-height: var(--gs-control-touch); }
  .profile-switcher :deep(button) { flex-basis: var(--gs-control-touch); width: var(--gs-control-touch); height: var(--gs-control-touch); }
  .profile-switcher :deep(select) { height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .idol-detail :deep(.archive-technical summary) { min-height: var(--gs-control-touch); }
}

@media (max-width: 900px) {
  .idol-facts dl, .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .idol-facts dl div:nth-child(4n + 1) { border-left: 1px solid #e5e9ec; }
  .idol-facts dl div:nth-child(2n + 1) { border-left: 0; }
}

@media (max-width: 560px) {
  .idol-detail { padding: var(--gs-space-4); }
  .idol-profile-header { grid-template-columns: 78px minmax(0, 1fr); align-items: start; gap: var(--gs-space-5); min-height: 124px; padding: var(--gs-space-5); }
  .idol-portrait { --idol-avatar-override-size: 78px; }
  .idol-color { right: var(--gs-space-5); top: var(--gs-space-5); }
  .idol-facts, .idol-related, .idol-songs, .idol-events, .idol-notes { margin-top: var(--gs-space-4); padding: var(--gs-space-5); }
  .idol-facts dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .idol-facts dl div { padding: var(--gs-space-3); }
  .related-grid { grid-template-columns: 1fr; }
  .song-links { grid-template-columns: 1fr; }
  .idol-notes { grid-template-columns: 1fr; gap: var(--gs-space-5); }
  .idol-detail :deep(.relation-row) { gap: var(--gs-space-3); padding: var(--gs-space-3); }
}
</style>
