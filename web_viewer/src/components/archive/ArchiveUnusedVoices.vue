<template>
  <article class="unused-page" data-archive-scroll-container>
    <header class="unused-intro">
      <p>偶像、卡片与剧情页之外的游戏语音，共 {{ total }} 条，按在游戏里听到的地方分为事务所、登录、LIVE 与摄影，每组标出使用状态。没有文字的按原始编号列出，可以直接试听。</p>
    </header>
    <nav class="unused-places" aria-label="语音分类">
      <button v-for="entry in PLACES" :key="entry.id" type="button" :data-unused-place="entry.id" :aria-pressed="entry.id === place.id" @click="select(entry.shelves[0].id)">{{ entry.label }}</button>
    </nav>
    <nav v-if="place.shelves.length > 1" class="unused-shelves" :aria-label="`${place.label}分组`">
      <button v-for="entry in place.shelves" :key="entry.id" type="button" :data-unused-shelf="entry.id" :aria-pressed="entry.id === shelf.id" @click="select(entry.id)">{{ entry.label }}</button>
    </nav>
    <section class="unused-shelf" :data-unused-shelf-view="shelf.id" :aria-label="`${place.label} · ${shelf.label}`">
      <template v-for="(family, index) in families" :key="family.id">
        <header class="unused-family" :data-unused-family="family.id">
          <h3>{{ family.label }} <span class="unused-status-tag" :data-status="family.status">{{ STATUS[family.status] }}</span></h3>
          <p class="unused-meta">{{ family.count }} {{ family.id === OFFICE.id ? '句' : '条' }} · 编号 {{ family.prefix || family.id }}_…</p>
          <p class="unused-note">{{ family.note }}</p>
        </header>
        <div v-if="family.id === OFFICE.id" class="office-scenes">
          <div class="unused-speaker">
            <ArchiveIdolAvatar :idol-code="OFFICE_VOICES.speaker.code" :size="34" :ring-width="0" :gap="0" decorative :fallback-text="speakerName(OFFICE_VOICES.speaker.code).slice(0, 1)" />
            <strong>{{ speakerName(OFFICE_VOICES.speaker.code) }}</strong>
          </div>
          <section v-for="scene in OFFICE_VOICES.scenes" :key="scene.id" class="office-scene" :data-office-scene="scene.id">
            <h4>{{ scene.label }} <small>{{ scene.lines.length }} 句</small></h4>
            <p class="unused-note">{{ scene.note }}</p>
            <ol class="unused-lines">
              <li v-for="line in scene.lines" :key="line.cue" :data-office-cue="line.cue">
                <button type="button" class="unused-play" :aria-pressed="playing === line.cue" :aria-label="`播放 ${scene.label} ${line.cue}`" @click="play(line.cue)"><component :is="playing === line.cue ? Pause : Play" :size="18" aria-hidden="true" /></button>
                <span class="unused-text gs-flow" :lang="officeLine(line).lang" :class="{ 'is-pending': officeLine(line).pending }">{{ officeLine(line).text }}</span>
                <button type="button" class="voice-preview-btn" :aria-label="`演出预览 ${line.cue}`" title="演出预览" @click="preview(line.cue)"><MonitorPlay :size="18" aria-hidden="true" /></button>
              </li>
            </ol>
          </section>
        </div>
        <ol v-else-if="family.speakers.length === 1" class="unused-lines">
          <template v-for="speaker in family.speakers" :key="speaker.code">
            <li v-for="line in speaker.cues" :key="line.cue" :data-unused-cue="line.cue">
              <button type="button" class="unused-play" :aria-pressed="playing === line.cue" :aria-label="`播放 ${speakerName(speaker.code)} ${line.cue}`" @click="play(line.cue)"><component :is="playing === line.cue ? Pause : Play" :size="18" aria-hidden="true" /></button>
              <span v-if="line.text" class="unused-text gs-flow" :lang="lineText(line).lang" :class="{ 'is-pending': lineText(line).pending }">{{ lineText(line).text }}</span>
              <span v-else class="unused-text is-voice-only">{{ line.cue }} · 无文字</span>
            </li>
          </template>
        </ol>
        <ul v-else-if="!shelf.merge || index === families.length - 1" class="unused-speakers" :class="{ 'is-numbered': !shelf.merge }">
          <li v-for="speaker in speakerRows(shelf.merge ? families : [family])" :key="speaker.code" :data-unused-speaker="speaker.code">
            <div class="unused-speaker">
              <ArchiveIdolAvatar :idol-code="speaker.code" :size="34" :ring-width="0" :gap="0" decorative :fallback-text="speakerName(speaker.code).slice(0, 1)" />
              <strong>{{ speakerName(speaker.code) }}</strong>
            </div>
            <div class="unused-cues">
              <button v-for="line in speaker.cues" :key="line.cue" type="button" class="unused-chip" :data-unused-cue="line.cue" :aria-pressed="playing === line.cue" :aria-label="`播放 ${speakerName(speaker.code)} ${line.label} ${line.cue}`" :title="line.cue" @click="play(line.cue)">
                <component :is="playing === line.cue ? Pause : Play" :size="12" aria-hidden="true" />{{ line.label }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </section>
    <p class="unused-status" role="status">{{ failed ? `${failed} 暂时无法播放。` : '' }}</p>
    <audio ref="audio" preload="none" @ended="settle" @pause="settle" @error="fail" />
  </article>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { MonitorPlay, Pause, Play } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ARCHIVE from '../../data/unusedVoiceArchive.json'
import OFFICE_VOICES from '../../data/officeSystemVoices.json'
import { archiveLineText } from './useArchiveNamedText.js'
import { getVoiceUrl } from '../../utils/AssetResolver.js'
// `shelf` is the address's ?voices=; an empty or unknown id opens the first shelf.
const props = defineProps({ idolName: { type: Function, default: () => '' }, shelf: { type: String, default: '' } })
const emit = defineEmits(['preview-office-voice', 'shelf'])
// The office staff are not archive idols; their names come from the source.
const STAFF = { '101ken': '山村 賢', '102sha': '齋藤 孝司' }
const STATUS = { used: '已使用', unreleased: '未上线', unconfirmed: '用途未确认' }
// Yamamura's login-bonus and work-menu lines: scripted ADV steps (model, faces, lip curves), so each can
// open in the story player like a card touch voice.
const OFFICE = { id: 'office', prefix: '4_1_101', label: '事务所系统语音', status: 'used', count: OFFICE_VOICES.scenes.reduce((sum, scene) => sum + scene.lines.length, 0),
  note: '登录奖励与工作画面里山村贤的提示语音。原始脚本带有模型、表情动作与口型数据，可以用「演出预览」在剧情播放器里观看。' }
const FAMILY = Object.fromEntries([OFFICE, ...ARCHIVE.families].map(family => [family.id, family]))
// Shelved by where a voice is heard; whether it is used is a tag on the family, not a place. A `merge` shelf lists
// each idol once, with one button per family.
const PLACES = [
  { id: 'office', label: '事务所', shelves: [{ id: 'yamamura', label: '山村', families: ['office', '3_5'] }, { id: 'saito', label: '齋藤', families: ['3_1_102'] }] },
  { id: 'login', label: '登录', shelves: [{ id: 'login', label: '呼号', families: ['9_1', '9_9'], merge: true }] },
  { id: 'live', label: 'LIVE', shelves: [{ id: 'live-appeal', label: '应援', families: ['2_5'] }, { id: 'live-result', label: '结算', families: ['3_2'] }, { id: 'live-cheers', label: '欢呼', families: ['3_3'] }] },
  { id: 'photo', label: '摄影', shelves: [{ id: 'photo-pose', label: '姿势', families: ['3_4'] }] },
].map(place => ({ ...place, shelves: place.shelves.map(shelf => ({ ...shelf, place: place.id })) }))
const SHELVES = PLACES.flatMap(place => place.shelves)
const total = Object.values(FAMILY).reduce((sum, family) => sum + family.count, 0)
const playing = ref(''), failed = ref(''), audio = ref(null)
const shelf = computed(() => SHELVES.find(entry => entry.id === props.shelf) || SHELVES[0])
const place = computed(() => PLACES.find(entry => entry.id === shelf.value.place))
const families = computed(() => shelf.value.families.map(id => FAMILY[id]))
// One entry per idol; on a merged shelf a button is named by its family, otherwise by the cue's number.
function speakerRows(list) {
  const rows = new Map()
  for (const family of list) for (const speaker of family.speakers) {
    if (!rows.has(speaker.code)) rows.set(speaker.code, { code: speaker.code, cues: [] })
    for (const line of speaker.cues) rows.get(speaker.code).cues.push({ cue: line.cue, label: list.length > 1 ? family.label : line.cue.split('_').at(-1) })
  }
  return [...rows.values()]
}
const officeLine = line => archiveLineText('card-lines', [['office-voice', 'text']], line.text)
function preview(cue) { stop(); emit('preview-office-voice', cue) }
const speakerName = code => props.idolName?.(code, STAFF[code]) || STAFF[code] || code
const lineText = line => archiveLineText('card-lines', [['unused-voice', 'text']], line.text)
function stop() { const el = audio.value; if (el && !el.paused) el.pause(); playing.value = '' }
function select(id) { if (id === shelf.value.id) return; stop(); failed.value = ''; emit('shelf', id === SHELVES[0].id ? '' : id) }
async function play(cue) {
  const el = audio.value
  if (!el) return
  if (playing.value === cue) { stop(); return }
  stop(); failed.value = ''
  el.src = getVoiceUrl(`${cue}.m4a`)
  playing.value = cue
  try { await el.play() } catch (error) { if (error.name !== 'AbortError') fail() }
}
// A pause queued by switching clips arrives after the next clip started; only a stopped element clears.
function settle() { if (audio.value?.paused) playing.value = '' }
function fail() { if (playing.value) failed.value = playing.value; playing.value = '' }
onBeforeUnmount(() => { const el = audio.value; if (el) { el.pause(); el.removeAttribute('src'); el.load() } })
</script>
<style scoped>
.unused-page { display: grid; align-content: start; gap: var(--gs-space-5); height: 100%; padding: var(--gs-space-8); overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink-2); }
.unused-intro p, .unused-note { margin: 0; max-width: 72ch; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.7; }
/* Places: one row of underlined tabs that stays in view, equal cells on a phone. Shelves: one row of short pills. */
/* Sticky offsets count from the page's padding edge; pull the bar up so it meets the header with no gap. */
.unused-places { position: sticky; top: calc(-1 * var(--gs-space-8)); z-index: 2; display: flex; gap: var(--gs-space-1); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); }
.unused-places button { min-width: 88px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-body); cursor: pointer; white-space: nowrap; }
.unused-places button[aria-pressed='true'] { border-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
/* A scroll container's automatic minimum height is 0, so the page grid would collapse the row without one. */
.unused-shelves { display: flex; gap: var(--gs-space-3); min-height: var(--gs-control-compact); overflow-x: auto; scrollbar-width: none; }
.unused-shelves::-webkit-scrollbar { display: none; }
/* Shelves are the second tier under the place tabs: plain text, the current one ink and bold (no pills on the rule). */
.unused-shelves button { flex: none; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-1); border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; white-space: nowrap; }
.unused-shelves button[aria-pressed='true'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.unused-shelf { display: grid; gap: var(--gs-space-4); padding: var(--gs-space-6); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); background: var(--gs-surface); }
.unused-family { display: grid; gap: var(--gs-space-2); }
.unused-family:not(:first-child) { margin-top: var(--gs-space-3); padding-top: var(--gs-space-5); border-top: 1px solid var(--gs-line); }
.unused-family h3 { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); margin: 0; font-size: var(--gs-text-subtitle); color: var(--gs-ink); }
.unused-meta { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.unused-status-tag { padding: 1px var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.unused-status-tag[data-status='used'] { border-color: transparent; background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.office-scenes { display: grid; gap: var(--gs-space-3); }
.office-scene { display: grid; gap: 6px; padding-top: var(--gs-space-3); }
.office-scene h4 { margin: 0; color: var(--gs-ink); font-size: var(--gs-text-ui); }
.office-scene h4 small { margin-left: 4px; color: var(--gs-ink-3); font-weight: 400; }
/* Play and stage preview are 44px icons on the line row, not boxes on its rule. */
.voice-preview-btn { flex: none; display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); margin: -6px 0; padding: 0; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); cursor: pointer; }
.voice-preview-btn:hover { background: var(--gs-current-bg-inset); color: var(--gs-ink); }
.unused-speakers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.unused-speakers > li { display: grid; align-content: start; gap: 8px; padding: 10px; border-radius: var(--gs-radius-control); background: var(--gs-paper); }
.unused-speaker { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--gs-text-ui); }
.unused-speaker strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unused-cues { display: flex; flex-wrap: wrap; gap: 6px; }
.unused-chip { display: inline-flex; align-items: center; gap: 4px; min-width: 44px; min-height: 30px; padding: 0 8px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; cursor: pointer; }
.unused-chip:hover, .unused-play:hover { border-color: var(--gs-mint-ink); color: var(--gs-mint-ink); }
.unused-chip[aria-pressed='true'], .unused-play[aria-pressed='true'] { border-color: var(--gs-mint-ink); background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.unused-lines { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.unused-lines li { display: flex; align-items: flex-start; gap: 10px; padding: 6px 4px; border-top: 1px solid var(--gs-line); }
.unused-play { flex: none; display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); margin: -6px 0; border: 0; border-radius: 50%; background: transparent; color: var(--gs-mint-ink); cursor: pointer; }
.unused-text { flex: 1; min-width: 0; padding-top: 4px; font-size: var(--gs-text-ui); line-height: 1.65; white-space: pre-line; }
.unused-text.is-pending { visibility: hidden; }
.unused-text.is-voice-only { color: var(--gs-ink-3); font-variant-numeric: tabular-nums; }
.unused-status { min-height: 1em; margin: 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
@media (max-width: 760px) {
  .unused-page { gap: var(--gs-space-4); padding: var(--gs-space-5) var(--gs-space-4); }
  .unused-places { top: calc(-1 * var(--gs-space-5)); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .unused-places button { min-width: 0; padding: 0; }
  .unused-shelf { padding: var(--gs-space-4); }
  /* One idol per row: the numbered buttons of a family fit on one or two lines instead of a tall column. */
  .unused-speakers { grid-template-columns: 1fr; gap: 6px; }
  .unused-speakers > li { gap: 6px; padding: 8px 10px; }
  .unused-cues { gap: 4px; }
  /* Numbered calls (at most 7 per idol) share one row of equal columns, so every idol's 01–07 line up. */
  .is-numbered .unused-cues { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .is-numbered .unused-chip { justify-content: center; gap: 2px; min-width: 0; padding: 0; }
}
</style>
