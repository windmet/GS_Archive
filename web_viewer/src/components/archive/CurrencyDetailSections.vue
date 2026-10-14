<template>
  <section class="domain-panel currency-usage"><h3>用途</h3>
    <ul class="currency-lines">
      <li v-for="(line,i) in textLines" :key="i"><p>{{ line.textZh }}</p><small v-if="line.quoteJa" lang="ja" class="collection-original">{{ line.kind === 'wiki' ? '攻略 Wiki' : '客户端文本' }}：{{ line.quoteJa }}</small></li>
    </ul>
    <details v-for="line in gashaLines" :key="line.kind+line.currency" class="currency-group">
      <summary>{{ gashaLineLabel(line) }} <small>{{ line.gashas.length }} 个卡池</small></summary>
      <ul class="currency-links"><li v-for="gasha in line.gashas" :key="gasha.gashaId"><button type="button" @click="emit('open-gasha',{id:gasha.gashaId,display_name:gasha.titleJa})">{{ gashaText(gasha.titleJa) }}<ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
    </details>
    <p v-if="gashaLines.length" class="domain-muted">卡池用途依据攻略 Wiki 卡池页面整理，覆盖已收录的卡池。</p>
  </section>
  <section v-if="detail.gashaSources?.length" class="domain-panel"><h3>卡池中的获得</h3>
    <template v-for="group in detail.gashaSources" :key="group.source">
      <details v-if="group.gashas?.length" class="currency-group">
        <summary>{{ gashaSourceLabels[group.source] || group.source }} <small>{{ group.gashas.length }} 个卡池</small></summary>
        <ul class="currency-links"><li v-for="gasha in group.gashas" :key="gasha.gashaId"><button type="button" @click="emit('open-gasha',{id:gasha.gashaId,display_name:gasha.titleJa})">{{ gashaText(gasha.titleJa) }}<ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
      </details>
      <p v-else>{{ gashaSourceLabels[group.source] || group.source }}<template v-if="group.gashaCount"> · {{ number(group.gashaCount) }} 个卡池</template></p>
    </template>
  </section>
  <section class="domain-panel"><h3>已知获得来源</h3>
    <p v-if="!detail.acquisition?.length" class="domain-muted">客户端奖励配置中没有发放此资源的记录。</p>
    <ul v-else class="currency-acquisition">
      <li v-for="group in detail.acquisition" :key="group.source">
        <details v-if="group.events?.length" class="currency-group">
          <summary>{{ acquisitionLabel(group.source) }} <small>{{ number(group.count) }} 条 · 合计 {{ number(group.totalAmount) }}</small></summary>
          <ul class="currency-links"><li v-for="row in group.events" :key="row.event_id"><button type="button" @click="emit('open-event',row)"><span>{{ row.title }}</span><small>{{ number(row.count) }} 条 · 合计 {{ number(row.totalAmount) }}</small><ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
        </details>
        <p v-else>{{ acquisitionLabel(group.source) }} <small>{{ number(group.count) }} 条 · 合计 {{ number(group.totalAmount) }}<template v-if="group.levelRange"> · Lv.{{ group.levelRange[0] }}–{{ group.levelRange[1] }}</template></small></p>
      </li>
    </ul>
    <p class="domain-muted">数量为客户端奖励配置的合计，按历史配置统计，不代表单个账号可获得的总量。</p>
  </section>
</template>
<script setup>
import {computed} from 'vue'
import {ChevronRight} from '@lucide/vue'
import {number} from './DomainPresentation.mjs'
import {gashaText} from './useArchiveGashaText.js'
const props=defineProps({detail:{type:Object,required:true}})
const emit=defineEmits(['open-event','open-gasha'])
const textLines=computed(()=>(props.detail.usage || []).filter(line=>line.textZh))
const gashaLines=computed(()=>(props.detail.usage || []).filter(line=>line.gashas?.length))
const gashaSourceLabels={'gasha-draw':'卡池抽取附赠','memory-star-conversion':'卡池结束后由记忆之星转换'}
const acquisitionLabels={'event-point':'活动累计点数奖励','event-ranking':'活动排名奖励','event-idol-ranking':'活动偶像排名奖励','event-repeated':'活动重复奖励',
  'event-panel':'活动面板奖励','event-story':'活动剧情奖励','event-valentine-level':'情人节活动等级奖励','event-seasonal-story':'季节剧情奖励',
  'producer-level':'制作人等级奖励','producer-rank':'制作人阶级奖励','main-story':'主线剧情奖励','idol-story':'偶像剧情奖励','episode-zero-story':'Episode 0 剧情奖励','home-story':'主页剧情奖励',
  'login-bonus':'登录奖励','campaign-login-bonus':'企划登录奖励'}
const acquisitionLabel=source=>acquisitionLabels[source] || '其他客户端来源'
function gashaLineLabel(line){
  if(line.kind==='gasha-exchange')return '可在这些卡池兑换卡片'
  return line.currency==='paid' ? '可用于这些卡池（含付费限定抽取）' : '可用于这些卡池'
}
</script>
<style scoped>
.currency-lines,.currency-links,.currency-acquisition { display:grid; gap:var(--gs-space-3,8px); margin:0 0 var(--gs-space-4,12px); padding:0; list-style:none; }
.currency-lines p,.currency-acquisition p { margin:0; line-height:1.6; }
.currency-lines small,.currency-acquisition small,.currency-group summary small { display:block; color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); line-height:1.5; overflow-wrap:anywhere; }
.currency-group summary small { display:inline; margin-left:var(--gs-space-2,4px); }
.currency-group { margin:0 0 var(--gs-space-3,8px); }
.currency-group summary { min-height:var(--gs-control-touch,44px); display:flex; align-items:center; flex-wrap:wrap; gap:var(--gs-space-2,4px); cursor:pointer; font-weight:var(--gs-weight-semibold,600); }
.currency-links { margin:var(--gs-space-2,4px) 0 0; padding-left:var(--gs-space-4,12px); border-left:2px solid var(--gs-line); }
.currency-links button { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--gs-space-1,2px) var(--gs-space-3,8px); width:100%; min-height:var(--gs-control-touch,44px); padding:var(--gs-space-2,4px) 0; border:0; background:none; color:var(--gs-mint-ink); font:inherit; text-align:left; cursor:pointer; overflow-wrap:anywhere; }
.currency-links button small { grid-column:1; color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); }
.currency-links button svg { grid-column:2; grid-row:1 / span 2; }
.currency-links button:focus-visible,.currency-group summary:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
@media (hover:hover) and (pointer:fine) { .currency-links button:hover { background:var(--gs-mint-wash); } }
</style>
