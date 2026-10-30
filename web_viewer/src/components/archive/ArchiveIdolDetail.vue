<template>
  <article v-if="idol" class="idol-detail" :style="themeStyle" data-archive-scroll-container>
    <!-- 人物幕: the idol's wash, the figure with a flat shadow in the idol's ink (色影), the unit logo,
         the name after a 3px colour bar, and the autograph written beside it in ink (落款). The unit's
         faces live in the title row (the shell's header actions), not here. -->
    <header class="idol-hero" :class="{ 'has-figure': portrait && !portraitFailed }" :style="heroStyle">
      <img v-if="portrait && !portraitFailed" class="idol-hero-figure" :src="portrait.url" alt="" decoding="async" @error="portraitFailed = true" />
      <ArchiveIdolAvatar v-else class="idol-hero-avatar" :idol-code="idol.idol_code" :accent-color="idol.color" :size="104" :ring-width="3" decorative />
      <div class="idol-hero-copy">
        <button v-if="idol.unit_code" class="idol-hero-unit" type="button" :data-archive-focus-id="`idol-unit:${idol.idol_code}`" :aria-label="`组合 ${idol.unit_name}`" @click="emit('open-unit', idol)">
          <img v-if="!unitLogoFailed" :src="getUnitLogoUrl(idol.unit_code)" alt="" decoding="async" @error="unitLogoFailed = true" /><span v-else>{{ idol.unit_name }}</span>
        </button>
        <h2 class="idol-hero-name">{{ displayedIdolName }}</h2>
        <p lang="ja">{{ idol.name_fields?.kana || '' }}</p>
        <span class="idol-hero-sign" aria-hidden="true"></span>
      </div>
      <div class="idol-hero-acts">
        <button v-if="hasHome" type="button" class="idol-hero-home" :data-archive-focus-id="`idol-home:${idol.idol_code}`" @click="emit('open-home', idol.idol_code)">去事务所<ChevronRight :size="15" aria-hidden="true" /></button>
        <span v-if="isFavorite" class="idol-hero-favorite">我的担当</span>
        <ArchiveIdolSwitcher v-if="unitMates.length <= 1" class="profile-switcher" :idols="idols" :selected-idol="selectedIdol" @select="emit('select-idol', $event)" />
      </div>
    </header>

    <section class="idol-facts" aria-label="偶像档案">
      <dl>
        <div v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value || '—' }}</dd>
        </div>
      </dl>
    </section>

    <!-- The game's profile view (IdolProfileView) plays this line from its 自己紹介 button. -->
    <section v-if="selfIntroduction" class="idol-intro" aria-labelledby="idol-intro-title">
      <div class="section-heading">
        <h3 id="idol-intro-title">自我介绍</h3>
        <span>偶像资料页「自己紹介」· 1 段语音</span>
      </div>
      <div class="idol-intro-body">
        <button type="button" class="idol-intro-play" aria-label="播放自我介绍 ADV" title="播放 ADV" :data-archive-focus-id="`idol-intro:${idol.idol_code}`" @click="emit('play-introduction', selfIntroduction.file)">
          <Play :size="18" fill="currentColor" aria-hidden="true" />
        </button>
        <p class="idol-intro-line gs-flow" :lang="introLine.lang" :class="{ 'is-pending': introLine.pending }">{{ introLine.text }}</p>
      </div>
    </section>

    <section class="idol-related" aria-labelledby="idol-related-title">
      <div class="section-heading">
        <h3 id="idol-related-title">关联资料</h3>
      </div>
      <div class="related-grid">
        <!-- Numbers are text: the figure in the stage face, the name, one grey line for what it holds. -->
        <button v-for="item in related" :key="item.id" :data-archive-focus-id="`idol-domain:${idol.idol_code}:${item.id}`" @click="emit('open-domain', item.id)">
          <span class="related-figure">{{ item.figure ?? '—' }}<small v-if="item.unit && item.figure != null">{{ item.unit }}</small></span>
          <span class="related-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.figure == null ? '尚未确认' : item.breakdown }}</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </section>

    <!-- Honors as the plates the game shows. The idol's own honors decode from the honor id; ranking
         honors name the idol in an event's ranking configuration. Each plate opens the honor page. -->
    <section v-if="honors.length" class="idol-related idol-honors" aria-labelledby="idol-honors-title">
      <div class="section-heading"><h3 id="idol-honors-title">称号</h3><span>{{ honors.length }} 个</span></div>
      <!-- The plate already prints the honor's name; each caption adds only what the plate does not
           say (bond level, FES and month, rank). Where each group comes from opens behind its ⓘ. -->
      <section v-for="group in honorGroups" :key="group.id" class="honor-group" :aria-labelledby="`idol-honor-group-${group.id}`">
        <h4 :id="`idol-honor-group-${group.id}`">{{ group.title }}<small>{{ group.count }}</small>
          <button type="button" class="honor-info" :aria-expanded="openHonorNote === group.id" :aria-label="`${group.title}的来源说明`" :title="group.note" @click="openHonorNote = openHonorNote === group.id ? '' : group.id"><Info :size="15" aria-hidden="true" /></button>
        </h4>
        <p v-if="openHonorNote === group.id" class="honor-note">{{ group.note }}</p>
        <div v-for="row in group.rows" :key="row.id" class="honor-row">
          <h5 v-if="row.title">{{ row.title }}</h5>
          <ul v-for="line in row.lines" :key="line.id" class="honor-plates" :class="line.layout && `is-${line.layout}`">
            <li v-for="item in line.items" :key="item.honor.key">
              <button type="button" :data-archive-focus-id="`idol-honor:${idol.idol_code}:${item.honor.key}`" :aria-label="item.label" :title="item.honor.nameJa" @click="emit('open-honor',item.honor.key)">
                <span class="honor-plate"><img v-if="item.honor.image?.url" :src="item.honor.image.url" alt="" loading="lazy" decoding="async" /><Medal v-else :size="20" aria-hidden="true" /></span>
                <span v-if="item.tag" class="honor-caption"><span class="honor-text">{{ item.text }}</span><span class="honor-sep" aria-hidden="true">·</span><b class="honor-value">{{ item.tag }}</b></span>
              </button>
            </li>
          </ul>
        </div>
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

    <ArchiveTechnicalDetails :key="idol.idol_code" :evidence="{ idol, songs: songs.map(entry => ({ song_code: entry.song.song_code, title: entry.song.title, evidenceLabel: entry.evidenceLabel, performance_mapping: entry.song.performance_mapping })) }" />
  </article>
</template>

<script setup>
import { archiveLineText, archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
import { computed, ref, shallowRef, watch } from 'vue'
import { idolThemeProperties } from '../../presentation/idolStageLight.js'
import { ChevronRight, Info, Medal, Music, Play } from '@lucide/vue'
import { getCharaSignUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { loadCharacterPortraitData } from '../../data/ArchiveDataRepository.js'
import { portalIdolPortrait } from '../../presentation/ArchivePortalPresentation.js'
import idolVisualFocus from '../../presentation/idolVisualFocus.json'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveText} from './useArchiveCollectionText.js'
import { fesHonorMonth } from '../../presentation/HonorIdentity.mjs'
import { eventBannerUrl } from '../../data/eventResourceGraph.js'
import { formatIdolAge } from '../../data/idolPage.js'
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
  selfIntroduction: { type: Object, default: null },
  // The idol has an office (事务所) page to open, and is the reader's own 担当.
  hasHome: Boolean,
  isFavorite: Boolean,
})

// The page is about this idol, so the identity colour, its ink and its wash apply here (layer 2: a hero wash, never the whole page).
const themeStyle = computed(() => idolThemeProperties(props.idol?.color))
const unitMates = computed(() => props.idol?.unit_name ? props.idols.filter(row => row.unit_name === props.idol.unit_name) : [])
const emit = defineEmits(['open-domain', 'open-unit', 'open-event', 'open-song', 'select-idol','open-honor','play-introduction','open-home'])

// The figure is the same promoted character art the portal hero uses (portalIdolPortrait over the
// promotion registry), placed by where the person stands in it (idolVisualFocus), not by the image edge.
const portraitRegistry = shallowRef(null)
loadCharacterPortraitData().then(registry => { portraitRegistry.value = registry }).catch(() => {})
const portrait = computed(() => props.idol ? portalIdolPortrait(portraitRegistry.value, props.idol.idol_code) : null)
const portraitFailed = ref(false), unitLogoFailed = ref(false)
watch(() => props.idol?.idol_code, () => { portraitFailed.value = false; unitLogoFailed.value = false })
const HERO_FIGURE_HEIGHT = 340
const heroStyle = computed(() => {
  if (!props.idol) return undefined
  const image = portrait.value
  const focus = image ? idolVisualFocus.focusX[image.url] ?? 0.5 : 0.5
  const width = image?.width && image?.height ? HERO_FIGURE_HEIGHT * image.width / image.height : HERO_FIGURE_HEIGHT * 0.66
  return { '--hero-sign': `url(${getCharaSignUrl(props.idol.idol_code)})`, '--hero-figure-left': `calc(78% - ${Math.round(focus * width)}px)` }
})
// The self-introduction is the idol's IdolDetail home voice (home-voice, self-intro in the card-lines shard).
const introLine = computed(() => archiveLineText('card-lines', [['home-voice', 'self-intro']], props.selfIntroduction?.text || ''))
// Bond honors (担当 at bond Lv.50, the catchphrase at Lv.100), then FES achievements, then event
// rankings grouped by event. Notes say where each group comes from in reader terms.
const openHonorNote = ref('')
const HONOR_NOTES = {
  bond: '偶像羁绊达到指定等级时获得：担当称号为 Lv.50，台词称号为 Lv.100。等级来自玩家转述，暂未见官方资料。',
  fes: '称号原名就是达成条件：让该偶像的 FES 限定卡换装，或突破至最大上限。称号牌上印有对应的卡名。',
  ranking: '活动期间该偶像排行榜的名次奖励，按游戏内的排名配置关联到偶像。情人节活动（VDCP）另有送出巧克力数量的达成称号，称号编号对应偶像与数量。',
}
const rankText = source => source.upperRank === source.lowerRank ? `第 ${source.upperRank} 名` : `第 ${source.upperRank}–${source.lowerRank} 名`
// Captions add only what neither the plate nor the group heading says: "担当 · Lv.50",
// "<translation> · Lv.100", "限定换装 · 2022.12". Ranking plates print their rank, so they carry
// no caption; the rank stays in the accessible name.
function honorItem(honor) {
  const name = archiveText('honor', honor.nameJa)
  if (honor.kind === 'tantou' || honor.kind === 'catchphrase') {
    const level = honorBondSource(honor)?.level
    const text = honor.kind === 'tantou' ? '担当' : name
    return { honor, text, tag: level ? `Lv.${level}` : '', label: [name, level && `羁绊 Lv.${level}`].filter(Boolean).join(' · ') }
  }
  if (honor.kind?.startsWith('fes-')) {
    const text = honor.kind === 'fes-change' ? '限定换装' : '限定满破'
    const month = fesHonorMonth(honor).replace(/^(\d{4})年(\d{1,2})月$/, (_, y, m) => `${y}.${m.padStart(2, '0')}`)
    return { honor, text, tag: month, label: `FES ${text} · ${month}` }
  }
  const source = honor.sources?.[0] || {}
  // Chocolate plates print their count; the count stays in the accessible name.
  if (honor.kind === 'chocolate') return { honor, text: '', tag: '', label: `${source.event?.title || ''} 送出巧克力 ${source.count} 个` }
  return { honor, text: '', tag: '', label: `${source.event?.title || ''} ${rankText(source)}` }
}
const honorGroups = computed(() => {
  const own = kinds => props.honors.filter(honor => kinds.includes(honor.kind)).map(honorItem)
  const events = new Map()
  for (const honor of props.honors.filter(honor => honor.group === 'ranking')) {
    const event = honor.sources?.[0]?.event
    const id = String(event?.event_id || event?.title || honor.key)
    if (!events.has(id)) events.set(id, { id, title: event?.title || '活动排名', ranked: [], chocolate: [] })
    events.get(id)[honor.kind === 'chocolate' ? 'chocolate' : 'ranked'].push(honorItem(honor))
  }
  // One event, one heading: its rank plates on one line, its chocolate plates (VDCP) on the next.
  const eventRows = [...events.values()].map(({ id, title, ranked, chocolate }) => ({ id, title, lines: [
    { id: 'ranked', layout: 'ranked', items: ranked.sort((a, b) => (a.honor.sources?.[0]?.upperRank ?? 0) - (b.honor.sources?.[0]?.upperRank ?? 0)) },
    { id: 'chocolate', layout: 'chocolate', items: chocolate.sort((a, b) => a.honor.sources[0].count - b.honor.sources[0].count) },
  ].filter(line => line.items.length) }))
  return [
    { id: 'bond', title: '羁绊称号', rows: [{ id: 'bond', lines: [{ id: 'bond', items: own(['tantou', 'catchphrase']) }] }] },
    { id: 'fes', title: 'FES 成就', rows: [{ id: 'fes', lines: [{ id: 'fes', items: own(['fes-change', 'fes-limitbreak']) }] }] },
    { id: 'ranking', title: '活动称号', rows: eventRows },
  ].map(group => ({ ...group, note: HONOR_NOTES[group.id], count: group.rows.reduce((sum, row) => sum + row.lines.reduce((total, line) => total + line.items.length, 0), 0) }))
    .filter(group => group.count)
})

const displayedIdolName = computed(() => props.idol
  ? props.idolName(props.idol.idol_code, props.idol.display_name) || props.idol.display_name
  : '')

void loadArchiveNames('profiles').catch(() => {})
const profileText = field => props.idol?.[field] ? archiveNamedText('idol-profile', props.idol[field], field) : ''
// Eight facts, four to a row: the unit is the hero's logo, so 兴趣 and 特技 take its place.
const facts = computed(() => [
  { label: '年龄', value: formatIdolAge(props.idol?.display_age) },
  { label: '生日', value: props.idol?.birthday },
  { label: '身高 / 体重', value: [props.idol?.height && `${props.idol.height} cm`, props.idol?.weight && `${props.idol.weight} kg`].filter(Boolean).join(' · ') },
  { label: '出身', value: profileText('birthplace') },
  { label: 'CV', value: props.idol?.cv },
  { label: '前职', value: profileText('former_job') },
  { label: '兴趣', value: profileText('hobby') },
  { label: '特技', value: profileText('specialty') },
])

// Each row: a figure (null while unconfirmed), its unit, and a grey breakdown.
// 个人剧情 counts 第N話 with their Episode parts and Small Talk; an older stats leaf only has the total.
const storyRow = computed(() => {
  const { storySections: sections, storyEpisodes: episodes, storySmallTalks: talks, stories } = props.stats
  if (sections == null || episodes == null) return { figure: stories ?? null, unit: '篇', breakdown: '' }
  return { figure: sections, unit: '话', breakdown: [`${episodes} Episode`, talks ? `${talks} Small Talk` : ''].filter(Boolean).join(' · ') }
})
const related = computed(() => [
  { id: 'cards', label: '卡片', figure: props.stats.cards || 0, unit: '张', breakdown: '全部卡面' },
  { id: 'stories', label: '个人剧情', ...storyRow.value },
  { id: 'chat', label: '个人聊天', figure: props.stats.chats ?? null, unit: '条', breakdown: '' },
  { id: 'phone', label: '电话通信', figure: props.stats.phones ?? null, unit: '条', breakdown: '' },
  ...(props.photo ? [{ id: 'photos', label: '摄影姿势与语音', figure: props.photo.faceCount, unit: '表情', breakdown: `${props.photo.poseCount} 姿势 · ${props.photo.cueCount} 语音` }] : []),
  // Every archive idol has a Valentine / White Day arc; the seasonal page opens on theirs.
  { id: 'seasonal', label: '季节企划', figure: 2, unit: '', breakdown: '情人节与白色情人节' },
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
    imageUrl: eventBannerUrl(event),
    imageAlt: event.title,
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

/* 人物幕: artwork on the idol's wash. The figure casts a flat shadow in the idol's ink (24%) to the
   lower right; the autograph is written in ink beside the name. Media radius, nothing else. */
.idol-hero { position: relative; display: flex; flex-direction: column; justify-content: space-between; height: 300px; overflow: hidden; padding: var(--gs-space-7) var(--gs-space-8); border-radius: var(--gs-radius-media); background: radial-gradient(circle at 78% 62%, var(--gs-surface) 0, var(--gs-idol-wash) 58%); }
.idol-hero-figure { position: absolute; left: var(--hero-figure-left, 50%); bottom: -60px; z-index: 1; width: auto; max-width: none; height: 340px; object-fit: contain; -webkit-mask-image: linear-gradient(black 82%, transparent); mask-image: linear-gradient(black 82%, transparent); filter: drop-shadow(6px 4px 0 color-mix(in oklab, var(--gs-idol-ink) 24%, transparent)); }
.idol-hero-avatar { position: absolute; right: var(--gs-space-9); top: 50%; z-index: 1; translate: 0 -50%; }
.idol-hero-copy { position: relative; z-index: 2; display: grid; justify-items: start; gap: var(--gs-space-2); width: max-content; max-width: 55%; }
.idol-hero-unit { display: block; height: 42px; margin-bottom: var(--gs-space-2); padding: 0; border: 0; background: none; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.idol-hero-unit img { display: block; height: 100%; width: auto; max-width: 140px; object-fit: contain; object-position: left center; }
/* The 3px identity bar before the name. */
.idol-hero-name { margin: 0; padding-left: var(--gs-space-4); border-left: 3px solid var(--gs-idol); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.25; overflow-wrap: anywhere; }
/* 落款, wide screens: the autograph beside the name block, sized with the page (signatures run both
   tall and wide, so the box is square and the mark is contained in it). */
.idol-hero-sign { position: absolute; left: calc(100% + var(--gs-space-5)); top: 50%; width: clamp(84px, 11cqi, 136px); aspect-ratio: 1; translate: 0 -50%; background: var(--gs-idol-ink); -webkit-mask: var(--hero-sign) center / contain no-repeat; mask: var(--hero-sign) center / contain no-repeat; mask-mode: luminance; animation: idol-sign-write 1.1s var(--gs-motion-ease) .2s backwards; }
@keyframes idol-sign-write { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0); } }
@media (prefers-reduced-motion: reduce) { .idol-hero-sign { animation: none; } }
.idol-hero-copy p { margin: 0; padding-left: calc(var(--gs-space-4) + 3px); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.idol-hero-acts { position: relative; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); }
.idol-hero-home { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3) 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-surface); box-shadow: var(--gs-shadow-1); color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.idol-hero-favorite { display: inline-flex; align-items: center; height: 26px; padding: 0 var(--gs-space-3); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-idol-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.profile-switcher { gap: var(--gs-space-3); min-width: 0; }
.profile-switcher :deep(button) { flex-basis: var(--gs-control-normal); width: var(--gs-control-normal); height: var(--gs-control-normal); border-radius: var(--gs-radius-control); }
.profile-switcher :deep(label span) { font-size: var(--gs-text-meta); }
.profile-switcher :deep(select) { min-width: 0; height: var(--gs-control-normal); padding: 0 var(--gs-space-8) 0 var(--gs-space-4); border-radius: var(--gs-radius-field); font-size: var(--gs-text-ui); }

.idol-facts dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 var(--gs-space-7); margin: 0; border-top: 1px solid var(--gs-rule); }
.idol-facts dl div { min-width: 0; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.idol-facts dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-facts dd { margin: var(--gs-space-1) 0 0; overflow-wrap: anywhere; white-space: pre-line; font-weight: var(--gs-weight-medium); }

.section-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.section-heading span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.related-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-7); }
.related-grid button { display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-4) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); text-align: left; cursor: pointer; }
.related-grid button > svg { color: var(--gs-ink-3); }
.related-figure { font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.related-figure small { margin-left: 3px; color: var(--gs-ink-3); font-family: var(--gs-font-body); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.related-copy { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.related-copy strong { font-weight: var(--gs-weight-semibold); }
.related-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 var(--gs-space-7); }
.song-links button { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); min-width: 0; padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); text-align: left; cursor: pointer; }
.song-links img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; }
.song-links button > svg { margin: auto; color: var(--gs-ink-3); }
.song-links span { display: grid; min-width: 0; }
.song-links strong { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.idol-intro-body { display: flex; align-items: flex-start; gap: var(--gs-space-3); padding-top: var(--gs-space-3); }
.idol-intro-line { padding-top: var(--gs-space-2); }
.idol-intro-line { margin: 0; color: var(--gs-ink); line-height: 1.8; white-space: pre-line; overflow-wrap: anywhere; }
.idol-intro-line.is-pending { visibility: hidden; }
/* A 44px play icon leading the line, like an episode row: out of the heading rule, no pill. */
.idol-intro-play { display: grid; flex: none; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); margin-top: calc(-1 * var(--gs-space-2)); padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--gs-mint-ink); cursor: pointer; }
@media (hover: hover) { .idol-intro-play:hover { background: var(--gs-current-bg-inset); } }
.honor-group + .honor-group { margin-top: var(--gs-space-7); }
.honor-group h4 { display: flex; align-items: center; gap: var(--gs-space-3); margin: 0 0 var(--gs-space-3); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.honor-group h4 small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }
.honor-info { display: grid; place-items: center; width: var(--gs-control-compact); height: var(--gs-control-compact); margin-left: calc(-1 * var(--gs-space-2)); padding: 0; border: 0; border-radius: var(--gs-radius-pill); background: none; color: var(--gs-ink-3); cursor: pointer; }
.honor-info[aria-expanded="true"] { color: var(--gs-mint-ink); }
.honor-note { max-width: 46em; margin: 0 0 var(--gs-space-4); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.7; }
.honor-row + .honor-row { margin-top: var(--gs-space-5); }
.honor-row h5 { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
/* Plates keep the game's 228x46 / 232x60 proportions on a fixed grid, four to a row. */
.honor-plates { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--gs-space-5) var(--gs-space-6); margin: 0; padding: 0; list-style: none; }
.honor-plates button { display: grid; gap: var(--gs-space-2); width: 100%; min-width: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.honor-plate { display: flex; align-items: center; height: 60px; color: var(--gs-ink-3); }
.honor-plate img { display: block; max-width: 100%; max-height: 60px; object-fit: contain; object-position: left center; transition: transform var(--gs-motion-feedback) var(--gs-motion-ease); }
.honor-caption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--gs-space-2); min-width: 0; padding-left: var(--gs-space-2); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.honor-text { min-width: 0; font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.honor-sep { color: var(--gs-ink-3); }
/* The value the plate does not print (bond level, FES month) is set in the stage face. */
.honor-value { color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* An event's four rank plates always fill one row (two by two on phones), so none is left alone. */
.honor-plates.is-ranked { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-4); }
/* VDCP chocolate plates (five counts) share the event heading on a line of their own. */
.honor-plates.is-chocolate { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gs-space-4); }
.honor-plates + .honor-plates { margin-top: var(--gs-space-4); }
.idol-detail :deep(.relation-row) { border-radius: var(--gs-radius-control); }
.idol-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.idol-detail :deep(.relation-labels strong), .idol-detail :deep(.relation-labels small), .idol-detail :deep(.relation-meta) { font-size: var(--gs-text-meta); }

@media (hover: hover) {
  .related-grid button:hover strong, .song-links button:hover strong, .honor-plates button:hover .honor-text { color: var(--gs-ink-2); }
  .honor-plates button:hover img { transform: translateY(-2px); }
  .honor-info:hover { color: var(--gs-ink); }
  .idol-hero-home:hover { background: var(--gs-paper); }
}
@media (max-width: 900px) { .idol-facts dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* Phones: the hero runs to the screen edges at 220px, the figure to the right. */
@media (max-width: 760px) {
  .idol-detail { gap: var(--gs-space-8); padding: var(--gs-space-5); }
  .idol-hero { height: 220px; margin: calc(-1 * var(--gs-space-5)) calc(-1 * var(--gs-space-5)) 0; width: auto; max-width: none; padding: var(--gs-space-5); border-radius: 0; }
  .idol-hero-figure { left: auto; right: -40px; bottom: -46px; height: 270px; }
  .idol-hero-avatar { right: var(--gs-space-5); --idol-avatar-override-size: 78px; }
  .idol-hero-copy { max-width: 62%; }
  .idol-hero-unit { height: 30px; }
  .idol-hero-name { font-size: var(--gs-text-section); }
  /* Phones: the figure owns the right half, so the autograph signs under the name and reading. */
  .idol-hero-sign { position: static; width: 112px; height: 44px; aspect-ratio: auto; margin-left: calc(var(--gs-space-4) + 3px); translate: none; -webkit-mask-position: left center; mask-position: left center; }
  .idol-hero-home { min-height: var(--gs-control-touch); }
  .profile-switcher :deep(button) { flex-basis: var(--gs-control-touch); width: var(--gs-control-touch); height: var(--gs-control-touch); }
  .profile-switcher :deep(select) { height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .related-grid, .song-links { grid-template-columns: 1fr; gap: 0; }
  .related-grid button { grid-template-columns: 60px minmax(0, 1fr) auto; }
  .honor-plates, .honor-plates.is-ranked, .honor-plates.is-chocolate { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-4); }
  .honor-plate { height: auto; min-height: 36px; }
}
</style>
