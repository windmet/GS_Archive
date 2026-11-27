<template>
  <section v-if="kind === 'studio'" class="landing landing-studio" data-archive-scroll-container>
    <div class="studio-lobby">
      <div class="studio-hero-band">
        <div class="studio-showcase">
          <img
            class="studio-art"
            :src="studioImage"
            alt="摄影工作台：两位偶像和贴纸摆在街景前"
            width="960"
            height="540"
            decoding="async"
          />
        </div>

        <div class="studio-console">
          <p class="studio-lede">把背景、偶像与贴纸当作图层自由编排，换好服装、表情与动作即可导出 1280×720 成片。</p>

          <div v-if="localDraft" class="studio-draft-strip">
            <div class="studio-draft-head">
              <span class="studio-draft-badge">{{ localDraft.source === 'autosave' ? '自动暂存' : '本地存档' }}</span>
              <small v-if="localDraft.timeLabel">{{ localDraft.timeLabel }}</small>
              <button
                v-if="localDraft.source === 'autosave'"
                type="button"
                class="studio-draft-clear"
                title="清除自动暂存"
                @click="clearAutosaveDraft"
              >清除</button>
            </div>
            <div class="studio-draft-row">
              <div v-if="localDraft.idols.length" class="studio-avatar-stack">
                <ArchiveIdolAvatar
                  v-for="(idol, index) in localDraft.idols.slice(0, 5)"
                  :key="`${idol.id}-${index}`"
                  :idol-code="idol.id"
                  :accent-color="idol.color"
                  :size="28"
                  :ring-width="2"
                  :gap="1"
                  decorative
                />
              </div>
              <span v-else class="studio-draft-icon" aria-hidden="true"><History :size="18" /></span>
              <span class="studio-draft-summary">{{ localDraft.summary }}</span>
              <button
                type="button"
                class="studio-draft-resume"
                :disabled="starting"
                @click="emitPhoto({ restore: true, restoreSource: localDraft.source })"
              >继续编辑<ChevronRight :size="16" aria-hidden="true" /></button>
            </div>
          </div>

          <ul class="start-list">
            <li>
              <button
                type="button"
                class="start-row"
                :class="{ 'is-primary': !localDraft }"
                :disabled="starting"
                @click="startWithIdol"
              >
                <ArchiveIdolAvatar v-if="preferredIdol" class="start-avatar" :idol-code="preferredIdol.id" :accent-color="preferredIdol.color" :size="32" :ring-width="2" :gap="1" decorative />
                <span v-else class="start-glyph" aria-hidden="true"><UserRound :size="18" /></span>
                <span class="start-copy">
                  <strong>{{ preferredIdol ? `带上${preferredName}开始拍摄` : '从一位偶像开始' }}</strong>
                  <small>{{ preferredIdol ? '直接带着担当进画布换装与调表情' : '进去后在「人物」里选一位偶像' }}</small>
                </span>
                <ChevronRight :size="18" aria-hidden="true" />
              </button>
            </li>
            <li v-if="unitMembers.length >= 2">
              <button type="button" class="start-row" :disabled="starting" @click="startWithUnit">
                <span class="studio-avatar-stack is-mini" aria-hidden="true">
                  <ArchiveIdolAvatar
                    v-for="member in unitMembers.slice(0, 3)"
                    :key="member.id"
                    :idol-code="member.id"
                    :accent-color="member.color"
                    :size="24"
                    :ring-width="1"
                    :gap="1"
                    decorative
                  />
                </span>
                <span class="start-copy">
                  <strong>{{ preferredIdol.unitName }} 全员开拍</strong>
                  <small>一键上场 {{ unitMembers.length }} 位成员并自动排开站位</small>
                </span>
                <ChevronRight :size="18" aria-hidden="true" />
              </button>
            </li>
            <li>
              <button type="button" class="start-row" :disabled="starting" @click="emitPhoto({ background: true })">
                <span class="start-glyph" aria-hidden="true"><Images :size="18" /></span>
                <span class="start-copy">
                  <strong>从空白背景开始</strong>
                  <small>先选拍摄地点与时段，再逐位加入人物和贴纸</small>
                </span>
                <ChevronRight :size="18" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <p class="size-note">首次打开约 <b>2.5 MB</b> · 每加一位偶像约 2 MB</p>
        </div>
      </div>

      <div class="studio-shelf-band">
        <section class="studio-shelf-section" aria-labelledby="studio-ref-heading">
          <header class="studio-shelf-header">
            <h2 id="studio-ref-heading">玩家实拍参考构图</h2>
            <span>直接载入还原图层，可继续换装与微调</span>
          </header>
          <div class="studio-ref-grid">
            <button
              v-for="preset in referencePresets"
              :key="preset.id"
              type="button"
              class="studio-ref-card"
              :disabled="starting"
              @click="emitPhoto({ reference: preset.id })"
            >
              <img class="studio-ref-thumb" :src="preset.image" :alt="preset.title" width="480" height="270" loading="lazy" decoding="async" />
              <div class="studio-ref-body">
                <strong>{{ preset.title }}</strong>
                <p>{{ preset.description }}</p>
                <div class="studio-ref-foot">
                  <span class="studio-avatar-stack is-mini" aria-hidden="true">
                    <ArchiveIdolAvatar
                      v-for="member in preset.cast"
                      :key="member.code"
                      :idol-code="member.code"
                      :accent-color="member.color"
                      :size="22"
                      :ring-width="1"
                      :gap="1"
                      decorative
                    />
                  </span>
                  <small>{{ preset.stats }}</small>
                  <span class="studio-ref-action">载入参考<ChevronRight :size="15" aria-hidden="true" /></span>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section class="studio-shelf-section" aria-labelledby="studio-spot-heading">
          <header class="studio-shelf-header">
            <h2 id="studio-spot-heading">精选取景地 · 点选即开拍</h2>
            <span>直接带着选定场地进入画布</span>
          </header>
          <div class="studio-spot-shelf">
            <button
              v-for="spot in featuredSpots"
              :key="spot.spotId"
              type="button"
              class="studio-spot-card"
              :disabled="starting"
              @click="emitPhoto({ spotId: spot.spotId, background: true })"
            >
              <img :src="spot.thumb" :alt="spot.name" loading="lazy" decoding="async" />
              <span class="studio-spot-copy">
                <strong>{{ spot.name }}</strong>
                <small>{{ spot.note }}</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </section>

  <section v-else class="landing landing-live" data-archive-scroll-container>
    <div class="tool-pair">
      <button v-for="tool in TOOLS" :key="tool.id" type="button" class="tool" @click="emit(tool.id)">
        <img :src="tool.image" :alt="tool.imageAlt" width="192" height="108" decoding="async" />
        <span class="tool-copy">
          <strong>{{ tool.heading }}<ArrowUpRight :size="16" aria-hidden="true" /></strong>
          <span>{{ tool.summary }}</span>
          <small>首次约 {{ tool.size }}<span class="tool-size-note"> · {{ tool.sizeNote }}</span></small>
        </span>
      </button>
    </div>

    <ArchiveLiveChartTable :songs="songs" @chart-song="(code, difficulty) => emit('chart-song', code, difficulty)" @stage-song="emit('stage-song', $event)" />
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { ArrowUpRight, ChevronRight, History, Images, UserRound } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'
import studioRefA from '../../assets/tools/studio-ref-a.webp'
import studioRefB from '../../assets/tools/studio-ref-b.webp'

// LIVE: the two tools side by side, then the chart table. Studio: flat booklet paper layout — clean 16:9 picture +
// hairline starter list above, rule-separated rendered reference compositions and curated spots below.
const props = defineProps({
  kind: { type: String, default: 'live' },
  songs: { type: Array, default: () => [] },
  preferredIdol: { type: Object, default: null },
  preferredName: { type: String, default: '' },
  idols: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['charts', 'stage', 'photo', 'chart-song', 'stage-song'])
const TOOLS = [
  { id: 'charts', heading: '谱面预览', image: chartImage, imageAlt: '谱面预览：DRIVE A LIVE EXPERT 的透视轨道',
    summary: '像在游戏里一样看音符落下，或展开成整首的长轨图。', size: '3 MB', sizeNote: '之后每首不到 0.1 MB' },
  { id: 'stage', heading: '2D舞台', image: stageImage, imageAlt: '2D舞台：三位偶像的小人在舞台上跳舞',
    summary: '把偶像编进想看的曲目，看小人们按游戏里的编舞唱跳。', size: '12 MB', sizeNote: '含一首歌的音频，建议流量充足时打开' },
]
const MANUAL_SAVE_KEY = 'sidem-studio-document-v1'
const AUTOSAVE_KEY = 'sidem-studio-autosave-v1'

const ArchiveLiveChartTable = defineAsyncComponent(() => import('./ArchiveLiveChartTable.vue'))

const starting = ref(false)

function emitPhoto(payload = {}) {
  if (starting.value) return
  starting.value = true
  emit('photo', payload)
}

function startWithIdol() {
  if (!props.preferredIdol) return emitPhoto({})
  emitPhoto({ idolCode: props.preferredIdol.id })
}

const unitMembers = computed(() => {
  if (!props.preferredIdol?.unitId || !props.idols.length) return []
  return props.idols.filter(idol => String(idol.unitId) === String(props.preferredIdol.unitId)).slice(0, 6)
})

function startWithUnit() {
  if (!unitMembers.value.length) return startWithIdol()
  emitPhoto({ idolCodes: unitMembers.value.map(idol => idol.id) })
}

const referencePresets = [
  {
    id: 'A',
    image: studioRefA,
    title: 'THE 虎牙道 · Live House 斗嘴名场面',
    description: '大河武与牙崎涟在 Live House 舞台针锋相对，一旁的 SideMini 圆城寺道流满头问号围观。',
    stats: '2 人物 · 5 贴纸',
    cast: [
      { code: '038tak', color: '' },
      { code: '040ren', color: '' },
    ],
  },
  {
    id: 'B',
    image: studioRefB,
    title: 'DRAMATIC STARS · 后台蛋糕小互动',
    description: '柏木翼招手端出草莓蛋糕，天道辉与樱庭薫在后台休息室里的热闹日常。',
    stats: '3 人物 · 5 贴纸',
    cast: [
      { code: '004ter', color: '' },
      { code: '005kao', color: '' },
      { code: '006tsu', color: '' },
    ],
  },
]

const featuredSpots = [
  { spotId: 1, name: '摄影棚', note: '经典纯景定妆', thumb: '/assets/bg/thumbs/bg058_photostudio_in_01_s.png' },
  { spotId: 7, name: '音乐厅', note: '穹顶演出舞台', thumb: '/assets/bg/thumbs/bg021_concerthall_in_01_s.png' },
  { spotId: 16, name: '练习室', note: '日常排练场景', thumb: '/assets/bg/thumbs/bg032_lessonstudio_in_01_s.png' },
  { spotId: 18, name: '河堤', note: '多时段外景', thumb: '/assets/bg/thumbs/bg045_riverbed_out_01_s.png' },
]

const idolByNumericId = computed(() => {
  const map = new Map()
  for (const idol of props.idols) {
    const numeric = Number(String(idol.id || '').slice(0, 3))
    if (Number.isInteger(numeric) && numeric > 0) map.set(numeric, idol)
  }
  return map
})

const localDraft = ref(null)
function formatSavedTime(timestamp) {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function parseDraftRecord(source, raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const doc = source === 'autosave' ? parsed?.document : parsed
    if (!doc || !Array.isArray(doc.actors) || !Array.isArray(doc.stickers)) return null
    const uniqueIds = [...new Set(doc.actors.map(row => Number(row.idolId)).filter(id => Number.isInteger(id) && id > 0))]
    const idols = uniqueIds.map(id => idolByNumericId.value.get(id)).filter(Boolean)
    const time = source === 'autosave' && typeof parsed?.savedAt === 'number' ? formatSavedTime(parsed.savedAt) : ''
    const parts = [`${doc.actors.length} 位人物`, `${doc.stickers.length} 张贴纸`]
    if (doc.frameId) parts.push('含相框')
    return {
      source,
      idols,
      timeLabel: time ? `更新于 ${time}` : '',
      summary: parts.join(' · '),
    }
  } catch {
    return null
  }
}

function readLocalDraft() {
  try {
    localDraft.value =
      parseDraftRecord('autosave', localStorage.getItem(AUTOSAVE_KEY)) ||
      parseDraftRecord('saved', localStorage.getItem(MANUAL_SAVE_KEY))
  } catch {
    localDraft.value = null
  }
}

function clearAutosaveDraft() {
  try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* private window */ }
  readLocalDraft()
}

onMounted(() => {
  readLocalDraft()
})
</script>

<style scoped>
.landing { height: 100%; box-sizing: border-box; overflow: auto; padding: var(--gs-space-6) var(--gs-gutter) var(--gs-space-7); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
.landing button { font: inherit; }
.landing :focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }

/* LIVE: two tools on the paper, no cards. */
.tool-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-7); max-width: var(--gs-content-width); margin: 0 auto; }
.tool { display: flex; align-items: center; gap: var(--gs-space-5); padding: var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.tool img { flex: none; width: 192px; height: 108px; object-fit: cover; border-radius: var(--gs-radius-control); background: var(--gs-line); }
.tool-copy { display: grid; gap: var(--gs-space-2); min-width: 0; }
.tool-copy strong { display: flex; align-items: center; gap: var(--gs-space-2); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.tool-copy strong svg { color: var(--gs-ink-3); }
.tool-copy > span { color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.5; }
.tool-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (hover: hover) { .tool:hover { background: var(--gs-hover); } }

/* Studio lobby: flat program-booklet layout directly on paper (content first, hairlines instead of boxes). */
.studio-lobby { display: grid; gap: var(--gs-space-7); width: 100%; max-width: 1440px; margin: 0 auto; }
.studio-hero-band { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr); align-items: start; gap: var(--gs-space-7); }

.studio-showcase { min-width: 0; }
.studio-art { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-media); background: var(--gs-line); }

.studio-console { display: grid; gap: var(--gs-space-4); min-width: 0; }
.studio-lede { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.6; }

.studio-draft-strip { display: grid; gap: var(--gs-space-2); padding: var(--gs-space-2) 0 var(--gs-space-2) var(--gs-space-4); border-left: 2px solid var(--gs-selected-line); }
.studio-draft-head { display: flex; align-items: center; gap: var(--gs-space-3); }
.studio-draft-badge { color: var(--gs-selected-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.studio-draft-head small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.studio-draft-clear { margin-left: auto; padding: 0 var(--gs-space-2); border: 0; background: transparent; color: var(--gs-ink-3); font-size: var(--gs-text-meta); cursor: pointer; }
@media (hover: hover) { .studio-draft-clear:hover { color: var(--gs-ink); } }
.studio-draft-row { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.studio-draft-summary { flex: 1; min-width: 0; color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); }
.studio-draft-icon { display: grid; place-items: center; width: 28px; height: 28px; color: var(--gs-selected-ink); }
.studio-draft-resume { display: inline-flex; align-items: center; gap: var(--gs-space-1); flex: none; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
@media (hover: hover) { .studio-draft-resume:hover:not(:disabled) { filter: brightness(.96); } }

.start-list { margin: 0; padding: 0; border-top: 1px solid var(--gs-line); list-style: none; }
.start-list li { border-bottom: 1px solid var(--gs-line); }
.start-row { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; min-height: 60px; padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid transparent; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); text-align: left; cursor: pointer; transition: background-color var(--gs-motion-feedback) var(--gs-ease-out); }
.start-row.is-primary { border-color: var(--gs-btn-primary-border); background: var(--gs-btn-primary-bg); color: var(--gs-btn-primary-ink); box-shadow: var(--gs-btn-primary-shadow); }
.start-row.is-primary .start-copy small { color: var(--gs-ink-2); }
.start-row.is-primary > svg { color: var(--gs-mint-ink); }
.start-row:disabled { opacity: .6; cursor: default; }
.start-row > svg { flex: none; color: var(--gs-ink-3); }
.start-avatar, .start-glyph { flex: none; width: 32px; height: 32px; }
.start-glyph { display: grid; place-items: center; color: var(--gs-ink-2); }
.start-copy { display: grid; flex: 1; gap: 2px; min-width: 0; }
.start-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.start-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
@media (hover: hover) { .start-row:not(:disabled, .is-primary):hover { background: var(--gs-hover); } .start-row.is-primary:not(:disabled):hover { background: var(--gs-btn-primary-hover-bg); } }

.studio-avatar-stack { display: inline-flex; align-items: center; flex: none; }
.studio-avatar-stack > :deep(*) + :deep(*) { margin-left: -8px; }
.studio-avatar-stack.is-mini > :deep(*) + :deep(*) { margin-left: -6px; }

.size-note { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.size-note b { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }

/* Lower shelf band: flat hairline sections directly on paper */
.studio-shelf-band { display: grid; gap: var(--gs-space-7); padding-top: var(--gs-space-6); border-top: 1px solid var(--gs-rule); }
.studio-shelf-section { display: grid; gap: var(--gs-space-4); min-width: 0; }
.studio-shelf-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-4); }
.studio-shelf-header h2 { margin: 0; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.studio-shelf-header span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }

.studio-ref-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-6); }
.studio-ref-card { display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); align-items: center; gap: var(--gs-space-4); min-width: 0; padding: var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); text-align: left; cursor: pointer; transition: background-color var(--gs-motion-feedback) var(--gs-ease-out); }
.studio-ref-thumb { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-media); background: var(--gs-line); }
.studio-ref-body { display: grid; gap: var(--gs-space-2); min-width: 0; }
.studio-ref-body strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.studio-ref-body p { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.5; }
.studio-ref-foot { display: flex; align-items: center; gap: var(--gs-space-2); padding-top: var(--gs-space-1); }
.studio-ref-foot small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.studio-ref-action { display: inline-flex; align-items: center; gap: var(--gs-space-1); margin-left: auto; color: var(--gs-mint-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
@media (hover: hover) { .studio-ref-card:not(:disabled):hover { background: var(--gs-hover); } }

.studio-spot-shelf { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-4); }
.studio-spot-card { display: grid; gap: var(--gs-space-2); min-width: 0; padding: var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); text-align: left; cursor: pointer; transition: background-color var(--gs-motion-feedback) var(--gs-ease-out); }
.studio-spot-card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-media); background: var(--gs-line); }
.studio-spot-copy { display: grid; gap: 2px; min-width: 0; }
.studio-spot-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.studio-spot-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (hover: hover) { .studio-spot-card:not(:disabled):hover { background: var(--gs-hover); } }

@media (max-width: 1100px) {
  .studio-hero-band { grid-template-columns: 1fr; gap: var(--gs-space-5); }
  .studio-ref-card { grid-template-columns: minmax(0, 200px) minmax(0, 1fr); }
  .studio-spot-shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .landing { padding: var(--gs-space-4) var(--gs-space-4) var(--gs-space-7); }
  /* The two tools side by side: a 16:9 picture over the name ↗ and one line of size (线框减法册 L4). */
  .tool-pair { gap: var(--gs-space-4); }
  .tool { flex-direction: column; align-items: stretch; gap: var(--gs-space-2); padding: 0; }
  .tool img { width: 100%; height: auto; aspect-ratio: 16 / 9; }
  .tool-copy { gap: 2px; }
  .tool-copy strong { font-size: var(--gs-text-ui); }
  .tool-copy > span { display: none; }
  .tool-size-note { display: none; }

  /* Mobile studio lobby: clean paper hierarchy + horizontal scroll-snap rails below. */
  .studio-lobby { gap: var(--gs-space-5); }
  .studio-hero-band { gap: var(--gs-space-4); }
  .studio-lede { font-size: var(--gs-text-ui); }
  .studio-shelf-band { gap: var(--gs-space-5); padding-top: var(--gs-space-5); }

  .studio-ref-grid { display: flex; gap: var(--gs-space-3); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: var(--gs-space-1); }
  .studio-ref-grid::-webkit-scrollbar { display: none; }
  .studio-ref-card { flex: 0 0 84%; grid-template-columns: 1fr; padding: 0; scroll-snap-align: start; }

  .studio-spot-shelf { display: flex; gap: var(--gs-space-3); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: var(--gs-space-1); }
  .studio-spot-shelf::-webkit-scrollbar { display: none; }
  .studio-spot-card { flex: 0 0 46%; padding: 0; scroll-snap-align: start; }
}
</style>
