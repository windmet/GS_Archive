<template>
  <section class="domain-panel collection-entry-details">
    <DomainMediaPreview :binding="detail.media?.image" :effect-status="detail.media?.effectStatus" :name="name" />
    <div class="domain-detail-title"><h3 :title="detail.entry.nameJa">{{ name }}</h3><p v-if="name !== detail.entry.nameJa" lang="ja" class="collection-original">{{ detail.entry.nameJa }}</p></div>
    <p class="domain-description"><DomainInlineText :text="description" /></p>
    <dl class="domain-meta">
      <div><dt>种类</dt><dd>{{ kind === 'honors' ? (honorIdol ? honorKindLabel : '称号') : itemBrowseGroup(detail.entry.itemType).label }}</dd></div>
      <!-- An idol honor's id names its idol (HonorIdentity), so the honor page links back to the idol. -->
      <div v-if="honorIdol"><dt>所属偶像</dt><dd><button v-if="linkIdol" type="button" class="collection-idol-link" :data-archive-focus-id="`collection-honor-idol:${detail.entry.id}`" @click="emit('open-idol',honorIdol.code)"><ArchiveIdolAvatar :idol-code="honorIdol.code" :size="24" decorative />{{ honorIdol.name }}<ChevronRight :size="15" aria-hidden="true" /></button><template v-else>{{ honorIdol.name }}</template></dd></div>
      <div v-if="honorIdol?.kind.startsWith('fes-')"><dt>对应 FES</dt><dd>{{ fesHonorMonth(detail.entry) }} FES 限定卡</dd></div>
      <div v-if="detail.entry.term"><dt>历史配置期</dt><dd>{{ historicalPeriod(detail.entry) }}</dd></div>
      <div v-if="kind === 'items'"><dt>持有上限</dt><dd>{{ detail.entry.maxAmount === undefined ? '未记录' : number(detail.entry.maxAmount) }}</dd></div>
      <div v-if="detail.entry.hasPrefab"><dt>原始效果</dt><dd>原配置含 Prefab，当前展示静态图片。</dd></div>
    </dl>
    <section v-if="usageCards.length" class="collection-card-usage" aria-label="使用此道具的卡片">
      <h4>使用此道具的卡片 <small>{{ usageCards.length }} 张</small></h4>
      <p class="collection-usage-note">依据卡片的突破素材配置；不代表获得来源或解锁条件。</p>
      <ul class="collection-usage-list">
        <li v-for="card in usageCards" :key="card.resource_id">
          <button type="button" class="collection-usage-card" :data-archive-focus-id="`collection-card:item:${detail.entry.id}:${card.resource_id}`" @click="emit('open-card',card)">
            <span class="collection-usage-image" aria-hidden="true"><img v-if="card.image?.url && !failedCardImages.has(card.image.url)" :src="card.image.url" alt="" loading="lazy" @error="failedCardImages.add(card.image.url)" /><ImageOff v-else :size="20" /></span>
            <span class="collection-usage-copy">
            <span class="collection-usage-identity"><small v-if="card.rarity">{{ card.rarity }}</small><span>{{ cardIdolName(card) }}</span></span>
            <strong>{{ cardTitle(card.title) }}</strong>
            </span>
          </button>
        </li>
      </ul>
    </section>
    <details class="collection-source-meta"><summary>原始资料</summary><dl class="domain-meta"><div><dt>编号</dt><dd>{{ detail.entry.id }}</dd></div><div><dt>资源键</dt><dd>{{ detail.entry.resourceId }}</dd></div><div><dt>原文名称</dt><dd>{{ detail.entry.nameJa }}</dd></div></dl></details>
    <p class="domain-muted">{{ kind === 'honors' ? '以下是已知来源，不代表完整的解锁条件。' : '历史配置不代表当前可获得。用途分类为阅读整理标签；兑换商店和任务来源尚未完整收录。' }}</p>
  </section>
</template>
<script setup>
import {number,itemBrowseGroup} from './DomainPresentation.mjs'
import {computed,ref,watch} from 'vue'
import {ChevronRight,ImageOff} from '@lucide/vue'
import {historicalPeriod} from './DomainPresentation.mjs'
import {archiveText} from './useArchiveCollectionText.js'
import {archiveText as cardText} from './useArchiveCardTitle.js'
import {IDOL_ID_TO_NAME,IDOL_NAME_TO_ID} from '../../utils/IdolNameMap.js'
import {idolHonorIdentity,fesHonorMonth} from '../../presentation/HonorIdentity.mjs'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainInlineText from './DomainInlineText.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
const props=defineProps({detail:{type:Object,required:true},kind:{type:String,required:true},displayIdolName:{type:Function,default:()=>''},linkIdol:Boolean})
const emit=defineEmits(['open-card','open-idol'])
const honorIdol=computed(()=>{
  const identity=props.kind==='honors' ? idolHonorIdentity(props.detail.entry) : null
  const code=identity && Object.values(IDOL_NAME_TO_ID).find(value=>/^\d{3}/.test(value) && Number(value.slice(0,3))===identity.idolNumber)
  return code ? {code,kind:identity.kind,name:props.displayIdolName(code,IDOL_ID_TO_NAME[code]) || IDOL_ID_TO_NAME[code] || code} : null
})
const honorKindLabel=computed(()=>({tantou:'担当称号',catchphrase:'专属台词称号','fes-change':'FES 成就 · 换装','fes-limitbreak':'FES 成就 · 满破'})[honorIdol.value?.kind] || '称号')
const failedCardImages=ref(new Set())
watch(()=>props.detail.entry.key,()=>{failedCardImages.value=new Set()})
const domain=computed(()=>props.kind==='honors'?'honor':'item')
const name=computed(()=>archiveText(domain.value,props.detail.entry.nameJa))
const description=computed(()=>archiveText(domain.value,props.detail.entry.descriptionText?.plain,'description') || '尚未收录说明。')
const usageCards=computed(()=>props.kind==='items' && Array.isArray(props.detail.usageCards) ? props.detail.usageCards : [])
const cardTitle=source=>cardText('card',source,'title')
function cardIdolName(card){const source=IDOL_ID_TO_NAME[card.character_id] || '';return props.displayIdolName(card.character_id,source) || source || '姓名待确认'}
</script>
<style scoped>
.domain-detail-title { display:block; }
.domain-detail-title h3 { min-width:0;overflow-wrap:anywhere; }
.collection-card-usage { min-width:0; margin:var(--gs-space-6,20px) 0; padding-top:var(--gs-space-5,16px); border-top:1px solid var(--gs-line); }
.collection-card-usage h4 { display:flex; flex-wrap:wrap; align-items:baseline; gap:var(--gs-space-3,8px); margin:0; color:var(--gs-ink); font-size:var(--gs-text-subtitle,16px); font-weight:var(--gs-weight-semibold,600); line-height:1.5; }
.collection-card-usage h4 small { color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); font-weight:var(--gs-weight-regular,400); }
.collection-usage-note { margin:var(--gs-space-3,8px) 0 var(--gs-space-4,12px); color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); line-height:1.6; }
.collection-usage-list { display:grid; gap:var(--gs-space-3,8px); margin:0; padding:0; list-style:none; }
.collection-usage-list > li { display:block; min-width:0; padding-bottom:var(--gs-space-3,8px); border-bottom:1px solid var(--gs-line); }
.collection-usage-card { display:grid; grid-template-columns:44px minmax(0,1fr); align-items:center; gap:var(--gs-space-2,4px); width:100%; min-width:0; min-height:var(--gs-control-touch,44px); padding:var(--gs-space-2,4px) 0; border:0; border-radius:var(--gs-radius-field,8px); background:transparent; color:var(--gs-ink); font-family:inherit; text-align:left; cursor:pointer; }
.collection-usage-copy { display:grid; gap:4px; min-width:0; }
.collection-usage-image { display:grid; place-items:center; width:44px; height:44px; color:var(--gs-ink-3); }
.collection-usage-image img { display:block; width:100%; height:100%; object-fit:contain; }
.collection-usage-card strong { font-size:var(--gs-text-body,14px); font-weight:var(--gs-weight-semibold,600); line-height:1.6; overflow-wrap:anywhere; }
.collection-usage-identity { display:flex; flex-wrap:wrap; align-items:center; gap:var(--gs-space-3,8px); font-size:var(--gs-text-meta,12px); line-height:1.5; overflow-wrap:anywhere; }
.collection-usage-identity small { padding:var(--gs-space-1,2px) var(--gs-space-2,4px); border-radius:4px; background:var(--gs-mint-wash); color:var(--gs-mint-ink); font-size:inherit; font-weight:var(--gs-weight-semibold,600); }
.collection-idol-link { display:inline-flex; align-items:center; gap:var(--gs-space-2,4px); min-height:var(--gs-control-compact,32px); padding:0; border:0; background:none; color:var(--gs-mint-ink); font:inherit; font-weight:var(--gs-weight-semibold,600); cursor:pointer; }
.collection-idol-link:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
.collection-usage-card:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
@media (hover:hover) and (pointer:fine) { .collection-usage-card:hover { background:var(--gs-mint-wash); } }
</style>
