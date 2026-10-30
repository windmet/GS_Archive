<template>
  <section class="song-block song-version-panel" aria-labelledby="song-version-title" :data-vocal-setting="audition.mode">
    <div class="song-block-heading">
      <h3 id="song-version-title">演唱版本</h3>
      <small>分轨试听与原游戏混音可能不同</small>
    </div>
    <!-- Every mode is a tab and the tab row never goes away; the mode's own choice sits under it. -->
    <div class="version-tabs" role="radiogroup" aria-labelledby="song-version-title" data-vocal-setting-selector>
      <button v-for="item in audition.modes" :key="item.id" type="button" role="radio" :aria-checked="audition.mode === item.id" @click="audition.chooseMode(item.id)">{{ item.label }}</button>
    </div>

    <div v-if="audition.mode === 'unit'" class="version-pills" role="radiogroup" aria-label="组合">
      <button v-for="option in audition.unitOptions" :key="option.key" type="button" role="radio" :aria-checked="currentUnitKey === option.key" @click="audition.unitKey = option.key">{{ option.label }}</button>
    </div>
    <div v-else-if="audition.mode === 'single'" class="version-pills" role="radiogroup" aria-label="收录音轨">
      <button v-for="option in audition.trackOptions" :key="option.key" type="button" role="radio" :aria-checked="currentTrackKey === option.key" @click="audition.trackKey = option.key">{{ option.label }}</button>
    </div>
    <button v-else-if="audition.mode === 'solo'" type="button" class="version-value" @click="openPicker(null)">
      <span>Solo 声部</span><strong>{{ soloDisplayName(audition.currentSoloTrack) || '选择偶像' }}</strong><ChevronRight :size="18" aria-hidden="true" />
    </button>
    <div v-else-if="audition.mode === 'lineup'" class="version-lineup">
      <div v-if="audition.arrangements.length > 1" class="version-pills" role="radiogroup" aria-label="演唱切换表">
        <button v-for="entry in audition.arrangements" :key="entry.id" type="button" role="radio" :aria-checked="audition.arrangementId === entry.id" @click="audition.selectArrangement(entry.id)">{{ entry.title }}</button>
      </div>
      <fieldset class="performer-lineup">
        <legend>
          <span>五个位置 · 已选 {{ audition.filledCount }}/5</span>
          <details class="lineup-rule">
            <summary aria-label="编成规则"><CircleHelp :size="16" aria-hidden="true" /></summary>
            <p>五个位置对应舞台位置，选满五位后才能试听。每位偶像的声部约 3 MB，选中后才下载；重复偶像共用声部与演唱区间。</p>
          </details>
        </legend>
        <div
          v-for="stagePosition in audition.stagePositions"
          :key="stagePosition"
          class="performer-slot"
          :class="{ active: audition.activeStagePositions.includes(stagePosition), filled: Boolean(audition.idolForStagePosition(stagePosition)) }"
          :data-slot-state="audition.slotState(stagePosition)"
        >
          <button
            type="button"
            class="slot-pick"
            :aria-label="`舞台位置 ${stagePosition}${stagePosition === 3 ? '，中心' : ''}：${audition.idolForStagePosition(stagePosition) ? audition.slotName(stagePosition) : '未选择'}`"
            @click="openPicker(stagePosition)"
          >
            <span class="slot-position">{{ stagePosition }}<span v-if="stagePosition === 3" class="slot-center"> · 中心</span></span>
            <ArchiveIdolAvatar v-if="audition.idolForStagePosition(stagePosition)" class="slot-avatar" :idol-code="audition.idolForStagePosition(stagePosition)" :accent-color="idolColor(audition.idolForStagePosition(stagePosition))" :size="64" decorative />
            <span v-else class="slot-avatar slot-empty" aria-hidden="true"><Plus :size="22" /></span>
            <strong>{{ audition.idolForStagePosition(stagePosition) ? audition.slotName(stagePosition) : '选择' }}</strong>
            <small>{{ audition.slotStatusLabel(stagePosition) }}</small>
          </button>
          <button v-if="audition.idolForStagePosition(stagePosition)" type="button" class="slot-clear" :aria-label="`清空位置 ${stagePosition}`" @click="audition.assignStagePosition(stagePosition, '')"><X :size="16" aria-hidden="true" /></button>
        </div>
      </fieldset>
      <p class="lineup-progress" role="status">
        <template v-if="audition.loadingTimeline">正在读取演唱切换表…</template>
        <template v-else-if="audition.filledCount < 5">还差 {{ 5 - audition.filledCount }} 位。点空位选择，选满五位后即可试听。</template>
        <template v-else-if="!audition.armed">这是你上次的编成。<button type="button" class="lineup-load" @click="audition.arm()">载入并试听 · 约 {{ audition.estimatedMegabytes }} MB</button></template>
        <template v-else-if="!audition.lineupSession.ready">正在载入 {{ audition.readyCount }}/{{ audition.trackUrls.length }} 条音轨…</template>
        <template v-else>五人已就绪，可以播放。</template>
      </p>
    </div>

    <!-- One idol picker for Solo and for every lineup position: a side drawer wide, a bottom sheet on phones. -->
    <ArchiveTerminalDialog class="idol-drawer" :open="pickerOpen" :title="pickerTarget ? `选择位置 ${pickerTarget}${pickerTarget === 3 ? '（中心）' : ''} 的偶像` : 'Solo 声部试听'" :title-id="pickerTitleId" @close="closePicker">
      <p class="idol-hint">{{ pickerTarget ? '选择后自动跳到下一个空位；×N 是这位偶像已占的位置数' : '选择后立即切换' }}</p>
      <ArchiveIdolPickerPanel :idols="pickerIdols" :idol-name="idolName" :idol-search="idolSearch" group-ring
        :model-value="pickedCode" :counts="pickerCounts" @update:model-value="pick" />
    </ArchiveTerminalDialog>
  </section>
</template>

<script setup>
import { ChevronRight, CircleHelp, Plus, X } from '@lucide/vue'
import { computed, ref, useId } from 'vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

const props = defineProps({
  audition: { type: Object, required: true },
  idolDirectory: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
})
const currentUnitKey = computed(() => props.audition.unitKey || props.audition.unitOptions[0]?.key)
const currentTrackKey = computed(() => props.audition.trackKey || props.audition.trackOptions[0]?.key)
const directory = computed(() => new Map(props.idolDirectory.map(idol => [idol.id, idol])))
function soloDisplayName(entry) { return (entry?.idol_code && props.idolName(entry.idol_code, entry.displayName)) || entry?.displayName || '' }

const idolColor = code => directory.value.get(code)?.color || ''
// The site's one idol picker, limited to the idols with a collected vocal for this song.
const pickerIdols = computed(() => props.audition.soloEntries.map(entry => directory.value.get(entry.idol_code)
  || { id: entry.idol_code, name: entry.displayName || entry.idol_code, unitCode: '', unitName: '' }))

// null picks a Solo; a number is the stage position being filled.
const pickerOpen = ref(false), pickerTarget = ref(null)
const pickerTitleId = useId()
function openPicker(stagePosition) {
  pickerTarget.value = stagePosition
  pickerOpen.value = true
}
function closePicker() {
  pickerOpen.value = false
  pickerTarget.value = null
}
// Filling a position: the idol already there is the current choice, and ×N counts the positions each idol holds.
const pickedCode = computed(() => pickerTarget.value ? props.audition.idolForStagePosition(pickerTarget.value) : props.audition.idolCode)
const pickerCounts = computed(() => {
  if (!pickerTarget.value) return {}
  const counts = {}
  for (const code of props.audition.stageLineup) if (code) counts[code] = (counts[code] || 0) + 1
  return counts
})
async function pick(code) {
  const position = pickerTarget.value
  if (!position) {
    props.audition.selectSolo(code)
    closePicker()
    return
  }
  const next = props.audition.nextEmptyStagePosition(position) || 0
  // Advance before awaiting, so the dialog title follows the reader's next pick immediately.
  if (next && next !== position) pickerTarget.value = next
  else closePicker()
  await props.audition.assignStagePosition(position, code)
}
</script>

<style scoped>
/* The version panel: on the paper under the head; tabs, then the mode's own choice. */
.song-version-panel { container: song-version / inline-size; min-width: 0; }
.song-version-panel .song-block-heading small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.version-tabs { display: flex; gap: var(--gs-space-5); height: 44px; margin-top: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); overflow-x: auto; scrollbar-width: none; }
.version-tabs::-webkit-scrollbar { display: none; }
.version-tabs button { flex: none; padding: 0 var(--gs-space-1); border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.version-tabs button[aria-checked="true"] { border-bottom-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
@media (hover: hover) { .version-tabs button:hover { color: var(--gs-ink); } }

/* Up to sixteen choices sit in place as pills. */
.version-pills { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); margin-top: var(--gs-space-4); }
.version-pills button { display: inline-flex; align-items: center; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; transition: color .15s, background-color .15s, border-color .15s; }
.version-pills button[aria-checked="true"] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
@media (hover: hover) { .version-pills button:hover { border-color: var(--gs-ink-3); color: var(--gs-ink); } }

/* A value row: what is chosen, and the way to change it. */
.version-value { display: flex; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: var(--gs-control-touch); margin-top: var(--gs-space-4); padding: var(--gs-space-2) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.version-value span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.version-value strong { flex: 1; min-width: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.version-value svg { flex: none; color: var(--gs-ink-3); }

/* Five-slot lineup: a slot is the place on stage — number, face, name, what it is doing. */
.performer-lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gs-space-3); margin: var(--gs-space-4) 0 0; padding: 0; border: 0; }
.performer-lineup legend { display: flex; align-items: center; gap: var(--gs-space-2); margin-bottom: var(--gs-space-3); padding: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.lineup-rule { position: relative; }
.lineup-rule summary { display: grid; place-items: center; width: 28px; height: 28px; color: var(--gs-ink-3); list-style: none; cursor: pointer; }
.lineup-rule summary::-webkit-details-marker { display: none; }
.lineup-rule p { position: absolute; top: 100%; left: 0; z-index: 3; width: min(320px, 70vw); margin: var(--gs-space-1) 0 0; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: 1.6; }
.performer-slot { position: relative; min-width: 0; border-top: 2px solid var(--gs-line); }
.performer-slot.active { border-top-color: var(--gs-mint); }
.slot-pick { display: grid; justify-items: center; gap: var(--gs-space-1); width: 100%; min-width: 0; padding: var(--gs-space-3) var(--gs-space-1) var(--gs-space-2); border: 0; background: none; color: var(--gs-ink); font: inherit; text-align: center; cursor: pointer; }
.slot-position { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-variant-numeric: tabular-nums; }
.slot-empty { width: 64px; height: 64px; border-radius: 50%; }
.slot-empty { display: grid; place-items: center; box-sizing: border-box; border: 1.5px dashed var(--gs-ink-3); background: none; color: var(--gs-ink-3); }
.slot-pick strong { max-width: 100%; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.performer-slot:not(.filled) .slot-pick strong { color: var(--gs-mint-ink); }
.slot-pick small { max-width: 100%; overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-caption); text-overflow: ellipsis; white-space: nowrap; }
.performer-slot.active .slot-pick small, .performer-slot[data-slot-state=ready] .slot-pick small { color: var(--gs-mint-ink); }
.performer-slot[data-slot-state=error] .slot-pick small { color: var(--gs-critical); }
.performer-slot[data-slot-state=loading] .slot-avatar { opacity: .55; }
.slot-clear { position: absolute; top: var(--gs-space-1); right: 0; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--gs-ink-3); cursor: pointer; }
.lineup-progress { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.lineup-load { margin-left: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-action-bg); color: var(--gs-action-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
@media (hover: hover) { .slot-pick:hover strong { color: var(--gs-mint-ink); } .slot-clear:hover { color: var(--gs-ink); } }

/* Narrow: pills scroll sideways in two rows; slots keep the face and the number. */
@container song-version (max-width: 519px) {
  .version-pills { display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, auto); justify-content: start; overflow-x: auto; scrollbar-width: none; }
  .version-pills::-webkit-scrollbar { display: none; }
  .version-pills button { min-height: var(--gs-control-touch); }
  .performer-lineup { gap: var(--gs-space-1); }
  .slot-empty { width: 44px; height: 44px; }
  .slot-avatar { --idol-avatar-override-size: 44px; }
  .slot-pick small, .slot-center { display: none; }
  .slot-pick strong { font-size: var(--gs-text-meta); }
  .performer-slot { display: grid; justify-items: center; }
  .slot-clear { position: static; }
}

/* Idol picker: a side drawer on wide screens, an 85dvh bottom sheet on phones. */
.idol-drawer {
  --drawer-safe-top: var(--gs-safe-top);
  --drawer-header-safe-top: var(--drawer-safe-top);
  --drawer-inline-left: max(var(--gs-space-5), var(--gs-safe-left));
  --drawer-inline-right: max(var(--gs-space-5), var(--gs-safe-right));
  position: fixed; inset: 0 0 0 auto; margin: 0; box-sizing: border-box;
  width: min(var(--gs-surface-drawer-width), 100vw); max-width: 100vw; height: 100dvh; max-height: 100dvh;
  padding: 0; border: 0; border-radius: 0;
  background: var(--gs-surface); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body);
}
.idol-drawer :deep(.terminal-dialog-header) { min-width: 0; padding: calc(var(--gs-space-4) + var(--drawer-header-safe-top)) var(--drawer-inline-right) var(--gs-space-4) var(--drawer-inline-left); }
.idol-drawer :deep(.terminal-dialog-header h2) { min-width: 0; font-size: var(--gs-text-section); overflow-wrap: anywhere; }
.idol-drawer :deep(.terminal-dialog-body) { min-width: 0; padding: var(--gs-space-4) var(--drawer-inline-right) calc(var(--gs-space-5) + var(--gs-safe-bottom)) var(--drawer-inline-left); }
.idol-hint { margin: 0 0 var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (max-width: 760px) {
  /* Only protect the top inset left uncovered by this 85dvh sheet's 15dvh gap. */
  .idol-drawer { --drawer-header-safe-top: max(0px, calc(var(--drawer-safe-top) - 15dvh)); inset: auto 0 0; width: 100vw; height: 85dvh; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
}
.song-version-panel :is(button, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.version-tabs button:focus-visible { outline-offset: -2px; }
</style>
