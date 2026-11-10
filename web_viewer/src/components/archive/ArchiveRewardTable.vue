<template>
  <div class="domain-rewards">
    <div v-if="rows.length" class="domain-table-controls">
      <GsFilterMenu v-if="scopes.length>1" v-model="scope" label="获取方式" :options="scopeOptions" neutral="" />
      <span>{{ filtered.length }} 条</span>
    </div>
    <ol v-if="filtered.length" class="domain-reward-list" :aria-label="sources ? '已知来源与用途' : '奖励明细'">
      <li v-for="(row,i) in visible" :key="row.key || `${page}:${i}`" class="domain-reward-entry">
        <div class="domain-reward-heading">
          <div class="domain-reward-conditions">
            <small>{{ rewardRelationLabel(row) }}</small>
            <div><span v-for="(condition,c) in rewardConditions(row)" :key="c" class="domain-reward-condition">{{ condition }}</span></div>
          </div>
          <span v-if="hasAmount(row)" class="domain-reward-quantity" :aria-label="`数量 ${amount(row)}`">× {{ amount(row) }}</span>
        </div>
        <div v-if="!sources" class="domain-reward-product">
          <div class="domain-reward-icon">
            <DomainMediaPreview v-if="row.product?.presentation?.image" :binding="row.product.presentation.image" :name="rewardProductName(row.product)" compact/>
            <ImageOff v-else :size="22" aria-label="未绑定图片" />
          </div>
          <button v-if="rewardCollectionKey(row.product) || row.product?.target" type="button" class="domain-reward-name" @click="openProduct(row.product)">
            <span><strong>{{ rewardProductName(row.product) }}</strong><small v-if="rewardProductLabel(row.product) !== rewardProductName(row.product)">{{ rewardProductLabel(row.product) }}</small></span><ChevronRight :size="16" />
          </button>
          <div v-else class="domain-reward-name"><span><strong>{{ rewardProductName(row.product) }}</strong><small v-if="rewardProductLabel(row.product) !== rewardProductName(row.product)">{{ rewardProductLabel(row.product) }}</small></span></div>
        </div>
        <div v-else-if="row.event" class="domain-reward-source">
          <button type="button" class="domain-reward-name" @click="emit('open-event',row.event)"><span><strong>{{ row.event.title }}</strong><small>查看关联活动</small></span><ChevronRight :size="16" /></button>
        </div>
        <div v-if="row.campaigns?.length" class="domain-reward-campaigns"><template v-for="campaign in row.campaigns" :key="campaign.id"><small v-if="campaignPeriod(campaign.term)">{{ campaignPeriod(campaign.term) }} 期间登录</small></template></div>
      </li>
    </ol>
    <nav v-if="pages>1" class="domain-pagination" aria-label="奖励分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {ChevronRight,ImageOff} from '@lucide/vue'
import {campaignPeriod,number,rewardConditions,rewardScopeLabels,rewardRelationLabel,rewardProductLabel,rewardCollectionKey} from './DomainPresentation.mjs'
import {presentRewardProductName as rewardProductName} from './useArchiveRewardText.js'
import DomainMediaPreview from './DomainMediaPreview.vue'
import GsFilterMenu from '../gs/GsFilterMenu.vue'
import '../../styles/archive-rewards.css'
const props=defineProps({rows:{type:Array,default:()=>[]},sources:Boolean})
const emit=defineEmits(['open-entity','open-event','open-target'])
const scope=ref(''),page=ref(0),size=25
const scopes=computed(()=>[...new Set(props.rows.map(row=>row.scope).filter(Boolean))])
const scopeOptions=computed(()=>[{value:'',label:'全部',count:props.rows.length},...scopes.value.map(kind=>({value:kind,label:rewardScopeLabels[kind]||'其他来源',count:props.rows.filter(row=>row.scope===kind).length}))])
const filtered=computed(()=>props.rows.filter(row=>!scope.value || row.scope===scope.value))
const pages=computed(()=>Math.ceil(filtered.value.length/size)),visible=computed(()=>filtered.value.slice(page.value*size,(page.value+1)*size))
watch(()=>props.rows,()=>{scope.value='';page.value=0});watch(scope,()=>{page.value=0})
const hasAmount=row=>Number.isFinite(row.product?.amount ?? row.amount)
const amount=row=>hasAmount(row)?number(row.product?.amount ?? row.amount):''
function openProduct(product) {
  const key=rewardCollectionKey(product)
  if(key) emit('open-entity',key)
  else if(product?.target) emit('open-target',product.target)
}
</script>
