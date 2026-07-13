<template>
  <section class="unit-catalog">
    <div class="unit-grid">
      <button v-for="entry in entries" :key="entry.unit.unit_code" class="unit-entry" @click="emit('select', entry.unit)">
        <img :src="getBgUrl(entry.unit.representative_bg)" :alt="entry.unit.unit_name" loading="lazy" />
        <span class="unit-color" :style="{ backgroundColor: entry.unit.unit_color || '#23a99f' }"></span>
        <span class="unit-copy">
          <strong>{{ entry.unit.unit_name }}</strong>
          <small>{{ entry.members.length }} members · {{ entry.storyCount }} stories</small>
        </span>
        <span class="member-stack" aria-hidden="true">
          <img
            v-for="member in entry.members.slice(0, 5)"
            :key="member.idol_code"
            :src="`/assets/idols/icons/image_chara_icon_${member.idol_code}.png`"
            alt=""
            loading="lazy"
          />
        </span>
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight } from '@lucide/vue'
import { getBgUrl } from '../../utils/AssetResolver.js'

defineProps({ entries: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
</script>

<style scoped>
.unit-catalog { height: 100%; overflow-y: auto; background: #f7f9fa; }
.unit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 16px; }
.unit-entry { position: relative; display: grid; grid-template-columns: 94px 5px minmax(0, 1fr) auto auto; align-items: center; gap: 11px; min-height: 96px; padding: 0 14px 0 0; overflow: hidden; border: 1px solid #dfe4e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.unit-entry:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-entry > img { width: 94px; height: 94px; object-fit: cover; }
.unit-color { width: 5px; height: 56px; border-radius: 3px; }
.unit-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.unit-copy strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-copy small { color: #78838c; font-size: 0.66rem; }
.member-stack { display: flex; padding-left: 8px; }
.member-stack img { width: 30px; height: 30px; margin-left: -8px; border: 2px solid #fff; border-radius: 50%; background: #eef1f3; object-fit: cover; }
.unit-entry > svg { color: #9aa4ab; }

@media (max-width: 850px) {
  .unit-grid { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .unit-grid { gap: 8px; padding: 10px; }
  .unit-entry { grid-template-columns: 72px 4px minmax(0, 1fr) auto; min-height: 74px; padding-right: 9px; }
  .unit-entry > img { width: 72px; height: 72px; }
  .unit-color { height: 44px; }
  .member-stack { display: none; }
}
</style>
