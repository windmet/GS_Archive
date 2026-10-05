<template>
  <ArchiveProducerSettings v-if="canCancel && !selectionOnly" :preferences="preferences" :idols="idols" :preferred-idols="preferredIdols" :idol-name="idolName" :idol-search="idolSearch" :notice="notice" @cancel="emit('cancel')" @save-startup="emit('save-startup',$event)" @save-preferred="emit('save-preferred',$event)" @settings-applied="emit('settings-applied')" />
  <section v-else aria-labelledby="welcome-title" class="archive-terminal terminal-welcome selection-only" :class="{ 'has-wallpaper': wallpaper.selected.value }">
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
          <h1 id="welcome-title" ref="heading" tabindex="-1">选择偶像</h1>
          <p>{{ targetLabel === '首页' ? '选择的偶像将用于首页，可随时更改。' : '只用于本次打开，不改变已保存的启动方式。' }}</p>
        </div>
        <p v-if="notice" class="terminal-notice" role="status">{{ notice }}</p>
        <p v-if="wallpaper.notice.value" class="terminal-notice" role="status">{{ wallpaper.notice.value }}</p>
        <p v-if="backdropFailed" class="terminal-notice" role="status">卡面图片未能载入，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择或重试</button></p>
        <p v-if="wallpaper.unavailable.value || wallpaper.error.value" class="terminal-notice" role="status">壁纸暂时不可用，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择</button></p>
        <div class="terminal-selection">
          <p v-if="!dataReady" role="status">正在准备人物名单…</p>
          <ArchiveIdolPickerPanel v-model="selectedIdol" :idols="idols" :idol-name="idolName" :idol-search="idolSearch" />
          <div class="terminal-picker-actions" aria-label="确认偶像与打开页面">
            <p class="terminal-picker-summary" role="status">{{ selectedName ? `已选：${selectedName}` : '请选择一位偶像' }}<small>打开{{ targetLabel }}</small></p>
            <label><input v-model="setPreferred" type="checkbox" /> 也保存为资料馆的“我的偶像”快捷入口</label>
            <button class="terminal-secondary" type="button" :disabled="!idols.length" @click="chooseRandom"><Shuffle :size="16" />随机一位</button>
            <button class="terminal-primary" type="button" :disabled="!selectedName" @click="chooseIdol">打开{{ targetLabel }}</button>
          </div>
        </div>
        <p class="terminal-signature">SideM Archive · 非官方资料存档</p>
      </div>
    </div>
    <ArchiveWallpaperPicker :open="wallpaperOpen" :idols="preferredIdols.length ? preferredIdols : idols" :idol-name="idolName" :idol-search="idolSearch" @close="wallpaperOpen = false" />
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import ArchiveProducerSettings from './ArchiveProducerSettings.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Images, Shuffle } from '@lucide/vue'
import ArchiveTerminalBackdrop from './terminal/ArchiveTerminalBackdrop.vue'
import ArchiveWallpaperPicker from './terminal/ArchiveWallpaperPicker.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import { useTerminalWallpaper } from '../../data/terminal/useTerminalWallpaper.js'
import '../../styles/archive-terminal.css'
const props = defineProps({
  idols: { type: Array, default: () => [] }, preferredIdols: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  preferences: { type: Object, default: () => ({}) }, notice: { type: String, default: '' },
  dataReady: Boolean, selectionOnly: Boolean, canCancel: Boolean,
  targetLabel: { type: String, default: '立绘主页' },
})
// The producer settings page (opened from the archive) or the idol picker for a page that needs one.
// The first-run mode chooser is retired: new visitors start in the archive with ArchiveOnboarding.
const emit = defineEmits(['cancel', 'choose-idol', 'save-startup', 'save-preferred', 'settings-applied'])
const heading = ref(null)
const selectedIdol = ref(props.preferences.startupIdol || props.preferences.preferredIdol || ''), setPreferred = ref(!props.preferences.preferredIdol), wallpaperOpen = ref(false)
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === selectedIdol.value)
  return idol ? props.idolName(idol.id) || idol.name || '' : ''
})
const wallpaper = useTerminalWallpaper()
const backdropFailed = ref(false)
watch(wallpaper.revision, () => { backdropFailed.value = false })
watch(() => props.idols, idols => {
  if (!idols.some(x => x.id === selectedIdol.value)) selectedIdol.value = idols.some(x => x.id === props.preferences.startupIdol) ? props.preferences.startupIdol : ''
}, { immediate: true })
onMounted(() => { heading.value?.focus({ preventScroll: true }); if (wallpaper.preferences.value.wallpaperKey) wallpaper.load() })
function chooseRandom() { if (props.idols.length) selectedIdol.value = props.idols[Math.floor(Math.random() * props.idols.length)].id }
function chooseIdol() {
  if (props.idols.some(x => x.id === selectedIdol.value)) emit('choose-idol', { idolCode: selectedIdol.value, rememberStartup: false, setPreferred: setPreferred.value })
}
</script>

