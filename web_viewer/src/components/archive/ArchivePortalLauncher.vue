<template>
  <section class="portal-launcher" aria-labelledby="portal-title" :style="{ '--portal-background': `url(${getPortalBackgroundUrl()})` }">
    <header class="portal-header">
      <button class="portal-back" @click="emit('back')"><ArrowLeft :size="17" /><span>返回</span></button>
      <div class="portal-header-actions">
        <button class="portal-action" @click="emit('open-home')"><Sparkles :size="16" /><span>游戏风首页</span></button>
        <button class="portal-action" @click="emit('settings')"><Settings2 :size="16" /><span>启动设置</span></button>
      </div>
    </header>
    <div class="portal-body">
      <div class="portal-heading">
        <h1 id="portal-title" tabindex="-1" ref="heading">我的资料馆</h1>
        <p>从这里，打开每一份收藏</p>
      </div>
      <section v-if="preferredIdol" class="preferred-panel" aria-labelledby="preferred-title">
        <img :src="idolIcon(preferredIdol.id)" :alt="preferredIdol.name" />
        <div class="preferred-copy">
          <span>我的偶像</span>
          <h2 id="preferred-title">{{ preferredIdol.name }}</h2>
          <small>{{ preferredIdol.unitName || '315 STARS' }}</small>
        </div>
        <nav aria-label="我的偶像快捷入口">
          <button v-for="item in preferredActions" :key="item.id" @click="emit('open-preferred', item.id)">{{ item.label }}</button>
        </nav>
      </section>
      <nav class="portal-apps" aria-label="全部门户入口">
        <button v-for="item in ARCHIVE_NAVIGATION" :key="item.id" class="portal-app" :data-section="item.id" @click="emit('navigate', item.id)">
          <span class="portal-icon"><component :is="archiveNavigationIcons[item.id]" :size="38" :stroke-width="1.65" aria-hidden="true" /></span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <footer class="portal-signature"><span>SideM Archive</span><span>GROWING STARS</span></footer>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ArrowLeft, Settings2, Sparkles } from '@lucide/vue'
import { ARCHIVE_NAVIGATION } from '../../core/archiveRoute.js'
import { getPortalBackgroundUrl } from '../../utils/AssetResolver.js'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'

defineProps({
  preferredIdol: { type: Object, default: null },
})
const emit = defineEmits(['navigate', 'back', 'settings', 'open-home', 'open-preferred'])
const heading = ref(null)
const preferredActions = [
  { id: 'profile', label: '资料' },
  { id: 'story', label: '个人故事' },
  { id: 'cards', label: '卡片' },
  { id: 'work', label: 'Work' },
  { id: 'mobile', label: '通信' },
]
function idolIcon(idolCode) { return `/assets/idols/icons/image_chara_icon_${idolCode}.png` }
onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<style scoped>
.portal-launcher {
  --portal-ink: #123d4b;
  --portal-muted: #618895;
  height: 100%; display: flex; flex-direction: column; overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: #c9d1de transparent;
  color: var(--portal-ink);
  background-color: #eceff7;
  background-image: var(--portal-background);
  background-size: min(100%, 560px) auto;
  background-repeat: no-repeat;
  background-position: center bottom;
  font-family: Inter, "Noto Sans SC", "Noto Sans JP", system-ui, sans-serif;
}
.portal-header { width: 100%; flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 44px 22px 0; max-width: 680px; margin: 0 auto; }
.portal-back { display: inline-flex; gap: 5px; align-items: center; justify-content: center; min-height: 44px; padding: 0 13px; border: 1px solid #cde7eb; border-radius: 24px; background: transparent; color: inherit; font: inherit; font-size: 14px; cursor: pointer; }
.portal-header-actions { display: flex; gap: 8px; }.portal-action { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; padding: 0 11px; border: 0; border-radius: 22px; background: rgba(255,255,255,.58); color: inherit; cursor: pointer; font: inherit; font-size: 12px; }
.portal-body { width: 100%; max-width: 560px; margin: 0 auto; flex: 1 0 auto; display: flex; flex-direction: column; padding: 32px 25px 30px; box-sizing: border-box; }
.portal-heading h1 { margin: 0; font-size: 34px; line-height: 1.3; letter-spacing: -.8px; font-weight: 800; outline: none; }
.portal-heading p { margin: 8px 0 0; font-size: 16px; line-height: 1.6; color: var(--portal-muted); letter-spacing: .6px; }
.preferred-panel { display: grid; grid-template-columns: 58px minmax(0,1fr); gap: 10px 13px; align-items: center; margin-top: 25px; padding: 14px; border: 1px solid #cde3e3; border-radius: 18px; background: rgba(255,255,255,.72); }.preferred-panel > img { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; }.preferred-copy { min-width: 0; }.preferred-copy span,.preferred-copy small { color: var(--portal-muted); font-size: 11px; }.preferred-copy h2 { margin: 2px 0; overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }.preferred-panel nav { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }.preferred-panel nav button { min-height: 36px; padding: 0 11px; border: 1px solid #cae0e0; border-radius: 18px; background: #fff; color: #175359; cursor: pointer; font: inherit; font-size: 12px; }
.portal-apps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 26px 20px; margin-top: 32px; }
.portal-app { display: flex; align-items: center; flex-direction: column; gap: 10px; padding: 0; min-width: 0; border: 0; border-radius: 20px; background: none; color: inherit; font: inherit; font-size: 16px; line-height: 1.4; font-weight: 600; cursor: pointer; }
.portal-icon { display: grid; place-items: center; width: min(100%, 86px); aspect-ratio: 1; border-radius: 23px; background: #d4f5ef; color: #175359; transition: transform 160ms ease, box-shadow 160ms ease; }
.portal-app[data-section="stories"] .portal-icon { background: #d8f0fd; color: #1d5477; }
.portal-app[data-section="songs"] .portal-icon { background: #e9e3fc; color: #554381; }
.portal-app[data-section="idols"] .portal-icon { background: #fbf4de; color: #244f5a; }
.portal-app[data-section="cards"] .portal-icon { background: #fce5ef; color: #963c68; }
.portal-app[data-section="gashas"] .portal-icon { background: #dceeff; color: #315f98; }
.portal-app[data-section="resources"] .portal-icon { background: #e0ebf0; color: #486779; }
.portal-app:hover .portal-icon { transform: translateY(-3px); box-shadow: 0 6px 15px #123d4b0d; }
.portal-app:active .portal-icon { transform: scale(.96); }
.portal-back:focus-visible, .portal-action:focus-visible, .portal-app:focus-visible, .preferred-panel button:focus-visible { outline: 3px solid #168f98; outline-offset: 4px; }
.portal-signature { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: auto; padding-top: 36px; color: var(--portal-muted); font-size: 11px; letter-spacing: 1px; }
.portal-signature span:last-child { font-size: 10px; letter-spacing: 2.8px; }
@media (max-width: 520px) { .portal-header { align-items: flex-start; padding: 24px 14px 0; }.portal-header-actions { align-items: flex-end; flex-direction: column; }.portal-action { min-height: 36px; }.portal-body { padding: 25px 16px 24px; }.portal-heading h1 { font-size: 30px; }.portal-heading p { font-size: 14px; }.portal-apps { gap: 24px 12px; margin-top: 28px; }.portal-app { font-size: 14px; }.portal-icon { border-radius: 20px; } }
@media (min-width: 761px) { .portal-header { padding-top: 32px; } .portal-body { padding-top: 34px; } }
@media (prefers-reduced-motion: reduce) { .portal-icon { transition: none; } }
</style>
