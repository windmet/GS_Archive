<template>
  <section class="story-discovery" aria-label="查找剧情">
    <div class="filter-deck">
      <div class="discovery-tools">
        <label class="search-input"><Search :size="17" /><input :value="query" @input="emit('update:query',$event.target.value)" type="search" aria-label="搜索剧情标题、简介或偶像" placeholder="搜索剧情标题、简介或偶像…" /></label>
        <button class="mobile-filter-toggle" :aria-expanded="filtersOpen" aria-controls="story-advanced-filters" @click="filtersOpen=!filtersOpen"><SlidersHorizontal :size="17" />筛选<span v-if="active"> · 已设</span></button>
      </div>
      <div id="story-advanced-filters" class="advanced-filters" :class="{ 'is-open': filtersOpen }">
      <div class="facet-tools">
        <button :aria-expanded="idolPicker" @click="idolPicker=!idolPicker"><UserRound :size="16" />{{ state.idols.length ? `已选 ${state.idols.length} 位偶像` : '按登场偶像筛选' }}</button>
        <label>组合<select v-model="state.unit" aria-label="登场组合"><option value="">全部组合</option><option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option></select></label>
      </div>
      <div v-if="idolPicker" class="idol-picker" aria-label="49 位偶像多选">
        <p>多选匹配任一登场偶像 <button @click="state.idols=[]">清除偶像</button><button @click="idolPicker=false">完成选择</button></p>
        <div v-for="unit in units" :key="unit" class="idol-unit"><strong>{{ unit }}</strong><div><button v-for="idol in idolDirectory.filter(row=>row.unitName===unit)" :key="idol.id" :aria-pressed="state.idols.includes(idol.id)" @click="toggleIdol(idol.id)"><img :src="getCharaIconUrl(idol.id)" alt="" width="30" height="30" loading="lazy" /><span>{{ idolName(idol.id)||idol.name }}</span></button></div></div>
      </div>
      <nav class="series-tabs" aria-label="剧情系列"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="state.series===tab.id" @click="state.series=tab.id;emit('series-change')">{{ tab.label }}</button></nav>
      <slot name="filters" />
      <div class="translation-filter"><label>翻译状态<select v-model="state.language" aria-label="翻译状态"><option value="">全部</option><option value="translated">中文已译</option><option value="partial">部分已译</option><option value="original">原文未译</option><option value="unknown">尚未核对</option></select></label></div>
      </div>
      <div class="result-controls">
        <span role="status">共 {{ filtered.length }} 篇</span>
        <div v-if="!compact" role="group" aria-label="结果视图"><button :aria-pressed="state.view==='list'" @click="state.view='list'"><List :size="16" />列表</button><button :aria-pressed="state.view==='table'" @click="state.view='table'"><Table2 :size="16" />表格</button></div>
        <button v-if="active" class="clear-filters" @click="clear">清除检索条件</button>
      </div>
    </div>
    <div v-if="compact || state.view==='list'" class="dense-results">
      <button v-for="entry in visible" :key="entry.id" :data-archive-focus-id="`story:${entry.id}`" class="result-row" :class="`domain-${entry.domain}`" :disabled="!entry.exists&&!entry.eventRelation" @click="emit('select',entry)">
        <span class="row-visual"><img v-if="cover(entry)" :src="cover(entry)" alt="" width="64" height="36" loading="lazy" /><BookOpen v-else :size="22" /></span>
        <span class="row-copy"><span class="row-heading"><small>{{ entry.eventScopeLabel||entry.domainLabel }}</small><strong :title="entry.title"><template v-for="(part,i) in titleParts(displayTitle(entry))" :key="i"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></strong></span><span v-if="compact" class="mobile-row-meta"><span :title="castNames(entry)">{{ mobileCast(entry) || entry.unitName || entry.sectionLabel || '' }}</span><small :class="language(entry)">{{ languageLabel(entry) }}</small></span><span class="row-description" :title="description(entry)">{{ description(entry) }}</span></span>
        <span class="row-cast" :aria-label="castNames(entry)"><img v-for="code in cast(entry).slice(0,4)" :key="code" :src="getCharaIconUrl(code)" :alt="idolName(code)" :title="idolName(code)" width="24" height="24" loading="lazy" /><small v-if="cast(entry).length>4">+{{ cast(entry).length-4 }}</small></span>
        <span class="row-language" :class="language(entry)">{{ languageLabel(entry) }}</span><span class="read-action">{{ entry.exists?'阅读':'未收录' }}<ArrowRight :size="15" /></span>
      </button>
    </div>
    <div v-else class="table-wrap"><table><thead><tr><th>章节 / 类型</th><th>标题</th><th>登场偶像</th><th>译文</th><th>操作</th></tr></thead><tbody><tr v-for="entry in visible" :key="entry.id"><td>{{ entry.domainLabel }}<small>{{ entry.sectionLabel }} {{ entry.episodeLabel }}</small></td><td><button :data-archive-focus-id="`story:${entry.id}`" :disabled="!entry.exists&&!entry.eventRelation" @click="emit('select',entry)">{{ entry.title }}</button></td><td :title="castNames(entry)">{{ castNames(entry) }}</td><td>{{ languageLabel(entry) }}</td><td><button :data-archive-focus-id="`story:${entry.id}`" :disabled="!entry.exists&&!entry.eventRelation" :aria-label="`阅读 ${entry.title}`" @click="emit('select',entry)"><ArrowRight :size="15" /></button></td></tr></tbody></table></div>
    <p v-if="!filtered.length" class="empty-results">没有符合条件的剧情。</p>
    <div v-if="compact && filtered.length" class="mobile-more"><p role="status">已显示 {{ visible.length }} / {{ filtered.length }} 篇</p><button v-if="visible.length<filtered.length" @click="state.mobileLimit+=40">加载更多 · 剩余 {{ filtered.length-visible.length }} 篇</button><p v-else>已显示全部结果</p></div>
    <nav v-else-if="!compact" class="result-pagination" aria-label="检索结果分页"><button :disabled="page===1" @click="page--">上一页</button><span>{{ page }} / {{ pages }}</span><button :disabled="page===pages" @click="page++">下一页</button></nav>
  </section>
</template>
<script setup>
import {computed,ref,watch,onMounted,onBeforeUnmount} from 'vue'
import {Search,UserRound,BookOpen,ArrowRight,List,Table2,SlidersHorizontal} from '@lucide/vue'
import {storyDiscoveryState as state} from '../../data/storyDiscoveryState.js'
import {storyEventResources} from '../../data/eventResourceGraph.js'
import {getCharaIconUrl} from '../../utils/AssetResolver.js'
import {presentIdolEpisodeLabel} from '../../presentation/idolEpisodeLabel.js'
import localization from '../../../public/data/editorial/story-search-localization.json'
const props=defineProps({externalFiltersActive:Boolean,query:{type:String,default:''},entries:{type:Array,default:()=>[]},idolDirectory:{type:Array,default:()=>[]},idolName:{type:Function,default:()=>''},idolSearch:{type:Function,default:()=>''}})
const emit=defineEmits(['select','series-change','update:query','reset-filters'])
const idolPicker=ref(false),filtersOpen=ref(false)
const viewport=typeof window==='undefined'?null:window.matchMedia('(max-width:760px)')
const compact=ref(viewport?.matches||false)
const updateViewport=event=>{compact.value=event.matches}
onMounted(()=>viewport?.addEventListener('change',updateViewport))
onBeforeUnmount(()=>viewport?.removeEventListener('change',updateViewport))
const page=computed({get:()=>state.page,set:value=>{state.page=Math.max(1,Math.min(pages.value,value))}})
const tabs=[{id:'',label:'全部剧情'},{id:'GROWING SIGN@L',label:'GROWING SIGN@L'},{id:'GROWING SELECTION',label:'GROWING SELECTION'},{id:'unit_story',label:'组合前传'},{id:'idol_story',label:'偶像个人剧情'}]
const units=computed(()=>[...new Set(props.idolDirectory.map(row=>row.unitName).filter(Boolean))])
const knownIdols=computed(()=>new Set(props.idolDirectory.map(row=>row.id)))
const cast=entry=>(storyEventResources(entry)?.storyCast||entry.characters||[]).filter(code=>knownIdols.value.has(code))
const castNames=entry=>cast(entry).map(code=>props.idolName(code)).join('、')
function mobileCast(entry){
 const codes=cast(entry),selected=code=>state.idols.includes(code)||(state.unit&&props.idolDirectory.find(row=>row.id===code)?.unitName===state.unit)
 const ordered=[...codes.filter(selected),...codes.filter(code=>!selected(code))]
 return ordered.slice(0,2).map(code=>props.idolName(code)).join('、')+(codes.length>2?` 等${codes.length}人`:'')
}
const language=entry=>localization.rows[entry.file]||'unknown'
const languageLabel=entry=>({translated:'中文已译',partial:'部分已译',original:'日文原文',unknown:'尚未核对'}[language(entry)])
const description=entry=>entry.preplaySynopsis?.text||[entry.sectionLabel,entry.episodeLabel&&presentIdolEpisodeLabel({sourceName:entry.episodeLabel}),entry.unitName].filter(Boolean).join(' · ')
function cover(entry){const resource=storyEventResources(entry);if(resource?.storyCover)return resource.storyCover.url;if(entry.domain==='main'&&['101','102'].includes(entry.sectionId))return `/assets/stories/main/image_story_main_button_${String(Number(entry.sectionId)-100).padStart(2,'0')}.png`;return ''}
function toggleIdol(code){state.idols=state.idols.includes(code)?state.idols.filter(value=>value!==code):[...state.idols,code]}
function clear(){state.series='';state.idols=[];state.unit='';state.language='';emit('update:query','');emit('series-change');emit('reset-filters')}
const active=computed(()=>Boolean(props.externalFiltersActive||state.series||state.idols.length||state.unit||props.query||state.language))
const filtered=computed(()=>props.entries.filter(entry=>{
 const event=entry.domain==='event'?storyEventResources(entry):null
 if(state.series==='unit_story'&&entry.domain!=='unit_story')return false
 if(state.series==='idol_story'&&entry.domain!=='idol_story')return false
 if(state.series.startsWith('GROWING')&&event?.series!==state.series)return false
 const codes=cast(entry)
 if(state.idols.length&&!state.idols.some(code=>codes.includes(code)))return false
 if(state.unit&&!codes.some(code=>props.idolDirectory.find(row=>row.id===code)?.unitName===state.unit))return false
 if(state.language&&language(entry)!==state.language)return false
 const text=[entry.title,description(entry),...codes.map(code=>props.idolSearch(code))].join(' ').toLowerCase()
 return text.includes(props.query.trim().toLowerCase())
}))
const pages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/40)))
const visible=computed(()=>compact.value?filtered.value.slice(0,state.mobileLimit):filtered.value.slice((page.value-1)*40,page.value*40))
// Retain loaded rows/page across Reader round trips; reset only when the result
// identity or actual filter choices change, not when a component is remounted.
watch(()=>JSON.stringify([state.series,state.idols,state.unit,props.query,state.language,filtered.value.map(entry=>entry.id)]),key=>{
 if(key!==state.resultKey){state.page=1;state.mobileLimit=40;state.resultKey=key}
},{immediate:true})
function displayTitle(entry){return compact.value&&entry.domain==='event'?entry.title.replace(/^GROWING (SIGN@L|SELECTION)\s*-\s*/,'').replace(/-$/,''):entry.title}
function titleParts(title){const query=props.query.trim();if(!query)return [{text:title,hit:false}];const parts=[],lower=title.toLowerCase(),needle=query.toLowerCase();let start=0,index;while((index=lower.indexOf(needle,start))!==-1){parts.push({text:title.slice(start,index),hit:false},{text:title.slice(index,index+query.length),hit:true});start=index+query.length}parts.push({text:title.slice(start),hit:false});return parts}
</script>
<style scoped>
.story-discovery{background:var(--gs-paper);--line:#e0e7e9;--ink:#2e4550;--accent:#187f77;font-size:var(--gs-text-body);font-weight:var(--gs-weight-regular)}.filter-deck{position:sticky;top:51px;z-index:20;background:var(--gs-paper);border-bottom:1px solid var(--gs-line);padding:var(--gs-space-5) var(--gs-space-7)}.discovery-tools{display:flex;align-items:center;gap:var(--gs-space-4)}.discovery-tools .search-input{display:flex;align-items:center;gap:var(--gs-space-3);flex:1;border:1px solid var(--line);border-radius:var(--gs-radius-field);padding:0 var(--gs-space-4);background:var(--gs-surface);color:var(--gs-ink-3)}.search-input input{width:100%;min-width:0;min-height:var(--gs-control-toolbar);border:0;font:inherit;font-size:var(--gs-text-ui);outline:none;background:transparent;color:var(--gs-ink);font-weight:var(--gs-weight-regular)}.filter-deck button,.filter-deck select,.result-pagination button{font:inherit;font-size:var(--gs-text-ui);background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:var(--gs-radius-control);padding:var(--gs-space-3);cursor:pointer;font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-normal)}.discovery-tools>button{display:flex;align-items:center;gap:6px;min-height:var(--gs-control-toolbar)}.filter-deck label{font-size:var(--gs-text-meta);color:#657d85;display:flex;align-items:center;gap:var(--gs-space-3);font-weight:var(--gs-weight-semibold)}.series-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:var(--gs-space-4) 0}.series-tabs button{border-radius:var(--gs-radius-pill);padding:6px var(--gs-space-4);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-compact)}.filter-deck button[aria-pressed=true]{background:var(--gs-ink);border-color:var(--gs-ink);color:var(--gs-paper)}.result-controls{display:flex;gap:var(--gs-space-4);align-items:center;flex-wrap:wrap;margin-top:var(--gs-space-4)}.result-controls>span{margin-left:auto;font-size:var(--gs-text-meta);color:#58717a;font-weight:var(--gs-weight-medium)}.result-controls>[role=group]{display:flex;gap:var(--gs-space-2)}.result-controls button{display:inline-flex;align-items:center;gap:var(--gs-space-2);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-compact)}.idol-picker{max-height:300px;overflow:auto;background:#f5f9f9;border:1px solid var(--line);border-radius:var(--gs-radius-panel);margin-top:var(--gs-space-4);padding:var(--gs-space-4)}.idol-picker p{display:flex;align-items:center;gap:var(--gs-space-3);font-size:var(--gs-text-meta);margin:0 0 var(--gs-space-4)}.idol-unit{margin:var(--gs-space-4) 0}.idol-unit>strong{font-size:var(--gs-text-caption);color:#6d838b;font-weight:var(--gs-weight-semibold)}.idol-unit>div{display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--gs-space-2)}.idol-unit button{display:flex;align-items:center;gap:var(--gs-space-2);font-size:var(--gs-text-meta);padding:var(--gs-space-2) var(--gs-space-3);font-weight:var(--gs-weight-semibold);min-height:var(--gs-control-toolbar)}.idol-unit img{border-radius:50%}.dense-results{padding:var(--gs-space-2) var(--gs-space-7);display:grid}.result-row{display:grid;grid-template-columns:64px minmax(0,1fr) 112px 70px 48px;align-items:center;gap:var(--gs-space-4);min-height:76px;padding:var(--gs-space-3) 0;border:0;border-bottom:1px solid var(--gs-line);border-radius:0;background:none;text-align:left;color:var(--gs-ink);cursor:pointer}.result-row:hover .row-heading strong{color:var(--gs-mint-ink)}.result-row:disabled{opacity:.6;cursor:default}.row-visual{display:grid;place-items:center;color:#54858a}.row-visual img{width:64px;height:36px;object-fit:cover;border-radius:var(--gs-radius-media)}.row-copy{display:flex;flex-direction:column;gap:var(--gs-space-2);min-width:0}.row-heading{display:flex;align-items:center;gap:var(--gs-space-3);min-width:0}.row-heading small{font-size:var(--gs-text-caption);color:var(--gs-ink-3);white-space:nowrap;font-weight:var(--gs-weight-medium)}.row-heading strong{font-size:var(--gs-text-ui);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:var(--gs-weight-bold)}.row-description{font-size:var(--gs-text-caption);color:#7d8c94;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:var(--gs-weight-regular)}.row-cast{display:flex;align-items:center}.row-cast img{border-radius:50%;border:2px solid #fff;margin-left:-5px;width:26px;height:26px}.row-cast img:first-child{margin-left:0}.row-cast small{font-size:var(--gs-text-caption);color:#6d8188;margin-left:3px}.row-language{font-size:var(--gs-text-caption);color:#7d8b91;white-space:nowrap;font-weight:var(--gs-weight-medium)}.row-language.translated,.row-language.partial{color:#20866c}.read-action{font-size:var(--gs-text-meta);color:#26867e;display:flex;align-items:center;gap:3px;font-weight:var(--gs-weight-semibold)}.row-copy mark{color:#0d8376;background:#e2f5ef}.table-wrap{overflow-x:auto;margin:var(--gs-space-4) var(--gs-space-7)}table{width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;font-size:var(--gs-text-meta);color:var(--ink);min-width:680px}th{text-align:left;background:#ecf2f4;font-size:var(--gs-text-caption);color:#617a83;font-weight:var(--gs-weight-semibold)}th,td{height:44px;padding:6px var(--gs-space-4);border-bottom:1px solid var(--line)}th:first-child{width:18%}th:nth-child(2){width:37%}th:nth-child(3){width:26%}th:last-child{width:38px}td{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}td small{display:block;font-size:var(--gs-text-caption);color:#7b8f98}td button{width:100%;border:0;background:transparent;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c6965;font:inherit;cursor:pointer}.result-pagination{display:flex;align-items:center;justify-content:center;gap:var(--gs-space-5);padding:var(--gs-space-4) 0 var(--gs-space-7);font-size:var(--gs-text-meta);color:#6b8189}.result-pagination button:disabled{opacity:.4;cursor:default}.empty-results{padding:var(--gs-space-8);text-align:center;font-size:var(--gs-text-ui);color:#6a8089}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #159c91;outline-offset:2px}@media(max-width:800px){.result-row{grid-template-columns:48px minmax(0,1fr) 70px;gap:var(--gs-space-3)}.row-visual img{width:48px;height:30px}.row-cast{grid-column:2;grid-row:2}.row-language{grid-column:3;grid-row:1;font-weight:var(--gs-weight-medium)}.read-action{grid-column:3;grid-row:2;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold)}.result-row{min-height:82px}.row-description{display:none;font-weight:var(--gs-weight-regular)}}@media(max-width:620px){.filter-deck{padding:var(--gs-space-4);position:relative;top:auto}.discovery-tools{flex-wrap:wrap;gap:var(--gs-space-3)}.discovery-tools .search-input{flex-basis:100%}.result-controls{gap:var(--gs-space-3)}.result-controls>span{margin-left:0;font-weight:var(--gs-weight-medium)}.dense-results{padding:var(--gs-space-4) var(--gs-space-4)}.row-heading{display:block}.row-heading small{display:table;margin-bottom:3px;font-weight:var(--gs-weight-semibold)}.row-heading strong{display:block;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-bold)}.table-wrap{margin:var(--gs-space-4)}.idol-picker p{flex-wrap:wrap}}.filter-deck select{font-weight:var(--gs-weight-regular)}
</style>

<style scoped>
.filter-deck{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 var(--gs-space-4);}
.discovery-tools{grid-column:1;grid-row:1;}.advanced-filters{display:contents;}
.facet-tools{grid-column:2;grid-row:1;display:flex;align-items:center;gap:var(--gs-space-4);}
.facet-tools>button{display:flex;align-items:center;gap:6px;min-height:var(--gs-control-toolbar);}
.series-tabs,.idol-picker,.filter-deck :deep(.catalog-toolbar),.result-controls,.translation-filter{grid-column:1/-1;}
.filter-deck :deep(.catalog-toolbar label){font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);}
.filter-deck :deep(.catalog-toolbar label > span){font-size:var(--gs-text-meta);}
.filter-deck :deep(.catalog-toolbar select){min-height:var(--gs-control-normal);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-regular);}
.translation-filter{grid-column:1;margin-top:var(--gs-space-4);}.result-controls{grid-column:2;}.mobile-filter-toggle{display:none!important;}
.mobile-row-meta{display:none;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-medium);line-height:1.4;}
@media(max-width:760px){
 .filter-deck{display:block;position:sticky;top:44px;padding:var(--gs-space-3) var(--gs-space-4);background:var(--gs-paper);z-index:20;}
 .discovery-tools{display:flex;flex-wrap:nowrap;gap:var(--gs-space-3);}.discovery-tools .search-input{flex:1;flex-basis:auto;min-width:0;padding:0 var(--gs-space-3);}
 .search-input input{min-height:var(--gs-control-toolbar);font-size:var(--gs-text-ui);}
 .mobile-filter-toggle{display:inline-flex!important;align-items:center;gap:var(--gs-space-2);flex-shrink:0;min-height:var(--gs-control-touch);}
 .advanced-filters{display:none;}.advanced-filters.is-open{display:block;max-height:calc(100dvh - 240px);overflow-y:auto;padding:var(--gs-space-4) 0;}
 .facet-tools{flex-wrap:wrap;gap:var(--gs-space-3);}.facet-tools>button{min-height:var(--gs-control-touch);}.facet-tools select{max-width:180px;min-height:var(--gs-control-toolbar);}
 .series-tabs{gap:6px;margin:var(--gs-space-4) 0;}.series-tabs button{min-height:var(--gs-control-normal);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);}
 .result-controls{margin-top:var(--gs-space-2);min-height:20px;gap:var(--gs-space-3);}.result-controls>span{margin-left:0;font-size:var(--gs-text-caption);font-weight:var(--gs-weight-medium);}
 .result-controls .clear-filters{margin-left:auto;border:0;padding:3px var(--gs-space-2);}
 .dense-results{padding:0 var(--gs-space-5);}
 .result-row{display:grid;grid-template-columns:56px minmax(0,1fr) 16px;gap:var(--gs-space-4);min-height:64px;padding:var(--gs-space-3) 0;}
 .row-cast,.row-language,.row-description{display:none;}.row-visual img{width:56px;height:32px;}
 .row-copy{grid-column:2;grid-row:1;gap:var(--gs-space-2);}.row-heading{display:flex;gap:6px;}
 .row-heading small{display:inline;font-size:var(--gs-text-caption);flex:none;margin:0;max-width:70px;overflow:hidden;text-overflow:ellipsis;font-weight:var(--gs-weight-semibold);}
 .row-heading strong{display:block;font-size:var(--gs-text-body);line-height:18px;font-weight:var(--gs-weight-bold);}
 .mobile-row-meta{display:flex;gap:var(--gs-space-3);align-items:center;color:var(--gs-ink-3);font-size:var(--gs-text-meta);line-height:1.4;min-width:0;font-weight:var(--gs-weight-medium);}
 .mobile-row-meta>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;}
 .mobile-row-meta>small{flex:none;font-size:var(--gs-text-caption);}.mobile-row-meta>.translated,.mobile-row-meta>.partial{color:#20866c;}
 .read-action{grid-column:3;grid-row:1;font-size:0;color:var(--gs-ink-3);}.read-action svg{width:16px;}
 .mobile-more{display:grid;gap:var(--gs-space-3);padding:var(--gs-space-4) var(--gs-space-4) var(--gs-space-7);text-align:center;}
 .mobile-more p{margin:0;color:#72868c;font-size:var(--gs-text-caption);}.mobile-more button{min-height:var(--gs-control-touch);background:#fff;color:var(--gs-mint-ink);border:1px solid #a9cfc8;border-radius:var(--gs-radius-field);font:inherit;font-size:var(--gs-text-ui);cursor:pointer;font-weight:var(--gs-weight-semibold);}
}
@media(max-width:760px), (pointer:coarse){
 .filter-deck button,.filter-deck select,.result-pagination button,.mobile-more button,td button{min-height:var(--gs-control-touch);}
 .search-input input,.filter-deck select{min-height:var(--gs-control-touch);font-size:var(--gs-text-subtitle);}
 .filter-deck :deep(.catalog-toolbar select){min-height:var(--gs-control-touch);font-size:var(--gs-text-subtitle);}
}
</style>
