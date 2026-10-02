<template>
  <article class="event-catalog" data-archive-scroll-container>
    <div class="catalog-summary"><div><strong>{{ rows.length }}</strong><span>历史活动</span></div><div><strong>{{ storyCount }}</strong><span>关联剧情</span></div><div><strong>{{ reprintCount }}</strong><span>复刻活动</span></div></div>
    <p v-if="busy" role="status">正在读取活动一览…</p>
    <p v-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <div class="catalog-filter">
      <label>搜索<input :value="query" placeholder="活动名称或编号" @input="emit('query',$event.target.value)" /></label>
      <label>活动形式<select v-model="eventKind"><option value="">全部</option><option v-for="(label,id) in eventKindLabels" :key="id" :value="id">{{ label }}</option></select></label>
      <label>排序<select v-model="sort"><option value="newest">最新优先</option><option value="oldest">最早优先</option></select></label>
      <span>{{ filtered.length }} 条结果</span>
    </div>
    <div class="event-grid">
      <button v-for="row in visible" :key="row.id" type="button" class="event-item" :data-archive-focus-id="`event:${row.id}`" @click="select(row)">
        <EventResourceImage :binding="row.resources?.hero || row.image" :name="row.title" />
        <span class="event-copy"><strong>{{ row.title }}</strong>
          <span class="badges"><small>{{ eventKindLabels[row.eventKind] }}</small><small v-if="row.isReprint" class="reprint">复刻</small></span>
          <span class="event-meta">{{ historicalDate(row.release_at) }}<template v-if="row.resources?.endAt"> — {{ historicalDate(row.resources.endAt) }}</template></span>
          <span class="event-meta">{{ row.resources?.episodeCount ? `${row.resources.episodeCount} 章剧情` : row.eventKind==='collection' ? '道具收集兑换' : ['valentine','whiteday'].includes(row.eventKind) ? '季节企划' : '暂无剧情记录' }} · {{ row.resources?.exchangeRewards ? `${row.resources.exchangeRewards.cards.length} 张兑换卡（Wiki）` : row.resources?.rewardCardCount ? `${row.resources.rewardCardCount} 张报酬卡` : row.eventKind==='collection' ? '兑换报酬待补录' : '暂无报酬卡记录' }}</span>
        </span><ChevronRight :size="16" />
      </button>
    </div>
    <p v-if="!busy&&!error&&!filtered.length" class="empty">没有匹配的活动。</p>
    <nav v-if="pages>1" class="pagination" aria-label="活动目录分页"><button :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button :disabled="page+1>=pages" @click="page++">下一页</button></nav>
  </article>
</template>
<script setup>
import {computed,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import {ChevronRight} from '@lucide/vue'
import {eventKindLabels,historicalDate} from './DomainPresentation.mjs'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {eventResources} from '../../data/eventResourceGraph.js'
import EventResourceImage from './EventResourceImage.vue'
const props=defineProps({client:Object,bootstrap:Object,query:{type:String,default:''}})
const emit=defineEmits(['query','open-event'])
const repository=new DomainRepository(props.client,props.bootstrap)
const rows=shallowRef([]),busy=ref(false),error=ref(''),page=ref(0),eventKind=ref(''),sort=ref('newest')
const storyCount=computed(()=>rows.value.filter(row=>row.resources?.storyAvailable).length)
const reprintCount=computed(()=>rows.value.filter(row=>row.isReprint).length)
const filtered=computed(()=>{
  const q=props.query.trim().toLocaleLowerCase()
  return rows.value.filter(row=>(!q||`${row.title} ${row.id} ${row.event_code}`.toLocaleLowerCase().includes(q))&&(!eventKind.value||row.eventKind===eventKind.value))
    .sort((a,b)=>(sort.value==='newest'?-1:1)*(a.release_at-b.release_at)||String(a.id).localeCompare(String(b.id)))
})
const pages=computed(()=>Math.ceil(filtered.value.length/24)),visible=computed(()=>filtered.value.slice(page.value*24,(page.value+1)*24))
let controller=null,request=0
onBeforeUnmount(()=>{request++;controller?.abort()})
async function load(){
  controller?.abort();controller=new AbortController()
  const id=++request,options={signal:controller.signal}
  busy.value=true;error.value='';rows.value=[]
  try{const value=await repository.catalog('events',options);if(id===request)rows.value=value.map(row=>({...row,resources:eventResources(row)}))}
  catch(cause){if(id===request&&!options.signal.aborted){console.error('[ArchiveEvents]',cause);error.value='活动资料暂时无法读取，请重试。'}}
  finally{if(id===request)busy.value=false}
}
function select(row){emit('open-event',{event_id:row.id})}
watch(()=>[props.query,eventKind.value,sort.value],()=>{page.value=0})
load()
</script>
<style scoped>
.event-catalog{height:100%;overflow-y:auto;background:#f6f8f9;color:#27343b;font-family:var(--gs-font-directory);font-size:var(--gs-text-body);font-weight:var(--gs-weight-regular)}.catalog-summary{display:flex;gap:28px;padding:var(--gs-space-5) var(--gs-space-6);background:#fff;border-bottom:1px solid #e3e8eb}.catalog-summary div{display:flex;gap:7px;align-items:baseline}.catalog-summary strong{color:#1b7772;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-bold)}.catalog-summary span,.catalog-filter>span{color:#758088;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular)}.catalog-filter{display:flex;flex-wrap:wrap;align-items:center;gap:var(--gs-space-4);padding:var(--gs-space-4) var(--gs-space-6);background:#fff;border-bottom:1px solid #e3e8eb}.catalog-filter label{display:flex;gap:var(--gs-space-3);align-items:center;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold)}.catalog-filter input,.catalog-filter select{min-height:var(--gs-control-normal);max-width:100%;border:1px solid #dce5e8;border-radius:5px;padding:6px 9px;font:inherit;background:#fff;color:#34454d;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-regular)}.catalog-filter>span{margin-left:auto}.event-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:var(--gs-space-4);padding:16px 20px 28px}.event-item{display:grid;grid-template-columns:178px minmax(0,1fr) 16px;align-items:center;gap:var(--gs-space-4);padding:10px;min-width:0;border:1px solid #e0e5e8;border-radius:7px;background:#fff;color:inherit;text-align:left;cursor:pointer;font:inherit}.event-item:hover{border-color:#85cbc6;box-shadow:0 3px 12px #23494e14}.event-copy{display:flex;flex-direction:column;gap:var(--gs-space-3);min-width:0}.event-copy strong{font-size:15px;line-height:1.5;overflow-wrap:anywhere;font-weight:var(--gs-weight-bold)}.badges{display:flex;gap:5px;flex-wrap:wrap}.badges small{background:#e7f6f4;color:#187b74;padding:2px 5px;border-radius:3px;font-size:var(--gs-text-caption);font-weight:var(--gs-weight-medium)}.badges .reprint{background:#fff0db;color:#965f13}.event-meta{font-size:var(--gs-text-meta);line-height:1.5;color:#75838b;font-weight:var(--gs-weight-regular)}.pagination{display:flex;justify-content:center;align-items:center;gap:var(--gs-space-5);padding:0 var(--gs-space-6) var(--gs-space-7);font-size:var(--gs-text-ui)}.pagination button{border:1px solid #dce5e8;background:#fff;border-radius:5px;padding:9px 14px;color:#187b74;cursor:pointer;font:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-normal)}.pagination button:disabled{opacity:.45;cursor:default}.empty{padding:var(--gs-space-6)}.event-catalog>p[role]{padding:var(--gs-space-4) var(--gs-space-6)}
@media(max-width:700px){.catalog-summary{gap:18px;padding:var(--gs-space-4)}.catalog-summary div{flex-direction:column;gap:var(--gs-space-1)}.catalog-filter{padding:10px;gap:10px}.catalog-filter label{flex:1 1 140px;min-width:0;flex-wrap:wrap}.catalog-filter input,.catalog-filter select{width:100%;min-width:0}.event-grid{grid-template-columns:1fr;padding:10px}.event-item{grid-template-columns:126px minmax(0,1fr) 16px;gap:10px}}
@media(max-width:430px){.event-item{grid-template-columns:minmax(0,1fr) 16px}.event-item>.resource-image{grid-column:1/-1}}

.event-catalog>p[role] button{font:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-normal);}
@media(max-width:760px), (pointer:coarse){
 .catalog-filter input,.catalog-filter select{min-height:var(--gs-control-touch);font-size:var(--gs-text-subtitle);}
 .pagination button,.event-catalog>p[role] button{min-height:var(--gs-control-touch);}
 .event-catalog>p[role] button{min-width:var(--gs-control-touch);}
}
</style>
