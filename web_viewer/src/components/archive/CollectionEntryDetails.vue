<template>
  <section class="domain-panel collection-entry-details">
    <DomainMediaPreview :binding="detail.media?.image" :effect-status="detail.media?.effectStatus" :name="name" />
    <div class="domain-detail-title"><h3 :title="detail.entry.nameJa">{{ name }}</h3></div>
    <p class="domain-description"><DomainInlineText :text="description" /></p>
    <dl class="domain-meta">
      <div><dt>种类</dt><dd>{{ kind === 'honors' ? '称号' : '道具' }} · 类别 {{ detail.entry.itemType ?? detail.entry.honorType }}</dd></div>
      <div v-if="detail.entry.term"><dt>历史配置期</dt><dd>{{ historicalPeriod(detail.entry) }}</dd></div>
      <div v-if="kind === 'items'"><dt>持有上限</dt><dd>{{ detail.entry.maxAmount === undefined ? '未记录' : number(detail.entry.maxAmount) }}</dd></div>
      <div v-if="detail.entry.hasPrefab"><dt>原始效果</dt><dd>原配置含 Prefab，当前展示静态图片。</dd></div>
    </dl>
    <p class="domain-muted">{{ kind === 'honors' ? '以下是已知来源，不代表完整的解锁条件。' : '历史配置不代表当前可获得。用途分类为阅读整理标签；兑换商店和任务来源尚未完整收录。' }}</p>
  </section>
</template>
<script setup>
import {number} from './DomainPresentation.mjs'
import {computed} from 'vue'
import {historicalPeriod} from './DomainPresentation.mjs'
import {archiveText} from './useArchiveGeneralText.js'
import DomainInlineText from './DomainInlineText.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
const props=defineProps({detail:{type:Object,required:true},kind:{type:String,required:true}})
const domain=computed(()=>props.kind==='honors'?'honor':'item')
const name=computed(()=>archiveText(domain.value,props.detail.entry.nameJa))
const description=computed(()=>archiveText(domain.value,props.detail.entry.descriptionText?.plain,'description') || '尚未收录说明。')
</script>
<style scoped>
.domain-detail-title { display:block; }
.domain-detail-title h3 { min-width:0;overflow-wrap:anywhere; }
</style>
