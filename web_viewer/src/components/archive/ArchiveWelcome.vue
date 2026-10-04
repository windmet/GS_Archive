<template>
  <section aria-labelledby="welcome-title" class="archive-terminal terminal-welcome" :class="{ 'has-wallpaper': wallpaper.selected.value, 'selection-only': selectionOnly || step === 'idol' }">
    <ArchiveTerminalBackdrop :key="wallpaper.revision.value" :wallpaper="wallpaper.selected.value" @error="backdropFailed = true" />
    <div class="terminal-scroll" data-archive-scroll-container>
      <div class="terminal-panel">
        <header class="terminal-header">
          <button v-if="canCancel" class="terminal-icon-button" type="button" aria-label="返回来源页" @click="emit('cancel')"><ArrowLeft :size="20" /></button>
          <span class="terminal-brand">SideM <b>ARCHIVE</b></span>
          <ArchiveLanguageSwitch />
          <button class="terminal-icon-button" type="button" aria-label="更换 SSR 卡面壁纸" title="SSR 卡面壁纸" @click="wallpaperOpen = true"><Images :size="20" /></button>
        </header>
        <div class="terminal-heading">
          <span class="terminal-kicker">GROWING STARS</span>
          <h1 id="welcome-title" ref="heading" tabindex="-1">{{ selectionOnly ? '选择偶像' : step === 'idol' ? '选择首页偶像' : canCancel ? '启动设置' : '欢迎来到资料馆' }}</h1>
          <p>{{ selectionOnly ? (targetLabel === '首页' ? '选择的偶像将用于首页，可随时更改。' : '只用于本次打开，不改变已保存的启动方式。') : step === 'idol' ? '选择会被保存为首页人物。下方可另外设置资料馆快捷入口。' : '先选下次打开的页面。本浏览器会记住选择，不再重复询问；可在资料馆的“启动设置”中更改。' }}</p>
        </div>
        <p v-if="notice" class="terminal-notice" role="status">{{ notice }}</p>
        <p v-if="wallpaper.notice.value" class="terminal-notice" role="status">{{ wallpaper.notice.value }}</p>
        <p v-if="backdropFailed" class="terminal-notice" role="status">卡面图片未能载入，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择或重试</button></p>
        <p v-if="wallpaper.unavailable.value || wallpaper.error.value" class="terminal-notice" role="status">壁纸暂时不可用，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择</button></p>
        <h2 v-if="!selectionOnly && step === 'mode'" class="welcome-section-title">下次打开哪里？</h2>
        <div v-if="!selectionOnly && step === 'mode'" class="terminal-mode-list">
          <button class="terminal-mode mode-portal" type="button" @click="emit('choose-portal')">
            <span class="mode-emblem" aria-hidden="true"><LayoutGrid :size="26" /></span>
            <span class="mode-copy"><small>ARCHIVE</small><strong>资料馆</strong><span>浏览故事、歌曲、卡片与偶像资料。<br />随时切换到带台词与语音的首页。</span><b>进入资料馆 <ChevronRight :size="16" /></b></span>
            <span v-if="preferences.homeMode === 'portal' || (preferences.homeMode === 'unset' && preferences.onboardingComplete)" class="mode-current">当前默认</span>
          </button>
          <button class="terminal-mode mode-light" type="button" @click="chooseMode('card')">
            <span class="mode-emblem" aria-hidden="true"><LayoutGrid :size="26" /></span>
            <span class="mode-copy"><small>CARD HOME</small><strong>卡牌首页</strong><span>静态 SSR 卡面 · 首页台词与语音。<br />横竖画面随屏幕方向切换。</span><b>选择首页偶像 <ChevronRight :size="16" /></b></span>
            <span v-if="preferences.homeMode === 'card'" class="mode-current">当前默认</span>
          </button>
          <button class="terminal-mode mode-stage" type="button" @click="chooseMode('spine')">
            <span class="mode-emblem" aria-hidden="true"><Sparkles :size="27" /></span>
            <span class="mode-copy"><small>HOME</small><strong>人物互动首页</strong><span>动态人物、服装与首页台词语音。<br />偶像和场景背景可以分开选择。</span><b>选择首页偶像 <ChevronRight :size="16" /></b></span>
            <span v-if="preferences.homeMode === 'spine'" class="mode-current">当前默认</span>
          </button>
        </div>
        <div v-else class="terminal-selection">
          <button v-if="!selectionOnly" type="button" class="terminal-text-button" @click="step = 'mode'"><ArrowLeft :size="16" />返回模式选择</button>
          <p v-if="!dataReady" role="status">正在准备人物名单…</p>
          <ArchiveIdolPickerPanel v-model="selectedIdol" :idols="idols" :idol-name="idolName" :idol-search="idolSearch" />
          <div class="terminal-picker-actions" aria-label="确认偶像与打开页面">
            <p class="terminal-picker-summary" role="status">{{ selectedName ? `已选：${selectedName}` : '请选择一位偶像' }}<small>{{ selectionOnly ? `打开${targetLabel}` : '确认后将记住此首页，下次直接打开。' }}</small></p>
            <label><input v-model="setPreferred" type="checkbox" /> 也保存为资料馆的“我的偶像”快捷入口</label>
            <button class="terminal-secondary" type="button" :disabled="!idols.length" @click="chooseRandom"><Shuffle :size="16" />随机一位</button>
            <button class="terminal-primary" type="button" :disabled="!selectedName" @click="chooseIdol">打开{{ selectionOnly ? targetLabel : selectedMode === 'card' ? '卡牌首页' : '人物互动首页' }}</button>
          </div>
        </div>
        <footer v-if="!selectionOnly && step === 'mode'" class="terminal-welcome-footer">
          <ProducerNameSetting />
          <ArchivePreferredIdolSlot :idols="preferredIdols.length ? preferredIdols : idols" :idol-name="idolName" :idol-search="idolSearch" :value="preferences.preferredIdol || ''" id-prefix="welcome" @save="emit('save-preferred', $event)" />
          <button class="terminal-text-button" type="button" @click="emit('choose-later')">{{ canCancel ? '暂不更改，返回来源页' : '先浏览资料馆，下次直接打开' }}</button>
          <details class="terminal-reset"><summary>更多设置</summary><button type="button" class="terminal-text-button" @click="emit('clear-preferences')">重置启动与“我的偶像”设置</button><small>不删除收藏、阅读位置或卡面壁纸。</small></details>
        </footer>
        <p class="terminal-signature">SideM Archive · 非官方资料存档</p>
      </div>
    </div>
    <ArchiveWallpaperPicker :open="wallpaperOpen" :idols="preferredIdols.length ? preferredIdols : idols" :idol-name="idolName" :idol-search="idolSearch" @close="wallpaperOpen = false" />
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronRight, Images, LayoutGrid, Shuffle, Sparkles } from '@lucide/vue'
import ProducerNameSetting from './ProducerNameSetting.vue'
import ArchiveTerminalBackdrop from './terminal/ArchiveTerminalBackdrop.vue'
import ArchiveWallpaperPicker from './terminal/ArchiveWallpaperPicker.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import ArchivePreferredIdolSlot from './terminal/ArchivePreferredIdolSlot.vue'
import { useTerminalWallpaper } from '../../data/terminal/useTerminalWallpaper.js'
import '../../styles/archive-terminal.css'
const props = defineProps({
  idols: { type: Array, default: () => [] }, preferredIdols: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  preferences: { type: Object, default: () => ({}) }, notice: { type: String, default: '' },
  dataReady: Boolean, selectionOnly: Boolean, canCancel: Boolean,
  targetLabel: { type: String, default: '人物互动首页' },
})
const emit = defineEmits(['cancel', 'choose-later', 'choose-portal', 'choose-idol', 'save-preferred', 'clear-preferences'])
const heading = ref(null), step = ref(props.selectionOnly ? 'idol' : 'mode')
const selectedMode = ref(props.preferences.homeMode === 'card' ? 'card' : 'spine')
function chooseMode(mode) { selectedMode.value = mode; step.value = 'idol' }
const selectedIdol = ref(props.preferences.startupIdol || props.preferences.preferredIdol || ''), setPreferred = ref(!props.preferences.preferredIdol), wallpaperOpen = ref(false)
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === selectedIdol.value)
  return idol ? props.idolName(idol.id) || idol.name || '' : ''
})
const wallpaper = useTerminalWallpaper()
const backdropFailed = ref(false)
watch(wallpaper.revision, () => { backdropFailed.value = false })
watch(() => props.selectionOnly, value => { step.value = value ? 'idol' : 'mode' })
watch(() => props.idols, idols => {
  if (!idols.some(x => x.id === selectedIdol.value)) selectedIdol.value = idols.some(x => x.id === props.preferences.startupIdol) ? props.preferences.startupIdol : ''
}, { immediate: true })
onMounted(() => { heading.value?.focus({ preventScroll: true }); if (wallpaper.preferences.value.wallpaperKey) wallpaper.load() })
function chooseRandom() { if (props.idols.length) selectedIdol.value = props.idols[Math.floor(Math.random() * props.idols.length)].id }
function chooseIdol() {
  if (props.idols.some(x => x.id === selectedIdol.value)) emit('choose-idol', { idolCode: selectedIdol.value, rememberStartup: !props.selectionOnly, homeMode: selectedMode.value, setPreferred: setPreferred.value })
}
</script>

<style scoped>
.welcome-section-title { font-size: 16px; margin: 20px 0 10px; color: #244558; }
</style>
