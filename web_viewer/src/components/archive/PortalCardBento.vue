<template>
  <div v-if="lead" class="card-bento" :class="{'is-global':global}">
    <button class="bento-lead" type="button" :data-archive-focus-id="`portal-card-art:${lead.id}`" :style="{'--card-art':`url(${(lead.landscape || lead.image).url})`}" :aria-label="`打开卡片 ${lead.title}`" @click="emit('open',lead)">
      <picture><source v-if="lead.image?.url" media="(max-width:760px)" :srcset="lead.image.url" /><img :src="(lead.landscape || lead.image).url" :alt="lead.title" decoding="async" /></picture>
      <span class="bento-caption"><small>{{ lead.rarity }} · {{ lead.idolName }}</small><strong>{{ lead.title }}</strong><ArrowUpRight :size="16" /></span>
    </button>
    <template v-if="!global">
      <button v-if="secondary" class="bento-portrait" type="button" :data-archive-focus-id="`portal-card-art:${secondary.id}`" :aria-label="`打开卡片 ${secondary.title}`" @click="emit('open',secondary)"><img :src="secondary.image.url" :alt="secondary.title" /><small>{{ secondary.rarity }}</small></button>
      <button v-if="third" class="bento-note" type="button" :data-archive-focus-id="`portal-card-art:${third.id}`" @click="emit('open',third)"><img :src="third.image.url" alt="" /><span><small>{{ third.rarity }} · 精选档案</small><strong>{{ third.title }}</strong></span><ArrowUpRight :size="16" /></button>
      <button class="bento-directory" type="button" @click="emit('filter',{})"><Layers :size="21" /><strong>{{ counts?.total ?? cards.length }} 张卡片</strong><small>已展出 {{ displayed }} 张 · 完整图鉴</small><ArrowUpRight :size="17" /></button>
    </template>
    <template v-else>
      <div class="bento-encounter"><header><Sparkles :size="16" /><span>今日相遇</span><button type="button" aria-label="再遇见一张卡片" @click="draw++; emit('expand')"><Shuffle :size="16" /></button></header><button v-if="encounter" class="encounter-card" type="button" :data-archive-focus-id="`portal-card:${encounter.id}`" @click="emit('open',encounter)"><img :src="encounter.image.url" alt="" /><span :data-idol="encounter.idolName"><small>{{ encounter.idolName }} · {{ encounter.rarity }}</small><strong>{{ encounter.title }}</strong></span><ArrowUpRight :size="15" /></button><small>从档案中遇见一颗星</small></div>
      <button v-if="encounterNext" class="encounter-next" type="button" :data-archive-focus-id="`portal-card:${encounterNext.id}`" :aria-label="`打开卡片 ${encounterNext.title}`" @click="emit('open',encounterNext)"><img :src="encounterNext.image.url" alt="" /><strong>{{ encounterNext.idolName }}</strong></button>
      <div class="bento-filters"><span>按属性探索</span><div class="attribute-links"><button v-for="attribute in attributes" :key="attribute.id" type="button" :disabled="!attributeAvailable" :title="attributeAvailable ? '' : '属性索引暂不可用'" :style="{'--attribute':attribute.color}" @click="emit('filter',{attribute:attribute.id})">{{ attribute.label }} <small>{{ attributeAvailable ? counts?.attribute?.[attribute.id] ?? cards.filter(row=>row.attribute===attribute.id).length : '—' }}</small></button></div><div class="rarity-links"><button v-for="rarity in rarities" :key="rarity" type="button" @click="emit('filter',{rarity})">{{ rarity }} <small>{{ counts?.rarity?.[rarity] ?? cards.filter(row=>row.rarity===rarity).length }}</small></button></div></div>
    </template>
  </div>
  <p v-else class="bento-empty">暂无可展示的卡面。</p>
</template>
<script setup>
import {computed,ref} from 'vue'
import {ArrowUpRight,Layers,Shuffle,Sparkles} from '@lucide/vue'
import {portalDailyCard} from '../../presentation/PortalBento.js'
const props=defineProps({cards:{type:Array,default:()=>[]},counts:Object,global:Boolean,offset:{type:Number,default:0}})
const emit=defineEmits(['open','filter','expand'])
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),draw=ref(0)
const lead=computed(()=>{const pool=props.cards.filter(row=>row.landscape?.url);return props.global ? portalDailyCard(pool,date,props.offset) : pool[0] || props.cards.find(row=>row.image?.url)})
const secondary=computed(()=>props.cards.find(row=>row.id!==lead.value?.id && row.image?.url))
const third=computed(()=>props.cards.find(row=>row.id!==lead.value?.id && row.id!==secondary.value?.id && row.image?.url))
const displayed=computed(()=>[lead.value,secondary.value,third.value].filter(Boolean).length)
// The encounter is never the lead card already shown beside it.
const encounter=computed(()=>portalDailyCard(props.cards.filter(row=>row.id!==lead.value?.id),date,draw.value))
// A second encounter sits beside the first, both as pictures next to the lead.
const encounterNext=computed(()=>{const next=portalDailyCard(props.cards.filter(row=>row.id!==encounter.value?.id && row.id!==lead.value?.id),date,draw.value);return next?.image?.url ? next : null})
const rarities=['SSR','SR','R','N']
const attributeAvailable=computed(()=>Boolean(props.counts?.attribute && Object.keys(props.counts.attribute).length === 3) || (props.cards.length>0 && props.cards.every(row=>row.attribute)))
const attributes=[{id:'Physical',label:'Physical',color:'#ca4d5d'},{id:'Intelligence',label:'Intelli',color:'#446aa8'},{id:'Mental',label:'Mental',color:'#9b7f24'}]
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
.bento-lead picture {position:relative;display:block;width:100%;height:100%;min-height:0;}
.bento-lead picture > img {width:100%;height:100%;object-fit:contain;}
.encounter-next {display:none;}
/* Phones: a bento of pictures whose frames hug the art — the lead in portrait, two cards beside it,
   filters below. No padding inside a frame, no blurred fill around a picture. */
@media (max-width:760px){
  .card-bento,.is-global {grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-rows:142px 142px;gap:8px;}
  .card-bento button {border-radius:var(--gs-radius-control);}
  .bento-lead {grid-column:1;grid-row:span 2;}
  .bento-lead:before {display:none;}
  .bento-lead picture > img {object-fit:cover;object-position:top;}
  .bento-portrait,.bento-note,.encounter-next {position:relative;display:block;padding:0;overflow:hidden;border:1px solid var(--portal-line)!important;background:var(--gs-paper)!important;}
  .bento-portrait img,.bento-note > img,.encounter-next img {width:100%;height:100%;object-fit:cover;object-position:top;}
  .bento-note {grid-column:2;}
  .bento-note > span,.bento-note > svg {display:none;}
  .bento-directory {grid-column:1 / -1;grid-row:3;}
  .bento-encounter {position:relative;padding:0;overflow:hidden;background:var(--gs-paper);}
  .bento-encounter header span,.bento-encounter > small {display:none;}
  .bento-encounter header {position:absolute;top:2px;right:2px;z-index:1;}
  .bento-encounter header button {color:var(--gs-surface);}
  .encounter-card {height:100%;padding:0;}
  .encounter-card img {width:100%;height:100%;object-fit:cover;object-position:top;}
  .encounter-card > span {position:absolute;inset:auto 0 0;padding:16px 6px 6px;background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 82%,transparent));color:var(--gs-surface);}
  .encounter-card > span small,.encounter-card > span strong,.encounter-card > svg {display:none;}
  .encounter-card > span::after {content:attr(data-idol);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);}
  .encounter-card strong,.encounter-next strong {font-size:var(--gs-text-meta);}
  .encounter-next strong {position:absolute;inset:auto 0 0;padding:16px 6px 6px;background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 82%,transparent));color:var(--gs-surface);}
  .bento-filters {grid-column:1 / -1;grid-row:3;display:grid;gap:8px;padding:0;border:0;background:none;}
  .bento-filters > span {display:none;}
  .attribute-links,.rarity-links {display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;margin:0;}
  .attribute-links button,.rarity-links button {min-height:36px;border-radius:var(--gs-radius-pill);text-align:center;font-size:var(--gs-text-meta);}
}
/* Desktop: the same hugging frames — cover, never a blurred fill. 卡面探索 shows the lead at the
   landscape art's own 15:8, two encounter cards beside it in portrait, the filters under them. */
@media (min-width:761px){
  .is-global {grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,.5fr));grid-template-rows:minmax(0,1fr) auto;}
  .is-global .bento-lead {grid-column:1;grid-row:1 / span 2;align-self:start;aspect-ratio:15 / 8;}
  .bento-lead:before {display:none;}
  .bento-lead picture > img,.bento-portrait img {object-fit:cover;object-position:top;}
  .bento-encounter {grid-column:2;grid-row:1;position:relative;padding:0;overflow:hidden;background:var(--gs-paper);}
  .bento-encounter header span,.bento-encounter > small {display:none;}
  .bento-encounter header {position:absolute;top:2px;right:2px;z-index:1;}
  .bento-encounter header button {color:var(--gs-surface);}
  .encounter-card {height:100%;padding:0;}
  .encounter-card img,.encounter-next img {width:100%;height:100%;object-fit:cover;object-position:top;}
  .encounter-card > span,.encounter-next strong {position:absolute;inset:auto 0 0;padding:24px 10px 8px;background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 82%,transparent));color:var(--gs-surface);}
  .encounter-card > span small,.encounter-card > svg {display:none;}
  .encounter-next {grid-column:3;grid-row:1;position:relative;display:block;padding:0;overflow:hidden;background:var(--gs-paper)!important;}
  .encounter-next strong {font-size:var(--gs-text-meta);}
  .bento-filters {grid-column:2 / -1;grid-row:2;display:grid;gap:8px;padding:0;border:0;background:none;}
  .bento-filters > span {display:none;}
  .attribute-links,.rarity-links {display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;margin:0;}
  .attribute-links button,.rarity-links button {min-height:36px;border-radius:var(--gs-radius-pill);text-align:center;font-size:var(--gs-text-meta);}
}
</style>
