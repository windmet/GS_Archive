<template>
  <div v-if="lead" ref="root" class="card-bento" :class="{'is-global':global,'has-portrait-lead':!lead.landscape?.url}">
    <button class="bento-lead" type="button" :data-archive-focus-id="`portal-card-art:${lead.id}`" :aria-label="`打开卡片 ${lead.title}`" @click="emit('open',lead)">
      <picture><source v-if="lead.image?.url" media="(max-width:760px)" :srcset="near ? artUrl(lead.image) : undefined" /><img :src="near ? artUrl(lead.landscape || lead.image) : undefined" :alt="lead.title" decoding="async" @error="artFailed" /></picture>
      <span class="bento-caption"><small>{{ lead.rarity }} · {{ lead.idolName }}</small><strong>{{ lead.title }}</strong><ArrowUpRight :size="16" /></span>
    </button>
    <button v-for="card in shownPortraits" :key="card.id" class="bento-portrait" type="button" :data-archive-focus-id="`portal-card-art:${card.id}`" :aria-label="`打开卡片 ${card.title}`" @click="emit('open',card)"><img :src="near ? artUrl(card.image) : undefined" alt="" decoding="async" @error="artFailed" /><span class="bento-tile-caption">{{ global ? card.idolName : card.title }}</span></button>
  </div>
  <p v-else class="bento-empty">暂无可展示的卡面。</p>
</template>
<script setup>
import {computed,onBeforeUnmount,reactive,ref,watch} from 'vue'
import {ArrowUpRight} from '@lucide/vue'
import {portalDailyCard} from '../../presentation/PortalBento.js'
import {useNearViewport} from './useNearViewport.js'
const props=defineProps({cards:{type:Array,default:()=>[]},global:Boolean,offset:{type:Number,default:0}})
const emit=defineEmits(['open'])
// Card art is the Portal's heaviest download and sits below the fold on phones; in the wider layout the
// gallery is on the first screen and may be the LCP, so it loads at once.
const root=ref(null)
const near=useNearViewport(root,{eagerMedia:'(min-width:761px)'})
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date())
// One landscape lead (the only art with a 15:8 picture) and three portraits. The 担当 lens shows its
// first cards; the all-idol lens draws by date, and 换一组 moves the offset so all four change together.
const lead=computed(()=>{const pool=props.cards.filter(row=>row.landscape?.url);return props.global ? portalDailyCard(pool,date,props.offset) : pool[0] || props.cards.find(row=>row.image?.url)})
const portraits=computed(()=>{
  const chosen=[]
  const taken=new Set([lead.value?.id])
  for(let n=0;n<3;n++){
    const pool=props.cards.filter(row=>!taken.has(row.id) && row.image?.url)
    const next=props.global ? portalDailyCard(pool,date,props.offset) : pool[0]
    if(!next) break
    chosen.push(next); taken.add(next.id)
  }
  return chosen
})
// The row holds three portraits only when it is wider than 900px and not the phone layout; narrower rows
// render two, so the hidden picture is never requested (CSS hiding would still download it).
const wide=ref(false)
let resize=null
watch(root,element=>{
  resize?.disconnect(); resize=null
  if(!element || typeof ResizeObserver==='undefined') return
  resize=new ResizeObserver(([entry])=>{wide.value=entry.contentRect.width>900 && !matchMedia('(max-width:760px)').matches})
  resize.observe(element)
},{flush:'post'})
onBeforeUnmount(()=>resize?.disconnect())
const shownPortraits=computed(()=>portraits.value.slice(0,wide.value ? 3 : 2))
// The Portal asks for the derived thumbnail first; if that object is missing (a deployment that has not
// uploaded thumbnails yet), the picture falls back to the original art instead of staying blank.
const failed=reactive(new Set())
const artUrl=art=>art?.url && failed.has(art.url) && art.full ? art.full : art?.url
function artFailed(event){
  const src=event.target.currentSrc || event.target.src
  if(src) failed.add(new URL(src,location.href).pathname)
}
</script>
<style scoped>
/* Featured cards: one row of pictures at one height. Each picture's flex ratio is its art's width/height,
   so once the gaps are taken the row splits the rest in proportion and every picture ends equally tall
   at any width: the landscape lead at 15:8, the portraits at 4:5. */
.card-bento { display:flex;gap:var(--gs-space-4);min-width:0; }
.card-bento button { min-width:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer; }
.card-bento button:focus-visible { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.bento-lead, .bento-portrait { position:relative;overflow:hidden;border-radius:var(--gs-radius-media);background:var(--gs-line); }
.bento-lead { flex:1.875 1 0;aspect-ratio:15 / 8; }
.has-portrait-lead .bento-lead { flex:.8 1 0;aspect-ratio:4 / 5; }
.bento-portrait { flex:.8 1 0;aspect-ratio:4 / 5; }
.bento-lead picture { display:block;width:100%;height:100%; }
.card-bento img:not([src]) { visibility:hidden; }
.bento-lead picture > img, .bento-portrait img { display:block;width:100%;height:100%;object-fit:cover;object-position:top; }
/* Captions on art: the only place text sits on a picture, over a chrome fade. */
.bento-caption, .bento-tile-caption { position:absolute;inset:auto 0 0;background:linear-gradient(transparent,color-mix(in srgb,var(--gs-chrome) 84%,transparent));color:var(--gs-surface); }
.bento-caption { display:grid;grid-template-columns:1fr auto;align-items:end;gap:2px var(--gs-space-3);padding:var(--gs-space-7) var(--gs-space-5) var(--gs-space-4); }
.bento-caption small { grid-column:1 / -1;font-size:var(--gs-text-meta); }
.bento-caption strong { font-size:var(--gs-text-body);font-weight:var(--gs-weight-semibold);line-height:1.4; }
/* Portraits carry one line: the card title when every card is one idol's, the idol's name in the
   all-archive view. Rarity is marked on the lead only. */
.bento-tile-caption { overflow:hidden;padding:var(--gs-space-7) var(--gs-space-3) var(--gs-space-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);text-overflow:ellipsis;white-space:nowrap; }
.bento-empty { color:var(--gs-ink-3); }

@media (hover:hover) and (pointer:fine) {
  .bento-lead img, .bento-portrait img { transition:transform var(--gs-motion-feedback) var(--gs-motion-ease); }
  .bento-lead:hover img, .bento-portrait:hover img { transform:scale(1.02); }
}
@media (prefers-reduced-motion:reduce) { .card-bento * { transition:none !important;transform:none !important; } }

/* Phones: the lead in its portrait art on the left, two cards stacked beside it. */
@media (max-width:760px) {
  .card-bento { display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-rows:142px 142px;gap:var(--gs-space-3); }
  .bento-lead, .has-portrait-lead .bento-lead { grid-column:1;grid-row:1 / span 2;aspect-ratio:auto; }
  .bento-portrait { grid-column:2;aspect-ratio:auto; }
}
</style>
