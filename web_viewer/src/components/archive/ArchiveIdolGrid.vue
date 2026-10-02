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
.list-screen{--idol-rail-control-height:var(--gs-control-normal,36px);padding:0;height:100%;min-width:0;overflow-y:auto;overflow-x:hidden;background:#f8fafb;font-family:var(--gs-font-directory,Inter,'Noto Sans JP','Noto Sans SC',system-ui,sans-serif);font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-regular,400);}
.idol-toolbar{display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-3,8px);padding:var(--gs-space-4,12px) var(--gs-space-5,16px);background:#fff;}
.idol-toolbar>span{color:#71838a;font-size:var(--gs-text-meta,12px);font-weight:var(--gs-weight-medium,500);}
.idol-view-switch{display:flex;gap:var(--gs-space-1,2px);background:#f0f4f5;border-radius:var(--gs-radius-field,8px);padding:var(--gs-space-2,4px);}
.idol-view-switch button,.unit-rail button,.clear-unit{font:inherit;font-size:var(--gs-text-ui,13px);font-weight:var(--gs-weight-semibold,600);border:0;background:transparent;color:#57727b;min-height:var(--gs-control-normal,36px);padding:0 var(--gs-space-4,12px);cursor:pointer;white-space:nowrap;}
.idol-view-switch button[aria-pressed=true]{background:#fff;color:#148573;border-radius:var(--gs-radius-control,6px);box-shadow:0 1px 3px #233c5010;}
.unit-rail{display:flex;gap:var(--gs-space-3,8px);position:sticky;top:0;z-index:2;overflow-x:auto;white-space:nowrap;padding:var(--gs-space-3,8px) var(--gs-space-5,16px);background:#fff;border-block:1px solid #e5eeeb;scrollbar-width:thin;}
.unit-rail button{border:1px solid #dce9e4;border-radius:var(--gs-radius-pill,999px);background:#f8fcfa;flex:none;}
.unit-rail button:disabled{opacity:.4;cursor:default;}
.clear-unit{margin:var(--gs-space-3,8px) var(--gs-space-5,16px);background:#e6f5ef;border-radius:var(--gs-radius-control,6px);}
.roster-filter{display:flex;gap:var(--gs-space-3,8px);align-items:center;padding:var(--gs-space-3,8px) var(--gs-space-5,16px);font-size:var(--gs-text-meta,12px);font-weight:var(--gs-weight-semibold,600);color:#57727b;background:#fff;}
.roster-filter select{min-width:0;max-width:100%;min-height:var(--gs-control-normal,36px);font:inherit;font-size:var(--gs-text-ui,13px);font-weight:var(--gs-weight-regular,400);border:1px solid #dce9e4;border-radius:var(--gs-radius-control,6px);padding:0 var(--gs-space-3,8px);}
.idol-sections{display:grid;gap:var(--gs-space-5,16px);padding:var(--gs-space-5,16px);}
.idol-unit-section{min-width:0;background:#fff;border:1px solid #e2ebe7;border-left:4px solid var(--unit-accent);border-radius:var(--gs-radius-panel,12px);scroll-margin-top:calc(var(--idol-rail-control-height) + var(--gs-space-3,8px) + var(--gs-space-3,8px) + 2px + var(--gs-space-3,8px));padding:var(--gs-space-4,12px);box-shadow:0 2px 6px #213c5010;}
.idol-unit-heading{display:flex;gap:var(--gs-space-4,12px);align-items:center;border-bottom:1px solid #edf2f0;padding-bottom:var(--gs-space-4,12px);margin-bottom:var(--gs-space-4,12px);}
.idol-unit-heading>img{width:80px;height:32px;object-fit:contain;}
.idol-unit-heading>span{display:grid;gap:var(--gs-space-2,4px);min-width:0;flex:1;}
.idol-unit-heading strong{font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-bold,700);color:#30434b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.idol-unit-heading small{font-size:var(--gs-text-caption,11px);font-weight:var(--gs-weight-medium,500);color:#71838a;}
.idol-unit-heading button{display:flex;align-items:center;flex:none;white-space:nowrap;gap:var(--gs-space-1,2px);background:transparent;border:0;color:var(--unit-accent);font:inherit;font-size:var(--gs-text-ui,13px);font-weight:var(--gs-weight-semibold,600);min-height:var(--gs-control-normal,36px);padding:0 var(--gs-space-3,8px);cursor:pointer;}
.idol-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:var(--gs-space-3,8px);}
.idol-card{display:flex;align-items:center;gap:var(--gs-space-3,8px);min-width:0;min-height:66px;padding:var(--gs-space-3,8px);border:1px solid #edf2f0;border-radius:var(--gs-radius-field,8px);background:#fff;text-align:left;cursor:pointer;font:inherit;}
.idol-card-copy{display:grid;min-width:0;gap:var(--gs-space-2,4px);}
.idol-name{font-size:var(--gs-text-body,14px);font-weight:var(--gs-weight-semibold,600);line-height:1.5;color:#30434b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.idol-unit{font-size:var(--gs-text-caption,11px);font-weight:var(--gs-weight-medium,500);color:#71838a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.empty-state{text-align:center;color:#71838a;font-size:var(--gs-text-body,14px);padding:var(--gs-space-6,20px);}
button:focus-visible,select:focus-visible{outline:2px solid #168b83;outline-offset:2px;}
.is-roster .idol-unit-section{border-left-width:1px;}
@media(hover:hover) and (pointer:fine){
 .unit-rail button:hover:not(:disabled){background:#e6f5ef;color:#087961;}
 .idol-card:hover{background:color-mix(in srgb,var(--idol-card-accent) 5%,#fff);border-color:var(--idol-card-accent);}
}
.unit-rail button:active:not(:disabled){background:#e6f5ef;color:#087961;}
.idol-card:active{background:color-mix(in srgb,var(--idol-card-accent) 5%,#fff);border-color:var(--idol-card-accent);}
@media(max-width:560px){
 .idol-toolbar{padding:var(--gs-space-3,8px) var(--gs-space-4,12px);}.idol-view-switch button{padding-inline:var(--gs-space-3,8px);font-size:var(--gs-text-meta,12px);}
 .unit-rail{padding-inline:var(--gs-space-4,12px);scrollbar-width:none;}.idol-sections{padding:var(--gs-space-4,12px);gap:var(--gs-space-4,12px);}.idol-unit-section{padding:var(--gs-space-4,12px);}
 .idol-unit-heading{gap:var(--gs-space-3,8px);}.idol-unit-heading>img{width:54px;height:28px;}.idol-unit-heading strong{font-size:var(--gs-text-meta,12px);}.idol-unit-heading button{font-size:var(--gs-text-meta,12px);}
 .idol-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-3,8px);}.idol-card{min-height:60px;padding:var(--gs-space-3,8px);gap:var(--gs-space-3,8px);}.idol-avatar{--idol-avatar-override-size:38px;}.idol-name{font-size:var(--gs-text-meta,12px);white-space:normal;overflow-wrap:anywhere;}
 .is-roster .idol-card:only-child{grid-column:1/-1;}
}
@media(max-width:760px), (pointer:coarse){
 .list-screen{--idol-rail-control-height:var(--gs-control-touch,44px);}
 .idol-view-switch button,.unit-rail button,.clear-unit,.idol-unit-heading button,.roster-filter select{min-height:var(--gs-control-touch,44px);}
 .unit-rail button{min-width:var(--gs-control-touch,44px);}
 .roster-filter select{font-size:var(--gs-text-subtitle,16px);}
}
</style>
