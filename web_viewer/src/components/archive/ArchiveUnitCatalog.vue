<template>
  <section class="unit-catalog" data-archive-scroll-container>
    <div class="unit-grid">
      <button v-for="entry in entries" :key="entry.unit.unit_code" class="unit-entry" :class="{'without-background':!entry.unit.representative_bg}" @click="emit('select', entry.unit)">
        <img v-if="entry.unit.representative_bg" :src="getBgUrl(entry.unit.representative_bg)" :alt="entry.unit.unit_name" loading="lazy" />
        <span class="unit-color" :style="{ backgroundColor: entry.unit.unit_color || '#23a99f' }"></span>
        <span class="unit-copy">
          <img class="unit-logo" :src="getUnitLogoUrl(entry.unit.unit_code)" alt="" loading="lazy" />
          <strong>{{ entry.unit.unit_name }}</strong>
          <small>
            <span>{{ entry.members.length }} 位成员</span><span> · {{ entry.cardStats.total }} 张卡片</span><span> · {{ entry.teamEventCount ?? entry.eventRelations?.team_events?.length ?? 0 }} 次团活</span>
          </small>
        </span>
        <span class="member-stack" aria-hidden="true">
          <ArchiveIdolAvatar
            v-for="member in entry.members.slice(0, 5)"
            :key="member.idol_code"
            :idol-code="member.idol_code"
            :accent-color="member.color"
            :size="30"
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
.unit-catalog { height:100%;min-width:0;overflow-y:auto;background:var(--gs-paper);font-family:var(--gs-font-directory,Inter,'Noto Sans JP','Noto Sans SC',system-ui,sans-serif);font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-regular,400); }
.unit-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-4,12px);padding:var(--gs-space-5,16px); }
.unit-entry { position:relative;display:grid;grid-template-columns:94px 5px minmax(0,1fr) auto auto;align-items:center;gap:var(--gs-space-4,12px);min-height:96px;padding:0 var(--gs-space-4,12px) 0 0;overflow:hidden;border:1px solid var(--gs-line);border-radius:var(--gs-radius-control,6px);background:var(--gs-surface);color:var(--gs-ink);cursor:pointer;text-align:left;font:inherit; }
.unit-entry > img { width:94px;height:94px;object-fit:cover; }
.unit-color { width:5px;height:56px;border-radius:3px; }
.unit-copy { display:flex;flex-direction:column;gap:var(--gs-space-2,4px);min-width:0; }
.unit-logo { width:min(132px,100%);height:32px;object-fit:contain;object-position:left center; }
.unit-copy strong { overflow:hidden;font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-semibold,600);line-height:1.4;text-overflow:ellipsis;white-space:nowrap; }
.unit-copy small { color:var(--gs-ink-3);font-size:var(--gs-text-meta,12px);font-weight:var(--gs-weight-medium,500);line-height:1.5; }
.member-stack { display:flex;padding-left:8px; }
.member-stack > .idol-avatar-shell { margin-left:-8px;box-shadow:0 0 0 2px var(--gs-surface); }
.unit-entry > svg { color:var(--gs-ink-3); }
.unit-entry.without-background { grid-template-columns:5px minmax(0,1fr) auto auto;padding-left:var(--gs-space-4,12px); }
@media(hover:hover) and (pointer:fine){
 .unit-entry:hover { border-color:var(--gs-selected-line);background:var(--gs-mint-wash); }
}
.unit-entry:active { border-color:var(--gs-selected-line);background:var(--gs-mint-wash); }
@media(max-width:850px){
 .unit-grid { grid-template-columns:1fr; }
}
@media(max-width:520px){
 .unit-grid { gap:var(--gs-space-3,8px);padding:var(--gs-space-4,12px); }
 .unit-entry,.unit-entry.without-background { grid-template-columns:4px minmax(0,1fr) auto auto;column-gap:var(--gs-space-3,8px);row-gap:var(--gs-space-1,2px);min-height:84px;padding:var(--gs-space-3,8px); }
 .unit-entry > img { display:none; }
 .unit-color { grid-column:1;grid-row:1 / span 3;height:44px; }
 .unit-copy { display:contents; }
 .unit-copy strong { grid-column:2;grid-row:2;min-width:0; }
 .unit-copy small { grid-column:2 / -1;grid-row:3;display:flex;flex-wrap:wrap;column-gap:var(--gs-space-1,2px);min-width:0; }
 .unit-copy small > span { white-space:nowrap; }
 .member-stack { display:flex;grid-column:3;grid-row:1 / span 2; }
 .member-stack > .idol-avatar-shell { --idol-avatar-override-size:24px;margin-left:-8px; }
 .unit-logo { grid-column:2;grid-row:1;height:26px; }
 .unit-entry > svg { grid-column:4;grid-row:1 / span 2; }
}
@media(max-width:760px), (pointer:coarse){
 .unit-entry { min-height:max(96px,var(--gs-control-touch,44px)); }
}
@media(max-width:520px){
 .unit-entry { min-height:max(84px,var(--gs-control-touch,44px)); }
}
</style>
