import {createApp,h,onMounted} from 'vue';
import Studio from '/src/components/archive/PictureStudio.vue';
import Chart from '/src/components/archive/ArchiveSongChartPreview.vue';
import {ReadModelClient} from '/readmodels/runtime/ReadModelClient.mjs';
import {validateStudioDocument} from '/src/core/StudioDocument.mjs';
import bootstrap from '/readmodels/bootstrap.inline.json';
import fixtures from '../fixtures/responsive/tools.json';
import {uiLocale} from '/src/utils/LanguageStore.js';
import '/src/styles/GS_UI_TOKENS.css';
import '/src/styles/player-tokens.css';
if(!import.meta.env.DEV)throw Error('Development only');
const p=new URL(location.href).searchParams,domain=p.get('domain')||'studio',mode=p.get('mode')||'Worst';
const test=window.__A2={domain,mode,release:fixtures.release,status:'LOADING',synthetic:domain==='studio'||['Empty','One','Missing','Delayed','Error'].includes(mode),scope:domain==='studio'?'Full PictureStudio with isolated synthetic saved composition; real material IDs':'Real chart component and release chart descriptors',mutations:[],events:[]};
uiLocale.value=p.get('lang')==='CN'?'zh-CN':'ja-JP';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const name=(code,fallback)=>bootstrap.idols.find(i=>i.id===code)?.name||fallback||'';
const originalFetch=window.fetch.bind(window);let delayed=false,failed=false;
// Test-only adapter. The read-model files, bootstrap and production loader remain untouched.
const rawClient=new ReadModelClient({release:fixtures.release,fetchImpl:async(input,options)=>{if(String(input).includes('/photos/')){if(mode==='Delayed'&&!delayed){delayed=true;test.events.push('SYNTHETIC photo request delayed 1800ms');await wait(1800);}if(mode==='Error'&&!failed){failed=true;test.events.push('SYNTHETIC photo request rejected once; retry uses real fetch');throw Error('SYNTHETIC A2 photo transport failure');}}return originalFetch(input,options);}});
const client={async load(descriptor,options){const value=await rawClient.load(descriptor,options);if(mode!=='Missing')return value;const copy=structuredClone(value);const entries=copy.view?.media?.entries;let removed=0;for(const [key,binding]of Object.entries(entries||{})){if(/^(poses|faces):/.test(key)&&binding.image?.url){binding.image.url=null;removed++;}}if(removed)test.mutations.push('SYNTHETIC '+removed+' optional pose/face thumbnails removed; required canvas backgrounds preserved');return copy;},dispose:()=>rawClient.dispose()};
const storageKey='sidem-studio-document-v1',previous=localStorage.getItem(storageKey);
const composition=structuredClone(fixtures.studio[mode==='Dense'?'dense':mode==='Worst'?'worst':mode==='Empty'?'empty':'normal']);
if(domain==='studio'){validateStudioDocument(composition);localStorage.setItem(storageKey,JSON.stringify(composition));test.sourceRefs=fixtures.studio.sourceRefs.map(({originalValue,...r})=>r);test.expectedActors=composition.actors.length;test.expectedStickers=composition.stickers.length;test.mutations.push('SYNTHETIC isolated saved composition');}
const restoreStorage=()=>{if(previous===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,previous);};
addEventListener('pagehide',()=>{if(domain==='studio')restoreStorage();client.dispose();},{once:true});
const chart=structuredClone(fixtures.chart[mode==='Normal'||mode==='One'?'normal':mode==='Dense'?'densest-chart-notes':'longest-chart-ticks']);
if(domain==='chart'){
 test.sourceRefs=chart.sourceRef?[chart.sourceRef]:[];
 if(mode==='One')chart.difficulties=chart.difficulties.filter(d=>d.type===chart.initialDifficulty);
 if(mode==='Empty')chart.difficulties=[];
 if(mode==='Missing')chart.difficulties=chart.difficulties.map(d=>({...d,chart:null}));
 if(['Delayed','Error'].includes(mode)){const urls=new Set(chart.difficulties.map(d=>d.chart?.url));window.fetch=async(input,options)=>{if(urls.has(String(input))){if(mode==='Delayed'&&!delayed){delayed=true;test.events.push('SYNTHETIC chart request delayed 1800ms');await wait(1800);}if(mode==='Error'&&!failed){failed=true;test.events.push('SYNTHETIC chart request rejected once');throw Error('SYNTHETIC A2 chart failure');}}return originalFetch(input,options);};}
}
createApp({setup(){onMounted(()=>{
 const probe=()=>{const text=document.querySelector('#subject')?.innerText||'';let state='LOADING';
 if(domain==='chart'){if(document.querySelector('.chart-viewport')&&!/正在加载谱面/.test(text))state='READY';else if(document.querySelector('.chart-main [role=alert]'))state=['Empty','Missing','Error'].includes(mode)?'EXPECTED_ERROR':'RESOURCE_ERROR';}
 else {const busy=[...document.querySelectorAll('.studio-notices p,.studio-status')].some(e=>/正在读取|正在载入/.test(e.textContent)&&e.getBoundingClientRect().height);const error=document.querySelector('.studio-notices [role=alert]');const layerCount=document.querySelectorAll('[data-studio-layer]').length;test.observedLayerElements=layerCount;
 if(error)state=mode==='Error'?'EXPECTED_ERROR':'RESOURCE_ERROR';else if(!busy&&layerCount===test.expectedActors+test.expectedStickers&&document.querySelector('.studio-canvas-wrap canvas,.studio-canvas canvas,.studio-stage canvas,canvas')&&document.querySelector('[aria-label="导出图片"]:not(:disabled)'))state='READY';}
 test.status=state;document.body.dataset.qaState=state;};
 const observer=new MutationObserver(probe);observer.observe(document.querySelector('#subject'),{subtree:true,childList:true,attributes:true,characterData:true});probe();
});return()=>h('div',[
 h('header',{class:'qa-controls'},[h('strong',`A2 DEV ONLY · ${domain} · ${mode}`),h('span',test.synthetic?'SYNTHETIC test boundary / see __A2':'REAL data'),h('a',{href:`?domain=${domain}&mode=Normal`},'Normal'),h('a',{href:`?domain=${domain}&mode=Worst`},'Worst'),h('a',{href:`?domain=${domain}&mode=Dense`},'Dense')]),
 h('main',{id:'subject'},[domain==='studio'?h(Studio,{client,bootstrap,standalone:true,restoreOnOpen:true,idolName:name,idolSearch:name}):h(Chart,{...chart,standalone:true})])]);}}).mount('#qa');
const style=document.createElement('style');style.textContent='*,*::before,*::after{box-sizing:border-box}html,body,#qa{margin:0;height:100%;font-family:var(--gs-font-directory,system-ui);background:var(--gs-paper);color:var(--gs-ink)}.qa-controls{display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#eee;color:#222;font:12px system-ui;box-sizing:border-box}#subject{height:calc(100dvh - 64px);position:relative;min-height:400px}';document.head.append(style);
