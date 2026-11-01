// Independent Vite development entry. Never imported by a production entry.
import {createApp,h,ref,nextTick} from 'vue';
import IdolGrid from '/src/components/archive/ArchiveIdolGrid.vue';
import UnitCatalog from '/src/components/archive/ArchiveUnitCatalog.vue';
import Live from '/src/components/archive/ArchiveLiveChartTable.vue';
import Cards from '/src/components/archive/ArchiveCardList.vue';
import Song from '/src/components/archive/ArchiveSongDetail.vue';
import Event from '/src/components/archive/ArchiveEventDetail.vue';
import Gasha from '/src/components/archive/ArchiveGashaDetail.vue';
import Collection from '/src/components/archive/CollectionDetailPanel.vue';
import Picker from '/src/components/archive/terminal/ArchiveIdolPickerPanel.vue';
import bootstrap from '/readmodels/bootstrap.inline.json';
import {languageMode,uiLocale} from '/src/utils/LanguageStore.js';
import '/src/styles/GS_UI_TOKENS.css';
import '/src/styles/archive-collection.css';
import '/src/styles/player-tokens.css';
if(!import.meta.env.DEV)throw Error('QA fixtures require development mode');
const files=import.meta.glob('../fixtures/responsive/*.json',{import:'default'});
const params=new URL(location.href).searchParams;
const domain=params.get('domain')||'events',mode=params.get('mode')||'Normal';
const metric=params.get('metric');
const modes=['Normal','Worst','Empty','One','Dense','Missing','Delayed','Error'];
const domains=['idols','units','cards','songs','events','gashas','items','honors','currencies','costumes','tool-picker','live'];
if(!domains.includes(domain)||!modes.includes(mode))throw Error('Unknown fixture');
let unitEntries=[];
const test={domain,mode,metric,release:bootstrap.release,status:'LOADING',synthetic:!['Normal','Worst'].includes(mode),scope:domain==='tool-picker'?'Shared picker only; no stage/canvas/workbench acceptance':'Real component prop boundary',mutations:[],events:[]};
window.__A2=test;
const setStatus=s=>{test.status=s;document.body.dataset.qaState=s;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const idName=(code,fallback)=>bootstrap.idols.find(i=>i.id===code)?.name||fallback||'';
// Optional fields only; mandatory schema objects and identifiers are preserved.
function missing(v){if(Array.isArray(v))return v.map(missing);if(!v||typeof v!=='object')return v;for(const key of Object.keys(v)){if(['image','imageCandidates','jacketUrl','jacket_url','banner_url','representative_bg','descriptionJa','descriptionText','description','officialVideos','movies','media'].includes(key)){test.mutations.push(key);if(Array.isArray(v[key]))v[key]=[];else if(v[key]&&typeof v[key]==='object')v[key]={};else v[key]=null;}else v[key]=missing(v[key]);}return v;}
// Only known collection fields are trimmed. Required entity identity stays intact.
function cardinality(v,n){if(Array.isArray(v))return v.slice(0,n);if(!v||typeof v!=='object')return v;for(const k of ['variants','performers','officialVideos','relatedEvents','cards','songs','episodes','cast','castReferences','readingEntries','members','sources','usageCards'])if(Array.isArray(v[k]))v[k]=v[k].slice(0,n);if(v.view)v.view=cardinality(v.view,n);if(v.gasha){for(const k of ['related_pickup_cards','derived_pickup_cards'])if(Array.isArray(v.gasha[k]))v.gasha[k]=v.gasha[k].slice(0,n);}if(v.entry?.members)v.entry.members=v.entry.members.slice(0,n);return v;}
createApp({setup(){const content=ref(null),error=ref(''),phase=ref('LOADING');const lang=ref(params.get('lang')||'JP');languageMode.value=lang.value;uiLocale.value=lang.value==='JP'?'ja-JP':'zh-CN';
const load=async()=>{try{phase.value='LOADING';setStatus('LOADING');if(mode==='Delayed')await delay(1800);if(mode==='Error')throw Error('SYNTHETIC fixture loader rejection; not a production request failure');const fixture=await files[`../fixtures/responsive/${domain==='tool-picker'?'idols':domain}.json`]();unitEntries=fixture.catalogRows?.map(x=>x.catalog)||[];test.component=fixture.component;test.sourceRefs=fixture.sourceRefs?.map(({originalValue,...r})=>r);test.language=lang.value;test.modeBoundary=['Empty','One'].includes(mode)?'Trim listed relation arrays; entity identity preserved. Collection empty uses nullable detail; event/gasha keep identity and trim relation arrays. Not every field is cleared.':null;
let data=structuredClone(mode==='Normal'?fixture.normal:mode==='Dense'?(fixture.dense||fixture.worst):fixture.worst);
if(metric){const e=fixture.extremeEntities?.find(x=>x.metric===metric);if(!e)throw Error('Unknown extreme metric');data=structuredClone(e.data);test.metricSource=e.source;}
if(mode==='Dense'&&!fixture.dense&&fixture.extremeEntities?.length){const candidates=fixture.extremeEntities.filter(e=>fixture.sourceRefs.find(r=>r.metric===e.metric)?.fieldType==='array');if(candidates.length){const e=candidates.sort((a,b)=>fixture.sourceRefs.find(r=>r.metric===b.metric).measuredValue-fixture.sourceRefs.find(r=>r.metric===a.metric).measuredValue)[0];data=structuredClone(e.data);test.denseMetric=e.metric;}}
if(mode==='Dense'&&!fixture.dense)test.densityScope='Largest real relation entity selected separately via metric; no arbitrary duplication';
if(mode==='Empty'||mode==='One')data=cardinality(data,mode==='Empty'?0:1);
if(mode==='Missing')data=missing(data);
content.value=data;await nextTick();phase.value='READY';setStatus('READY');}catch(e){error.value=e.message;phase.value=mode==='Error'?'EXPECTED_ERROR':'RENDER_ERROR';setStatus(phase.value);}};
load();const log=(event,payload)=>test.events.push({event,payload,at:performance.now()});
function subject(){const v=content.value,common={idolName:idName,displayIdolName:idName};
if(domain==='idols')return h(IdolGrid,{...common,title:'偶像目录',idols:v.map(x=>({...bootstrap.idols.find(i=>i.id===x.id),...x})),idolsBeforeUnitFilter:v.length,unitOptions:[],embedded:true});
if(domain==='tool-picker')return h(Picker,{...common,idols:(mode==='Dense'?bootstrap.idols:v.map(x=>({...bootstrap.idols.find(i=>i.id===x.id),...x}))),counts:mode==='Dense'?Object.fromEntries(bootstrap.idols.map(i=>[i.id,6])):{},onUpdateModelValue:code=>log('select',code)});
if(domain==='units'){const entries=mode==='Dense'?unitEntries:[v.view.entry];return h(UnitCatalog,{entries:(mode==='Empty'?[]:entries.length?entries:[v.view.entry])});}
if(domain==='live')return h(Live,{songs:v});
if(domain==='cards')return h(Cards,{...common,title:'卡面',cards:v,embedded:true});
if(domain==='songs')return h(Song,{...common,song:v.view,idolDirectory:bootstrap.idols});
if(domain==='events')return h(Event,{...common,view:v.view,bootstrap});
if(domain==='gashas')return h(Gasha,{...common,gasha:v.gasha});
return h(Collection,{...common,kind:domain,detail:mode==='Empty'?null:v,modal:false});}
return()=>h('div',[
h('header',{class:'qa-controls'},[h('strong','A2 DEV ONLY · '+domain),h('span',test.synthetic?'SYNTHETIC '+mode:'REAL '+mode),h('select',{value:domain,onChange:e=>location.search=`?domain=${e.target.value}&mode=${mode}`},domains.map(d=>h('option',{value:d},d))),h('select',{value:mode,onChange:e=>location.search=`?domain=${domain}&mode=${e.target.value}`},modes.map(m=>h('option',{value:m},m))),h('select',{value:lang.value,onChange:e=>{lang.value=e.target.value;languageMode.value=e.target.value;uiLocale.value=e.target.value==='JP'?'ja-JP':'zh-CN';test.language=e.target.value;}},['JP','CN','BILINGUAL'].map(l=>h('option',{value:l},l))),h('span',phase.value)]),
h('main',{id:'subject','data-domain':domain},phase.value==='READY'?subject():h('p',{role:'status'},error.value||'SYNTHETIC delayed fixture boundary — loading…'))]);}}).mount('#qa');
const style=document.createElement('style');style.textContent=`*,*::before,*::after{box-sizing:border-box}html,body,#qa{margin:0;min-height:100%;background:var(--gs-paper);color:var(--gs-ink);font-family:var(--gs-font-directory,system-ui)}.qa-controls{box-sizing:border-box;display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#eee;color:#222;font:12px system-ui}.qa-controls select{max-width:100%;min-height:32px}#subject{height:calc(100dvh - 96px);min-height:400px;position:relative;isolation:isolate}.qa-stage{position:relative;height:100%;background:#d6ded9}.qa-controls span{overflow-wrap:anywhere}`;document.head.append(style);
