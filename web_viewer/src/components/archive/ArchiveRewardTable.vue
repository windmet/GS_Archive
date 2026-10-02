<template>
  <div class="domain-rewards">
    <div class="domain-table-controls">
      <label>获取方式 <select v-model="scope"><option value="">全部</option><option v-for="kind in scopes" :key="kind" :value="kind">{{ rewardScopeLabels[kind] || '其他来源' }}</option></select></label>
      <span>{{ filtered.length }} 条</span>
    </div>
    <ol v-if="filtered.length" class="domain-reward-list" :aria-label="sources ? '已知来源与用途' : '奖励明细'">
      <li v-for="(row,i) in visible" :key="row.key || `${page}:${i}`" class="domain-reward-entry"
        :class="{ 'is-card': !sources && row.product?.kind === 'card' && row.product.referenceStatus === 'resolved-entity' }">
        <div class="domain-reward-heading">
          <div class="domain-reward-conditions">
            <small>{{ rewardRelationLabel(row) }}</small>
            <div><span v-for="(condition,c) in rewardConditions(row)" :key="c" class="domain-reward-condition">{{ condition }}</span></div>
          </div>
          <span class="domain-reward-quantity" :aria-label="`数量 ${amount(row)}`">{{ hasAmount(row) ? '× ' : '' }}{{ amount(row) }}</span>
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
          <small v-if="['unknown-type','missing-entity'].includes(row.product?.referenceStatus)" class="domain-reward-unresolved">奖励引用待确认</small>
        </div>
        <div v-else class="domain-reward-source">
          <button v-if="row.event" type="button" class="domain-reward-name" @click="emit('open-event',row.event)"><span><strong>{{ row.event.title }}</strong><small>查看关联活动</small></span><ChevronRight :size="16" /></button>
          <strong v-else>{{ rewardRelationLabel(row) }}</strong>
        </div>
        <div v-if="row.campaigns?.length" class="domain-reward-campaigns"><small v-for="campaign in row.campaigns" :key="campaign.id">历史企划 {{ campaign.id }} · {{ historicalDate(campaign.term?.openAt) }} — {{ historicalDate(campaign.term?.closeAt) }}</small></div>
      </li>
    </ol>
    <p v-else class="domain-muted">{{ sources ? '尚未收录此藏品的获取来源。' : '尚未收录此范围的奖励明细。' }}</p>
    <nav v-if="pages>1" class="domain-pagination" aria-label="奖励分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {ChevronRight,ImageOff} from '@lucide/vue'
import {historicalDate,number,rewardConditions,rewardScopeLabels,rewardRelationLabel,rewardProductLabel,rewardCollectionKey} from './DomainPresentation.mjs'
import {presentRewardProductName as rewardProductName} from './useArchiveRewardText.js'
import DomainMediaPreview from './DomainMediaPreview.vue'
import '../../styles/archive-rewards.css'
const props=defineProps({rows:{type:Array,default:()=>[]},sources:Boolean})
const emit=defineEmits(['open-entity','open-event','open-target'])
const scope=ref(''),page=ref(0),size=25
const scopes=computed(()=>[...new Set(props.rows.map(row=>row.scope).filter(Boolean))])
const filtered=computed(()=>props.rows.filter(row=>!scope.value || row.scope===scope.value))
const pages=computed(()=>Math.ceil(filtered.value.length/size)),visible=computed(()=>filtered.value.slice(page.value*size,(page.value+1)*size))
watch(()=>props.rows,()=>{scope.value='';page.value=0});watch(scope,()=>{page.value=0})
const hasAmount=row=>Number.isFinite(row.product?.amount ?? row.amount)
const amount=row=>hasAmount(row)?number(row.product?.amount ?? row.amount):'未记录'
function openProduct(product) {
  const key=rewardCollectionKey(product)
  if(key) emit('open-entity',key)
  else if(product?.target) emit('open-target',product.target)
}
</script>
