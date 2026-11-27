<template>
  <div class="domain-rewards" :class="{ 'is-sources': sources }">
    <div v-if="rows.length && (!useGroupedSources || scopes.length > 1)" class="domain-table-controls">
      <div v-if="scopes.length>1" class="domain-scope-tabs" role="group" aria-label="奖励分类">
        <button v-for="option in scopeOptions" :key="option.value || 'all'" type="button" :aria-pressed="scope === option.value" @click="scope = option.value">
          <span>{{ option.label }}</span><small>{{ option.count }}</small>
        </button>
      </div>
      <span>{{ filtered.length }} 条</span>
    </div>
    <div v-if="useGroupedSources" class="domain-reward-accordions" aria-label="获得来源分组">
      <details v-for="group in sourceGroups" :key="group.label" class="domain-reward-accordion" :open="sourceGroups.length === 1">
        <summary>
          <span class="domain-reward-accordion-copy">
            <strong>{{ group.label }}</strong>
            <small>{{ group.rows.length }} 条记录</small>
          </span>
          <span class="domain-reward-toggle" aria-hidden="true">
            <span class="domain-reward-toggle-closed">展开</span>
            <span class="domain-reward-toggle-open">收起</span>
            <ChevronDown :size="15" />
          </span>
        </summary>
        <ol class="domain-reward-list">
          <li v-for="(row,i) in visibleGroupRows(group)" :key="row.key || `${group.label}:${i}`" class="domain-reward-entry">
            <div class="domain-reward-heading">
              <div class="domain-reward-conditions">
                <span class="domain-reward-relation">{{ rewardRelationLabel(row) }}</span>
                <span v-for="(condition,c) in rewardConditions(row)" :key="c" class="domain-reward-condition">{{ condition }}</span>
              </div>
              <span v-if="hasAmount(row)" class="domain-reward-quantity" :aria-label="`数量 ${amount(row)}`">× {{ amount(row) }}</span>
            </div>
            <div v-if="row.event" class="domain-reward-source">
              <button type="button" class="domain-reward-name" @click="emit('open-event',row.event)"><span><strong>{{ row.event.title }}</strong></span><ChevronRight :size="15" aria-hidden="true" /></button>
            </div>
            <div v-if="row.campaigns?.length" class="domain-reward-campaigns"><template v-for="campaign in row.campaigns" :key="campaign.id"><small v-if="campaignPeriod(campaign.term)">{{ campaignPeriod(campaign.term) }} 期间登录</small></template></div>
          </li>
        </ol>
        <button v-if="group.rows.length > groupLimit(group.label)" type="button" class="domain-reward-more" @click="expandGroup(group.label)">展开其余 {{ group.rows.length - groupLimit(group.label) }} 条</button>
      </details>
    </div>
    <ol v-else-if="filtered.length" class="domain-reward-list" :aria-label="sources ? '获得来源' : '奖励明细'">
      <template v-for="(row,i) in visible" :key="row.key || `${page}:${i}`">
      <li v-if="startsGroup(i)" class="domain-reward-group" aria-hidden="true">{{ rewardRelationLabel(row) }}</li>
      <li class="domain-reward-entry">
        <div class="domain-reward-heading">
          <div class="domain-reward-conditions">
            <span class="domain-reward-relation">{{ rewardRelationLabel(row) }}</span>
            <span v-for="(condition,c) in rewardConditions(row)" :key="c" class="domain-reward-condition">{{ condition }}</span>
          </div>
          <span v-if="hasAmount(row)" class="domain-reward-quantity" :aria-label="`数量 ${amount(row)}`">× {{ amount(row) }}</span>
        </div>
        <button v-if="!sources && (rewardCollectionKey(row.product) || row.product?.target)" type="button" class="domain-reward-product is-actionable" @click="openProduct(row.product)">
          <span class="domain-reward-icon" aria-hidden="true">
            <DomainMediaPreview v-if="row.product?.presentation?.image" :binding="row.product.presentation.image" :name="rewardProductName(row.product)" compact passive />
            <ImageOff v-else :size="22" aria-hidden="true" />
          </span>
          <span class="domain-reward-name"><span><strong>{{ rewardProductName(row.product) }}</strong><small v-if="rewardProductLabel(row.product) !== rewardProductName(row.product)">{{ rewardProductLabel(row.product) }}</small></span><ChevronRight :size="16" aria-hidden="true" /></span>
        </button>
        <div v-else-if="!sources" class="domain-reward-product">
          <div class="domain-reward-icon">
            <DomainMediaPreview v-if="row.product?.presentation?.image" :binding="row.product.presentation.image" :name="rewardProductName(row.product)" compact />
            <ImageOff v-else :size="22" aria-label="未绑定图片" />
          </div>
          <div class="domain-reward-name"><span><strong>{{ rewardProductName(row.product) }}</strong><small v-if="rewardProductLabel(row.product) !== rewardProductName(row.product)">{{ rewardProductLabel(row.product) }}</small></span></div>
        </div>
        <div v-else-if="row.event" class="domain-reward-source">
          <button type="button" class="domain-reward-name" @click="emit('open-event',row.event)"><span><strong>{{ row.event.title }}</strong></span><ChevronRight :size="15" aria-hidden="true" /></button>
        </div>
        <div v-if="row.campaigns?.length" class="domain-reward-campaigns"><template v-for="campaign in row.campaigns" :key="campaign.id"><small v-if="campaignPeriod(campaign.term)">{{ campaignPeriod(campaign.term) }} 期间登录</small></template></div>
      </li>
      </template>
    </ol>
    <nav v-if="!useGroupedSources && pages>1" class="domain-pagination" aria-label="奖励分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {ChevronDown,ChevronRight,ImageOff} from '@lucide/vue'
import {campaignPeriod,number,rewardConditions,rewardScopeLabels,rewardRelationLabel,rewardProductLabel,rewardCollectionKey} from './DomainPresentation.mjs'
import {presentRewardProductName as rewardProductName} from './useArchiveRewardText.js'
import DomainMediaPreview from './DomainMediaPreview.vue'
import '../../styles/archive-rewards.css'
const props=defineProps({rows:{type:Array,default:()=>[]},sources:Boolean})
const emit=defineEmits(['open-entity','open-event','open-target'])
const scope=ref(''),page=ref(0),size=25,expandedGroups=ref({})
const GROUP_INITIAL_LIMIT=12
const SCOPE_ORDER=['point','ranking','idol-ranking','panel','repeated','story-in-event-term','story-archive','story-section','seasonal-story','valentine-level']
const scopes=computed(()=>{
  const present=new Set(props.rows.map(row=>row.scope).filter(Boolean))
  const ordered=SCOPE_ORDER.filter(kind=>present.has(kind))
  for(const kind of present)if(!ordered.includes(kind))ordered.push(kind)
  return ordered
})
const scopeOptions=computed(()=>[{value:'',label:'全部',count:props.rows.length},...scopes.value.map(kind=>({value:kind,label:rewardScopeLabels[kind]||'其他来源',count:props.rows.filter(row=>row.scope===kind).length}))])
const filtered=computed(()=>props.rows.filter(row=>!scope.value || row.scope===scope.value))
const sourceGroups=computed(()=>{
  if(!props.sources)return []
  const map=new Map()
  for(const row of filtered.value){
    const label=rewardRelationLabel(row) || '其他来源'
    if(!map.has(label))map.set(label,{label,rows:[]})
    map.get(label).rows.push(row)
  }
  return [...map.values()]
})
const useGroupedSources=computed(()=>props.sources && filtered.value.length > 6)
const pages=computed(()=>Math.ceil(filtered.value.length/size)),visible=computed(()=>filtered.value.slice(page.value*size,(page.value+1)*size))
watch(()=>props.rows,()=>{scope.value='';page.value=0;expandedGroups.value={}});watch(scope,()=>{page.value=0;expandedGroups.value={}})
const groupLimit=label=>expandedGroups.value[label] ? Infinity : GROUP_INITIAL_LIMIT
const visibleGroupRows=group=>group.rows.slice(0,groupLimit(group.label))
const expandGroup=label=>{expandedGroups.value={...expandedGroups.value,[label]:true}}
// A run of rows from one source shows its name once; a new page restarts the run.
const startsGroup=i=>i===0 || rewardRelationLabel(visible.value[i-1])!==rewardRelationLabel(visible.value[i])
const hasAmount=row=>Number.isFinite(row.product?.amount ?? row.amount)
const amount=row=>hasAmount(row)?number(row.product?.amount ?? row.amount):''
function openProduct(product) {
  const key=rewardCollectionKey(product)
  if(key) emit('open-entity',key)
  else if(product?.target) emit('open-target',product.target)
}
</script>
