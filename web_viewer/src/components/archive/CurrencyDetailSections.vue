<template>
  <section v-if="textLines.length || gashaLines.length" class="domain-panel currency-usage"><h3>用途</h3>
    <ul v-if="textLines.length" class="currency-lines">
      <li v-for="(line,i) in textLines" :key="i"><p>{{ line.textZh }}</p><small v-if="line.quoteJa" lang="ja" class="collection-original"><span v-if="line.kind === 'wiki'" class="currency-tag" lang="zh">攻略 Wiki</span>{{ quoteText(line.quoteJa) }}</small></li>
    </ul>
    <details v-for="line in gashaLines" :key="line.kind+line.currency" class="currency-group">
      <summary><span class="currency-row-copy"><strong>{{ gashaLineLabel(line) }}<small class="currency-tag">攻略 Wiki</small></strong><small>{{ line.gashas.length }} 个卡池</small></span><span class="currency-toggle" aria-hidden="true"><span class="currency-toggle-closed">展开</span><span class="currency-toggle-open">收起</span><ChevronDown :size="15" /></span></summary>
      <ul class="currency-links"><li v-for="gasha in line.gashas" :key="gasha.gashaId"><button type="button" @click="emit('open-gasha',{id:gasha.gashaId,display_name:gasha.titleJa})"><span>{{ gashaText(gasha.titleJa) }}</span><ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
    </details>
  </section>
  <section v-if="detail.gashaSources?.length" class="domain-panel"><h3>卡池中的获得</h3>
    <ul class="currency-acquisition">
      <li v-for="group in detail.gashaSources" :key="group.source">
        <details v-if="group.gashas?.length" class="currency-group">
          <summary><span class="currency-row-copy"><strong>{{ gashaSourceLabels[group.source] || group.source }}</strong><small>{{ group.gashas.length }} 个卡池</small></span><span class="currency-toggle" aria-hidden="true"><span class="currency-toggle-closed">展开</span><span class="currency-toggle-open">收起</span><ChevronDown :size="15" /></span></summary>
          <ul class="currency-links"><li v-for="gasha in group.gashas" :key="gasha.gashaId"><button type="button" @click="emit('open-gasha',{id:gasha.gashaId,display_name:gasha.titleJa})"><span>{{ gashaText(gasha.titleJa) }}</span><ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
        </details>
        <p v-else class="currency-row-copy"><strong>{{ gashaSourceLabels[group.source] || group.source }}</strong><small v-if="group.gashaCount">{{ number(group.gashaCount) }} 个卡池</small></p>
      </li>
    </ul>
  </section>
  <section v-if="detail.acquisition?.length" class="domain-panel"><h3>已知获得来源</h3>
    <ul class="currency-acquisition">
      <li v-for="group in detail.acquisition" :key="group.source">
        <details v-if="group.events?.length" class="currency-group">
          <summary><span class="currency-row-copy"><strong>{{ acquisitionLabel(group.source) }}</strong><small>{{ acquisitionSummary(group) }}</small></span><span class="currency-toggle" aria-hidden="true"><span class="currency-toggle-closed">展开</span><span class="currency-toggle-open">收起</span><ChevronDown :size="15" /></span></summary>
          <ul class="currency-links"><li v-for="row in group.events" :key="row.event_id"><button type="button" @click="emit('open-event',row)"><span>{{ row.title }}</span><small>{{ number(row.totalAmount) }}</small><ChevronRight :size="15" aria-hidden="true" /></button></li></ul>
        </details>
        <p v-else class="currency-row-copy"><strong>{{ acquisitionLabel(group.source) }}</strong><small>{{ acquisitionSummary(group) }}</small></p>
      </li>
    </ul>
  </section>
</template>
<script setup>
import {computed} from 'vue'
import {ChevronDown,ChevronRight} from '@lucide/vue'
import {acquisitionSummary,number} from './DomainPresentation.mjs'
import {gashaText} from './useArchiveGashaText.js'
const props=defineProps({detail:{type:Object,required:true}})
const emit=defineEmits(['open-event','open-gasha'])
const textLines=computed(()=>(props.detail.usage || []).filter(line=>line.textZh))
const gashaLines=computed(()=>(props.detail.usage || []).filter(line=>line.gashas?.length))
const gashaSourceLabels={'gasha-draw':'卡池抽取附赠','memory-star-conversion':'卡池结束后由记忆之星转换'}
const acquisitionLabels={'event-point':'活动累计点数奖励','event-ranking':'活动排名奖励','event-idol-ranking':'活动偶像排名奖励','event-repeated':'活动循环报酬',
  'event-panel':'活动面板奖励','event-story':'活动剧情奖励','event-valentine-level':'情人节活动等级奖励','event-seasonal-story':'季节剧情奖励',
  'producer-level':'制作人等级奖励','producer-rank':'制作人阶级奖励','main-story':'主线剧情奖励','idol-story':'偶像剧情奖励','episode-zero-story':'Episode 0 剧情奖励','home-story':'主页剧情奖励',
  'login-bonus':'登录奖励','campaign-login-bonus':'企划登录奖励'}
// Client strings inline their icons as <emoji>name</emoji>; the quote names the icon instead.
// Format slots ({0}, {1}) are filled by the game at run time; the quote shows them as ○.
const quoteText=text=>String(text).replace(/<emoji>([a-z_]+)<\/emoji>/g,(_,name)=>name==='stamina'?'ST':`[${name}]`).replace(/\{\d+\}/g,'○')
const acquisitionLabel=source=>acquisitionLabels[source] || '其他'
function gashaLineLabel(line){
  if(line.kind==='gasha-exchange')return '可在这些卡池兑换卡片'
  return line.currency==='paid' ? '可用于这些卡池（含付费限定抽取）' : '可用于这些卡池'
}
</script>
<style scoped>
/* Usage quotes, then hairline rows: a row that folds says 「展开」 with a turning chevron; a plain row has none. */
.currency-lines { display:grid; gap:var(--gs-space-4,12px); margin:0 0 var(--gs-space-4,12px); padding:0; list-style:none; }
.currency-lines p { margin:0; line-height:1.6; }
.currency-lines small { display:block; margin-top:var(--gs-space-1,2px); color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); line-height:1.6; overflow-wrap:break-word; }
.currency-acquisition { display:grid; gap:0; margin:0; padding:0; list-style:none; border-top:1px solid var(--gs-line); }
.currency-acquisition > li { border-bottom:1px solid var(--gs-line); }
.currency-acquisition > li > p { margin:0; padding:var(--gs-space-3,8px) 0; }
.currency-row-copy { display:grid; gap:2px; min-width:0; }
.currency-row-copy strong { display:flex; flex-wrap:wrap; align-items:center; gap:var(--gs-space-2,4px); color:var(--gs-ink); font-weight:var(--gs-weight-semibold,600); line-height:1.45; }
.currency-row-copy > small { color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); font-weight:var(--gs-weight-regular,400); line-height:1.45; font-variant-numeric:tabular-nums; }
.currency-tag { display:inline-block; padding:0 var(--gs-space-2,4px); border:1px solid var(--gs-line); border-radius:var(--gs-radius-pill); color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); font-weight:var(--gs-weight-regular,400); }
.currency-lines .currency-tag { margin-right:var(--gs-space-2,4px); }
.currency-usage > .currency-group { border-top:1px solid var(--gs-line); }
.currency-usage > .currency-group:last-child { border-bottom:1px solid var(--gs-line); }
.currency-group summary { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--gs-space-3,8px); min-height:var(--gs-control-touch,44px); padding:var(--gs-space-3,8px) 0; list-style:none; cursor:pointer; }
.currency-group summary::-webkit-details-marker { display:none; }
.currency-toggle { display:inline-flex; align-items:center; gap:2px; padding:var(--gs-space-1,2px) var(--gs-space-2,4px) var(--gs-space-1,2px) var(--gs-space-3,8px); border-radius:var(--gs-radius-pill); background:var(--gs-current-bg-inset); color:var(--gs-ink-2); font-size:var(--gs-text-meta,12px); font-weight:var(--gs-weight-medium,500); white-space:nowrap; }
.currency-toggle svg { transition:transform var(--gs-motion-feedback) var(--gs-ease-out); }
.currency-toggle-open, .currency-group[open] .currency-toggle-closed { display:none; }
.currency-group[open] .currency-toggle-open { display:inline; }
.currency-group[open] .currency-toggle svg { transform:rotate(180deg); }
.currency-links { display:grid; gap:0; margin:0 0 var(--gs-space-3,8px); padding:0 0 0 var(--gs-space-4,12px); list-style:none; border-left:2px solid var(--gs-line); }
.currency-links button { display:grid; grid-template-columns:minmax(0,1fr) auto 15px; align-items:center; gap:var(--gs-space-3,8px); width:100%; min-height:var(--gs-control-touch,44px); padding:var(--gs-space-2,4px) var(--gs-space-2,4px) var(--gs-space-2,4px) 0; border:0; border-radius:var(--gs-radius-control); background:none; color:var(--gs-ink); font:inherit; text-align:left; cursor:pointer; }
.currency-links button > span { min-width:0; overflow-wrap:anywhere; line-height:1.45; }
.currency-links button small { color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); font-variant-numeric:tabular-nums; white-space:nowrap; }
.currency-links button svg { grid-column:3; color:var(--gs-mint-ink); }
.currency-links button > span:first-child + svg { grid-column:3; }
.currency-links button:focus-visible,.currency-group summary:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
@media (hover:hover) and (pointer:fine) { .currency-links button:hover { background:var(--gs-mint-wash); } .currency-group summary:hover .currency-toggle { background:var(--gs-hover); color:var(--gs-ink); } }
@media (prefers-reduced-motion: reduce) { .currency-toggle svg { transition:none; } }
</style>
