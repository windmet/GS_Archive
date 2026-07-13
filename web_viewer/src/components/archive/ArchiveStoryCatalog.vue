<template>
  <section class="story-catalog">
    <div class="catalog-toolbar">
      <label>
        <span>资料域</span>
        <select :value="domain" @change="emit('update:domain', $event.target.value)">
          <option value="">全部（{{ catalogTotal }}）</option>
          <option v-for="option in domainOptions" :key="option.id" :value="option.id">
            {{ option.label }}（{{ option.count }}）
          </option>
        </select>
      </label>
      <label>
        <span>可用性</span>
        <select :value="availability" @change="emit('update:availability', $event.target.value)">
          <option value="all">全部</option>
          <option value="playable">可播放</option>
          <option value="missing">缺少文件</option>
        </select>
      </label>
      <label>
        <span>排序</span>
        <select :value="sort" @change="emit('update:sort', $event.target.value)">
          <option value="domain">资料域</option>
          <option value="title">标题</option>
          <option value="resource">资源 ID</option>
          <option value="steps_desc">步骤数</option>
        </select>
      </label>
      <span class="catalog-count">{{ filteredTotal }} results</span>
    </div>

    <div class="story-list">
      <p v-if="!entries.length" class="empty-state">没有符合当前条件的故事</p>
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="story-row"
        :class="{ missing: !entry.exists }"
        :disabled="!entry.exists"
        @click="emit('select', entry)"
      >
        <span class="story-play" aria-hidden="true">
          <Play v-if="entry.exists" :size="16" fill="currentColor" />
          <FileWarning v-else :size="18" />
        </span>
        <span class="story-domain">{{ entry.domainLabel }}</span>
        <span class="story-main">
          <strong>{{ entry.title }}</strong>
          <small>{{ entry.resourceId }}</small>
          <small v-if="entry.subtitle" class="story-subtitle">{{ entry.subtitle }}</small>
        </span>
        <span class="story-stats">
          <span>{{ entry.summary?.step_count || 0 }} steps</span>
          <span>{{ entry.summary?.voice_count || 0 }} voices</span>
        </span>
        <span class="story-status">{{ entry.exists ? '可播放' : '缺少文件' }}</span>
      </button>
    </div>

    <button v-if="entries.length < filteredTotal" class="load-more" @click="emit('load-more')">
      <ChevronDown :size="17" />
      <span>显示更多</span>
    </button>
  </section>
</template>

<script setup>
import { ChevronDown, FileWarning, Play } from '@lucide/vue'

defineProps({
  entries: { type: Array, default: () => [] },
  domainOptions: { type: Array, default: () => [] },
  domain: { type: String, default: '' },
  availability: { type: String, default: 'all' },
  sort: { type: String, default: 'domain' },
  catalogTotal: { type: Number, default: 0 },
  filteredTotal: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'load-more', 'update:domain', 'update:availability', 'update:sort'])
</script>

<style scoped>
.story-catalog { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f7f9fa; }
.catalog-toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: end; gap: 10px; min-height: 62px; padding: 9px 16px; border-bottom: 1px solid #dfe4e8; background: #fff; }
.catalog-toolbar label { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
.catalog-toolbar label > span { color: #7b858e; font-size: 0.62rem; }
.catalog-toolbar select { height: 32px; padding: 0 28px 0 9px; border: 1px solid #d7dde2; border-radius: 6px; background: #fff; color: #26313a; font: inherit; font-size: 0.72rem; }
.catalog-count { margin: 0 0 8px auto; color: #7b858e; font-size: 0.68rem; white-space: nowrap; }
.story-list { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; }
.story-row { display: grid; grid-template-columns: 28px 74px minmax(0, 1fr) 92px 58px; align-items: center; gap: 10px; min-height: 72px; width: 100%; padding: 9px 12px; border: 1px solid #e1e6e9; border-radius: 6px; background: #fff; color: #29343d; cursor: pointer; text-align: left; }
.story-row:hover { border-color: #72c9c3; background: #f2fbfa; }
.story-row:disabled { cursor: not-allowed; opacity: 0.72; }
.story-row.missing { border-style: dashed; background: #f3f5f6; }
.story-play { display: grid; place-items: center; color: #15978e; }
.story-row.missing .story-play { color: #8d979e; }
.story-domain { display: inline-flex; align-items: center; justify-content: center; min-height: 24px; padding: 3px 6px; border-radius: 4px; background: #eaf8f6; color: #147f78; font-size: 0.64rem; text-align: center; }
.story-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.story-main strong { overflow: hidden; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.story-main small { overflow-wrap: anywhere; color: #7a858e; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.64rem; }
.story-main .story-subtitle { overflow: hidden; font-family: inherit; text-overflow: ellipsis; white-space: nowrap; }
.story-stats { display: flex; flex-direction: column; gap: 3px; color: #73808a; font-size: 0.64rem; text-align: right; }
.story-status { padding: 3px 6px; border-radius: 4px; background: #eaf8f6; color: #147f78; font-size: 0.62rem; text-align: center; white-space: nowrap; }
.story-row.missing .story-status { background: #e5e9eb; color: #68737b; }
.empty-state { margin: 32px 0; color: #7a858e; font-size: 0.78rem; text-align: center; }
.load-more { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 32px); min-height: 38px; margin: 0 16px 20px; border: 1px solid #d4dcdf; border-radius: 6px; background: #fff; color: #4f5c65; cursor: pointer; font: inherit; font-size: 0.72rem; }
.load-more:hover { border-color: #69c4bd; color: #147f78; }

@media (max-width: 700px) {
  .catalog-toolbar { align-items: stretch; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 8px 10px; }
  .catalog-toolbar label { min-width: 0; }
  .catalog-toolbar label:nth-child(3) { grid-column: 1; }
  .catalog-count { align-self: end; justify-self: end; margin: 0 0 8px; }
  .story-list { padding: 10px; }
  .story-row { grid-template-columns: 24px 64px minmax(0, 1fr); gap: 7px; padding: 9px 8px; }
  .story-stats { grid-column: 3; flex-direction: row; gap: 8px; text-align: left; }
  .story-status { grid-column: 2; grid-row: 2; }
  .load-more { width: calc(100% - 20px); margin: 0 10px 16px; }
}
</style>
