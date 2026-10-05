<template>
  <section class="translation-audit" aria-labelledby="translation-audit-title">
    <div class="audit-heading"><div><h3 id="translation-audit-title">翻译与校对进度</h3><p>初译覆盖与人工校对分别统计。已校对仍可继续修订，不代表终稿。</p></div><button type="button" @click="exportSummary">导出审计摘要</button></div>
    <p class="audit-scope">{{ audit.scope }}。共 {{ audit.general.unique.toLocaleString() }} 条通用原文，使用 {{ audit.general.references.toLocaleString() }} 次；{{ audit.general.batches }} 个 Gemini 校对批次。</p>
    <p v-if="audit.gasha" class="audit-scope">卡池另计 {{ audit.gasha.translation_names }} 个独立名称、{{ audit.gasha.catalog_records }} 条目录记录；其中 {{ audit.gasha.supplemental_groups }} 条由道具补录，关联 {{ audit.gasha.tickets }} 种抽取道具。{{ audit.gasha.unlinked_selection_tickets }} 种选择券未指明具体卡池，未建立抽取关联。开放日期与卡片范围不会由券名推定。</p>
    <div class="audit-legend"><span v-for="(label,key) in statuses" :key="key" :class="key">{{ label }}</span></div>
    <nav class="audit-scopes" aria-label="翻译审计范围"><button v-for="item in scopes" :key="item.id" type="button" :aria-pressed="scope===item.id" @click="scope=item.id;selectedDomain=''">{{ item.label }}</button></nav>
    <div class="audit-groups">
      <button v-for="group in scopedGroups" :key="group.id" type="button" class="audit-group" :aria-pressed="selectedDomain===group.id" @click="openGroup(group.id)">
        <span class="audit-group-label">{{ group.label }}</span>
        <span class="audit-bar" aria-hidden="true"><span v-for="key in ['reviewed','final','draft','stale','missing']" :key="key" :class="key" :style="{width:`${group.total ? group[key]/group.total*100 : 0}%`}" /></span>
        <strong>{{ ((group.draft+group.reviewed+group.final)/Math.max(1,group.total)*100).toFixed(1) }}% 有译文</strong>
        <small>{{ group.reviewed + group.final }} 已校对 / {{ group.total.toLocaleString() }} 原文<span v-if="group.uncertain"> · {{ group.uncertain }} 项待确认术语</span></small>
      </button>
    </div>
    <ul class="audit-pending"><li v-for="entry in audit.pending" :key="entry.id"><strong>{{ entry.label }}</strong> · {{ entry.note }}</li></ul>
    <div v-if="selectedDomain" class="audit-review">
      <div class="audit-heading"><h4>{{ selectedLabel }} · 校对清单</h4><button type="button" @click="selectedDomain=''">收起清单</button></div>
      <p v-if="busy" role="status">正在读取校对清单…</p><p v-if="error" role="alert">{{ error }} <button type="button" @click="openGroup(selectedDomain)">重试</button></p>
      <template v-if="!busy && !error">
        <div class="audit-filters"><label>查找原文、译文或来源<input v-model="query" type="search" /></label><label>校对状态<select v-model="status"><option value="">全部</option><option v-for="(label,key) in statuses" :key="key" :value="key">{{ label }}</option><option value="uncertain">待确认术语</option></select></label><label v-if="!isStory">批次<select v-model="batch"><option value="">全部批次</option><option v-for="id in batches" :key="id">{{ id }}</option></select></label></div>
        <p>{{ filtered.length.toLocaleString() }} 项<span v-if="isStory"> · 按阅读文档列出；进入原文页继续逐行检查。</span><span v-else> · 相同原文在同一资料域内共用译文。初译不会因有译文就被标为已校对。</span></p>
        <ol class="audit-entries">
          <li v-for="row in visible" :key="row.key||row.id">
            <template v-if="isStory"><strong>{{ row.title }}</strong><p>{{ row.reviewed + row.final }} 已校对 · {{ row.draft }} 初译 · {{ row.missing }} 缺译 · {{ row.stale }} 原文变化 / {{ row.total }} 原文单元</p><a :href="row.url">打开阅读页</a><details><summary>来源</summary><code>{{ row.id }}</code><p>{{ row.sourceHash }}</p></details></template>
            <template v-else><div class="audit-text-pair"><p lang="ja"><small>日文原文</small>{{ row.source }}</p><p lang="zh-CN"><small>{{ statuses[row.status] }} · {{ row.batch }}</small>{{ row.translation || '尚无译文' }}</p></div><p v-if="row.notes.length" class="audit-note">{{ row.notes.join('；') }}</p><details><summary>使用位置（{{ row.references.length }}）与翻译记录</summary><p>{{ row.translator }} · {{ row.decision || '初译，待校对' }}</p><code>{{ row.key }}</code><ul><li v-for="ref in row.references" :key="`${ref.id}:${ref.field}`">{{ ref.kind }} · {{ ref.id }} · {{ ref.field }}</li></ul></details></template>
          </li>
        </ol>
        <nav v-if="filtered.length>25" class="audit-pagination" aria-label="校对清单分页"><button type="button" :disabled="!page" @click="page--">上一页</button><span>{{ page+1 }} / {{ Math.ceil(filtered.length/25) }}</span><button type="button" :disabled="(page+1)*25>=filtered.length" @click="page++">下一页</button></nav>
      </template>
    </div>
  </section>
</template>
<script setup>
import {computed,ref,shallowRef,watch} from 'vue'
import audit from '../../../config/translation-audit/summary.json'
const loaders=import.meta.glob('../../../config/translation-audit/general-*.json',{import:'default'})
const statuses={draft:'已有初译 / 待校对',reviewed:'已校对',final:'终稿',missing:'缺译',stale:'原文变化 / 需重查'}
const scopes=[{id:'general',label:'通用资料'},{id:'story',label:'剧情文本'},{id:'ui',label:'界面与人名'}]
const scope=ref('general')
const scopedGroups=computed(()=>audit.groups.filter(g=>scope.value==='story'?g.id.startsWith('story:'):scope.value==='ui'?g.id==='ui'||g.id.startsWith('entity-'):!g.id.startsWith('story:')&&g.id!=='ui'&&!g.id.startsWith('entity-')))
const selectedDomain=ref(''),query=ref(''),status=ref(''),batch=ref(''),page=ref(0),busy=ref(false),error=ref(''),general=shallowRef([]),stories=shallowRef([])
const isStory=computed(()=>selectedDomain.value.startsWith('story:'))
const selectedLabel=computed(()=>audit.groups.find(g=>g.id===selectedDomain.value)?.label||'')
const rows=computed(()=>isStory.value?stories.value.filter(r=>r.domain===selectedDomain.value):general.value.filter(r=>r.kind===selectedDomain.value))
const batches=computed(()=>[...new Set(rows.value.map(r=>r.batch).filter(Boolean))])
const filtered=computed(()=>{const q=query.value.trim().toLowerCase();return rows.value.filter(r=>(!batch.value||r.batch===batch.value)&&(!status.value||(isStory.value?r[status.value]>0:status.value==='uncertain'?r.decision==='uncertain':r.status===status.value))&&(!q||JSON.stringify(r).toLowerCase().includes(q)))})
const visible=computed(()=>filtered.value.slice(page.value*25,(page.value+1)*25))
watch([query,status,batch,selectedDomain],()=>{page.value=0})
let request=0
async function openGroup(id){const turn=++request;selectedDomain.value=id;query.value='';status.value='';batch.value='';error.value='';busy.value=true;try{if(id.startsWith('story:')){if(!stories.value.length){const value=(await import('../../../config/translation-audit/stories.json')).default;if(turn===request)stories.value=value}}else {const value=await loaders[`../../../config/translation-audit/general-${id}.json`]();if(turn===request)general.value=value}}catch(_){if(turn===request)error.value='校对清单载入失败。'}finally{if(turn===request)busy.value=false}}
function exportSummary(){const url=URL.createObjectURL(new Blob([JSON.stringify(audit,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='GS_Archive_translation_audit.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
</script>
<style scoped>
.translation-audit { margin:24px 0;padding:22px;border:1px solid #d6e5e7;border-radius:12px;background:#fff;color:#284752;font-size:13px; }.audit-heading{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.audit-heading h3,.audit-heading h4{margin:0}.audit-heading p,.audit-scope{color:#637b87;line-height:1.6}.translation-audit button,.translation-audit input,.translation-audit select{font:inherit;border:1px solid #cbdedc;border-radius:7px;padding:8px;background:#fff;color:inherit;min-height:36px}.translation-audit button{cursor:pointer}.translation-audit button:focus-visible,.translation-audit input:focus-visible,.translation-audit select:focus-visible{outline:3px solid #159c91;outline-offset:2px}.audit-legend{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.audit-legend>span::before{content:'';display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--tone);margin-right:5px}.draft{--tone:#d3aa61}.reviewed,.final{--tone:#2b9b81}.missing{--tone:#e7edef}.stale{--tone:#c67167}.audit-scopes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.translation-audit .audit-scopes button[aria-pressed=true]{background:#eaf7f2;border-color:#168c7b;color:#116953}.audit-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.translation-audit .audit-group{display:grid;grid-template-columns:1fr auto;gap:7px;text-align:left;padding:12px}.audit-group[aria-pressed=true]{border-color:#168c7b;background:#f0faf7}.audit-group-label{font-weight:600}.audit-group strong{font-size:12px;font-weight:500}.audit-group small{grid-column:1/-1;color:#607c85}.audit-bar{display:flex;height:5px;border-radius:3px;overflow:hidden;grid-column:1/-1;grid-row:2;background:#e7edef}.audit-bar>span{background:var(--tone)}.audit-pending{padding-left:18px;color:#637b87;line-height:1.7}.audit-review{margin-top:24px;padding-top:20px;border-top:1px solid #e0e9ec}.audit-filters{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.audit-filters label{display:grid;gap:5px;min-width:120px}.audit-filters label:first-child{flex:1}.audit-entries{list-style:none;padding:0;margin:0}.audit-entries>li{padding:16px 0;border-bottom:1px solid #e3ebee}.audit-text-pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.audit-text-pair p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.audit-text-pair small{display:block;color:#74878e;margin-bottom:6px}.audit-entries details{margin-top:8px;color:#72868e;font-size:12px;overflow-wrap:anywhere}.audit-entries summary{cursor:pointer}.audit-note{color:#8a6428}.audit-pagination{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:16px}@media(max-width:760px){.translation-audit{padding:14px}.audit-groups,.audit-text-pair{grid-template-columns:1fr}.audit-filters label{flex:1}.audit-group strong{font-size:11px}}
</style>
