<template>
  <article class="unused-page" data-archive-scroll-container>
    <header class="unused-intro">
      <p>游戏资源里有、但本站其他页面没有用到的语音，共 {{ total }} 条。除齋藤的 15 句以外，原始脚本里都没有文字，这里按原始编号列出，可以直接试听。</p>
    </header>
    <nav class="unused-families" aria-label="语音分组">
      <button v-for="entry in ARCHIVE.families" :key="entry.id" type="button" :aria-pressed="entry.id === family.id" @click="select(entry.id)">
        {{ entry.label }} <small>{{ entry.count }}</small>
      </button>
    </nav>
    <section class="unused-family" :data-unused-family="family.id" aria-labelledby="unused-family-heading">
      <h3 id="unused-family-heading">{{ family.label }} <small>{{ family.count }} 条 · 编号 {{ family.id }}_…</small></h3>
      <p class="unused-note">{{ family.note }}</p>
      <ul class="unused-speakers" :class="{ 'has-lines': hasText }">
        <li v-for="speaker in family.speakers" :key="speaker.code" :data-unused-speaker="speaker.code">
          <div class="unused-speaker">
            <ArchiveIdolAvatar :idol-code="speaker.code" :size="34" :ring-width="0" :gap="0" decorative :fallback-text="speakerName(speaker.code).slice(0, 1)" />
            <strong>{{ speakerName(speaker.code) }}</strong>
          </div>
          <ol v-if="hasText" class="unused-lines">
            <li v-for="line in speaker.cues" :key="line.cue" :data-unused-cue="line.cue">
              <button type="button" class="unused-play" :aria-pressed="playing === line.cue" :aria-label="`播放 ${speakerName(speaker.code)} ${line.cue}`" @click="play(line.cue)"><component :is="playing === line.cue ? Pause : Play" :size="14" aria-hidden="true" /></button>
              <span v-if="line.text" class="unused-text gs-flow" :lang="lineText(line).lang" :class="{ 'is-pending': lineText(line).pending }">{{ lineText(line).text }}</span>
              <span v-else class="unused-text is-voice-only">{{ line.cue }} · 无文字</span>
            </li>
          </ol>
          <div v-else class="unused-cues">
            <button v-for="line in speaker.cues" :key="line.cue" type="button" class="unused-chip" :data-unused-cue="line.cue" :aria-pressed="playing === line.cue" :aria-label="`播放 ${speakerName(speaker.code)} ${line.cue}`" :title="line.cue" @click="play(line.cue)">
              <component :is="playing === line.cue ? Pause : Play" :size="12" aria-hidden="true" />{{ line.cue.split('_').at(-1) }}
            </button>
          </div>
        </li>
      </ul>
    </section>
    <p class="unused-status" role="status">{{ failed ? `${failed} 暂时无法播放。` : '' }}</p>
    <audio ref="audio" preload="none" @ended="settle" @pause="settle" @error="fail" />
  </article>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Pause, Play } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ARCHIVE from '../../data/unusedVoiceArchive.json'
import { archiveLineText, loadArchiveNames } from './useArchiveNamedText.js'
import { getVoiceUrl } from '../../utils/AssetResolver.js'
const props = defineProps({ idolName: { type: Function, default: () => '' } })
// The office staff are not archive idols; their names come from the source.
const STAFF = { '101ken': '山村 賢', '102sha': '齋藤 孝司' }
const total = ARCHIVE.families.reduce((sum, family) => sum + family.count, 0)
const familyId = ref(ARCHIVE.families[0].id), playing = ref(''), failed = ref(''), audio = ref(null)
const family = computed(() => ARCHIVE.families.find(entry => entry.id === familyId.value))
const hasText = computed(() => family.value.speakers.some(speaker => speaker.cues.some(line => line.text)))
const speakerName = code => props.idolName?.(code, STAFF[code]) || STAFF[code] || code
const lineText = line => archiveLineText('card-lines', [['unused-voice', 'text']], line.text)
void loadArchiveNames('card-lines').catch(error => console.warn('Card line translations unavailable', error))
function stop() { const el = audio.value; if (el && !el.paused) el.pause(); playing.value = '' }
function select(id) { stop(); failed.value = ''; familyId.value = id }
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
.unused-page { display: grid; align-content: start; gap: 18px; height: 100%; padding: var(--gs-space-8); overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink-2); }
.unused-intro p, .unused-note { margin: 0; max-width: 72ch; color: var(--gs-ink-3); font-size: 13px; line-height: 1.7; }
.unused-families { display: flex; flex-wrap: wrap; gap: 8px; }
.unused-families button { min-height: 36px; padding: 0 12px; border: 1px solid var(--gs-line); border-radius: 999px; background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: 13px; cursor: pointer; }
.unused-families button small { margin-left: 4px; color: var(--gs-ink-3); }
.unused-families button[aria-pressed='true'] { border-color: var(--gs-mint-ink); background: var(--gs-mint-wash); color: var(--gs-mint-ink); font-weight: 700; }
.unused-family { display: grid; gap: 10px; padding: 18px; border: 1px solid var(--gs-line); border-radius: 12px; background: var(--gs-surface); }
.unused-family h3 { margin: 0; font-size: 17px; color: var(--gs-ink); }
.unused-family h3 small { margin-left: 6px; font-size: 12px; font-weight: 400; color: var(--gs-ink-3); }
.unused-speakers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin: 6px 0 0; padding: 0; list-style: none; }
.unused-speakers.has-lines { grid-template-columns: 1fr; }
.unused-speakers > li { display: grid; gap: 8px; padding: 10px; border-radius: 10px; background: var(--gs-paper); }
.unused-speaker { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; }
.unused-speaker strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unused-cues { display: flex; flex-wrap: wrap; gap: 6px; }
.unused-chip { display: inline-flex; align-items: center; gap: 4px; min-width: 44px; min-height: 30px; padding: 0 8px; border: 1px solid var(--gs-line); border-radius: 6px; background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: 12px; font-variant-numeric: tabular-nums; cursor: pointer; }
.unused-chip:hover, .unused-play:hover { border-color: var(--gs-mint-ink); color: var(--gs-mint-ink); }
.unused-chip[aria-pressed='true'], .unused-play[aria-pressed='true'] { border-color: var(--gs-mint-ink); background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
.unused-lines { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.unused-lines li { display: flex; align-items: flex-start; gap: 10px; padding: 6px 4px; border-top: 1px solid var(--gs-line); }
.unused-play { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--gs-line); border-radius: 50%; background: var(--gs-surface); color: var(--gs-mint-ink); cursor: pointer; }
.unused-text { flex: 1; min-width: 0; padding-top: 5px; font-size: 13px; line-height: 1.65; white-space: pre-line; }
.unused-text.is-pending { visibility: hidden; }
.unused-text.is-voice-only { color: var(--gs-ink-3); font-variant-numeric: tabular-nums; }
.unused-status { min-height: 1em; margin: 0; color: #a04747; font-size: 13px; }
@media (max-width: 760px) { .unused-page { padding: var(--gs-space-5) var(--gs-space-4); } .unused-family { padding: 12px; } .unused-speakers { grid-template-columns: 1fr; } }
</style>
