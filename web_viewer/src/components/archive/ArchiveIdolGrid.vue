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
    <nav v-if="browseMode==='groups'" class="unit-rail" aria-label="快速定位组合">
      <button type="button" @click="jumpToUnit('')">全部组合（{{ unitOptions.length }}）</button>
      <button v-for="unit in unitOptions" :key="unit.id" type="button" :disabled="!currentUnit && !displayedGroups.some(group=>group.id===unit.id)" @click="jumpToUnit(unit.id)">{{ unit.name }}</button>
    </nav>
    <label v-else class="roster-filter">组合筛选
      <select :value="currentUnit" @change="emit('select-unit', $event.target.value)"><option value="">全部偶像（{{ idolsBeforeUnitFilter }}）</option><option v-for="unit in unitOptions" :key="unit.id" :value="unit.id">{{ unit.name }}（{{ unit.count }}）</option></select>
    </label>
    <button v-if="currentUnit" class="clear-unit" type="button" @click="emit('select-unit','')">当前组合筛选 · 查看全部偶像</button>
    <p v-if="!idols.length" class="empty-state">没有符合当前条件的偶像</p>
    <div class="idol-sections" :class="{'is-roster':browseMode==='roster'}">
      <section v-for="unit in displayedGroups" :key="unit.id" :ref="element=>setUnitElement(unit.id,element)" class="idol-unit-section" :style="{'--unit-accent':normalizeIdolAccentColor(unit.color)||'#168b83'}" :aria-label="unit.name">
        <header v-if="browseMode==='groups'" class="idol-unit-heading">
          <img v-if="unit.code" :src="getUnitLogoUrl(unit.code)" alt="" loading="lazy" />
          <span><strong>{{ unit.name }}</strong><small>{{ unit.members.length }}{{ unit.count>unit.members.length ? ` / ${unit.count}` : '' }} 位成员</small></span>
          <button v-if="unit.code" type="button" :aria-label="`${unit.name} 组合资料`" @click="emit('open-unit',{unit_code:unit.code})">组合资料 <ChevronRight :size="14" /></button>
        </header>
        <div class="idol-grid">
          <button v-for="entry in unit.members" :key="entry.id" class="idol-card" :data-archive-focus-id="`idol:${entry.id}`" :style="{'--idol-card-accent':normalizeIdolAccentColor(entry.color)||'#168b83'}" @click="emit('select',entry)" :title="displayName(entry)">
            <ArchiveIdolAvatar class="idol-avatar" :idol-code="entry.id" :accent-color="entry.color" :size="48" decorative />
            <span class="idol-card-copy"><strong class="idol-name">{{ displayName(entry) }}</strong><small v-if="browseMode==='roster'" class="idol-unit">{{ entry.unitName }}</small></span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
<script setup>
import {computed,nextTick,ref} from 'vue'
import {ChevronRight} from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import {normalizeIdolAccentColor} from '../../presentation/idolAccentColor.js'
import {groupIdolsByUnit} from '../../presentation/IdolUnitGroups.mjs'
import {getUnitLogoUrl} from '../../utils/AssetResolver.js'
const props=defineProps({title:{type:String,default:''},filterPlaceholder:{type:String,default:''},modelValue:{type:String,default:''},idols:{type:Array,default:()=>[]},embedded:Boolean,unitOptions:{type:Array,default:()=>[]},currentUnit:{type:String,default:''},idolsBeforeUnitFilter:{type:Number,default:0},idolName:{type:Function,default:()=>''}})
const emit=defineEmits(['back','select','select-unit','open-unit','update:modelValue'])
const browseMode=ref('groups'),unitElements=new Map()
const displayedGroups=computed(()=>browseMode.value==='roster'?[{id:'roster',members:props.idols}]:groupIdolsByUnit(props.idols,props.unitOptions))
const displayName=entry=>props.idolName(entry.id)||entry.name
function setUnitElement(id,element){if(element)unitElements.set(id,element);else unitElements.delete(id)}
async function jumpToUnit(id){
  if(props.currentUnit){emit('select-unit','');await nextTick()}
  const target=id ? unitElements.get(id) : unitElements.values().next().value
  target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})
}
</script>
<style scoped>
.list-screen{padding:0;height:100%;overflow-y:auto;overflow-x:hidden;background:#f8fafb;}
.idol-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;background:#fff;}
.idol-toolbar>span{color:#71838a;font-size:12px;}
.idol-view-switch{display:flex;gap:2px;background:#f0f4f5;border-radius:7px;padding:3px;}
.idol-view-switch button,.unit-rail button,.clear-unit{font:inherit;font-size:12px;border:0;background:transparent;color:#57727b;min-height:36px;padding:0 10px;cursor:pointer;white-space:nowrap;}
.idol-view-switch button[aria-pressed=true]{background:#fff;color:#148573;border-radius:5px;box-shadow:0 1px 3px #233c5010;}
.unit-rail{display:flex;gap:6px;position:sticky;top:0;z-index:2;overflow-x:auto;white-space:nowrap;padding:6px 16px;background:#fff;border-block:1px solid #e5eeeb;scrollbar-width:thin;}
.unit-rail button{border:1px solid #dce9e4;border-radius:18px;background:#f8fcfa;flex:none;}
.unit-rail button:hover{background:#e6f5ef;color:#087961;}
.unit-rail button:disabled{opacity:.4;cursor:default;}
.clear-unit{margin:8px 16px;background:#e6f5ef;border-radius:6px;}
.roster-filter{display:flex;gap:8px;align-items:center;padding:8px 16px;font-size:12px;color:#57727b;background:#fff;}
.roster-filter select{min-width:0;max-width:100%;min-height:36px;font:inherit;border:1px solid #dce9e4;border-radius:6px;padding:0 8px;}
.idol-sections{display:grid;gap:16px;padding:16px;}
.idol-unit-section{min-width:0;background:#fff;border:1px solid #e2ebe7;border-left:4px solid var(--unit-accent);border-radius:12px;scroll-margin-top:58px;padding:14px;box-shadow:0 2px 6px #213c5010;}
.idol-unit-heading{display:flex;gap:10px;align-items:center;border-bottom:1px solid #edf2f0;padding-bottom:10px;margin-bottom:10px;}
.idol-unit-heading>img{width:80px;height:32px;object-fit:contain;}
.idol-unit-heading>span{display:grid;gap:3px;min-width:0;flex:1;}
.idol-unit-heading strong{font-size:14px;color:#30434b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.idol-unit-heading small{font-size:11px;color:#71838a;}
.idol-unit-heading button{display:flex;align-items:center;flex:none;white-space:nowrap;gap:2px;background:transparent;border:0;color:var(--unit-accent);font:inherit;font-size:12px;min-height:36px;cursor:pointer;}
.idol-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;}
.idol-card{display:flex;align-items:center;gap:9px;min-width:0;min-height:66px;padding:8px;border:1px solid #edf2f0;border-radius:8px;background:#fff;text-align:left;cursor:pointer;}
.idol-card:hover{background:color-mix(in srgb,var(--idol-card-accent) 5%,#fff);border-color:var(--idol-card-accent);}
.idol-card-copy{display:grid;min-width:0;gap:4px;}
.idol-name{font-size:13px;color:#30434b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.idol-unit{font-size:10px;color:#71838a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.empty-state{text-align:center;color:#71838a;font-size:13px;padding:20px;}
button:focus-visible,select:focus-visible{outline:2px solid #168b83;outline-offset:2px;}
.is-roster .idol-unit-section{border-left-width:1px;}
@media(max-width:560px){
 .idol-toolbar{padding:8px 10px;}.idol-toolbar>span{font-size:11px;}.idol-view-switch button{padding-inline:8px;font-size:11px;}
 .unit-rail{padding-inline:10px;scrollbar-width:none;}.idol-sections{padding:10px;gap:12px;}.idol-unit-section{padding:10px;}
 .idol-unit-heading{gap:7px;}.idol-unit-heading>img{width:54px;height:28px;}.idol-unit-heading strong{font-size:12px;}.idol-unit-heading button{font-size:11px;}
 .idol-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}.idol-card{min-height:60px;padding:5px;gap:6px;}.idol-avatar{--idol-avatar-override-size:38px;}.idol-name{font-size:12px;}
}
</style>
