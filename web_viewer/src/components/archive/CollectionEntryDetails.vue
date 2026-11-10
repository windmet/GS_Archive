<template>
  <section class="domain-panel collection-entry-details">
    <DomainMediaPreview :binding="kind==='costumes' ? costumeImage(detail.entry?.id,detail.media?.image) : detail.media?.image" :effect-status="detail.media?.effectStatus" :name="name" />
    <div class="domain-detail-title"><h3 :title="detail.entry.nameJa">{{ name }}</h3><p v-if="name !== detail.entry.nameJa" lang="ja" class="collection-original">{{ detail.entry.nameJa }}</p></div>
    <p v-if="description" class="domain-description"><DomainInlineText :text="description" /></p>
    <dl class="domain-meta">
      <div v-if="kind!=='currencies'"><dt>种类</dt><dd>{{ kindLabel }}</dd></div>
      <!-- An idol honor's id names its idol (HonorIdentity), and a costume's model names its wearer, so both link back to the idol. -->
      <div v-if="ownerIdol"><dt>所属偶像</dt><dd><button v-if="linkIdol" type="button" class="collection-idol-link" :data-archive-focus-id="`collection-${domain}-idol:${detail.entry.id}`" @click="emit('open-idol',ownerIdol.code)"><ArchiveIdolAvatar :idol-code="ownerIdol.code" :size="24" decorative />{{ ownerIdol.name }}<ChevronRight :size="15" aria-hidden="true" /></button><template v-else>{{ ownerIdol.name }}</template></dd></div>
      <div v-if="honorIdol?.kind.startsWith('fes-')"><dt>对应 FES</dt><dd>{{ fesHonorMonth(detail.entry) }} FES 限定卡</dd></div>
      <div v-if="detail.entry.term && period"><dt>开放期间</dt><dd>{{ period }}</dd></div>
      <div v-if="kind === 'costumes' && releaseDate"><dt>实装时间</dt><dd>{{ releaseDate }}</dd></div>
      <div v-if="kind === 'items' && Number.isFinite(detail.entry.maxAmount) && detail.entry.maxAmount !== DEFAULT_MAX_AMOUNT"><dt>持有上限</dt><dd>{{ number(detail.entry.maxAmount) }}</dd></div>
      <div v-if="maintainer && detail.entry.hasPrefab"><dt>原始效果</dt><dd>原配置含 Prefab，当前展示静态图片。</dd></div>
    </dl>
    <section v-if="usageCards.length" class="collection-card-usage" :aria-label="usageHeading">
      <h4>{{ usageHeading }} <small>{{ usageCards.length }} 张</small></h4>
      <p v-if="kind !== 'costumes'" class="collection-usage-note">依据卡片的突破素材；不代表获得来源或解锁条件。</p>
      <ul class="collection-usage-list">
        <li v-for="card in usageCards" :key="card.resource_id">
          <button type="button" class="collection-usage-card" :data-archive-focus-id="`collection-card:${domain}:${detail.entry.id}:${card.resource_id}`" @click="emit('open-card',card)">
            <span class="collection-usage-image" aria-hidden="true"><img v-if="card.image?.url && !failedCardImages.has(card.image.url)" :src="card.image.url" alt="" loading="lazy" @error="failedCardImages.add(card.image.url)" /><ImageOff v-else :size="20" /></span>
            <span class="collection-usage-copy">
            <span class="collection-usage-identity"><small v-if="card.rarity">{{ card.rarity }}</small><span v-if="cardIdolName(card)">{{ cardIdolName(card) }}</span></span>
            <strong>{{ cardTitle(card.title) }}</strong>
            <span v-if="card.slots?.length" class="collection-usage-slots">{{ card.slots.map(slot => costumeSlotLabels[slot] || slot).join(' · ') }}</span>
            </span>
            <ChevronRight class="collection-usage-go" :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
    <details class="collection-source-meta"><summary>原始资料</summary><dl class="domain-meta"><div><dt>编号</dt><dd>{{ detail.entry.id }}</dd></div><div v-if="maintainer && detail.entry.resourceId"><dt>资源键</dt><dd>{{ detail.entry.resourceId }}</dd></div><div v-if="maintainer && detail.entry.costumeIds?.length"><dt>衣装 ID</dt><dd>{{ detail.entry.costumeIds.join(' / ') }}</dd></div><div v-if="maintainer && detail.entry.productType"><dt>奖励类型码</dt><dd>{{ detail.entry.productType }}</dd></div><div><dt>原文名称</dt><dd>{{ detail.entry.nameJa || '未命名' }}</dd></div></dl></details>
    <p v-if="footnote" class="domain-muted">{{ footnote }}</p>
  </section>
</template>
<script setup>
import {number,itemBrowseGroup} from './DomainPresentation.mjs'
import {computed,ref,watch} from 'vue'
import {ChevronRight,ImageOff} from '@lucide/vue'
import {historicalPeriodNote,knownHistoricalDate} from './DomainPresentation.mjs'
import {isMaintainerMode} from '../../core/maintainerMode.js'
import {archiveText as costumeText} from './useArchiveCostumeText.js'
import {COLLECTION_KINDS} from '../../core/CollectionRouteState.js'
import {costumeImage,costumeName,costumeSlotLabels,costumeUseLabel} from '../../presentation/CostumeCollection.js'
import {archiveText} from './useArchiveCollectionText.js'
import {archiveText as cardText} from './useArchiveCardTitle.js'
import {IDOL_ID_TO_NAME} from '../../utils/IdolNameMap.js'
import {fesHonorMonth} from '../../presentation/HonorIdentity.mjs'
import {honorIdol as honorIdolOf,honorTitle} from './useHonorTitle.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainInlineText from './DomainInlineText.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
const props=defineProps({detail:{type:Object,required:true},kind:{type:String,required:true},displayIdolName:{type:Function,default:()=>''},linkIdol:Boolean})
const emit=defineEmits(['open-card','open-idol'])
// Engineering fields (resource keys, type codes, costume ids, Prefab notes) are for the maintainer view only.
const maintainer=isMaintainerMode()
const DEFAULT_MAX_AMOUNT=999999
const period=computed(()=>historicalPeriodNote(props.detail.entry))
const honorIdol=computed(()=>props.kind==='honors' ? honorIdolOf(props.detail.entry,props.displayIdolName) : null)
const honorKindLabel=computed(()=>({tantou:'担当称号',catchphrase:'专属台词称号','fes-change':'FES 成就 · 换装','fes-limitbreak':'FES 成就 · 满破'})[honorIdol.value?.kind] || '称号')
const failedCardImages=ref(new Set())
watch(()=>props.detail.entry.key,()=>{failedCardImages.value=new Set()})
const domain=computed(()=>COLLECTION_KINDS[props.kind]?.type || 'item')
const name=computed(()=>props.kind==='honors' ? honorTitle(props.detail.entry,props.displayIdolName) :
  props.kind==='costumes' ? costumeName(props.detail.entry) : archiveText(domain.value,props.detail.entry.nameJa))
// The game text hard-wraps its sentences; single newlines are layout, blank lines are real paragraph breaks.
const unwrap=text=>String(text || '').replace(/(?<!\n)\n(?!\n)/g,'')
const description=computed(()=>unwrap(props.kind==='costumes' ? costumeText('costume',props.detail.entry.descriptionJa,'description') :
  archiveText(domain.value,props.detail.entry.descriptionText?.plain ?? props.detail.entry.descriptionJa,'description')))
const costumeIdol=computed(()=>{
  const code=props.kind==='costumes' ? props.detail.entry.idolCode : ''
  const source=IDOL_ID_TO_NAME[code] || ''
  return code ? {code,name:props.displayIdolName(code,source) || source || code} : null
})
const ownerIdol=computed(()=>honorIdol.value || costumeIdol.value)
const kindLabel=computed(()=>props.kind==='honors' ? (honorIdol.value ? honorKindLabel.value : '称号') :
  props.kind==='currencies' ? '货币' : props.kind==='costumes' ? costumeUseLabel(props.detail.entry) : itemBrowseGroup(props.detail.entry.itemType).label)
const releaseDate=computed(()=>knownHistoricalDate(props.detail.entry.releaseAt))
const usageCards=computed(()=>{
  const cards=props.kind==='items' ? props.detail.usageCards : props.kind==='costumes' ? props.detail.cards : null
  return Array.isArray(cards) ? cards : []
})
const usageHeading=computed(()=>props.kind==='costumes' ? '穿着此衣装的卡片' : '使用此道具的卡片')
// Only what the site made itself is credited: a site-given name or a site-rendered thumbnail.
const footnote=computed(()=>{
  if(props.kind!=='costumes')return ''
  const entry=props.detail.entry || {}
  const parts=[]
  if(!entry.nameJa)parts.push('名称')
  if(costumeImage(entry.id,props.detail.media?.image)?.status==='site-render')parts.push('缩略图')
  return parts.length ? `${parts.join(' / ')}为本站整理` : ''
})
const cardTitle=source=>cardText('card',source,'title')
function cardIdolName(card){const source=IDOL_ID_TO_NAME[card.character_id] || '';return props.displayIdolName(card.character_id,source) || source || ''}
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
.collection-usage-card { display:grid; grid-template-columns:56px minmax(0,1fr) auto; align-items:center; gap:var(--gs-space-4,12px); width:100%; min-width:0; min-height:var(--gs-control-touch,44px); padding:var(--gs-space-2,4px) 0; border:0; border-radius:var(--gs-radius-field,8px); background:transparent; color:var(--gs-ink); font-family:inherit; text-align:left; cursor:pointer; }
.collection-usage-copy { display:grid; gap:4px; min-width:0; }
.collection-usage-image { display:grid; place-items:center; width:56px; height:56px; overflow:hidden; border-radius:var(--gs-radius-field); color:var(--gs-ink-3); }
.collection-usage-image img { display:block; width:100%; height:100%; object-fit:contain; }
.collection-usage-card strong { font-size:var(--gs-text-body,14px); font-weight:var(--gs-weight-semibold,600); line-height:1.6; overflow-wrap:anywhere; }
.collection-usage-identity { display:flex; flex-wrap:wrap; align-items:center; gap:var(--gs-space-1,2px) var(--gs-space-3,8px); min-width:0; font-size:var(--gs-text-meta,12px); line-height:1.5; overflow-wrap:anywhere; }
.collection-usage-slots { color:var(--gs-ink-3); font-size:var(--gs-text-meta,12px); line-height:1.5; overflow-wrap:anywhere; }
.collection-usage-go { color:var(--gs-mint-ink); }
.collection-usage-identity small { padding:var(--gs-space-1,2px) var(--gs-space-2,4px); border-radius:4px; background:var(--gs-mint-wash); color:var(--gs-mint-ink); font-size:inherit; font-weight:var(--gs-weight-semibold,600); }
.collection-idol-link { display:inline-flex; align-items:center; gap:var(--gs-space-2,4px); min-height:var(--gs-control-compact,32px); padding:0; border:0; background:none; color:var(--gs-mint-ink); font:inherit; font-weight:var(--gs-weight-semibold,600); cursor:pointer; }
.collection-idol-link:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
.collection-usage-card:focus-visible { outline:var(--gs-focus-ring,3px) solid var(--gs-mint); outline-offset:var(--gs-focus-offset,2px); }
@media (hover:hover) and (pointer:fine) { .collection-usage-card:hover { background:var(--gs-mint-wash); } }
</style>
