<template>
  <article v-if="idol" class="idol-detail">
    <header class="idol-profile-header">
      <img
        :src="`/assets/idols/icons/image_chara_icon_${idol.idol_code}.png`"
        :alt="idol.display_name"
        class="idol-portrait"
      />
      <div class="idol-identity">
        <span class="idol-code">{{ idol.idol_code }}</span>
        <h2>{{ idol.display_name }}</h2>
        <p>{{ idol.name_fields?.kana || idol.cv || '' }}</p>
        <button v-if="idol.unit_code" class="idol-unit-link" @click="emit('open-unit', idol)">
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
        <span>按现有索引统计</span>
      </div>
      <div class="related-grid">
        <button v-for="item in related" :key="item.id" @click="emit('open-domain', item.id)">
          <component :is="item.icon" :size="20" :stroke-width="1.8" />
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.count }}</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section v-if="songs.length" class="idol-songs" aria-labelledby="idol-songs-title">
      <div class="section-heading">
        <h3 id="idol-songs-title">演唱歌曲</h3>
        <span>{{ songs.length }} songs · 表 46 映射</span>
      </div>
      <div class="song-links">
        <button v-for="entry in songs" :key="entry.song.song_code" @click="emit('open-song', entry.song.song_code)">
          <img v-if="entry.song.jacket_url" :src="entry.song.jacket_url" :alt="`${entry.song.title} 封面`" />
          <Music v-else :size="20" aria-hidden="true" />
          <span>
            <strong>{{ entry.song.title }}</strong>
            <small>{{ entry.evidenceLabel }}</small>
          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section v-if="events.length" class="idol-events" aria-labelledby="idol-events-title">
      <div class="section-heading">
        <h3 id="idol-events-title">相关活动</h3>
        <span>{{ events.length }} events · 按出演阵容</span>
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
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpenText, ChevronRight, Images, MessageSquareText, Music, Phone, UsersRound } from '@lucide/vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import ArchiveIdolSwitcher from './ArchiveIdolSwitcher.vue'

const props = defineProps({
  idol: { type: Object, default: null },
  stats: { type: Object, default: () => ({}) },
  events: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  idols: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
})

const emit = defineEmits(['open-domain', 'open-unit', 'open-event', 'open-song', 'select-idol'])

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

const related = computed(() => [
  { id: 'stories', label: '个人故事', count: `${props.stats.stories || 0} segments`, icon: BookOpenText },
  { id: 'cards', label: '卡片', count: `${props.stats.cards || 0} cards`, icon: Images },
  { id: 'chat', label: '个人聊天', count: `${props.stats.chats || 0} records`, icon: MessageSquareText },
  { id: 'phone', label: '电话通信', count: `${props.stats.phones || 0} records`, icon: Phone },
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
.idol-detail { height: 100%; overflow-y: auto; padding: 24px; background: #f7f9fa; }
.idol-profile-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 152px;
  padding: 24px 28px;
  border-bottom: 3px solid #2bb8ae;
  background: #17212b;
  color: #fff;
}
.idol-portrait { width: 104px; height: 104px; border: 3px solid #fff; border-radius: 50%; background: #eef1f3; object-fit: cover; }
.idol-identity { min-width: 0; }
.idol-code { color: #58cec5; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.68rem; }
.idol-identity h2 { margin: 7px 0 4px; font-size: 1.55rem; letter-spacing: 0; }
.idol-identity p { margin: 0; color: #aeb9c2; font-size: 0.78rem; }
.idol-unit-link { display: inline-flex; align-items: center; gap: 6px; min-height: 29px; margin-top: 12px; padding: 0 8px; border: 1px solid #42515d; border-radius: 5px; background: #22303b; color: #dce5e9; cursor: pointer; font: inherit; font-size: 0.68rem; }
.idol-unit-link:hover { border-color: #58cec5; }
.idol-color { position: absolute; right: 26px; top: 24px; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.8); border-radius: 50%; }
.profile-switcher { width: min(360px, 38vw); margin-left: auto; margin-right: 34px; }
.idol-facts, .idol-related, .idol-songs, .idol-events, .idol-notes { margin-top: 18px; padding: 20px; border: 1px solid #dfe4e8; background: #fff; }
.idol-facts dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.idol-facts dl div { min-width: 0; padding: 10px 16px; border-left: 1px solid #e5e9ec; }
.idol-facts dl div:nth-child(4n + 1) { border-left: 0; }
.idol-facts dt { color: #7b858e; font-size: 0.67rem; }
.idol-facts dd { margin: 5px 0 0; overflow-wrap: anywhere; font-size: 0.82rem; font-weight: 650; }
.section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 12px; }
.section-heading h3, .idol-notes h3 { margin: 0; font-size: 0.86rem; }
.section-heading span { color: #7b858e; font-size: 0.67rem; }
.related-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.related-grid button {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 62px;
  padding: 10px 12px;
  border: 1px solid #dfe4e8;
  border-radius: 6px;
  background: #fff;
  color: #26313a;
  cursor: pointer;
  text-align: left;
}
.related-grid button:hover { border-color: #75cbc5; background: #f0fbfa; }
.related-grid button > svg:first-child { color: #16978e; }
.related-grid button > svg:last-child { color: #9ca5ad; }
.related-grid span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.related-grid strong { font-size: 0.78rem; }
.related-grid small { color: #7b858e; font-size: 0.66rem; }
.song-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.song-links button { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 58px; padding: 7px 10px; border: 1px solid #dfe4e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.song-links button:hover { border-color: #75cbc5; background: #f0fbfa; }
.song-links img { width: 44px; height: 44px; border-radius: 5px; object-fit: cover; }
.song-links button > svg:first-child { margin: auto; color: #16978e; }
.song-links button > svg:last-child { color: #9ca5ad; }
.song-links span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.song-links strong { overflow: hidden; font-size: 0.76rem; text-overflow: ellipsis; white-space: nowrap; }
.song-links small { color: #7b858e; font-size: 0.64rem; }
.idol-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
.idol-notes p { margin: 8px 0 0; color: #4f5b64; font-size: 0.78rem; line-height: 1.7; }

@media (max-width: 900px) {
  .idol-facts dl, .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .idol-facts dl div:nth-child(4n + 1) { border-left: 1px solid #e5e9ec; }
  .idol-facts dl div:nth-child(2n + 1) { border-left: 0; }
}

@media (max-width: 560px) {
  .idol-profile-header { align-items: flex-start; flex-wrap: wrap; padding: 18px 16px; }
  .profile-switcher { flex-basis: 100%; width: 100%; margin: 4px 0 0; }
  .idol-detail { padding: 12px; }
  .idol-profile-header { gap: 15px; min-height: 124px; padding: 18px; }
  .idol-portrait { width: 78px; height: 78px; }
  .idol-identity h2 { font-size: 1.2rem; }
  .idol-color { right: 16px; top: 16px; }
  .idol-facts, .idol-related, .idol-songs, .idol-events, .idol-notes { margin-top: 10px; padding: 14px; }
  .idol-facts dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .idol-facts dl div { padding: 9px 8px; }
  .related-grid { grid-template-columns: 1fr; }
  .song-links { grid-template-columns: 1fr; }
  .idol-notes { grid-template-columns: 1fr; gap: 16px; }
}
</style>
