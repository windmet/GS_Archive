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
        <p v-if="loadingSection" class="terminal-notice" role="status">{{ loadingSection }}<button v-if="retrySection" class="terminal-text-button" type="button" @click="emit('navigate', retrySection)">重试卡池目录</button></p>
        <p v-if="preferenceNotice || wallpaper.notice.value" class="terminal-notice" role="status">{{ preferenceNotice || wallpaper.notice.value }}</p>
        <p v-if="backdropFailed" class="terminal-notice" role="status">卡面图片未能载入，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择或重试</button></p>
        <p v-if="wallpaper.unavailable.value || wallpaper.error.value" class="terminal-notice" role="status">壁纸暂时不可用，已显示默认背景。<button class="terminal-text-button" type="button" @click="wallpaperOpen = true">重新选择</button></p>
        <button class="portal-workbench" type="button" aria-label="编辑制作人工作台" @click="personalOpen = true">
          <ArchiveIdolAvatar v-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :accent-color="preferredReference.accentColor" :size="42" decorative />
          <span v-else class="portal-workbench-empty"><Users :size="22" aria-hidden="true" /></span>
          <span class="portal-workbench-copy"><strong>{{ producerDisplayName }}</strong><small>{{ preferredReference?.actionable ? `担当：${idolName(preferredReference.idolCode) || preferredReference.displayName}` : '点击选择担当偶像' }}</small></span>
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
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { PRODUCER_NAME_WITH_P_TOKEN } from '../../localization/story/ProducerAddressing.js'
import { computed, onMounted, ref, watch } from 'vue'
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
const props = defineProps({ preferredReference: { type: Object, default: null }, idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' }, idols: { type: Array, default: () => [] }, canGoBack: Boolean, loadingSection: { type: String, default: '' }, retrySection: { type: String, default: '' }, preferenceNotice: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'back', 'settings', 'open-home', 'open-preferred', 'save-preferred'])
const producerDisplayName = computed(() => producerName.value ? presentProducerAddressingText(PRODUCER_NAME_WITH_P_TOKEN) : '未设置制作人')
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
.terminal-portal {--gs-text-portal:26px;}
.terminal-portal .terminal-panel {width:min(860px,100%);min-width:0;padding:var(--gs-space-6) var(--gs-space-7);}
.terminal-portal.has-wallpaper .terminal-panel {width:min(780px,70%);}
.terminal-portal .terminal-brand {font-weight:var(--gs-weight-heavy);}
.terminal-portal .terminal-heading {padding:var(--gs-space-6) 0 var(--gs-space-3);}
.terminal-portal .terminal-heading h1 {font-size:var(--gs-text-portal);font-weight:var(--gs-weight-heavy);margin:var(--gs-space-2) 0;}
.terminal-portal .terminal-kicker {font-size:var(--gs-text-caption);font-weight:var(--gs-weight-semibold);}
.terminal-portal .terminal-signature {padding-top:var(--gs-space-7);font-size:var(--gs-text-caption);font-weight:var(--gs-weight-regular);}
.portal-mobile-settings {display:none;}
.portal-workbench {display:flex;align-items:center;gap:var(--gs-space-4);width:100%;min-height:64px;margin-bottom:var(--gs-space-5);padding:var(--gs-space-3) var(--gs-space-4);border:1px solid #dce8e4;border-radius:var(--gs-radius-panel);background:#f7fbfa;color:#32584f;text-align:left;}
.portal-workbench > .portal-workbench-copy {display:grid;gap:var(--gs-space-2);flex:1;min-width:0;}
.portal-workbench strong {font-size:var(--gs-text-body);font-weight:var(--gs-weight-bold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.portal-workbench small {font-size:var(--gs-text-caption);font-weight:var(--gs-weight-regular);color:#7d9690;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.portal-workbench-empty {display:grid;place-items:center;width:42px;height:42px;border:1px dashed #afcfc3;border-radius:50%;color:#72a894;}
.portal-workbench:active {background:#e8f6f0;}
.portal-sections {display:grid;gap:var(--gs-space-6);}
.portal-section h2 {display:flex;align-items:center;gap:var(--gs-space-3);margin:0 0 var(--gs-space-3);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-bold);color:#496774;}
.portal-section-links {display:grid;gap:var(--gs-space-3);}
.portal-core .portal-section-links {grid-template-columns:repeat(2,minmax(0,1fr));}
.portal-entry {display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;border:1px solid #dbe9e6;background:#fff;color:#244650;text-align:left;}
.portal-core .portal-entry {position:relative;min-height:90px;padding:var(--gs-space-5);border-radius:10px 20px 10px 10px;box-shadow:0 3px 0 #d5ebe5;background:linear-gradient(135deg,#f1fbf7,#fff 75%);}
.portal-core .portal-entry::after {content:'';position:absolute;right:12px;top:10px;width:12px;height:9px;border-radius:4px 4px 0 4px;border:1px solid #badfd4;transform:skew(-10deg);}
.portal-entry-icon {display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:10px;background:#e7f7f0;color:#00a381;}
.portal-entry[data-section=cards] .portal-entry-icon {background:#eff0ff;color:#8270b3;}
.portal-entry[data-section=songs] .portal-entry-icon {background:#e9f5fd;color:#279ac0;}
.portal-entry[data-section=idols] .portal-entry-icon {background:#fff6e7;color:#ae893b;}
.portal-entry-copy {display:grid;gap:var(--gs-space-2);min-width:0;flex:1;}
.portal-entry-copy strong {font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-bold);}
.portal-entry-copy small {font-size:var(--gs-text-caption);font-weight:var(--gs-weight-regular);color:#77909b;line-height:1.4;}
.portal-records .portal-section-links {gap:0;border:1px solid #dce6eb;border-radius:var(--gs-radius-panel);overflow:hidden;}
.portal-records .portal-entry {min-height:48px;padding:var(--gs-space-3) var(--gs-space-4);border:0;}
.portal-records .portal-entry + .portal-entry {border-top:1px solid #edf1f3;}
.portal-records .portal-entry-icon {width:30px;height:30px;background:#f0f7f9;color:#558996;}
.portal-records .portal-entry-copy {display:flex;align-items:center;gap:var(--gs-space-4);}
.portal-records .portal-entry-copy strong {font-size:var(--gs-text-ui);white-space:nowrap;}
.portal-records .portal-entry-copy small {flex:1;text-align:right;font-size:var(--gs-text-caption);}
.portal-records .portal-entry > svg {color:#94a9b1;}
.portal-tools .portal-section-links {grid-template-columns:repeat(3,minmax(0,1fr));}
.portal-tools .portal-entry {justify-content:center;min-height:var(--gs-control-touch);padding:var(--gs-space-2) var(--gs-space-3);gap:var(--gs-space-2);border-radius:var(--gs-radius-control);background:#f8fafb;}
.portal-tools .portal-entry-icon {width:auto;height:auto;background:none;color:#78919e;}
.portal-tools .portal-entry-copy {flex:none;}
.portal-tools .portal-entry-copy strong {font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);white-space:nowrap;}
@media (hover:hover) and (pointer:fine) {
 .portal-entry:hover {border-color:#68bfa9;background:#f1fbf7;}
}
.portal-entry:active {transform:translateY(1px);box-shadow:none;}
@media(max-width:760px) {
 .terminal-portal {--gs-text-portal:23px;}
 .terminal-portal .terminal-scroll {padding:max(var(--gs-space-4),var(--terminal-safe-top)) max(var(--gs-space-4),var(--terminal-safe-right)) var(--gs-space-4) max(var(--gs-space-4),var(--terminal-safe-left));}
 .terminal-portal .terminal-panel,.terminal-portal.has-wallpaper .terminal-panel {width:100%;min-width:0;padding:var(--gs-space-4);border-radius:8px 20px 8px 8px;}
 .terminal-portal .terminal-brand {font-size:15px;}
 .terminal-portal .terminal-brand b {display:none;}
 .terminal-portal .terminal-control-strip {border:0;background:transparent;}
 .terminal-portal .portal-desktop-control {display:none;}
 .terminal-portal .portal-mobile-settings {display:grid;}
 .portal-workbench {margin-bottom:var(--gs-space-5);}
 .terminal-portal .terminal-heading {padding:var(--gs-space-3) 0 var(--gs-space-4);}
 .terminal-portal .terminal-heading .terminal-kicker {display:none;}
 .portal-sections {gap:var(--gs-space-5);}
 .portal-core .portal-entry {min-height:82px;padding:var(--gs-space-3) var(--gs-space-4);gap:var(--gs-space-3);}
 .portal-entry-icon {width:32px;height:36px;}
 .portal-entry-copy strong {font-size:var(--gs-text-subtitle);}
 .portal-entry-copy small {font-size:var(--gs-text-caption);}
 .portal-records .portal-entry-copy small {font-size:var(--gs-text-caption);}
 .portal-records .portal-entry-copy {gap:var(--gs-space-3);}
 .portal-records .portal-entry-copy strong {font-size:var(--gs-text-ui);}
 .portal-tools .portal-entry {padding-inline:var(--gs-space-2);gap:var(--gs-space-2);}
 .portal-tools .portal-entry-copy strong {font-size:var(--gs-text-meta);}
 .terminal-portal .terminal-signature {padding-top:var(--gs-space-4);}
}
</style>
