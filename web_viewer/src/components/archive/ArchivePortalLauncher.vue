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
            <button class="terminal-icon-button terminal-labelled-control portal-desktop-control" type="button" aria-label="打开首页" title="首页" @click="emit('open-home')"><Sparkles :size="19" /><span>首页</span></button>
            <button class="terminal-icon-button terminal-labelled-control portal-desktop-control" type="button" aria-label="更换 SSR 卡面壁纸" title="SSR 卡面壁纸" @click="wallpaperOpen = true"><Images :size="19" /><span>壁纸</span></button>
            <button class="terminal-icon-button terminal-labelled-control portal-desktop-control" type="button" aria-label="启动设置" title="启动设置" @click="emit('settings')"><Settings2 :size="19" /><span>设置</span></button>
            <button class="terminal-icon-button portal-mobile-settings" type="button" aria-label="资料馆设置" @click="settingsOpen = true"><Settings2 :size="20" /></button>
          </div>
        </header>
        <div class="terminal-heading"><span class="terminal-kicker">GROWING STARS</span><h1 id="portal-title" tabindex="-1" ref="heading">资料馆</h1></div>
        <p v-if="loadingSection" class="terminal-notice" role="status">{{ loadingSection }}</p>
        <p v-if="preferenceNotice || wallpaper.notice.value" class="terminal-notice" role="status">{{ preferenceNotice || wallpaper.notice.value }}</p>
        <p v-if="backdropFailed" class="terminal-notice" role="status">卡面图片未能载入，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择或重试</button></p>
        <p v-if="wallpaper.unavailable.value || wallpaper.error.value" class="terminal-notice" role="status">壁纸暂时不可用，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择</button></p>
        <button class="portal-workbench" type="button" aria-label="编辑制作人工作台" @click="personalOpen = true">
          <ArchiveIdolAvatar v-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :accent-color="preferredReference.accentColor" :size="42" decorative />
          <span v-else class="portal-workbench-empty"><Users :size="22" aria-hidden="true" /></span>
          <span><strong>{{ producerName || '未设置制作人' }}</strong><small>{{ preferredReference?.actionable ? `担当：${idolName(preferredReference.idolCode) || preferredReference.displayName}` : '点击选择担当偶像' }}</small></span>
          <ChevronRight :size="17" aria-hidden="true" />
        </button>
        <nav class="portal-sections" aria-label="全部门户入口">
          <section v-for="group in ARCHIVE_NAVIGATION_GROUPS" :key="group.id" class="portal-section" :class="`portal-${group.id}`" :aria-labelledby="`portal-${group.id}`">
            <h2 :id="`portal-${group.id}`">{{ group.label }}</h2>
            <div class="portal-section-links">
              <button v-for="item in group.items" :key="item.id" class="portal-entry" type="button" :data-section="item.id" @click="emit('navigate', item.id)">
                <span class="portal-entry-icon"><component :is="archiveNavigationIcons[item.id]" :size="group.id === 'core' ? 24 : 18" :stroke-width="1.8" aria-hidden="true" /></span>
                <span class="portal-entry-copy"><strong>{{ item.label }}</strong><small v-if="group.id !== 'tools'">{{ entryDescription(item.id) }}</small></span>
                <ChevronRight v-if="group.id === 'records'" :size="16" aria-hidden="true" />
              </button>
            </div>
          </section>
        </nav>
        <footer class="terminal-signature">SideM Archive · 非官方资料存档</footer>
      </div>
    </div>
    <div v-if="wallpaper.selected.value && !backdropFailed" class="terminal-art-caption" aria-hidden="true"><span>SSR</span><strong>{{ archiveNamedText('card', wallpaper.selected.value.label, 'title') }}</strong><small>{{ wallpaper.selected.value.idolName }}</small></div>
    <ArchiveTerminalDialog :open="personalOpen" title="我的工作台" title-id="portal-personal-title" @close="personalOpen = false">
      <ProducerNameSetting />
      <section class="terminal-personal" aria-label="我的偶像快捷入口">
        <ArchivePreferredIdolSlot :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :value="preferredReference?.idolCode || ''" id-prefix="portal" @save="emit('save-preferred', $event)" />
        <nav v-if="preferredReference?.actionable" class="terminal-preferred-actions" aria-label="我的偶像快捷入口">
          <button v-for="action in preferredActions" :key="action.id" type="button" @click="personalOpen = false; emit('open-preferred', action.id)">{{ action.label }}</button>
        </nav>
      </section>
    </ArchiveTerminalDialog>
    <ArchiveTerminalDialog :open="settingsOpen" title="资料馆设置" title-id="portal-settings-title" @close="settingsOpen = false">
      <button class="terminal-text-button" type="button" @click="settingsOpen = false; wallpaperOpen = true"><Images :size="18" />更换 SSR 卡面壁纸</button>
      <button class="terminal-text-button" type="button" @click="settingsOpen = false; emit('settings')"><Settings2 :size="18" />启动设置</button>
    </ArchiveTerminalDialog>
    <ArchiveWallpaperPicker :open="wallpaperOpen" @close="wallpaperOpen = false" />
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import ProducerNameSetting from './ProducerNameSetting.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import { producerName } from '../../utils/LanguageStore.js'
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronRight, Images, Settings2, Sparkles, Users } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { ARCHIVE_NAVIGATION_GROUPS } from '../../core/archiveNavigationGroups.js'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import ArchiveTerminalBackdrop from './terminal/ArchiveTerminalBackdrop.vue'
import ArchivePreferredIdolSlot from './terminal/ArchivePreferredIdolSlot.vue'
import ArchiveWallpaperPicker from './terminal/ArchiveWallpaperPicker.vue'
import { useTerminalWallpaper } from '../../data/terminal/useTerminalWallpaper.js'
import { archiveNamedText, loadArchiveNames } from './useArchiveNamedText.js'
import '../../styles/archive-terminal.css'
const props = defineProps({ preferredReference: { type: Object, default: null }, idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' }, idols: { type: Array, default: () => [] }, canGoBack: Boolean, loadingSection: { type: String, default: '' }, preferenceNotice: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'back', 'settings', 'open-home', 'open-preferred', 'save-preferred'])
const personalOpen = ref(false), settingsOpen = ref(false)
const heading = ref(null), wallpaperOpen = ref(false), wallpaper = useTerminalWallpaper()
const backdropFailed = ref(false)
watch(wallpaper.revision, () => { backdropFailed.value = false })
const preferredActions = [{ id: 'profile', label: '资料' }, { id: 'story', label: '故事' }, { id: 'cards', label: '卡片' }, { id: 'work', label: '工作' }, { id: 'mobile', label: '通信' }]
function entryDescription(id) {
  if (id === 'idols') return `${props.idols.length} 位偶像 · ${new Set(props.idols.map(idol => idol.unitId).filter(Boolean)).size} 个组合`
  return { stories: '主线 · 活动 · 前传', cards: '卡面 · 语音 · 剧情', songs: '演唱成员 · 歌曲试听', gashas: '招募档案 · 卡片关联', events: '活动时间线 · 报酬', interactions: '短信 · 通话 · Connect', collections: '道具 · 称号' }[id] || ''
}
onMounted(() => { heading.value?.focus({ preventScroll: true }); if (wallpaper.preferences.value.wallpaperKey) {
  wallpaper.load()
  void loadArchiveNames('cards').catch(error => console.warn('Wallpaper card names unavailable', error))
} })
</script>

<style scoped>
.terminal-portal .terminal-panel {width:min(860px,100%);min-width:0;padding:20px 24px;}
.terminal-portal.has-wallpaper .terminal-panel {width:min(780px,70%);}
.terminal-portal .terminal-heading {padding:18px 0 10px;}
.terminal-portal .terminal-heading h1 {font-size:26px;margin:4px 0;}
.portal-mobile-settings {display:none;}
.portal-workbench {display:flex;align-items:center;gap:10px;width:100%;min-height:64px;margin-bottom:16px;padding:8px 12px;border:1px solid #dce8e4;border-radius:10px;background:#f7fbfa;color:#32584f;text-align:left;}
.portal-workbench > span:not(.portal-workbench-empty) {display:grid;gap:4px;flex:1;min-width:0;}
.portal-workbench strong {font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.portal-workbench small {font-size:11px;color:#7d9690;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.portal-workbench-empty {display:grid;place-items:center;width:42px;height:42px;border:1px dashed #afcfc3;border-radius:50%;color:#72a894;}
.portal-sections {display:grid;gap:20px;}
.portal-section h2 {display:flex;align-items:center;gap:9px;margin:0 0 9px;font-size:13px;color:#496774;}
.portal-section-links {display:grid;gap:8px;}
.portal-core .portal-section-links {grid-template-columns:repeat(2,minmax(0,1fr));}
.portal-entry {display:flex;align-items:center;gap:12px;min-width:0;border:1px solid #dbe9e6;background:#fff;color:#244650;text-align:left;}
.portal-core .portal-entry {position:relative;min-height:90px;padding:15px;border-radius:10px 20px 10px 10px;box-shadow:0 3px 0 #d5ebe5;background:linear-gradient(135deg,#f1fbf7,#fff 75%);}
.portal-core .portal-entry::after {content:'';position:absolute;right:12px;top:10px;width:12px;height:9px;border-radius:4px 4px 0 4px;border:1px solid #badfd4;transform:skew(-10deg);}
.portal-entry-icon {display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:10px;background:#e7f7f0;color:#00a381;}
.portal-entry[data-section=cards] .portal-entry-icon {background:#eff0ff;color:#8270b3;}
.portal-entry[data-section=songs] .portal-entry-icon {background:#e9f5fd;color:#279ac0;}
.portal-entry[data-section=idols] .portal-entry-icon {background:#fff6e7;color:#ae893b;}
.portal-entry-copy {display:grid;gap:5px;min-width:0;flex:1;}
.portal-entry-copy strong {font-size:16px;}
.portal-entry-copy small {font-size:11px;color:#77909b;line-height:1.4;}
.portal-records .portal-section-links {gap:0;border:1px solid #dce6eb;border-radius:10px;overflow:hidden;}
.portal-records .portal-entry {min-height:48px;padding:6px 12px;border:0;}
.portal-records .portal-entry + .portal-entry {border-top:1px solid #edf1f3;}
.portal-records .portal-entry-icon {width:30px;height:30px;background:#f0f7f9;color:#558996;}
.portal-records .portal-entry-copy {display:flex;align-items:center;gap:12px;}
.portal-records .portal-entry-copy strong {font-size:13px;white-space:nowrap;}
.portal-records .portal-entry-copy small {flex:1;text-align:right;font-size:11px;}
.portal-records .portal-entry > svg {color:#94a9b1;}
.portal-tools .portal-section-links {grid-template-columns:repeat(3,minmax(0,1fr));}
.portal-tools .portal-entry {justify-content:center;min-height:44px;padding:5px 8px;gap:6px;border-radius:7px;background:#f8fafb;}
.portal-tools .portal-entry-icon {width:auto;height:auto;background:none;color:#78919e;}
.portal-tools .portal-entry-copy {flex:none;}
.portal-tools .portal-entry-copy strong {font-size:12px;white-space:nowrap;}
.portal-entry:hover {border-color:#68bfa9;background:#f1fbf7;}
.portal-entry:active {transform:translateY(1px);box-shadow:none;}
@media(max-width:760px) {
 .terminal-portal .terminal-scroll {padding:10px;}
 .terminal-portal .terminal-panel,.terminal-portal.has-wallpaper .terminal-panel {width:100%;min-width:0;padding:12px 14px;border-radius:8px 20px 8px 8px;}
 .terminal-portal .terminal-brand {font-size:15px;}
 .terminal-portal .terminal-brand b {display:none;}
 .terminal-portal .terminal-control-strip {border:0;background:transparent;}
 .terminal-portal .portal-desktop-control {display:none;}
 .terminal-portal .portal-mobile-settings {display:grid;}
 .portal-workbench {margin-bottom:14px;}
 .terminal-portal .terminal-heading {padding:10px 0 14px;}
 .terminal-portal .terminal-heading h1 {font-size:23px;}
 .terminal-portal .terminal-heading .terminal-kicker {display:none;}
 .portal-sections {gap:16px;}
 .portal-core .portal-entry {min-height:82px;padding:10px;gap:9px;}
 .portal-entry-icon {width:32px;height:36px;}
 .portal-entry-copy strong {font-size:15px;}
 .portal-entry-copy small {font-size:10px;}
 .portal-records .portal-entry-copy small {font-size:10px;}
 .portal-records .portal-entry-copy {gap:6px;}
 .portal-tools .portal-entry {padding-inline:5px;gap:4px;}
 .portal-tools .portal-entry-copy strong {font-size:11px;}
 .terminal-portal .terminal-signature {padding-top:10px;}
}
</style>
