<template>
  <section class="external-story-navigation">
    <header class="resource-hero">
      <div>
        <span>COMMUNITY TRANSLATIONS</span>
        <h2>社区中文剧情</h2>
        <p>只收录已经与本地 GROWING STARS 剧情完成精确核对的原始投稿。</p>
      </div>
      <strong>{{ entries.length }} 条精确资源</strong>
    </header>

    <div v-if="entries.length" class="resource-grid">
      <article v-for="entry in entries" :key="entry.id" class="resource-card">
        <div class="resource-visual">
          <img v-if="entry.visualUrl" :src="entry.visualUrl" :alt="entry.title" />
          <BookOpen v-else :size="40" />
          <span>{{ entry.categoryLabel }}</span>
        </div>

        <div class="resource-copy">
          <small>{{ entry.contextLabel }}</small>
          <h3>{{ entry.title }}</h3>
          <dl>
            <div><dt>译制投稿</dt><dd>{{ entry.resource.uploader.name }}</dd></div>
            <div><dt>覆盖范围</dt><dd>{{ coverageLabel(entry.resource.translation.coverage) }}</dd></div>
            <div><dt>平台</dt><dd>Bilibili · {{ entry.resource.platform.bvid }}</dd></div>
          </dl>
        </div>

        <div class="resource-actions">
          <button @click="emit('open-internal', entry)">
            <BookOpen :size="16" />
            <span>在资料馆查看</span>
          </button>
          <a
            :href="entry.resource.platform.canonical_url"
            target="_blank"
            rel="noopener noreferrer external"
          >
            <ExternalLink :size="16" />
            <span>前往观看</span>
          </a>
        </div>
      </article>
    </div>

    <p v-else class="empty-state">当前没有通过精确关系校验的社区中文剧情。</p>

    <footer>
      <ShieldCheck :size="16" />
      <span>链接指向原投稿并显示 uploader；本站不镜像视频、字幕、封面或头像。</span>
    </footer>
  </section>
</template>

<script setup>
import { BookOpen, ExternalLink, ShieldCheck } from '@lucide/vue'

defineProps({ entries: { type: Array, default: () => [] } })
const emit = defineEmits(['open-internal'])

function coverageLabel(coverage) {
  return ({
    'complete-story': '完整剧情',
    'complete-collection': '完整合集',
    partial: '部分覆盖',
    excerpt: '片段',
    unknown: '待确认',
  })[coverage] || coverage
}
</script>

<style scoped>
.external-story-navigation { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f4f7f7; color: #26343c; }
.resource-hero { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 34px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dce5e5; background: linear-gradient(135deg, #e8f7f4 0%, #fff 62%); }
.resource-hero span { color: #168a82; font-size: .61rem; font-weight: 800; letter-spacing: .08em; }
.resource-hero h2 { margin: 5px 0 8px; font-size: 1.5rem; }
.resource-hero p { margin: 0; color: #53646b; font-size: .7rem; line-height: 1.7; }
.resource-hero > strong { flex: none; color: #147970; font-size: .7rem; }
.resource-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 24px max(24px, calc((100% - 1120px) / 2)); }
.resource-card { display: grid; grid-template-columns: 150px minmax(0, 1fr); overflow: hidden; border: 1px solid #d9e2e3; border-radius: 7px; background: #fff; box-shadow: 0 7px 22px rgba(38, 61, 66, .05); }
.resource-visual { position: relative; display: grid; place-items: center; min-height: 145px; overflow: hidden; background: #e8f1f1; color: #16877f; }
.resource-visual img { width: 100%; height: 100%; object-fit: contain; }
.resource-visual > span { position: absolute; left: 8px; bottom: 8px; padding: 4px 7px; border-radius: 3px; background: rgba(28, 49, 53, .82); color: #fff; font-size: .53rem; font-weight: 800; }
.resource-copy { min-width: 0; padding: 16px 16px 10px; }
.resource-copy > small { color: #16877f; font-size: .55rem; font-weight: 700; }
.resource-copy h3 { margin: 5px 0 12px; font-size: .8rem; line-height: 1.45; }
.resource-copy dl { margin: 0; }
.resource-copy dl div { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 7px; padding: 4px 0; font-size: .57rem; }
.resource-copy dt { color: #859298; }.resource-copy dd { overflow-wrap: anywhere; margin: 0; color: #43555d; }
.resource-actions { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #e8eeee; }
.resource-actions button, .resource-actions a { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; border: 0; background: #fff; color: #236d68; cursor: pointer; font: inherit; font-size: .62rem; font-weight: 700; text-decoration: none; }
.resource-actions button { border-right: 1px solid #e8eeee; }
.resource-actions button:hover, .resource-actions a:hover { background: #edf8f6; color: #126f68; }
.empty-state { margin: 40px auto; color: #74858b; text-align: center; }
footer { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 20px 30px; color: #687b80; font-size: .59rem; }
@media (max-width: 840px) { .resource-grid { grid-template-columns: 1fr; }.resource-card { grid-template-columns: 130px minmax(0, 1fr); } }
@media (max-width: 520px) { .resource-hero { align-items: start; flex-direction: column; padding: 24px 14px; }.resource-grid { padding: 14px 10px; }.resource-card { grid-template-columns: 105px minmax(0, 1fr); }.resource-copy { padding: 12px 11px 8px; }.resource-copy h3 { font-size: .72rem; }.resource-copy dl div { grid-template-columns: 52px minmax(0, 1fr); } }
</style>
