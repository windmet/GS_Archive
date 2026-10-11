<template>
  <section class="archive-portal" :style="idolTheme" aria-labelledby="portal-title">
    <ArchiveTerminalBackdrop v-if="wallpaper.selected.value && !backdropFailed" :key="wallpaper.revision.value" class="archive-portal-backdrop" :wallpaper="wallpaper.selected.value" landscape-only @error="backdropFailed = true" />
    <ArchivePortalOverview ref="overview" :can-go-back="canGoBack" :producer-display-name="producerDisplayName" :preferred-reference="viewReference"
      :saved-idol-code="preferredReference?.idolCode || ''" :idols="idols" :idol-search="idolSearch" :idol-name="idolName"
      :preferred-actions="preferredActions" :desktop-overview="desktopOverview" :global-search="globalSearch"
      @back="emit('back')" @open-home="emit('open-home', $event)" @navigate="emit('navigate', $event)" @edit-personal="emit('settings')"
      @open-preferred="emit('open-preferred', $event)" @search="emit('search', $event)" @open-directory="emit('open-directory', $event)"
      @open-result="emit('open-result', $event)" @open-stage="emit('open-stage', $event)" @retry-overview="emit('retry-overview')"
      @select-scope="emit('select-scope', $event)" @save-preferred="emit('save-preferred', $event)" @expand-cards="emit('expand-cards')">
      <template #toolbar>
        <ArchiveLanguageSwitch dropdown />
        <button class="portal-control" type="button" aria-label="更换 SSR 卡面壁纸" title="SSR 卡面壁纸" data-archive-focus-id="portal-wallpaper" @click="wallpaperOpen = true"><Images :size="18" aria-hidden="true" /></button>
        <button class="portal-control" type="button" aria-label="制作人设置" title="制作人设置" data-archive-focus-id="portal-settings" @click="emit('settings')"><Settings2 :size="18" aria-hidden="true" /></button>
      </template>
      <template #notices>
        <p v-if="loadingSection" class="portal-notice" role="status">{{ loadingSection }}<button v-if="retrySection" type="button" @click="emit('navigate', retrySection)">重试</button></p>
        <p v-if="preferenceNotice || wallpaper.notice.value" class="portal-notice" role="status">{{ preferenceNotice || wallpaper.notice.value }}</p>
        <p v-if="backdropFailed || wallpaper.unavailable.value || wallpaper.error.value" class="portal-notice" role="status">壁纸暂时无法显示，已使用默认背景。<button type="button" @click="wallpaperOpen = true">重新选择</button></p>
      </template>
    </ArchivePortalOverview>
    <ArchiveWallpaperPicker :open="wallpaperOpen" :idols="idols" :idol-name="idolName" :idol-search="idolSearch" @close="wallpaperOpen = false" />
  </section>
</template>

<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import ArchivePortalOverview from './ArchivePortalOverview.vue'
import ArchiveTerminalBackdrop from './terminal/ArchiveTerminalBackdrop.vue'
import ArchiveWallpaperPicker from './terminal/ArchiveWallpaperPicker.vue'
import { producerName } from '../../utils/LanguageStore.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { PRODUCER_NAME_WITH_P_TOKEN } from '../../localization/story/ProducerAddressing.js'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'
import { useTerminalWallpaper } from '../../data/terminal/useTerminalWallpaper.js'
import { loadArchiveNames } from './useArchiveNamedText.js'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Images, Settings2 } from '@lucide/vue'

const props = defineProps({
  viewReference: { type: Object, default: null }, preferredReference: { type: Object, default: null },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  idols: { type: Array, default: () => [] }, canGoBack: Boolean,
  loadingSection: { type: String, default: '' }, retrySection: { type: String, default: '' }, preferenceNotice: { type: String, default: '' },
  desktopOverview: { type: Object, default: () => ({}) }, globalSearch: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['navigate', 'back', 'settings', 'open-home', 'open-preferred', 'save-preferred', 'search', 'open-result', 'open-directory', 'open-stage', 'retry-overview', 'select-scope', 'expand-cards'])

const overview = ref(null), wallpaperOpen = ref(false), backdropFailed = ref(false)
const wallpaper = useTerminalWallpaper()
watch(wallpaper.revision, () => { backdropFailed.value = false })
// The idol lens tints the portal only while it is about that idol; the whole archive stays mint.
const idolTheme = computed(() => props.viewReference?.actionable && normalizeIdolAccentColor(props.viewReference.accentColor)
  ? { '--portal-idol-color': normalizeIdolAccentColor(props.viewReference.accentColor) } : null)
const producerDisplayName = computed(() => producerName.value ? presentProducerAddressingText(PRODUCER_NAME_WITH_P_TOKEN) : '未设置制作人')
const preferredActions = [{ id: 'profile', label: '资料' }, { id: 'story', label: '故事' }, { id: 'cards', label: '卡片' }, { id: 'work', label: '工作' }, { id: 'mobile', label: '通信' }]

onMounted(async () => {
  await nextTick()
  overview.value?.focusHeading()
  if (wallpaper.preferences.value.wallpaperKey) {
    wallpaper.load()
    void loadArchiveNames('cards').catch(error => console.warn('Wallpaper card names unavailable', error))
  }
})
</script>

<style scoped>
.archive-portal { position: relative; height: 100%; min-height: 0; overflow: hidden; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
/* A chosen SSR wallpaper is a quiet cover image behind the top of the page, never a full backdrop. */
.archive-portal-backdrop { position: absolute; inset: 0 0 auto; z-index: 0; height: 360px; opacity: .35; pointer-events: none; -webkit-mask-image: linear-gradient(#000 30%, transparent); mask-image: linear-gradient(#000 30%, transparent); }
.archive-portal-backdrop :deep(picture) { display: block; height: 100%; }
.archive-portal-backdrop :deep(img) { display: block; width: 100%; height: 100%; object-fit: cover; object-position: var(--art-position-wide, 50% 30%); }
.portal-control { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); cursor: pointer; }
.portal-control:hover { background: var(--gs-mint-wash); color: var(--gs-ink); }
.portal-control:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.portal-notice { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); margin: 0 0 var(--gs-space-4); color: var(--gs-ink-2); font-size: var(--gs-text-body); }
.portal-notice button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
</style>
