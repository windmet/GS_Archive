<template>
  <div class="domain-rewards">
    <div class="domain-table-controls">
      <label>获取方式 <select v-model="scope"><option value="">全部</option><option v-for="kind in scopes" :key="kind" :value="kind">{{ rewardScopeLabels[kind] || '其他来源' }}</option></select></label>
      <span>{{ filtered.length }} 条</span>
    </div>
    <div v-if="filtered.length" class="domain-table-wrap">
      <table><thead><tr><th>方式 / 关联活动</th><th>条件</th><th v-if="!sources">奖励</th><th>数量</th></tr></thead>
        <tbody><tr v-for="(row,i) in visible" :key="row.key || `${page}:${i}`">
          <td><span>{{ rewardScopeLabels[row.scope] || relationLabel(row) }}</span><button v-if="row.event" type="button" class="domain-link" @click="emit('open-event',row.event)">{{ row.event.title }}</button></td>
          <td>{{ rewardCondition(row) }}<small v-for="campaign in row.campaigns" :key="campaign.id">历史企划 {{ campaign.id }} · {{ historicalDate(campaign.term?.openAt) }} — {{ historicalDate(campaign.term?.closeAt) }}</small></td>
          <td v-if="!sources"><button v-if="['item','honor'].includes(row.product?.kind) && row.product.referenceStatus === 'resolved-entity'" type="button" class="domain-link" @click="emit('open-entity',row.product.entityKey)">{{ productName(row.product) }}</button><button v-else-if="row.product?.target" type="button" class="domain-link" @click="emit('open-target',row.product.target)">{{ productName(row.product) }}</button><span v-else>{{ productName(row.product) }}</span><small v-if="row.product?.referenceStatus === 'unknown-type' || row.product?.referenceStatus === 'missing-entity'">奖励引用待确认</small></td>
          <td>{{ typeof (row.product?.amount ?? row.amount)==='number' ? number(row.product?.amount ?? row.amount) : '未记录' }}</td>
        </tr></tbody>
      </table>
    </div>
    <p v-else class="domain-muted">{{ sources ? '尚未收录此藏品的获取来源。' : '尚未收录此范围的奖励明细。' }}</p>
    <nav v-if="pages>1" class="domain-pagination" aria-label="奖励分页"><button type="button" :disabled="page===0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pages }}</span><button type="button" :disabled="page+1>=pages" @click="page++">下一页</button></nav>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {historicalDate,number,rewardCondition,rewardScopeLabels,sourceDomainLabels} from './DomainPresentation.mjs'
const props=defineProps({rows:{type:Array,default:()=>[]},sources:Boolean})
const emit=defineEmits(['open-entity','open-event','open-target'])
const scope=ref(''),page=ref(0),size=25
const scopes=computed(()=>[...new Set(props.rows.map(row=>row.scope).filter(Boolean))])
const filtered=computed(()=>props.rows.filter(row=>!scope.value || row.scope===scope.value))
const pages=computed(()=>Math.ceil(filtered.value.length/size)),visible=computed(()=>filtered.value.slice(page.value*size,(page.value+1)*size))
watch(()=>props.rows,()=>{scope.value='';page.value=0});watch(scope,()=>{page.value=0})
const productName=product=>product?.nameJa || product?.typeNameJa || `未解析奖励 ${product?.productId ?? ''}`
const relationLabel=row=>row.relation==='card-awakening-cost'?'觉醒消耗':row.relation==='event-material'?'活动材料':sourceDomainLabels[row.sourceTable] || '其他客户端来源'
</script>
