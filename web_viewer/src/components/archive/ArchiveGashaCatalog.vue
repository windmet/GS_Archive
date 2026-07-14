<template>
  <section class="gasha-catalog">
    <div class="catalog-summary">
      <div>
        <strong>{{ gashas.length }}</strong>
        <span>卡池公告</span>
      </div>
      <div>
        <strong>{{ namedCount }}</strong>
        <span>已确认名称</span>
      </div>
      <div>
        <strong>{{ pickupCount }}</strong>
        <span>关联卡片</span>
      </div>
    </div>

    <div class="gasha-grid">
      <button
        v-for="gasha in gashas"
        :key="gasha.id"
        class="gasha-item"
        @click="emit('select', gasha)"
      >
        <span class="banner-frame">
          <img :src="gasha.banner_url" :alt="gasha.display_name" loading="lazy" />
        </span>
        <span class="gasha-copy">
          <span class="gasha-heading">
            <strong>{{ gasha.display_name }}</strong>
            <small :class="{ known: gasha.name_known }">{{ gasha.name_known ? '名称已确认' : '内部编号' }}</small>
          </span>
          <span class="gasha-meta">
            <code>{{ gasha.code }}</code>
            <span>{{ formatDate(gasha.start_at) }}</span>
            <span>{{ gasha.derived_pickup_cards?.length || 0 }} cards</span>
          </span>
        </span>
        <ChevronRight :size="18" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'

const props = defineProps({
  gashas: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const namedCount = computed(() => props.gashas.filter(item => item.name_known).length)
const pickupCount = computed(() => props.gashas.reduce((sum, item) => sum + (item.derived_pickup_cards?.length || 0), 0))

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return 'unknown'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' })
    .format(new Date(timestamp * 1000))
}
</script>

<style scoped>
.gasha-catalog { height: 100%; overflow-y: auto; background: #f6f8f9; }
.catalog-summary { display: flex; gap: 28px; padding: 16px 20px; border-bottom: 1px solid #e3e8eb; background: #fff; }
.catalog-summary div { display: flex; align-items: baseline; gap: 7px; }
.catalog-summary strong { color: #1b7772; font-size: 1rem; font-variant-numeric: tabular-nums; }
.catalog-summary span { color: #758088; font-size: 0.68rem; }
.gasha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; padding: 16px 20px 28px; }
.gasha-item { display: grid; grid-template-columns: 178px minmax(0, 1fr) 20px; align-items: center; gap: 13px; min-width: 0; min-height: 116px; padding: 10px; border: 1px solid #e0e5e8; border-radius: 7px; background: #fff; color: #27343b; cursor: pointer; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; }
.gasha-item:hover { border-color: #85cbc6; box-shadow: 0 3px 12px rgba(35, 73, 78, 0.08); }
.gasha-item > svg { color: #8a969c; }
.banner-frame { display: block; width: 178px; aspect-ratio: 940 / 510; overflow: hidden; border: 1px solid #e6e8e9; border-radius: 4px; background: #eef1f2; }
.banner-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.gasha-copy { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.gasha-heading { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.gasha-heading strong { overflow: hidden; font-size: 0.78rem; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.gasha-heading small { align-self: flex-start; padding: 2px 5px; border-radius: 3px; background: #eef1f3; color: #7b858b; font-size: 0.56rem; }
.gasha-heading small.known { background: #e7f6f4; color: #187b74; }
.gasha-meta { display: flex; flex-wrap: wrap; gap: 5px 10px; color: #7a858c; font-size: 0.62rem; }
.gasha-meta code { color: #5d6a72; font-size: 0.62rem; }
@media (max-width: 700px) {
  .catalog-summary { gap: 16px; padding: 12px; }
  .catalog-summary div { align-items: flex-start; flex-direction: column; gap: 1px; }
  .gasha-grid { grid-template-columns: 1fr; padding: 10px 10px 22px; }
  .gasha-item { grid-template-columns: 126px minmax(0, 1fr) 16px; min-height: 92px; padding: 8px; }
  .banner-frame { width: 126px; }
}
@media (max-width: 430px) {
  .gasha-item { grid-template-columns: minmax(0, 1fr) 18px; }
  .banner-frame { grid-column: 1 / -1; width: 100%; }
  .gasha-heading strong { white-space: normal; }
}
</style>
