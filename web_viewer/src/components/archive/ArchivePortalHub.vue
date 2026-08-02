<template>
  <section class="portal-hub" aria-labelledby="portal-hub-title">
    <header class="portal-hero">
      <div>
        <span>APPLICATION HUB</span>
        <h2 id="portal-hub-title">应用启动器</h2>
        <p>把资料馆的各个入口收进一页手机桌面式门户。每个图标都是可深链、可刷新、可使用浏览器 Back 的正式入口。</p>
      </div>
      <div class="portal-hero-mark" aria-hidden="true">
        <LayoutGrid :size="42" stroke-width="1.4" />
      </div>
    </header>

    <nav class="portal-app-grid" aria-label="资料馆应用门户">
      <a
        v-for="app in apps"
        :key="app.id"
        class="portal-app"
        :href="routeHref(app.route)"
        @click.prevent="emit('open', app.route)"
      >
        <span class="portal-app-icon" :class="`tone-${app.tone}`" aria-hidden="true">
          <component :is="app.icon" :size="22" stroke-width="1.8" />
        </span>
        <span class="portal-app-copy">
          <strong>{{ app.label }}</strong>
          <small>{{ app.description }}</small>
        </span>
        <ArrowUpRight :size="16" aria-hidden="true" />
      </a>
    </nav>
  </section>
</template>

<script setup>
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CreditCard,
  Gamepad2,
  Languages,
  LayoutGrid,
  MessageCircle,
  Music2,
  Sparkles,
  UsersRound,
} from '@lucide/vue'
import { buildArchiveUrl } from '../../core/archiveRoute.js'

const emit = defineEmits(['open'])

const apps = [
  {
    id: 'stories',
    label: '故事',
    description: '主线、Extra、生日与活动',
    icon: BookOpen,
    tone: 'teal',
    route: { view: 'story_catalog' },
  },
  {
    id: 'songs',
    label: '歌曲',
    description: '作品、组合与偶像声部',
    icon: Music2,
    tone: 'blue',
    route: { view: 'song_catalog' },
  },
  {
    id: 'idols',
    label: '偶像',
    description: '49 位偶像与组合资料',
    icon: UsersRound,
    tone: 'orange',
    route: { view: 'idols' },
  },
  {
    id: 'cards',
    label: '卡片',
    description: '卡面、语音与剧情关系',
    icon: CreditCard,
    tone: 'pink',
    route: { view: 'cards', idol: '001tom' },
  },
  {
    id: 'gashas',
    label: '卡池',
    description: '公告、Pickup 与关联卡片',
    icon: Sparkles,
    tone: 'purple',
    route: { view: 'gashas' },
  },
  {
    id: 'events',
    label: '活动',
    description: '活动剧情与奖励关系',
    icon: CalendarDays,
    tone: 'yellow',
    route: { view: 'story_catalog', storyType: 'event', storyMode: 'search' },
  },
  {
    id: 'chibi-stage',
    label: 'Chibi Stage',
    description: '歌曲编舞、口型与舞台',
    icon: Gamepad2,
    tone: 'green',
    route: { view: 'chibi_stage' },
  },
  {
    id: 'communications',
    label: '互动',
    description: '个人、电话与组合通信',
    icon: MessageCircle,
    tone: 'cyan',
    route: { view: 'mobile_archive', idol: '001tom', mobileMode: 'personal' },
  },
  {
    id: 'external',
    label: '外部资源',
    description: '社区中文剧情与精确外链',
    icon: Languages,
    tone: 'indigo',
    route: { view: 'external_story_resources' },
  },
  {
    id: 'status',
    label: '资源状态',
    description: '归档清单、校验与工具',
    icon: ChartNoAxesCombined,
    tone: 'slate',
    route: { view: 'archive_status' },
  },
]

function routeHref(route) {
  const base = typeof window === 'undefined' ? 'http://localhost/' : window.location.href
  const url = buildArchiveUrl(base, route)
  return `${url.pathname}${url.search}${url.hash}`
}
</script>

<style scoped>
.portal-hub { min-height: 100%; overflow-y: auto; background: #f5f8f8; color: #23333a; }
.portal-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 34px max(22px, calc((100% - 1040px) / 2));
  background: linear-gradient(125deg, #e8f8f5, #fff 68%);
  border-bottom: 1px solid #d9e8e6;
}
.portal-hero > div:first-child { max-width: 720px; }
.portal-hero span { color: #188b82; font-size: .62rem; font-weight: 850; letter-spacing: .1em; }
.portal-hero h2 { margin: 6px 0 8px; font-size: 1.5rem; }
.portal-hero p { margin: 0; color: #52656d; font-size: .72rem; line-height: 1.75; }
.portal-hero-mark { display: grid; place-items: center; width: 84px; height: 84px; border: 1px solid #a9d9d4; border-radius: 22px; background: rgba(255,255,255,.72); color: #1ca096; transform: rotate(-5deg); }
.portal-app-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; max-width: 1040px; margin: 0 auto; padding: 24px max(22px, calc((100% - 1040px) / 2)) 42px; }
.portal-app {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 11px;
  min-height: 82px;
  padding: 12px 13px;
  border: 1px solid #dce6e7;
  border-radius: 10px;
  background: rgba(255,255,255,.92);
  color: #293b43;
  text-decoration: none;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.portal-app:hover { border-color: #68bdb6; box-shadow: 0 7px 18px rgba(38,86,86,.1); transform: translateY(-1px); }
.portal-app:focus-visible { outline: 3px solid rgba(24,167,157,.34); outline-offset: 2px; }
.portal-app > svg { color: #a2adb1; }
.portal-app-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px; }
.portal-app-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.portal-app-copy strong { font-size: .82rem; }
.portal-app-copy small { overflow: hidden; color: #718087; font-size: .63rem; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.tone-teal { background: #e5f7f4; color: #178f86; }
.tone-blue { background: #eaf1fc; color: #3b68b7; }
.tone-orange { background: #fff0df; color: #b5681a; }
.tone-pink { background: #fdebf1; color: #b95072; }
.tone-purple { background: #f1eafa; color: #8053b1; }
.tone-yellow { background: #fff7dc; color: #a77a12; }
.tone-green { background: #eaf6e7; color: #4c8c43; }
.tone-cyan { background: #e5f6fb; color: #28859c; }
.tone-indigo { background: #ecebfb; color: #5e5aa5; }
.tone-slate { background: #edf1f3; color: #586971; }
@media (max-width: 900px) { .portal-app-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) {
  .portal-hero { align-items: flex-start; padding: 24px 18px; }
  .portal-hero-mark { width: 64px; height: 64px; flex: 0 0 auto; border-radius: 17px; }
  .portal-app-grid { grid-template-columns: 1fr; gap: 8px; padding: 16px 14px 28px; }
  .portal-app { min-height: 76px; }
}
</style>
