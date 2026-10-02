<template>
  <section class="story-discovery" aria-label="查找剧情">
    <div class="filter-deck">
      <div class="discovery-tools">
        <label class="search-input"><Search :size="17" /><input :value="query" @input="emit('update:query',$event.target.value)" type="search" aria-label="搜索剧情标题、简介或偶像" placeholder="搜索剧情标题、简介或偶像…" /></label>
        <button :aria-expanded="idolPicker" @click="idolPicker=!idolPicker"><UserRound :size="16" />{{ state.idols.length ? `已选 ${state.idols.length} 位偶像` : '按登场偶像筛选' }}</button>
        <label>组合<select v-model="state.unit" aria-label="登场组合"><option value="">全部组合</option><option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option></select></label>
      </div>
      <div v-if="idolPicker" class="idol-picker" aria-label="49 位偶像多选">
        <p>多选匹配任一登场偶像 <button @click="state.idols=[]">清除偶像</button><button @click="idolPicker=false">完成选择</button></p>
        <div v-for="unit in units" :key="unit" class="idol-unit"><strong>{{ unit }}</strong><div><button v-for="idol in idolDirectory.filter(row=>row.unitName===unit)" :key="idol.id" :aria-pressed="state.idols.includes(idol.id)" @click="toggleIdol(idol.id)"><img :src="getCharaIconUrl(idol.id)" alt="" width="30" height="30" loading="lazy" /><span>{{ idolName(idol.id)||idol.name }}</span></button></div></div>
      </div>
      <nav class="series-tabs" aria-label="剧情系列"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="state.series===tab.id" @click="state.series=tab.id;emit('series-change')">{{ tab.label }}</button></nav>
      <slot name="filters" />
      <div class="result-controls">
        <label>翻译状态<select v-model="state.language" aria-label="翻译状态"><option value="">全部</option><option value="translated">中文已译</option><option value="partial">部分已译</option><option value="original">原文未译</option><option value="unknown">尚未核对</option></select></label>
        <span role="status">共 {{ filtered.length }} 篇</span>
        <div role="group" aria-label="结果视图"><button :aria-pressed="state.view==='list'" @click="state.view='list'"><List :size="16" />列表</button><button :aria-pressed="state.view==='table'" @click="state.view='table'"><Table2 :size="16" />表格</button></div>
        <button v-if="active" class="clear-filters" @click="clear">清除检索条件</button>
      </div>
    </div>
    <div v-if="state.view==='list'" class="dense-results">
      <button v-for="entry in visible" :key="entry.id" class="result-row" :class="`domain-${entry.domain}`" :disabled="!entry.exists&&!entry.eventRelation" @click="emit('select',entry)">
        <span class="row-visual"><img v-if="cover(entry)" :src="cover(entry)" alt="" width="64" height="36" loading="lazy" /><BookOpen v-else :size="22" /></span>
        <span class="row-copy"><span class="row-heading"><small>{{ entry.eventScopeLabel||entry.domainLabel }}</small><strong><template v-for="(part,i) in titleParts(entry.title)" :key="i"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></strong></span><span class="row-description" :title="description(entry)">{{ description(entry) }}</span></span>
        <span class="row-cast" :aria-label="castNames(entry)"><img v-for="code in cast(entry).slice(0,4)" :key="code" :src="getCharaIconUrl(code)" :alt="idolName(code)" :title="idolName(code)" width="24" height="24" loading="lazy" /><small v-if="cast(entry).length>4">+{{ cast(entry).length-4 }}</small></span>
        <span class="row-language" :class="language(entry)">{{ languageLabel(entry) }}</span><span class="read-action">{{ entry.exists?'阅读':'未收录' }}<ArrowRight :size="15" /></span>
      </button>
    </div>
    <div v-else class="table-wrap"><table><thead><tr><th>章节 / 类型</th><th>标题</th><th>登场偶像</th><th>译文</th><th>操作</th></tr></thead><tbody><tr v-for="entry in visible" :key="entry.id"><td>{{ entry.domainLabel }}<small>{{ entry.sectionLabel }} {{ entry.episodeLabel }}</small></td><td><button :disabled="!entry.exists&&!entry.eventRelation" @click="emit('select',entry)">{{ entry.title }}</button></td><td :title="castNames(entry)">{{ castNames(entry) }}</td><td>{{ languageLabel(entry) }}</td><td><button :disabled="!entry.exists&&!entry.eventRelation" :aria-label="`阅读 ${entry.title}`" @click="emit('select',entry)"><ArrowRight :size="15" /></button></td></tr></tbody></table></div>
    <p v-if="!filtered.length" class="empty-results">没有符合条件的剧情。</p>
    <nav class="result-pagination" aria-label="检索结果分页"><button :disabled="page===1" @click="page--">上一页</button><span>{{ page }} / {{ pages }}</span><button :disabled="page===pages" @click="page++">下一页</button></nav>
  </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {Search,UserRound,BookOpen,ArrowRight,List,Table2} from '@lucide/vue'
import {storyDiscoveryState as state} from '../../data/storyDiscoveryState.js'
import {storyEventResources} from '../../data/eventResourceGraph.js'
import {getCharaIconUrl} from '../../utils/AssetResolver.js'
import localization from '../../../public/data/editorial/story-search-localization.json'
const props=defineProps({query:{type:String,default:''},entries:{type:Array,default:()=>[]},idolDirectory:{type:Array,default:()=>[]},idolName:{type:Function,default:()=>''},idolSearch:{type:Function,default:()=>''}})
const emit=defineEmits(['select','series-change','update:query'])
const idolPicker=ref(false),page=ref(1)
const tabs=[{id:'',label:'全部剧情'},{id:'GROWING SIGN@L',label:'GROWING SIGN@L'},{id:'GROWING SELECTION',label:'GROWING SELECTION'},{id:'unit_story',label:'组合前传'},{id:'idol_story',label:'偶像个人剧情'}]
const units=computed(()=>[...new Set(props.idolDirectory.map(row=>row.unitName).filter(Boolean))])
const knownIdols=computed(()=>new Set(props.idolDirectory.map(row=>row.id)))
const cast=entry=>(storyEventResources(entry)?.storyCast||entry.characters||[]).filter(code=>knownIdols.value.has(code))
const castNames=entry=>cast(entry).map(code=>props.idolName(code)).join('、')
const language=entry=>localization.rows[entry.file]||'unknown'
const languageLabel=entry=>({translated:'中文已译',partial:'部分已译',original:'日文原文',unknown:'尚未核对'}[language(entry)])
const description=entry=>entry.preplaySynopsis?.text||[entry.sectionLabel,entry.episodeLabel,entry.unitName].filter(Boolean).join(' · ')
function cover(entry){const resource=storyEventResources(entry);if(resource?.storyCover)return resource.storyCover.url;if(entry.domain==='main'&&['101','102'].includes(entry.sectionId))return `/assets/stories/main/image_story_main_button_${String(Number(entry.sectionId)-100).padStart(2,'0')}.png`;return ''}
function toggleIdol(code){state.idols=state.idols.includes(code)?state.idols.filter(value=>value!==code):[...state.idols,code]}
function clear(){state.series='';state.idols=[];state.unit='';state.language='';emit('update:query','');emit('series-change')}
const active=computed(()=>Boolean(state.series||state.idols.length||state.unit||props.query||state.language))
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
const visible=computed(()=>filtered.value.slice((page.value-1)*40,page.value*40))
watch(()=>[state.series,state.idols,state.unit,props.query,state.language,props.entries],()=>{page.value=1})
function titleParts(title){const query=props.query.trim();if(!query)return [{text:title,hit:false}];const parts=[],lower=title.toLowerCase(),needle=query.toLowerCase();let start=0,index;while((index=lower.indexOf(needle,start))!==-1){parts.push({text:title.slice(start,index),hit:false},{text:title.slice(index,index+query.length),hit:true});start=index+query.length}parts.push({text:title.slice(start),hit:false});return parts}
</script>
<style scoped>
.story-discovery{background:#f5f7f8;--line:#e0e7e9;--ink:#2e4550;--accent:#187f77}.filter-deck{position:sticky;top:51px;z-index:20;background:#fff;border-bottom:1px solid var(--line);padding:16px 24px;box-shadow:0 4px 12px #18353c08}.discovery-tools{display:flex;align-items:center;gap:12px}.discovery-tools .search-input{display:flex;align-items:center;gap:9px;flex:1;border:1px solid var(--line);border-radius:7px;padding:0 12px;color:#68828b}.search-input input{width:100%;min-width:0;min-height:40px;border:0;font:inherit;font-size:13px;outline:none;background:#fff}.filter-deck button,.filter-deck select,.result-pagination button{font:inherit;font-size:12px;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px;cursor:pointer}.discovery-tools>button{display:flex;align-items:center;gap:6px;min-height:40px}.filter-deck label{font-size:11px;color:#657d85;display:flex;align-items:center;gap:7px}.series-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.series-tabs button{border-radius:18px;padding:6px 10px;font-size:11px}.filter-deck button[aria-pressed=true]{background:#e5f5f1;border-color:#8fc9bd;color:#126f63}.result-controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:12px}.result-controls>span{margin-left:auto;font-size:12px;color:#58717a}.result-controls>[role=group]{display:flex;gap:4px}.result-controls button{display:inline-flex;align-items:center;gap:5px}.idol-picker{max-height:300px;overflow:auto;background:#f5f9f9;border:1px solid var(--line);border-radius:8px;margin-top:12px;padding:12px}.idol-picker p{display:flex;align-items:center;gap:8px;font-size:12px;margin:0 0 10px}.idol-unit{margin:10px 0}.idol-unit>strong{font-size:11px;color:#6d838b}.idol-unit>div{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.idol-unit button{display:flex;align-items:center;gap:5px;font-size:11px;padding:4px 8px}.idol-unit img{border-radius:50%}.dense-results{padding:12px 24px;display:grid;gap:5px}.result-row{display:grid;grid-template-columns:64px minmax(0,1fr) 112px 70px 48px;align-items:center;gap:13px;min-height:76px;padding:9px 14px;border:1px solid var(--line);border-left:3px solid #6baebd;border-radius:7px;background:#fff;text-align:left;color:var(--ink);cursor:pointer}.result-row.domain-event{border-left-color:#d7a05e}.result-row.domain-card_scenarios{border-left-color:#a69acd}.result-row.domain-unit_story{border-left-color:#8bb092}.result-row:hover{border-color:#8ec4ba;box-shadow:0 2px 8px #294a4610}.result-row:disabled{opacity:.6;cursor:default}.row-visual{display:grid;place-items:center;color:#54858a}.row-visual img{width:64px;height:36px;object-fit:cover;border-radius:4px}.row-copy{display:flex;flex-direction:column;gap:5px;min-width:0}.row-heading{display:flex;align-items:center;gap:7px;min-width:0}.row-heading small{font-size:10px;color:#538290;white-space:nowrap;padding:2px 5px;border-radius:3px;background:#eef6f7}.row-heading strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row-description{font-size:11px;color:#7d8c94;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row-cast{display:flex;align-items:center}.row-cast img{border-radius:50%;border:2px solid #fff;margin-left:-5px;width:26px;height:26px}.row-cast img:first-child{margin-left:0}.row-cast small{font-size:10px;color:#6d8188;margin-left:3px}.row-language{font-size:10px;color:#7d8b91;white-space:nowrap}.row-language.translated,.row-language.partial{color:#20866c}.read-action{font-size:11px;color:#26867e;display:flex;align-items:center;gap:3px}.row-copy mark{color:#0d8376;background:#e2f5ef}.table-wrap{overflow-x:auto;margin:12px 24px}table{width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;font-size:12px;color:var(--ink);min-width:680px}th{text-align:left;background:#ecf2f4;font-size:11px;color:#617a83}th,td{height:44px;padding:6px 10px;border-bottom:1px solid var(--line)}th:first-child{width:18%}th:nth-child(2){width:37%}th:nth-child(3){width:26%}th:last-child{width:38px}td{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}td small{display:block;font-size:10px;color:#7b8f98}td button{width:100%;border:0;background:transparent;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2c6965;font:inherit;cursor:pointer}.result-pagination{display:flex;align-items:center;justify-content:center;gap:18px;padding:12px 0 22px;font-size:12px;color:#6b8189}.result-pagination button:disabled{opacity:.4;cursor:default}.empty-results{padding:30px;text-align:center;font-size:13px;color:#6a8089}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #159c91;outline-offset:2px}@media(max-width:800px){.result-row{grid-template-columns:48px minmax(0,1fr) 70px;gap:8px}.row-visual img{width:48px;height:30px}.row-cast{grid-column:2;grid-row:2}.row-language{grid-column:3;grid-row:1}.read-action{grid-column:3;grid-row:2}.result-row{min-height:82px}.row-description{display:none}}@media(max-width:620px){.filter-deck{padding:12px;position:relative;top:auto}.discovery-tools{flex-wrap:wrap;gap:8px}.discovery-tools .search-input{flex-basis:100%}.result-controls{gap:8px}.result-controls>span{margin-left:0}.dense-results{padding:10px 12px}.row-heading{display:block}.row-heading small{display:table;margin-bottom:3px}.row-heading strong{display:block;font-size:12px}.table-wrap{margin:12px}.idol-picker p{flex-wrap:wrap}}
</style>
