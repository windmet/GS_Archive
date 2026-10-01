<template>
  <section class="domain-panel collection-entry-details">
    <div class="domain-detail-title"><Medal v-if="kind === 'honors'" /><Box v-else /><h3>{{ detail.entry.nameJa }}</h3></div>
    <DomainMediaPreview :binding="detail.media?.image" :effect-status="detail.media?.effectStatus" :name="detail.entry.nameJa" />
    <p class="domain-description">{{ detail.entry.descriptionText?.plain || '尚未收录说明。' }}</p>
    <dl class="domain-meta">
      <div><dt>种类</dt><dd>{{ kind === 'honors' ? '称号' : '道具' }} · 类别 {{ detail.entry.itemType ?? detail.entry.honorType }}</dd></div>
      <div v-if="detail.entry.term"><dt>历史配置期</dt><dd>{{ historicalDate(detail.entry.term.openAt) }} — {{ historicalDate(detail.entry.term.closeAt) }}</dd></div>
      <div v-if="kind === 'items'"><dt>持有上限</dt><dd>{{ detail.entry.maxAmount === undefined ? '未记录' : number(detail.entry.maxAmount) }}</dd></div>
      <div v-if="detail.entry.hasPrefab"><dt>原始效果</dt><dd>原配置含 Prefab，当前展示静态图片。</dd></div>
    </dl>
    <p class="domain-muted">{{ kind === 'honors' ? '以下是已知来源，不代表完整的解锁条件。' : '历史配置不代表当前可获得。用途分类为阅读整理标签；兑换商店和任务来源尚未完整收录。' }}</p>
  </section>
</template>
<script setup>
import {Box,Medal} from '@lucide/vue'
import {historicalDate,number} from './DomainPresentation.mjs'
import DomainMediaPreview from './DomainMediaPreview.vue'
defineProps({detail:{type:Object,required:true},kind:{type:String,required:true}})
</script>
