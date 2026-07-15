<template>
  <main class="screen home-screen" :class="{ embedded }">
    <section class="archive-summary" aria-label="资料库概览">
      <div>
        <p class="summary-kicker">SIDE M ARCHIVE</p>
        <h2>资料索引</h2>
        <p class="summary-copy">故事、偶像、卡片与通讯资料统一入口</p>
        <p v-if="manifest" class="summary-meta">
          {{ formatCount(manifest.counts?.backgrounds) }} BG ·
          {{ formatCount(manifest.counts?.spine_models) }} Spine ·
          updated {{ formatDate(manifest.data_updated_at) }}
        </p>
      </div>
      <dl class="summary-stats">
        <div v-for="stat in stats" :key="stat.label">
          <dt>{{ stat.label }}</dt>
          <dd>{{ formatCount(stat.value) }}</dd>
        </div>
      </dl>
    </section>

    <section class="archive-domains" aria-labelledby="archive-domain-title">
      <div class="section-heading">
        <h3 id="archive-domain-title">资料分类</h3>
        <span>{{ totalFiles }} scenarios indexed</span>
      </div>
      <div class="category-grid">
        <button
          v-for="category in categories"
          :key="category.id"
          class="cat-btn"
          @click="emit('select', category.id)"
        >
          <span class="cat-icon" aria-hidden="true">
            <component :is="categoryIcon(category.id)" :size="21" :stroke-width="1.8" />
          </span>
          <span class="cat-text">
            <strong>{{ category.name }}</strong>
            <small>{{ category.count }}</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
        <button class="cat-btn status-btn" @click="emit('open-status')">
          <span class="cat-icon" aria-hidden="true"><Database :size="21" :stroke-width="1.8" /></span>
          <span class="cat-text">
            <strong>数据状态</strong>
            <small>覆盖率与缺失资源</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
        <button class="cat-btn lab-btn" @click="emit('open-spine-lab')">
          <span class="cat-icon" aria-hidden="true">
            <ScanSearch :size="21" :stroke-width="1.8" />
          </span>
          <span class="cat-text">
            <strong>Spine 实验室</strong>
            <small>自由预览</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
        <button class="cat-btn lab-btn" @click="emit('open-chibi-stage')">
          <span class="cat-icon" aria-hidden="true">
            <UsersRound :size="21" :stroke-width="1.8" />
          </span>
          <span class="cat-text">
            <strong>多人舞台</strong>
            <small>1–5 人歌曲编排</small>
          </span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
import {
  BookOpenText,
  ChevronRight,
  Database,
  Images,
  MessageSquareText,
  Phone,
  ScanSearch,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from '@lucide/vue'

defineProps({
  totalFiles: { type: Number, default: 0 },
  categories: { type: Array, default: () => [] },
  stats: { type: Array, default: () => [] },
  manifest: { type: Object, default: null },
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'open-spine-lab', 'open-chibi-stage', 'open-status'])

const icons = {
  main_story: BookOpenText,
  event: Sparkles,
  idol: UserRound,
  idol_chat: MessageSquareText,
  idol_phone: Phone,
  cards: Images,
  episode_zero: Star,
  extra: BookOpenText,
}

function categoryIcon(id) {
  return icons[id] || BookOpenText
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatDate(value) {
  if (!value) return 'unknown'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.home-screen {
  min-height: 100%;
  padding: 24px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #f7f9fa;
}
.archive-summary {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(420px, 1.4fr);
  align-items: center;
  gap: 32px;
  min-height: 156px;
  padding: 26px 30px;
  border-bottom: 3px solid #28b6ac;
  background: #17212b;
  color: #fff;
}
.summary-kicker { margin: 0 0 7px; color: #56d0c7; font-size: 0.68rem; font-weight: 800; }
.archive-summary h2 { margin: 0; font-size: 1.55rem; letter-spacing: 0; }
.summary-copy { margin: 7px 0 0; color: #aeb9c2; font-size: 0.78rem; }
.summary-meta { margin: 13px 0 0; color: #6f828f; font-size: 0.66rem; }
.summary-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.summary-stats div { min-width: 0; padding: 7px 18px; border-left: 1px solid #34414c; }
.summary-stats dt { color: #98a6b1; font-size: 0.66rem; white-space: nowrap; }
.summary-stats dd { margin: 5px 0 0; font-size: 1.22rem; font-weight: 750; }
.archive-domains { padding-top: 24px; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.section-heading h3 { margin: 0; font-size: 0.92rem; }
.section-heading span { color: #7a858e; font-size: 0.7rem; }
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.cat-btn {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid #dfe4e8;
  border-radius: 6px;
  background: #fff;
  color: #26313a;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.cat-btn:hover { border-color: #7bcfc9; background: #f0fbfa; }
.cat-btn > svg { color: #9aa4ad; }
.cat-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: #eaf8f6;
  color: #158f87;
}
.cat-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cat-text strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.cat-text small { color: #7a858e; font-size: 0.67rem; }
.lab-btn .cat-icon { background: #edf1f5; color: #566471; }

@media (max-width: 980px) {
  .archive-summary { grid-template-columns: 1fr; gap: 20px; }
  .summary-stats div:first-child { border-left: 0; padding-left: 0; }
  .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .home-screen { padding: 12px; }
  .archive-summary { min-height: 0; padding: 20px; }
  .summary-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 0; }
  .summary-stats div:nth-child(3) { border-left: 0; padding-left: 0; }
  .summary-stats dt { white-space: normal; }
  .category-grid { grid-template-columns: 1fr; }
  .section-heading { align-items: flex-end; }
}
</style>
