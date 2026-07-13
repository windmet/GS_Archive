<template>
  <article v-if="unit" class="unit-detail">
    <header class="unit-hero" :style="{ backgroundImage: `url(${getBgUrl(unit.representative_bg)})` }">
      <span class="unit-hero-shade" aria-hidden="true"></span>
      <div class="unit-hero-copy">
        <span>{{ unit.unit_code }}</span>
        <h2>{{ unit.unit_name }}</h2>
        <p>{{ unit.unit_kana }}</p>
      </div>
      <span class="unit-swatch" :style="{ backgroundColor: unit.unit_color || '#23a99f' }" :title="unit.unit_color"></span>
    </header>

    <section class="unit-description">
      <p>{{ unit.description }}</p>
    </section>

    <section class="unit-section" aria-labelledby="unit-members-title">
      <div class="section-heading">
        <h3 id="unit-members-title">成员</h3>
        <span>{{ members.length }}</span>
      </div>
      <div class="unit-members">
        <button v-for="member in members" :key="member.idol_code" @click="emit('open-idol', member)">
          <img :src="`/assets/idols/icons/image_chara_icon_${member.idol_code}.png`" :alt="member.display_name" />
          <span>{{ member.display_name }}</span>
        </button>
      </div>
    </section>

    <section class="unit-section" aria-labelledby="unit-stories-title">
      <div class="section-heading">
        <h3 id="unit-stories-title">组合剧情</h3>
        <span>{{ stories.length }}</span>
      </div>
      <div class="unit-stories">
        <button v-for="story in stories" :key="story.id" @click="emit('open-story', story)">
          <Play :size="15" fill="currentColor" />
          <span>
            <strong>{{ story.title }}</strong>
            <small>{{ story.resourceId }}</small>
          </span>
          <small>{{ story.summary?.step_count || 0 }} steps</small>
        </button>
      </div>
    </section>
  </article>
</template>

<script setup>
import { Play } from '@lucide/vue'
import { getBgUrl } from '../../utils/AssetResolver.js'

defineProps({
  unit: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  stories: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-idol', 'open-story'])
</script>

<style scoped>
.unit-detail { height: 100%; padding: 20px; overflow-y: auto; background: #f7f9fa; }
.unit-hero { position: relative; display: flex; align-items: flex-end; min-height: 220px; padding: 26px 28px; overflow: hidden; background-position: center; background-size: cover; color: #fff; }
.unit-hero-shade { position: absolute; inset: 0; background: rgba(15, 24, 31, 0.62); }
.unit-hero-copy { position: relative; z-index: 1; }
.unit-hero-copy > span { color: #6bd6ce; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.67rem; }
.unit-hero h2 { margin: 7px 0 5px; font-size: 1.8rem; letter-spacing: 0; }
.unit-hero p { margin: 0; color: #d5dde2; font-size: 0.72rem; }
.unit-swatch { position: absolute; z-index: 1; top: 20px; right: 20px; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; }
.unit-description, .unit-section { margin-top: 12px; padding: 18px; border: 1px solid #dfe4e8; background: #fff; }
.unit-description p { margin: 0; white-space: pre-wrap; color: #46535c; font-size: 0.76rem; line-height: 1.75; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-heading h3 { margin: 0; font-size: 0.86rem; }
.section-heading span { color: #7a858e; font-size: 0.66rem; }
.unit-members { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.unit-members button { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 52px; padding: 7px 9px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.unit-members button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-members img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.unit-members span { overflow: hidden; font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-stories { display: flex; flex-direction: column; gap: 6px; }
.unit-stories button { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 52px; padding: 7px 10px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #26313a; cursor: pointer; text-align: left; }
.unit-stories button:hover { border-color: #73c9c2; background: #f2fbfa; }
.unit-stories button > svg { color: #15978e; }
.unit-stories button > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.unit-stories strong { overflow: hidden; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-stories small { color: #7a858e; font-size: 0.63rem; }

@media (max-width: 560px) {
  .unit-detail { padding: 10px; }
  .unit-hero { min-height: 170px; padding: 20px; }
  .unit-hero h2 { font-size: 1.45rem; }
  .unit-description, .unit-section { margin-top: 8px; padding: 14px; }
  .unit-members { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-stories button { grid-template-columns: 20px minmax(0, 1fr); }
  .unit-stories button > small { grid-column: 2; }
}
</style>
