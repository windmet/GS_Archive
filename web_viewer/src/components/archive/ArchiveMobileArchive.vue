<template>
  <article
    v-if="archive"
    class="mobile-archive"
    :data-focused-scenario-id="String(focusedScenarioId || '')"
    :style="{ '--mobile-accent': accentColor }"
  >
    <header class="mobile-hero" :style="heroStyle">
      <div class="hero-shade"></div>
      <div class="mobile-identity">
        <img v-if="mode !== 'unit'" :src="idolIcon(selectedIdol)" :alt="idolName" />
        <img v-else class="unit-logo" :src="unitLogo(selectedUnit)" :alt="unitName" />
        <div>
          <span>MOBILE ARCHIVE</span>
          <h2>{{ mode === 'unit' ? unitName : idolName }}</h2>
          <p>{{ roomSubtitle }}</p>
        </div>
      </div>
      <div class="mobile-selector">
        <button title="上一项" @click="moveSelection(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span>{{ mode === 'unit' ? '组合' : '偶像' }}</span>
          <select :value="mode === 'unit' ? selectedUnit : selectedIdol" @change="changeSelection($event.target.value)">
            <option v-for="entry in selectionOptions" :key="entry.value" :value="entry.value">{{ entry.label }}</option>
          </select>
        </label>
        <button title="下一项" @click="moveSelection(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <nav class="mobile-tabs" aria-label="Mobile 分类">
      <button v-for="tab in tabs" :key="tab.id" :class="{ active: mode === tab.id }" @click="emit('update:mode', tab.id)">
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
        <small>{{ tabCount(tab.id) }}</small>
      </button>
    </nav>

    <main class="mobile-content">
      <div class="content-heading">
        <div>
          <span>{{ activeTab.eyebrow }}</span>
          <h3>{{ activeTab.label }}</h3>
        </div>
        <strong>{{ contentCount }} records</strong>
      </div>

      <div v-if="mode !== 'random'" class="conversation-list">
        <article
          v-for="bundle in bundles"
          :key="bundle.id"
          class="conversation-row"
          :class="{ focused: bundle.scenarios.some(item => String(item.id) === String(focusedScenarioId)), missing: !bundle.exists }"
          :data-scenario-ids="bundle.scenarios.map(item => item.id).join(',')"
        >
          <span class="conversation-type">
            <Phone v-if="bundle.kind === 'idol_phone'" :size="19" />
            <Users v-else-if="bundle.kind === 'unit_talk'" :size="19" />
            <MessageSquareText v-else :size="19" />
          </span>
          <div class="conversation-copy">
            <small>{{ formatDate(bundle.releaseAt) || kindLabel(bundle.kind) }}</small>
            <h4>{{ bundle.title }}</h4>
            <div class="unlock-list">
              <button
                v-for="unlock in bundle.unlocks"
                :key="unlock.id"
                :class="{ card: unlock.kind.startsWith('card_') }"
                :title="unlock.text"
                @click="openUnlockCard(unlock)"
              >
                <CreditCard v-if="unlock.kind.startsWith('card_')" :size="12" />
                <Unlock v-else :size="12" />
                <span>{{ unlock.text }}</span>
              </button>
            </div>
          </div>
          <div class="conversation-meta">
            <code>{{ bundle.file || bundle.scenarios[0]?.base_resource_id }}</code>
            <span>{{ bundle.scenarios.length }} unlocks</span>
          </div>
          <button class="conversation-play" :disabled="!bundle.exists" :title="bundle.exists ? '播放通信' : '本地脚本缺失'" @click="emit('play', bundle.file)">
            <Play v-if="bundle.exists" :size="17" fill="currentColor" />
            <FileWarning v-else :size="17" />
          </button>
        </article>
      </div>

      <div v-else class="random-list">
        <article v-for="bundle in randomBundles" :key="bundle.id" class="random-bundle">
          <header>
            <div><small>RANDOM TALK</small><h4>{{ bundle.title }}</h4></div>
            <button :disabled="!bundle.exists" title="播放随机 Talk 合集" @click="emit('play', bundle.file)"><Play :size="17" fill="currentColor" /></button>
          </header>
          <div class="topic-grid">
            <div v-for="(topic, index) in bundle.topics" :key="topic.id">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ topic.script_label }}</strong>
              <small>{{ timeWindow(topic) }} · weight {{ topic.weight }}</small>
            </div>
          </div>
        </article>
      </div>

      <p v-if="!contentCount" class="empty-state">当前分类没有可展示记录。</p>
    </main>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, CreditCard, FileWarning, MessageSquareText, Phone, Play, Shuffle, Unlock, Users } from '@lucide/vue'
import { buildCompiledGroupTitleMap, buildRandomTalkBundles, formatArchiveDate, groupMobileScenarios } from '../../data/idolCommunicationSelectors.js'

const props = defineProps({
  archive: { type: Object, default: null },
  compiledIndex: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  selectedUnit: { type: String, default: '' },
  mode: { type: String, default: 'personal' },
  focusedScenarioId: { type: [String, Number], default: '' },
})
const emit = defineEmits(['select-idol', 'select-unit', 'update:mode', 'play', 'open-card'])

const tabs = [
  { id: 'personal', label: '个人聊天', eyebrow: 'IDOL TALK', icon: MessageSquareText },
  { id: 'phone', label: '电话通信', eyebrow: 'PHONE CALL', icon: Phone },
  { id: 'unit', label: '组合聊天', eyebrow: 'UNIT TALK', icon: Users },
  { id: 'random', label: '随机 Talk', eyebrow: 'RANDOM TOPICS', icon: Shuffle },
]
const activeTab = computed(() => tabs.find(tab => tab.id === props.mode) || tabs[0])
const titleMap = computed(() => buildCompiledGroupTitleMap(props.compiledIndex))
const scenariosById = computed(() => new Map((props.archive?.scenarios || []).map(entry => [entry.id, entry])))
const idolScenarioIds = computed(() => props.archive?.by_idol_code?.[props.selectedIdol] || [])
const unitScenarioIds = computed(() => props.archive?.by_unit_code?.[props.selectedUnit] || [])
const idolScenarios = computed(() => idolScenarioIds.value.map(id => scenariosById.value.get(id)).filter(Boolean))
const unitScenarios = computed(() => unitScenarioIds.value.map(id => scenariosById.value.get(id)).filter(Boolean))
const bundles = computed(() => {
  const source = props.mode === 'unit' ? unitScenarios.value : idolScenarios.value
  const kind = props.mode === 'phone' ? 'idol_phone' : props.mode === 'unit' ? 'unit_talk' : 'idol_talk'
  return groupMobileScenarios(source.filter(entry => entry.kind === kind), titleMap.value)
})
const randomBundles = computed(() => buildRandomTalkBundles(props.archive, props.selectedIdol, titleMap.value))
const contentCount = computed(() => props.mode === 'random' ? randomBundles.value.length : bundles.value.length)
const idol = computed(() => props.idols.find(entry => entry.idol_code === props.selectedIdol) || props.idols[0] || {})
const unit = computed(() => props.units.find(entry => entry.unit_code === props.selectedUnit) || props.units[0] || {})
const idolName = computed(() => idol.value.display_name || props.selectedIdol)
const unitName = computed(() => unit.value.unit_name || props.selectedUnit)
const accentColor = computed(() => props.mode === 'unit' ? (unit.value.unit_color || '#168f87') : (idol.value.color || '#168f87'))
const personalRoom = computed(() => props.archive?.rooms?.personal?.find(room => room.idol_code === props.selectedIdol))
const unitRoom = computed(() => props.archive?.rooms?.unit?.find(room => room.unit_code === props.selectedUnit))
const roomSubtitle = computed(() => props.mode === 'unit' ? 'Unit Talk Room' : (personalRoom.value?.profile_text || 'Mobile Talk Room'))
const heroStyle = computed(() => ({
  backgroundImage: `url('${props.mode === 'unit' ? unitBackground(props.selectedUnit) : idolBackground(props.selectedIdol)}')`,
}))
const selectionOptions = computed(() => props.mode === 'unit'
  ? props.units.map(entry => ({ value: entry.unit_code, label: entry.unit_name }))
  : props.idols.map(entry => ({ value: entry.idol_code, label: entry.display_name })))

function tabCount(mode) {
  if (mode === 'random') return (props.archive?.random_talk?.topics || []).filter(topic => topic.idol_code === props.selectedIdol).length
  if (mode === 'unit') return unitScenarios.value.filter(entry => entry.kind === 'unit_talk').length
  return idolScenarios.value.filter(entry => entry.kind === (mode === 'phone' ? 'idol_phone' : 'idol_talk')).length
}
function moveSelection(delta) {
  const options = selectionOptions.value
  const current = props.mode === 'unit' ? props.selectedUnit : props.selectedIdol
  const index = options.findIndex(entry => entry.value === current)
  if (index < 0 || !options.length) return
  changeSelection(options[(index + delta + options.length) % options.length].value)
}
function changeSelection(value) {
  emit(props.mode === 'unit' ? 'select-unit' : 'select-idol', value)
}
function openUnlockCard(unlock) {
  if (!unlock.kind.startsWith('card_')) return
  emit('open-card', Number(unlock.condition?.param_a || 0))
}
function kindLabel(kind) { return kind === 'unit_talk' ? 'UNIT TALK' : kind === 'idol_phone' ? 'PHONE CALL' : 'IDOL TALK' }
function formatDate(value) { return formatArchiveDate(value) }
function idolIcon(code) { return `/assets/idols/mobile_icons/image_chara_mobile_icon_${code}.png` }
function idolBackground(code) { return `/assets/idols/mobile_bg/image_chara_mobile_background_${code}.png` }
function unitBackground(code) { return `/assets/units/mobile_bg/image_unit_mobile_background_${code}.png` }
function unitLogo(code) { return `/assets/units/logos/image_unit_logo_${code}.png` }
function timeWindow(topic) {
  const start = topic.open_time || '00:00'
  const end = topic.close_time || '00:00'
  return start === '0:00:00' && end === '00:00:00' ? '全天' : `${start}–${end}`
}
</script>

<style scoped>
.mobile-archive { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f4f6f7; color: #26343c; }.mobile-hero { position: relative; display: flex; align-items: end; justify-content: space-between; gap: 24px; min-height: 190px; padding: 26px max(24px, calc((100% - 1100px) / 2)); background-color: #dfe7e8; background-position: center; background-size: cover; }.hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,31,36,.82), rgba(20,31,36,.42) 58%, rgba(20,31,36,.18)); }.mobile-identity, .mobile-selector { position: relative; z-index: 1; }.mobile-identity { display: flex; align-items: center; gap: 15px; min-width: 0; color: #fff; }.mobile-identity > img { width: 76px; height: 76px; border: 3px solid rgba(255,255,255,.86); border-radius: 50%; background: #eef3f4; object-fit: cover; }.mobile-identity > img.unit-logo { width: 120px; border: 0; border-radius: 0; background: rgba(255,255,255,.9); object-fit: contain; }.mobile-identity span { color: #b9fff8; font-size: .58rem; font-weight: 800; }.mobile-identity h2 { margin: 4px 0; font-size: 1.45rem; }.mobile-identity p { margin: 0; color: rgba(255,255,255,.8); font-size: .65rem; }.mobile-selector { display: flex; align-items: end; gap: 6px; }.mobile-selector > button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.62); border-radius: 5px; background: rgba(19,30,35,.5); color: #fff; cursor: pointer; }.mobile-selector label { display: flex; flex-direction: column; gap: 4px; }.mobile-selector label span { color: rgba(255,255,255,.82); font-size: .56rem; }.mobile-selector select { min-width: 240px; height: 34px; padding: 0 30px 0 10px; border: 1px solid rgba(255,255,255,.7); border-radius: 5px; background: rgba(255,255,255,.94); color: #28363d; font: inherit; font-size: .67rem; }
.mobile-tabs { position: sticky; top: 0; z-index: 3; display: flex; justify-content: center; gap: 2px; border-bottom: 1px solid #dce3e5; background: rgba(255,255,255,.97); }.mobile-tabs button { display: inline-grid; grid-template-columns: 18px auto 26px; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #718087; cursor: pointer; font: inherit; font-size: .65rem; }.mobile-tabs button.active { border-color: var(--mobile-accent); color: #26343c; font-weight: 800; }.mobile-tabs small { display: grid; place-items: center; min-width: 24px; height: 18px; border-radius: 9px; background: #edf1f2; color: #77858b; font-size: .48rem; }
.mobile-content { max-width: 1100px; margin: 0 auto; padding: 22px 24px 42px; }.content-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 12px; }.content-heading span { color: var(--mobile-accent); font-size: .57rem; font-weight: 800; }.content-heading h3 { margin: 3px 0 0; font-size: 1rem; }.content-heading > strong { color: #7b888e; font-size: .59rem; }
.conversation-list { border-top: 1px solid #dbe2e4; }.conversation-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) 170px 38px; align-items: center; gap: 12px; min-height: 88px; padding: 12px 13px; border-right: 1px solid #dbe2e4; border-bottom: 1px solid #dbe2e4; border-left: 1px solid #dbe2e4; background: #fff; }.conversation-row.focused { box-shadow: inset 3px 0 var(--mobile-accent); background: #f2faf9; }.conversation-row.missing { background: #f6f7f8; }.conversation-type { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--mobile-accent) 12%, #fff); color: var(--mobile-accent); }.conversation-copy { min-width: 0; }.conversation-copy > small { color: var(--mobile-accent); font-size: .52rem; font-weight: 700; }.conversation-copy h4 { margin: 3px 0 7px; font-size: .7rem; }.unlock-list { display: flex; flex-wrap: wrap; gap: 4px; }.unlock-list button { display: inline-flex; align-items: center; gap: 4px; max-width: 310px; min-height: 22px; padding: 2px 7px; border: 1px solid #dce4e6; border-radius: 4px; background: #f7f9fa; color: #65747b; cursor: default; font: inherit; font-size: .5rem; }.unlock-list button.card { border-color: #bfe0dd; background: #eef8f7; color: #167e77; cursor: pointer; }.unlock-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.conversation-meta { display: flex; flex-direction: column; align-items: end; gap: 4px; min-width: 0; color: #87949a; font-size: .5rem; }.conversation-meta code { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.conversation-play, .random-bundle header button { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--mobile-accent); border-radius: 50%; background: #fff; color: var(--mobile-accent); cursor: pointer; }.conversation-play:disabled, .random-bundle header button:disabled { border-color: #ccd5d8; color: #8e999e; cursor: not-allowed; }
.random-list { border-top: 1px solid #dbe2e4; }.random-bundle { border-right: 1px solid #dbe2e4; border-bottom: 1px solid #dbe2e4; border-left: 1px solid #dbe2e4; background: #fff; }.random-bundle > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid #e4e9eb; }.random-bundle header small { color: var(--mobile-accent); font-size: .52rem; font-weight: 800; }.random-bundle h4 { margin: 3px 0 0; font-size: .72rem; }.topic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e1e6e8; }.topic-grid div { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 3px 8px; min-height: 62px; padding: 10px 12px; background: #fff; }.topic-grid div > span { grid-row: 1 / 3; color: var(--mobile-accent); font-size: .57rem; font-weight: 800; }.topic-grid strong { overflow: hidden; font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }.topic-grid small { color: #859198; font-size: .5rem; }.empty-state { padding: 40px 0; color: #7c898f; font-size: .65rem; text-align: center; }
@media (max-width: 760px) { .mobile-hero { align-items: start; flex-direction: column; min-height: 210px; padding: 18px 12px; }.mobile-identity > img { width: 58px; height: 58px; }.mobile-selector { width: 100%; }.mobile-selector label { flex: 1; }.mobile-selector select { width: 100%; min-width: 0; }.mobile-tabs { justify-content: start; overflow-x: auto; }.mobile-tabs button { flex: 0 0 auto; padding: 0 10px; }.mobile-content { padding: 16px 10px 30px; }.conversation-row { grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 9px; padding: 11px 9px; }.conversation-type { width: 36px; height: 36px; }.conversation-meta { display: none; }.topic-grid { grid-template-columns: 1fr; }.content-heading > strong { display: none; } }
</style>
