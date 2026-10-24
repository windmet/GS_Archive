<template>
  <section class="unit-catalog" data-archive-scroll-container>
    <div class="unit-grid">
      <button
        v-for="entry in entries"
        :key="entry.unit.unit_code"
        class="unit-entry"
        :class="{ 'without-background': !entry.unit.representative_bg }"
        @click="emit('select', entry.unit)"
      >
        <span
          class="unit-media"
          :class="{ 'without-bg': !entry.unit.representative_bg }"
          :style="!entry.unit.representative_bg ? { backgroundColor: entry.unit.unit_color ? `color-mix(in srgb, ${entry.unit.unit_color} 18%, var(--gs-surface))` : 'var(--gs-mint-wash)' } : {}"
        >
          <img
            v-if="entry.unit.representative_bg"
            class="unit-bg"
            :src="getBgUrl(entry.unit.representative_bg)"
            :alt="entry.unit.unit_name"
            loading="lazy"
          />
          <span v-if="entry.unit.representative_bg" class="unit-media-scrim" aria-hidden="true"></span>
          <img
            class="unit-logo"
            :src="getUnitLogoUrl(entry.unit.unit_code)"
            :alt="entry.unit.unit_name"
            loading="lazy"
          />
        </span>
        <span class="unit-color" :style="{ backgroundColor: entry.unit.unit_color || '#23a99f' }"></span>
        <span class="unit-copy">
          <strong>{{ entry.unit.unit_name }}</strong>
          <small>
            <span>{{ entry.members.length }} 位成员</span><span> · {{ entry.cardStats.total }} 张卡片</span><span> · {{ entry.teamEventCount ?? entry.eventRelations?.team_events?.length ?? 0 }} 次团活</span><span v-if="entry.songCount != null"> · {{ entry.songCount }} 首组合曲</span>
          </small>
        </span>
        <span class="member-stack" aria-hidden="true">
          <ArchiveIdolAvatar
            v-for="member in entry.members.slice(0, 5)"
            :key="member.idol_code"
            :idol-code="member.idol_code"
            :accent-color="member.color"
            :size="40"
            :ring-width="2"
            :gap="0"
            decorative
          />
        </span>
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight } from '@lucide/vue'
import { getBgUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'

defineProps({ entries: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
</script>

<style scoped>
.unit-catalog { height:100%;min-width:0;overflow-y:auto;background:var(--gs-paper);font-family:var(--gs-font-directory);font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-regular,400);container-type:inline-size;container-name:unit-catalog; }
.unit-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-4,12px);padding:var(--gs-space-5,16px); }
.unit-entry { position:relative;display:grid;grid-template-columns:160px 5px minmax(0,1fr) auto auto;align-items:center;gap:var(--gs-space-4,12px);min-height:96px;padding:0 var(--gs-space-4,12px) 0 0;overflow:hidden;border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink);cursor:pointer;text-align:left;font:inherit; }
.unit-media { position:relative;display:flex;align-items:center;justify-content:center;width:160px;height:94px;min-height:94px;overflow:hidden;flex:none;border-radius:calc(var(--gs-radius-control) - 1px) 0 0 calc(var(--gs-radius-control) - 1px);background:var(--gs-paper); }
.unit-bg { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .24s ease; }
.unit-media-scrim { position:absolute;inset:0;background:linear-gradient(135deg,rgb(255 255 255 / 45%),rgb(255 255 255 / 22%));pointer-events:none; }
.unit-logo { position:relative;z-index:1;max-width:120px;max-height:52px;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 2px 6px rgb(0 0 0 / 24%)); }
.unit-color { width:5px;height:56px;border-radius:3px;flex:none; }
.unit-copy { display:flex;flex-direction:column;gap:var(--gs-space-2,4px);min-width:0;justify-content:center; }
.unit-copy strong { overflow:hidden;font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-semibold,600);line-height:1.4;text-overflow:ellipsis;white-space:nowrap; }
.unit-copy small { color:var(--gs-ink-3);font-size:var(--gs-text-meta,12px);font-weight:var(--gs-weight-medium,500);line-height:1.5;display:flex;flex-wrap:wrap;column-gap:var(--gs-space-1,2px);min-width:0; }
.unit-copy small > span { white-space:nowrap; }
.member-stack { display:flex;padding-left:8px;flex:none; }
.member-stack > .idol-avatar-shell { margin-left:-12px;box-shadow:0 0 0 2px var(--gs-surface); }
.member-stack > .idol-avatar-shell:first-child { margin-left:0; }
.unit-entry > svg { color:var(--gs-ink-3);flex:none; }
@media(hover:hover) and (pointer:fine){
  .unit-entry:hover { border-color:var(--gs-selected-line);background:var(--gs-mint-wash); }
  .unit-entry:hover .unit-bg { transform:scale(1.04); }
}
.unit-entry:active { border-color:var(--gs-selected-line);background:var(--gs-mint-wash); }
@media(max-width:760px), (pointer:coarse){
  .unit-entry { min-height:max(96px,var(--gs-control-touch,44px)); }
}
@container unit-catalog (max-width:1080px){
  .unit-grid { grid-template-columns:1fr; }
}
@container unit-catalog (max-width:560px){
  .unit-grid { gap:var(--gs-space-3,8px);padding:var(--gs-space-4,12px); }
  .unit-entry,.unit-entry.without-background { grid-template-columns:4px minmax(0,1fr) auto auto;column-gap:var(--gs-space-3,8px);row-gap:var(--gs-space-1,2px);min-height:max(84px,var(--gs-control-touch,44px));padding:var(--gs-space-3,8px); }
  .unit-media { display:contents; }
  .unit-bg,.unit-media-scrim { display:none; }
  .unit-logo { grid-column:2;grid-row:1;height:26px;max-width:110px;object-position:left center;filter:none; }
  .unit-color { grid-column:1;grid-row:1 / span 3;height:44px; }
  .unit-copy { display:contents; }
  .unit-copy strong { grid-column:2;grid-row:2;min-width:0; }
  .unit-copy small { grid-column:2 / -1;grid-row:3;display:flex;flex-wrap:wrap;column-gap:var(--gs-space-1,2px);min-width:0; }
  .unit-copy small > span { white-space:nowrap; }
  .member-stack { display:flex;grid-column:3;grid-row:1 / span 2;padding-left:0; }
  .member-stack > .idol-avatar-shell { --idol-avatar-override-size:24px;margin-left:-8px; }
  .unit-entry > svg { grid-column:4;grid-row:1 / span 2; }
}
@media(prefers-reduced-motion:reduce){
  .unit-bg { transition:none !important; }
}
</style>
