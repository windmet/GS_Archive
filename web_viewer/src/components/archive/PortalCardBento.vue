<template>
  <div v-if="lead" class="card-bento" :class="{'is-global':global}">
    <button class="bento-lead" type="button" :data-archive-focus-id="`portal-card-art:${lead.id}`" :style="{'--card-art':`url(${(lead.landscape || lead.image).url})`}" :aria-label="`打开卡片 ${lead.title}`" @click="emit('open',lead)">
      <picture><source v-if="lead.image?.url" media="(max-width:760px)" :srcset="lead.image.url" /><img :src="(lead.landscape || lead.image).url" :alt="lead.title" decoding="async" /></picture>
      <span class="bento-caption"><small>{{ lead.rarity }} · {{ lead.idolName }}</small><strong>{{ lead.title }}</strong><ArrowUpRight :size="16" /></span>
    </button>
    <template v-if="!global">
      <button v-if="secondary" class="bento-portrait" type="button" :data-archive-focus-id="`portal-card-art:${secondary.id}`" :aria-label="`打开卡片 ${secondary.title}`" @click="emit('open',secondary)"><img :src="secondary.image.url" :alt="secondary.title" /><span class="bento-tile-caption">{{ secondary.title }}</span></button>
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
const attributes=[{id:'Physical',label:'Physical',color:'var(--gs-attr-physical)'},{id:'Intelligence',label:'Intelli',color:'var(--gs-attr-intelli)'},{id:'Mental',label:'Mental',color:'var(--gs-attr-mental)'}]
</script>
<style scoped>
/* Featured cards: pictures whose frames hug the art (media radius, cover, no blurred fill), and the
   text entries under them as plain rows on the paper. */
.card-bento { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:224px auto;gap:var(--gs-space-3) var(--gs-space-4);min-width:0; }
.card-bento button { min-width:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer; }
.card-bento button:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.bento-lead, .bento-portrait, .encounter-next, .bento-encounter { position:relative;overflow:hidden;border-radius:var(--gs-radius-media);background:var(--gs-line); }
.bento-lead { grid-column:span 2; }
.bento-lead picture { display:block;width:100%;height:100%; }
.bento-lead picture > img, .bento-portrait img, .encounter-card img, .encounter-next img { display:block;width:100%;height:100%;object-fit:cover;object-position:top; }
/* Captions on art: the only place text sits on a picture, over a chrome fade. */
.bento-caption, .encounter-card > span, .encounter-next strong { position:absolute;inset:auto 0 0;padding:var(--gs-space-7) var(--gs-space-5) var(--gs-space-4);background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 84%,transparent));color:var(--gs-surface); }
.bento-caption { display:grid;grid-template-columns:1fr auto;align-items:end;gap:2px var(--gs-space-3); }
.bento-caption small { grid-column:1 / -1;font-size:var(--gs-text-meta); }
.bento-caption strong { font-size:var(--gs-text-body);font-weight:var(--gs-weight-semibold);line-height:1.4; }
/* Small tiles carry one line at the bottom, the same fade as the lead: the card title when every
   card is one idol's, the idol's name in the all-archive view. Rarity is marked on the lead only. */
.bento-tile-caption { position:absolute;inset:auto 0 0;overflow:hidden;padding:var(--gs-space-7) var(--gs-space-3) var(--gs-space-3);background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 84%,transparent));color:var(--gs-surface);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);text-overflow:ellipsis;white-space:nowrap; }
/* Text entries: a third card and the directory, as rows under a hairline. */
.bento-note, .bento-directory { display:flex;align-items:center;gap:var(--gs-space-4);min-height:76px;padding:var(--gs-space-3) 0 !important;border-top:1px solid var(--gs-line) !important; }
.bento-note { grid-column:span 2; }
.bento-note > img { flex:none;width:48px;height:64px;object-fit:cover;object-position:top;border-radius:var(--gs-radius-media); }
.bento-note > span { display:grid;flex:1;gap:2px;min-width:0; }
.bento-note small, .bento-directory small { color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.bento-note strong, .bento-directory strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.4;overflow-wrap:anywhere; }
.bento-note > svg, .bento-directory > svg { flex:none;color:var(--gs-ink-3); }
.bento-directory { display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;align-content:center;column-gap:var(--gs-space-3); }
.bento-directory > svg:first-child { grid-column:1;grid-row:1 / span 2;align-self:center; }
.bento-directory strong { grid-column:2;grid-row:1; }
.bento-directory small { grid-column:2;grid-row:2; }
.bento-directory > svg:last-child { grid-column:3;grid-row:1 / span 2;align-self:center; }

/* Global view: the lead at the landscape art's 15:8, two encounter cards beside it, filters under. */
.is-global { grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,.5fr));grid-template-rows:minmax(0,1fr) auto;row-gap:var(--gs-space-5); }
.is-global .bento-lead { grid-column:1;grid-row:1 / span 2;align-self:start;aspect-ratio:15 / 8; }
.bento-encounter { grid-column:2;grid-row:1; }
.bento-encounter header span, .bento-encounter > small { display:none; }
.bento-encounter header { position:absolute;top:2px;right:2px;z-index:1; }
.bento-encounter header button { display:grid;place-items:center;width:var(--gs-control-touch);height:var(--gs-control-touch);color:var(--gs-surface); }
.encounter-card { display:block;width:100%;height:100%; }
.encounter-card > span small, .encounter-card > span strong, .encounter-card > svg { display:none; }
.encounter-card > span::after { content:attr(data-idol); }
.encounter-card > span, .encounter-next strong { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.encounter-card > span, .encounter-next strong { padding:var(--gs-space-7) var(--gs-space-3) var(--gs-space-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.encounter-next { grid-column:3;grid-row:1;display:block; }
.bento-filters { grid-column:2 / -1;grid-row:2;display:grid;gap:var(--gs-space-3);min-width:0; }
.bento-filters > span { display:none; }
.attribute-links, .rarity-links { display:grid;grid-auto-columns:1fr;grid-auto-flow:column;gap:var(--gs-space-2); }
.card-bento .attribute-links button, .card-bento .rarity-links button { min-height:var(--gs-control-normal);border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-meta);text-align:center;white-space:nowrap; }
.card-bento .attribute-links button { color:var(--attribute);font-weight:var(--gs-weight-semibold); }
.attribute-links small, .rarity-links small { margin-left:2px;color:var(--gs-ink-3);font-weight:var(--gs-weight-regular); }
.bento-empty { color:var(--gs-ink-3); }

@media (hover:hover) and (pointer:fine) {
  .bento-lead img, .bento-portrait img, .encounter-card img, .encounter-next img { transition:transform var(--gs-motion-feedback) var(--gs-motion-ease); }
  .bento-lead:hover img, .bento-portrait:hover img, .encounter-card:hover img, .encounter-next:hover img { transform:scale(1.02); }
  .bento-note:hover strong, .bento-directory:hover strong { color:var(--gs-mint-ink); }
  .card-bento .rarity-links button:hover { border-color:var(--gs-selected-line); }
}
@media (prefers-reduced-motion:reduce) { .card-bento * { transition:none !important;transform:none !important; } }

/* Phones: the lead in portrait, two cards beside it, the text entries and filters below. */
@media (max-width:760px) {
  .card-bento, .is-global { grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-rows:142px 142px auto;gap:var(--gs-space-3); }
  .is-global { row-gap:var(--gs-space-3); }
  .bento-filters { margin-top:var(--gs-space-3); }
  .bento-lead, .is-global .bento-lead { grid-column:1;grid-row:1 / span 2;aspect-ratio:auto; }
  .bento-portrait { grid-column:2;grid-row:1; }
  .bento-note { position:relative;grid-column:2;grid-row:2;display:block;min-height:0;padding:0 !important;border:0 !important;border-radius:var(--gs-radius-media);overflow:hidden;background:var(--gs-line); }
  .bento-note > img { width:100%;height:100%;border-radius:0; }
  .bento-note > svg, .bento-note > span small { display:none; }
  .bento-note > span { position:absolute;inset:auto 0 0;display:block;padding:var(--gs-space-7) var(--gs-space-3) var(--gs-space-3);background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 84%,transparent));color:var(--gs-surface); }
  .bento-note > span strong { display:block;overflow:hidden;font-size:var(--gs-text-meta);text-overflow:ellipsis;white-space:nowrap; }
  .bento-directory { grid-column:1 / -1;grid-row:3; }
  .bento-encounter { grid-column:2;grid-row:1; }
  .encounter-next { grid-column:2;grid-row:2; }
  .bento-filters { grid-column:1 / -1;grid-row:3; }
  .card-bento .attribute-links button, .card-bento .rarity-links button { min-height:var(--gs-control-touch); }
}
</style>
