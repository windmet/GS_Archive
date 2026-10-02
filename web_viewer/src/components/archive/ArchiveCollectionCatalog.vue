<template>
  <article class="domain-page collection-page" :class="{'is-honors':kind==='honors'}" data-archive-scroll-container>
    <nav class="domain-tabs" aria-label="藏品种类"><button type="button" :aria-pressed="kind==='items'" @click="switchKind('items')"><Box :size="18" />道具<small v-if="kind==='items'&&!catalogBusy">{{ filtered.length }}</small></button><button type="button" :aria-pressed="kind==='honors'" @click="switchKind('honors')"><Medal :size="18" />称号<small v-if="kind==='honors'&&!catalogBusy">{{ filtered.length }}</small></button></nav>
    <p v-if="catalogBusy" role="status">正在读取藏品目录…</p>
    <p v-if="errorScope==='catalog'" role="alert">{{ error }}<button @click="load">重试</button></p>
    <section v-if="rows.length" class="collection-directory" aria-label="资料目录">
      <div class="collection-filters">
        <label class="collection-search"><span>搜索</span><input type="search" aria-label="搜索藏品" :value="query" :placeholder="kind==='items'?'搜索道具名称…':'搜索称号或已知条件…'" @input="emit('query',$event.target.value)" /></label>
        <nav v-if="kind==='items'" class="collection-attribute-dots" aria-label="道具属性快捷筛选"><button v-for="entry in attributes.filter(entry=>entry.id)" :key="entry.id" type="button" :class="entry.id" :title="entry.label" :aria-label="`筛选${entry.label}道具`" :aria-pressed="attribute===entry.id" @click="attribute=attribute===entry.id?'':entry.id"><component :is="attributeIcons[entry.id]" :size="14" aria-hidden="true" /></button></nav>
        <template v-if="kind==='honors'">
          <label>偶像<select v-model="idol"><option value="">全部偶像</option><option v-for="entry in collectionIdols" :key="entry.id" :value="entry.id">{{ ownerName(entry) }}</option></select></label>
          <label>组合<select v-model="unit"><option value="">全部组合</option><option v-for="entry in units" :key="entry.id" :value="entry.id">{{ entry.name }}</option></select></label>
        </template>
        <span class="collection-count">{{ filtered.length }} 件</span>
      </div>
      <nav class="collection-chips" :aria-label="kind==='items'?'道具用途':'称号分类'">
        <button type="button" :aria-pressed="!category" @click="category=''">全部 {{ rows.length }}</button>
        <button v-for="group in groups" :key="group.key" type="button" :aria-pressed="category===group.key" @click="category=group.key">{{ group.label }}</button>
      </nav>
      <nav v-if="kind==='items'" class="collection-chips attributes" aria-label="道具属性"><button v-for="entry in attributes" :key="entry.id" type="button" :class="entry.id" :aria-pressed="attribute===entry.id" @click="attribute=entry.id">{{ entry.label }}</button></nav>
      <div class="collection-cards" :class="{'is-honors':kind==='honors'}">
        <button v-for="row in visible" :key="row.id" type="button" :class="kind==='items'?itemAttribute(row):''" :aria-label="entryName(row)" :title="entryName(row)" :aria-describedby="tooltipRow===row?tooltipId:undefined" :aria-pressed="detailOpen&&String(row.id)===selectedId" @pointerenter="showTooltip(row,$event)" @pointerleave="hideTooltip" @focus="showTooltip(row,$event)" @blur="hideTooltip" @keydown.esc="hideTooltip" @click="select(row)">
          <span v-if="kind==='items' && collectionItemVariant(row.nameJa)" class="collection-variant">{{ collectionItemVariant(row.nameJa) }}</span>
          <span class="collection-card-art"><img v-if="row.image?.url&&!failedThumbnails.has(`${kind}:${row.id}`)" :src="row.image.url" alt="" loading="lazy" decoding="async" @error="failedThumbnails=new Set([...failedThumbnails,`${kind}:${row.id}`])" /><component :is="kind==='honors'?Medal:Box" v-else :size="25" /></span>
          <span class="collection-card-copy"><strong>{{ entryName(row) }}</strong><template v-if="kind==='honors'"><small>{{ honorSourceLabel(row,bootstrap.release) }}</small><span class="collection-badge">{{ ownerName(honorIdol(row)) || honorLabels[honorGroup(row)] }}</span></template></span>

        </button>
      </div>
      <p v-if="!filtered.length">没有匹配的藏品。</p>
      <nav v-if="pages>1" class="domain-pagination" aria-label="目录分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
    </section>
    <ArchiveFloatingTooltip :anchor="tooltipAnchor" :id="tooltipId" @dismiss="hideTooltip">
      <template v-if="tooltipRow"><strong>{{ entryName(tooltipRow) }}</strong><span v-if="entryName(tooltipRow)!==tooltipRow.nameJa" lang="ja" class="collection-original">{{ tooltipRow.nameJa }}</span><span>{{ summary(tooltipRow)?.description?archiveText('item',summary(tooltipRow).description,'description'):itemBrowseGroup(tooltipRow.itemType).label }}</span><small>编号 {{ tooltipRow.id }} · 点击查看来源</small></template>
    </ArchiveFloatingTooltip>
    <CollectionDetailPanel v-if="detailOpen" :detail="detail" :kind="kind" :busy="catalogBusy||detailBusy" :error="errorScope==='detail'?error:''" modal @close="emit('entity','')" @retry="load" @open-event="emit('open-event',$event)" @open-gasha="emit('open-gasha',$event)" />
  </article>
</template>
<script setup>
import {computed,getCurrentInstance,nextTick,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import {Box,Medal,Flame,Sparkles,Heart} from '@lucide/vue'
import {collectionItemVariant} from '../../presentation/CollectionItemVariant.mjs'
import {itemBrowseGroups,itemBrowseGroup} from './DomainPresentation.mjs'
import {collectionIdols,collectionSummary,honorIdol,honorGroup,honorSourceLabel,itemAttribute} from '../../presentation/CollectionBrowse.js'
import {UNIT_CODE_TO_NAME} from '../../utils/UnitNameMap.js'
import CollectionDetailPanel from './CollectionDetailPanel.vue'
import ArchiveFloatingTooltip from './ArchiveFloatingTooltip.vue'
import {archiveText,archiveSearchText} from './useArchiveCollectionText.js'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {createCollectionCatalogSession} from '../../../readmodels/runtime/CollectionCatalogSession.mjs'
import '../../styles/archive-domains.css'
import '../../styles/archive-collection.css'
const props=defineProps({client:Object,bootstrap:Object,displayIdolName:{type:Function,default:()=>''},entity:{type:String,default:''},query:{type:String,default:''},browseState:{type:Object,default:()=>({kind:'items',page:0})}})
const emit=defineEmits(['query','entity','browse','open-event','open-gasha'])
const repository=new DomainRepository(props.client,props.bootstrap)
const kind=computed(()=>props.browseState.kind),rows=shallowRef([]),detail=shallowRef(null),catalogBusy=ref(false),detailBusy=ref(false),selectedId=ref(''),error=ref(''),errorScope=ref('')
function filterModel(key){return computed({get:()=>props.browseState[key] ?? (key==='page'?0:''),set:value=>emit('browse',{...props.browseState,[key]:value,...(key==='page'?{}:{page:0})})})}
const page=filterModel('page'),category=filterModel('category'),idol=filterModel('idol'),unit=filterModel('unit'),attribute=filterModel('attribute'),detailOpen=computed(()=>Boolean(props.entity)),failedThumbnails=shallowRef(new Set())
const tooltipRow=shallowRef(null),tooltipAnchor=shallowRef(null),tooltipId=`collection-tooltip-${getCurrentInstance().uid}`
function hideTooltip(){tooltipRow.value=null;tooltipAnchor.value=null}
async function showTooltip(row,event){
 const anchor=event.currentTarget
 if(kind.value!=='items'||detailOpen.value)return
 if(event.type==='pointerenter'&&(event.pointerType==='touch'||!matchMedia('(hover:hover) and (pointer:fine)').matches))return
 if(event.type==='focus'){await nextTick();if(document.activeElement!==anchor||!anchor.matches(':focus-visible')||detailOpen.value)return}
 tooltipRow.value=row;tooltipAnchor.value=anchor
}
watch(()=>[props.query,category.value,idol.value,unit.value,attribute.value,page.value,kind.value,detailOpen.value],hideTooltip)
const honorLabels={idol:'偶像称号',event:'活动称号',normal:'普通称号',other:'其他称号'}
const groups=computed(()=>kind.value==='items'?itemBrowseGroups:Object.entries(honorLabels).map(([key,label])=>({key,label})))
const units=Object.entries(UNIT_CODE_TO_NAME).map(([id,name])=>({id,name}))
const attributes=[{id:'',label:'全部属性'},{id:'physical',label:'体能'},{id:'intelligent',label:'知性'},{id:'mental',label:'心理'}]
const attributeIcons={physical:Flame,intelligent:Sparkles,mental:Heart}
const summary=row=>collectionSummary(row,kind.value,props.bootstrap.release)
const entryName=row=>archiveText(kind.value==='honors'?'honor':'item',row.nameJa||row.name)
const ownerName=owner=>owner ? (props.displayIdolName(owner.id)||owner.name) : ''
const filtered=computed(()=>{
 const q=props.query.trim().toLowerCase()
 return rows.value.filter(row=>{
  const owner=kind.value==='honors'?honorIdol(row):null
  const search=`${archiveSearchText(kind.value==='honors'?'honor':'item',row.nameJa)} ${row.id} ${kind.value==='honors'?honorSourceLabel(row,props.bootstrap.release):''}`.toLowerCase()
  return (!q||search.includes(q))&&(!category.value||(kind.value==='items'?itemBrowseGroup(row.itemType).key:honorGroup(row))===category.value)&&(!attribute.value||itemAttribute(row)===attribute.value)&&(!idol.value||owner?.id===idol.value)&&(!unit.value||owner?.unit===unit.value)
 })
})
const perPage=computed(()=>kind.value==='items'?72:36),pages=computed(()=>Math.ceil(filtered.value.length/perPage.value)),visible=computed(()=>filtered.value.slice(page.value*perPage.value,(page.value+1)*perPage.value))
const session=createCollectionCatalogSession(repository,state=>{rows.value=state.rows;detail.value=state.detail;selectedId.value=state.selectedId;catalogBusy.value=state.catalogBusy;detailBusy.value=state.detailBusy;error.value=state.error;errorScope.value=state.errorScope})
onBeforeUnmount(()=>session.dispose())
async function load(){
 const requestedKind=kind.value,type=requestedKind==='honors'?'honor':'item',key=props.entity.startsWith(`${type}:`)?props.entity:''
 await session.open(requestedKind,key,{selectDefault:false})
}
function select(row){hideTooltip();const key=`${kind.value==='honors'?'honor':'item'}:${row.id}`;if(key===props.entity)void load();else emit('entity',key)}
function switchKind(value){if(kind.value===value)return;emit('browse',{kind:value,category:'',idol:'',unit:'',attribute:'',page:0})}
watch(()=>[props.entity,kind.value],()=>{void load()},{immediate:true})
watch(pages,total=>{if(total>0&&page.value>=total)page.value=total-1})
</script>
