<template>
  <section class="archive-terminal terminal-portal" :class="{ 'has-wallpaper': wallpaper.selected.value }" aria-labelledby="portal-title">
    <ArchiveTerminalBackdrop :key="wallpaper.revision.value" :wallpaper="wallpaper.selected.value" @error="backdropFailed = true" />
    <div class="terminal-scroll" data-archive-scroll-container>
      <div class="terminal-panel">
        <header class="terminal-header">
          <button v-if="canGoBack" class="terminal-icon-button" type="button" aria-label="返回来源页" @click="emit('back')"><ArrowLeft :size="20" /></button>
          <span class="terminal-brand">SideM <b>ARCHIVE</b></span>
          <div class="terminal-control-strip">
          <ArchiveLanguageSwitch />
            <button class="terminal-icon-button terminal-labelled-control" type="button" aria-label="打开首页" title="首页" @click="emit('open-home')"><Sparkles :size="19" /><span>首页</span></button>
            <button class="terminal-icon-button terminal-labelled-control" type="button" aria-label="更换 SSR 卡面壁纸" title="SSR 卡面壁纸" @click="wallpaperOpen = true"><Images :size="19" /><span>壁纸</span></button>
            <button class="terminal-icon-button terminal-labelled-control" type="button" aria-label="启动设置" title="启动设置" @click="emit('settings')"><Settings2 :size="19" /><span>设置</span></button>
          </div>
        </header>
        <div class="terminal-heading"><span class="terminal-kicker">GROWING STARS</span><h1 id="portal-title" tabindex="-1" ref="heading">我的资料馆</h1><p>从这里，打开每一份收藏。</p></div>
        <p v-if="loadingSection" class="terminal-notice" role="status">{{ loadingSection }}</p>
        <p v-if="preferenceNotice || wallpaper.notice.value" class="terminal-notice" role="status">{{ preferenceNotice || wallpaper.notice.value }}</p>
        <p v-if="backdropFailed" class="terminal-notice" role="status">卡面图片未能载入，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择或重试</button></p>
        <p v-if="wallpaper.unavailable.value || wallpaper.error.value" class="terminal-notice" role="status">壁纸暂时不可用，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择</button></p>
        <button class="terminal-text-button" type="button" @click="producerOpen = true">P 名字 · {{ producerName || '未设置' }}</button>
        <section class="terminal-personal" aria-label="我的偶像快捷入口">
          <ArchivePreferredIdolSlot :idols="idols" :value="preferredReference?.idolCode || ''" id-prefix="portal" @save="emit('save-preferred', $event)" />
          <nav v-if="preferredReference?.actionable" class="terminal-preferred-actions" aria-label="我的偶像快捷入口">
            <button v-for="action in preferredActions" :key="action.id" type="button" @click="emit('open-preferred', action.id)">{{ action.label }}</button>
          </nav>
        </section>
        <nav class="terminal-apps" aria-label="全部门户入口">
          <button v-for="item in ARCHIVE_NAVIGATION" :key="item.id" class="terminal-app" type="button" :data-section="item.id" @click="emit('navigate', item.id)">
            <span class="terminal-app-face"><component :is="archiveNavigationIcons[item.id]" :size="27" :stroke-width="2" aria-hidden="true" /></span>
            <strong>{{ item.label }}</strong><small aria-hidden="true">{{ appEnglish[item.id] }}</small>
          </button>
        </nav>
        <footer class="terminal-signature">SideM Archive · 非官方资料存档</footer>
      </div>
    </div>
    <div v-if="wallpaper.selected.value && !backdropFailed" class="terminal-art-caption" aria-hidden="true"><span>SSR</span><strong>{{ archiveNamedText('card', wallpaper.selected.value.label, 'title') }}</strong><small>{{ wallpaper.selected.value.idolName }}</small></div>
    <ArchiveTerminalDialog :open="producerOpen" title="P 名字" title-id="portal-producer-title" @close="producerOpen = false"><ProducerNameSetting /></ArchiveTerminalDialog>
    <ArchiveWallpaperPicker :open="wallpaperOpen" @close="wallpaperOpen = false" />
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import ProducerNameSetting from './ProducerNameSetting.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import { producerName } from '../../utils/LanguageStore.js'
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, Images, Settings2, Sparkles } from '@lucide/vue'
import { ARCHIVE_NAVIGATION } from '../../core/archiveRoute.js'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import ArchiveTerminalBackdrop from './terminal/ArchiveTerminalBackdrop.vue'
import ArchivePreferredIdolSlot from './terminal/ArchivePreferredIdolSlot.vue'
import ArchiveWallpaperPicker from './terminal/ArchiveWallpaperPicker.vue'
import { useTerminalWallpaper } from '../../data/terminal/useTerminalWallpaper.js'
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
import '../../styles/archive-terminal.css'
defineProps({ preferredReference: { type: Object, default: null }, idols: { type: Array, default: () => [] }, canGoBack: Boolean, loadingSection: { type: String, default: '' }, preferenceNotice: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'back', 'settings', 'open-home', 'open-preferred', 'save-preferred'])
const producerOpen = ref(false)
const heading = ref(null), wallpaperOpen = ref(false), wallpaper = useTerminalWallpaper()
const backdropFailed = ref(false)
watch(wallpaper.revision, () => { backdropFailed.value = false })
const preferredActions = [{ id: 'profile', label: '资料' }, { id: 'story', label: '故事' }, { id: 'cards', label: '卡片' }, { id: 'work', label: '工作' }, { id: 'mobile', label: '通信' }]
const appEnglish = { home: 'HOME', stories: 'STORY', songs: 'MUSIC', idols: 'IDOL', cards: 'CARD', gashas: 'GASHA', interactions: 'MOBILE', resources: 'FILES', events:'EVENT', collections:'COLLECTION', photos:'PHOTO', experiments:'LAB' }
onMounted(() => { heading.value?.focus({ preventScroll: true }); if (wallpaper.preferences.value.wallpaperKey) {
  wallpaper.load()
  void loadArchiveNames('cards').catch(error => console.warn('Wallpaper card names unavailable', error))
} })
</script>
