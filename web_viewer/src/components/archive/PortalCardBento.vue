<template>
  <div v-if="lead" class="card-bento" :class="{'is-global':global}">
    <button class="bento-lead" type="button" :data-archive-focus-id="`portal-card-art:${lead.id}`" :style="{'--card-art':`url(${(lead.landscape || lead.image).url})`}" :aria-label="`打开卡片 ${lead.title}`" @click="emit('open',lead)">
      <img :src="(lead.landscape || lead.image).url" :alt="lead.title" decoding="async" />
      <span class="bento-caption"><small>{{ lead.rarity }} · {{ lead.idolName }}</small><strong>{{ lead.title }}</strong><ArrowUpRight :size="16" /></span>
    </button>
    <template v-if="!global">
      <button v-if="secondary" class="bento-portrait" type="button" :data-archive-focus-id="`portal-card-art:${secondary.id}`" :aria-label="`打开卡片 ${secondary.title}`" @click="emit('open',secondary)"><img :src="secondary.image.url" :alt="secondary.title" /><small>{{ secondary.rarity }}</small></button>
      <button v-if="third" class="bento-note" type="button" :data-archive-focus-id="`portal-card-art:${third.id}`" @click="emit('open',third)"><img :src="third.image.url" alt="" /><span><small>{{ third.rarity }} · 精选档案</small><strong>{{ third.title }}</strong></span><ArrowUpRight :size="16" /></button>
      <button class="bento-directory" type="button" @click="emit('filter',{})"><Layers :size="21" /><strong>{{ cards.length }} 张卡片</strong><small>已展出 {{ displayed }} 张 · 完整图鉴</small><ArrowUpRight :size="17" /></button>
    </template>
    <template v-else>
      <div class="bento-encounter"><header><Sparkles :size="16" /><span>今日相遇</span><button type="button" aria-label="再遇见一张卡片" @click="draw++"><Shuffle :size="16" /></button></header><button v-if="encounter" class="encounter-card" type="button" :data-archive-focus-id="`portal-card:${encounter.id}`" @click="emit('open',encounter)"><img :src="encounter.image.url" alt="" /><span><small>{{ encounter.idolName }} · {{ encounter.rarity }}</small><strong>{{ encounter.title }}</strong></span><ArrowUpRight :size="15" /></button><small>从档案中遇见一颗星</small></div>
      <div class="bento-filters"><span>按属性探索</span><div class="attribute-links"><button v-for="attribute in attributes" :key="attribute.id" type="button" :disabled="!attributeAvailable" :title="attributeAvailable ? '' : '属性索引暂不可用'" :style="{'--attribute':attribute.color}" @click="emit('filter',{attribute:attribute.id})">{{ attribute.label }} <small>{{ attributeAvailable ? cards.filter(row=>row.attribute===attribute.id).length : '—' }}</small></button></div><div class="rarity-links"><button v-for="rarity in rarities" :key="rarity" type="button" @click="emit('filter',{rarity})">{{ rarity }} <small>{{ cards.filter(row=>row.rarity===rarity).length }}</small></button></div></div>
    </template>
  </div>
  <p v-else class="bento-empty">暂无可展示的卡面。</p>
</template>
<script setup>
import {computed,ref} from 'vue'
import {ArrowUpRight,Layers,Shuffle,Sparkles} from '@lucide/vue'
import {portalDailyCard} from '../../presentation/PortalBento.js'
const props=defineProps({cards:{type:Array,default:()=>[]},global:Boolean,offset:{type:Number,default:0}})
const emit=defineEmits(['open','filter'])
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),draw=ref(0)
const lead=computed(()=>{const pool=props.cards.filter(row=>row.landscape?.url);return props.global ? portalDailyCard(pool,date,props.offset) : pool[0] || props.cards.find(row=>row.image?.url)})
const secondary=computed(()=>props.cards.find(row=>row.id!==lead.value?.id && row.image?.url))
const third=computed(()=>props.cards.find(row=>row.id!==lead.value?.id && row.id!==secondary.value?.id && row.image?.url))
const displayed=computed(()=>[lead.value,secondary.value,third.value].filter(Boolean).length)
const encounter=computed(()=>portalDailyCard(props.cards,date,draw.value))
const rarities=['SSR','SR','R','N']
const attributeAvailable=computed(()=>props.cards.length>0 && props.cards.every(row=>row.attribute))
const attributes=[{id:'Physical',label:'Physical',color:'#ca4d5d'},{id:'Intelligence',label:'Intelligence',color:'#446aa8'},{id:'Mental',label:'Mental',color:'#9b7f24'}]
</script>
<style scoped>
.card-bento {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:224px 94px;gap:10px;min-width:0;}
.card-bento button {font:inherit;cursor:pointer;color:inherit;min-width:0;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffa0;text-align:left;}
.card-bento button:focus-visible {outline:2px solid var(--portal-accent);outline-offset:3px;}
.bento-lead {position:relative;grid-column:span 2;overflow:hidden;padding:0;display:flex;flex-direction:column;justify-content:center;background:#e8e9f0!important;}
.bento-lead:before {content:'';position:absolute;inset:-20px;background-image:var(--card-art);background-size:cover;background-position:center;filter:blur(20px);opacity:.35;}
.bento-lead > img {position:relative;width:100%;height:100%;object-fit:contain;min-height:0;}
.bento-caption {position:absolute;inset:auto 0 0;display:grid;grid-template-columns:1fr auto;gap:3px;padding:24px 14px 12px;background:linear-gradient(transparent,#102330db);color:#fff;}
.bento-caption small {grid-column:1/-1;font-size:10px;}
.bento-caption strong {font-size:14px;line-height:1.4;}
.bento-portrait {position:relative;padding:0;overflow:hidden;}
.bento-portrait img {width:100%;height:100%;object-fit:contain;}
.bento-portrait > small {position:absolute;top:8px;left:8px;padding:2px 6px;background:#fff9;border-radius:5px;color:var(--portal-accent);}
.bento-note {grid-column:span 2;display:flex;align-items:center;gap:12px;padding:10px;}
.bento-note > img {width:54px;height:72px;object-fit:contain;}
.bento-note > span {flex:1;display:grid;gap:4px;min-width:0;}
.bento-note small,.bento-directory small,.bento-encounter > small {color:var(--portal-muted);font-size:10px;}
.bento-note strong {font-size:13px;line-height:1.4;overflow-wrap:anywhere;}
.bento-directory {position:relative;display:grid;gap:2px;align-content:center;padding:10px 12px;background:var(--portal-tint)!important;}
.bento-directory > svg:last-child {position:absolute;right:10px;top:12px;}
.bento-directory strong {font-size:14px;}
.is-global {grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-rows:168px 150px;}
.is-global .bento-lead {grid-column:1;grid-row:span 2;}
.bento-encounter,.bento-filters {padding:12px 14px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffff98;min-width:0;}
.bento-encounter header {display:flex;align-items:center;gap:6px;color:var(--portal-accent);font-size:12px;}
.bento-encounter header button {display:grid;place-items:center;min-height:30px;width:30px;margin-left:auto;border:0;background:transparent;}
.encounter-card {display:flex;align-items:center;gap:12px;width:100%;padding:4px 0;border:0!important;background:transparent!important;}
.encounter-card img {height:78px;width:62px;object-fit:contain;}
.encounter-card span {flex:1;min-width:0;display:grid;gap:4px;}
.encounter-card small {color:var(--portal-muted);font-size:11px;}
.encounter-card strong {font-size:13px;line-height:1.35;}
.bento-filters > span {font-size:11px;color:var(--portal-muted);}
.attribute-links,.rarity-links {display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;}
.attribute-links button {padding:5px 7px;color:var(--attribute);background:color-mix(in srgb,var(--attribute) 7%,white);border-color:color-mix(in srgb,var(--attribute) 20%,white);font-size:11px;min-height:32px;}
.rarity-links button {font-size:11px;min-height:30px;padding:3px 7px;}
.bento-empty {color:var(--portal-muted);}
@media(hover:hover) and (pointer:fine){.card-bento button:hover {box-shadow:0 4px 12px #1b33441a;border-color:var(--portal-accent);}.bento-note,.bento-directory,.encounter-card {transition:transform 160ms ease-out;}.bento-note:hover,.bento-directory:hover {transform:translateY(-2px);}}
@media(prefers-reduced-motion:reduce){.card-bento button {transition:none!important;transform:none!important;}}
@container(max-width:850px){.card-bento {grid-template-rows:210px 94px;}.is-global {grid-template-rows:168px 150px;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);}}

.bento-note,.bento-directory {border:0!important;box-shadow:none!important;background:color-mix(in srgb,var(--portal-idol-color) 6%,#ffffffa0)!important;}
</style>
