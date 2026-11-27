<template>
  <section class="screen list-screen" data-archive-scroll-container>
    <ArchiveListHeader v-if="!embedded" :title="title" :filter-placeholder="filterPlaceholder" :model-value="modelValue" @back="emit('back')" @update:model-value="emit('update:modelValue', $event)" />
    <div class="idol-toolbar">
      <span>{{ idolsBeforeUnitFilter }} 位偶像 · {{ unitOptions.length }} 个组合</span>
      <div class="idol-view-switch" role="group" aria-label="偶像浏览方式">
        <button type="button" :aria-pressed="browseMode==='groups'" @click="browseMode='groups'">按组合</button>
        <button type="button" :aria-pressed="browseMode==='roster'" @click="browseMode='roster'">全员名册</button>
      </div>
    </div>
    <GsFilterMenu v-if="browseMode==='roster'" class="roster-filter" label="组合" neutral="" :model-value="currentUnit" :options="[{ value: '', label: '全部偶像', count: idolsBeforeUnitFilter }, ...unitOptions.map(unit => ({ value: unit.id, label: unit.name, count: unit.count }))]" @update:model-value="emit('select-unit', $event)" />
    <button v-if="currentUnit" class="clear-unit" type="button" @click="emit('select-unit','')">当前组合筛选 · 查看全部偶像</button>
    <p v-if="!idols.length" class="empty-state">没有符合当前条件的偶像</p>
    <div class="idol-sections" :class="{'is-roster':browseMode==='roster'}">
      <section v-for="unit in displayedGroups" :key="unit.id" class="idol-unit-section" :aria-label="unit.name">
        <header v-if="browseMode==='groups'" class="idol-unit-heading">
          <img v-if="unit.code" :src="getUnitLogoUrl(unit.code)" alt="" loading="lazy" />
          <span><strong>{{ unit.name }}</strong><small>{{ unit.members.length }}{{ unit.count>unit.members.length ? ` / ${unit.count}` : '' }} 位成员</small></span>
          <button v-if="unit.code" type="button" :aria-label="`${unit.name} 组合资料`" @click="emit('open-unit',{unit_code:unit.code})">组合资料 <ChevronRight :size="14" /></button>
        </header>
        <div class="idol-grid">
          <button v-for="entry in unit.members" :key="entry.id" class="idol-card" :data-archive-focus-id="`idol:${entry.id}`" @click="emit('select',entry)" :title="displayName(entry)">
            <ArchiveIdolAvatar class="idol-avatar" :idol-code="entry.id" :accent-color="entry.color" :size="48" decorative />
            <span class="idol-card-copy"><strong class="idol-name">{{ displayName(entry) }}</strong><small v-if="browseMode==='roster'" class="idol-unit">{{ entry.unitName }}</small></span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
<script setup>
import {computed,ref} from 'vue'
import GsFilterMenu from '../gs/GsFilterMenu.vue'
import {ChevronRight} from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import {groupIdolsByUnit} from '../../presentation/IdolUnitGroups.mjs'
import {getUnitLogoUrl} from '../../utils/AssetResolver.js'
const props=defineProps({title:{type:String,default:''},filterPlaceholder:{type:String,default:''},modelValue:{type:String,default:''},idols:{type:Array,default:()=>[]},embedded:Boolean,unitOptions:{type:Array,default:()=>[]},currentUnit:{type:String,default:''},idolsBeforeUnitFilter:{type:Number,default:0},idolName:{type:Function,default:()=>''}})
const emit=defineEmits(['back','select','select-unit','open-unit','update:modelValue'])
const browseMode=ref('groups')
const displayedGroups=computed(()=>browseMode.value==='roster'?[{id:'roster',members:props.idols}]:groupIdolsByUnit(props.idols,props.unitOptions))
const displayName=entry=>props.idolName(entry.id)||entry.name
</script>
<style scoped>
/* Idol directory: units are sections on the paper (heading over an ink rule), members are hairline rows. */
.list-screen { height: 100%; min-width: 0; padding: 0; overflow-x: hidden; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); container: idol-directory / inline-size; }
.idol-toolbar, .roster-filter, .clear-unit, .idol-sections, .empty-state { max-width: var(--gs-content-width); margin-inline: auto; padding-inline: var(--gs-space-7); box-sizing: border-box; }
.idol-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); padding-block: var(--gs-space-6) var(--gs-space-3); }
.idol-toolbar > span { color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.idol-view-switch { display: flex; gap: var(--gs-space-1); padding: var(--gs-space-1); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); }
.idol-view-switch button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-pill); background: none; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; white-space: nowrap; }
.idol-view-switch button[aria-pressed=true] { background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.clear-unit { display: block; min-height: var(--gs-control-normal); margin-block: var(--gs-space-3); border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.roster-filter { display: flex; padding-block: var(--gs-space-3); }
.idol-sections { display: grid; gap: var(--gs-space-8); padding-block: var(--gs-space-6) var(--gs-space-section); }
.idol-unit-section { min-width: 0; }
.idol-unit-heading { display: flex; align-items: center; gap: var(--gs-space-4); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.idol-unit-heading > img { width: 80px; height: 32px; object-fit: contain; }
.idol-unit-heading > span { display: flex; flex: 1; align-items: baseline; gap: var(--gs-space-3); min-width: 0; }
.idol-unit-heading strong { overflow: hidden; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.idol-unit-heading small { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-unit-heading button { display: flex; flex: none; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-normal); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; white-space: nowrap; }
.idol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); column-gap: var(--gs-space-6); }
.idol-card { display: flex; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 64px; margin-inline: calc(-1 * var(--gs-space-2)); padding: var(--gs-space-3) var(--gs-space-2); border: 0; border-bottom: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.idol-card-copy { display: grid; gap: var(--gs-space-1); min-width: 0; }
.idol-name { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.idol-unit { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.empty-state { padding-block: var(--gs-space-6); color: var(--gs-ink-3); text-align: center; }
.list-screen :is(button, select):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) { .idol-card:hover { background: var(--gs-hover); } }
@container idol-directory (max-width: 560px) {
  .idol-toolbar, .roster-filter, .clear-unit, .idol-sections, .empty-state { padding-inline: var(--gs-space-5); }
  .idol-toolbar { padding-top: var(--gs-space-4); }
  .idol-view-switch button { min-height: var(--gs-control-touch); }
  .idol-unit-heading > img { width: 56px; height: 28px; }
  .idol-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--gs-space-4); }
  .idol-card { gap: var(--gs-space-3); }
  .idol-avatar { --idol-avatar-override-size: 40px; }
  .idol-name { white-space: normal; overflow-wrap: anywhere; }
}
</style>
