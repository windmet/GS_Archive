<template>
  <article class="event-catalog" data-archive-scroll-container :aria-busy="busy">
    <ArchiveCatalogScope :idol="scopeIdol" :name="scopeIdol ? idolName(scopeIdol.id) : ''" @clear="emit('clear-idol')" />
    <ul class="catalog-footprint" aria-label="活动收录"><li><b>{{ ready ? rows.length : '—' }}</b>历史活动</li><li><b>{{ ready ? storyCount : '—' }}</b>段关联剧情</li><li v-if="ready && reprintCount"><b>{{ reprintCount }}</b>次复刻</li></ul>
    <p v-if="busy" role="status">正在读取活动一览…</p>
    <p v-if="error" role="alert">{{ error }} <button @click="load">重试</button></p>
    <div class="catalog-filter">
      <label class="catalog-search"><span>搜索</span><input :value="query" type="search" placeholder="活动名称或编号" @input="emit('query',$event.target.value)" /></label>
      <ArchiveFilterSheet title="筛选活动" title-id="event-filter-title" :active-count="(eventKind ? 1 : 0) + (sort !== 'newest' ? 1 : 0)">
        <label><span>活动形式</span><select v-model="eventKind"><option value="">全部</option><option v-for="(label,id) in eventKindLabels" :key="id" :value="id">{{ label }}</option></select></label>
        <label><span>排序</span><select v-model="sort"><option value="newest">最新优先</option><option value="oldest">最早优先</option></select></label>
      </ArchiveFilterSheet>
      <span>{{ ready ? `${filtered.length} 条结果` : busy ? '正在读取…' : '结果暂不可用' }}</span>
    </div>
    <div class="event-grid">
      <button v-for="row in visible" :key="row.id" type="button" class="event-item" :data-archive-focus-id="`event:${row.id}`" @click="select(row)">
        <EventResourceImage :binding="row.resources?.hero || row.image" :name="row.title" />
        <span class="event-copy"><strong>{{ row.title }}</strong>
          <span class="event-meta">{{ eventKindLabels[row.eventKind] }}<template v-if="row.isReprint"> · 复刻</template></span>
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
import ArchiveFilterSheet from './ArchiveFilterSheet.vue'
import ArchiveCatalogScope from './ArchiveCatalogScope.vue'
import { eventMatchesIdol, idolEventIds } from '../../presentation/CatalogIdolScope.js'
const props=defineProps({scopeIdol:{type:Object,default:null},idolName:{type:Function,default:()=>''},loadIdol:Function,client:Object,bootstrap:Object,query:{type:String,default:''},browseState:{type:Object,default:()=>({kind:'',sort:'newest',page:0})}})
const emit=defineEmits(['query','browse','ready','open-event','clear-idol'])
const repository=new DomainRepository(props.client,props.bootstrap)
const scopeDetail=shallowRef(null)
const relatedEventIds=computed(()=>idolEventIds(scopeDetail.value))
const sourceRows=shallowRef([]),busy=ref(false),error=ref('')
function filterModel(key){return computed({get:()=>props.browseState[key] ?? (key==='page'?0:key==='sort'?'newest':''),set:value=>emit('browse',{...props.browseState,[key]:value,...(key==='page'?{}:{page:0})})})}
const page=filterModel('page'),eventKind=filterModel('kind'),sort=filterModel('sort')
const rows=computed(()=>sourceRows.value.filter(row=>eventMatchesIdol(row,props.scopeIdol,relatedEventIds.value)))
const ready=computed(()=>!busy.value&&!error.value)
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
  let loaded=false
  busy.value=true;error.value='';sourceRows.value=[]
  try{
    const [value,detail]=await Promise.all([repository.catalog('events',options),props.scopeIdol ? props.loadIdol(props.scopeIdol.id) : Promise.resolve(null)])
    if(id!==request||options.signal.aborted)return
    scopeDetail.value=detail
    sourceRows.value=value.map(row=>({...row,resources:eventResources(row)}))
    const lastPage=Math.max(0,pages.value-1)
    if(page.value>lastPage)page.value=lastPage
    loaded=true
  }
  catch(cause){if(id===request&&!options.signal.aborted){console.error('[ArchiveEvents]',cause);error.value='活动资料暂时无法读取，请重试。'}}
  finally{if(id===request){busy.value=false;if(loaded)emit('ready')}}
}
function select(row){emit('open-event',{event_id:row.id})}
watch(()=>[ready.value,page.value,pages.value],([isReady,current,total])=>{if(isReady&&current>Math.max(0,total-1))page.value=Math.max(0,total-1)})
watch(()=>props.scopeIdol?.id,load,{immediate:true})
</script>
<style scoped>
/* Event catalogue: footprint, one search line (other filters in the sheet on phones), hairline rows. */
.event-catalog { height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); container: event-catalog / inline-size; }
.catalog-footprint, .catalog-filter, .event-grid, .pagination, .event-catalog > p[role], .empty { max-width: var(--gs-content-width); margin-inline: auto; padding-inline: var(--gs-space-7); box-sizing: border-box; }
.catalog-footprint { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-5); margin-block: 0; padding-block: var(--gs-space-6) var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-ui); list-style: none; }
.catalog-footprint b { margin-right: var(--gs-space-2); color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.catalog-filter { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gs-space-3) var(--gs-space-5); padding-block: var(--gs-space-2) var(--gs-space-4); border-bottom: 1px solid var(--gs-line); }
.catalog-filter label { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.catalog-filter .catalog-search { flex: 1 1 260px; }
.catalog-search > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.catalog-filter input, .catalog-filter select { min-height: var(--gs-control-normal); max-width: 100%; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.catalog-filter > span { margin-left: auto; padding-bottom: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); column-gap: var(--gs-space-8); padding-block: var(--gs-space-2) var(--gs-space-8); }
.event-item { display: grid; grid-template-columns: 160px minmax(0, 1fr) 16px; align-items: center; gap: var(--gs-space-4); min-width: 0; padding: var(--gs-space-4) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.event-item > svg { color: var(--gs-ink-3); }
.event-item:hover strong { color: var(--gs-mint-ink); }
.event-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.event-copy strong { display: -webkit-box; overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.event-meta { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.pagination { display: flex; justify-content: center; align-items: center; gap: var(--gs-space-5); padding-bottom: var(--gs-space-8); font-size: var(--gs-text-ui); }
.pagination button, .event-catalog > p[role] button { min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.pagination button:disabled { opacity: .45; cursor: default; }
.event-catalog > p[role], .empty { margin-block: 0; padding-block: var(--gs-space-4); color: var(--gs-ink-2); }
.event-catalog :is(button, input, select):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container event-catalog (max-width: 560px) {
  .catalog-footprint, .catalog-filter, .event-grid, .pagination, .event-catalog > p[role], .empty { padding-inline: var(--gs-space-5); }
  .catalog-footprint { padding-top: var(--gs-space-4); }
  .catalog-filter { flex-wrap: nowrap; align-items: center; }
  .catalog-filter .catalog-search { flex: 1 1 auto; min-width: 0; }
  .catalog-filter input { width: 100%; min-height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .catalog-filter > span { display: none; }
  .event-grid { grid-template-columns: 1fr; }
  .event-item { grid-template-columns: 96px minmax(0, 1fr) 16px; }
  .pagination button, .event-catalog > p[role] button { min-height: var(--gs-control-touch); }
}
</style>
