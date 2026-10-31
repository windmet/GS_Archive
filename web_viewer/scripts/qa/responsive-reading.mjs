import {createApp,h,ref,nextTick} from 'vue';
import Row from '/src/components/archive/ReadingTranscriptRow.vue';
import Adv from '/src/components/AdvUI.vue';
import {provideStoryLocalization} from '/src/localization/story/StoryLocalizationContext.js';
import {resolveStoryText} from '/src/localization/story/StoryTextResolver.js';
import {normalizeLegacyDialogue,preferencesFromLegacyLanguageMode} from '/src/localization/story/LegacyDialogueAdapter.js';
import fixture from '../fixtures/responsive/reading.json';
import '/src/styles/GS_UI_TOKENS.css';
import '/src/styles/player-tokens.css';
import '/src/presentation/reader-theme.css';
if(!import.meta.env.DEV)throw Error('Development only');
const q=new URL(location.href).searchParams,domain=q.get('domain')||'reader',mode=q.get('mode')||'Worst',metric=q.get('metric'),lang=q.get('lang')||'BILINGUAL';
const test=window.__A2={domain,mode,metric,release:fixture.release,status:'LOADING',scope:fixture.scope,language:lang,synthetic:!['Normal','Worst'].includes(mode),mutations:[]};
createApp({setup(){const data=ref([]),state=ref('LOADING');const resolve=entry=>resolveStoryText({...normalizeLegacyDialogue(entry.row),overlayEntry:entry.overlay,preferences:preferencesFromLegacyLanguageMode(lang)});
provideStoryLocalization({resolveDialogue(dialogue){const entry=data.value.find(e=>e.row===dialogue)||{row:dialogue,overlay:null};const view=resolve(entry);return {speaker:view.speaker.display,text:[view.primary.text,view.secondary?.text].filter(Boolean).join('\n'),view};}});
async function load(){if(mode==='Delayed')await new Promise(r=>setTimeout(r,1800));if(mode==='Error'){state.value=test.status='EXPECTED_ERROR';return;}
const chosen=metric?(domain==='player'?fixture.playerExtrema:fixture.extremeEntities).find(e=>e.metric===metric)?.data:null;
data.value=structuredClone(chosen?[chosen]:mode==='Normal'?(domain==='player'?fixture.playerNormal:fixture.normal):mode==='Dense'?(domain==='player'?fixture.playerWorst:fixture.dense):(domain==='player'?fixture.playerWorst:fixture.worst));
if(mode==='Empty')data.value=[];if(mode==='One')data.value=data.value.slice(0,1);if(mode==='Missing'){for(const e of data.value){e.overlay=null;e.row.speaker=null;}test.mutations.push('SYNTHETIC optional speaker and overlay removed');}
test.sourceRefs=data.value.flatMap(e=>e.sourceRefs).map(({originalValue,...r})=>r);test.rowCount=data.value.length;test.renderScope=domain==='player'?'First real ADV dialogue in selected dataset; continuous playback and phone/SMS belong to separate surfaces':'All selected transcript rows';await nextTick();state.value=test.status='READY';document.body.dataset.qaState='READY';}
load();return()=>h('div',[
h('header',{class:'qa-controls'},[`A2 DEV ONLY · ${domain} · ${mode} · ${lang} · ${test.synthetic?'SYNTHETIC':'REAL'} · ${state.value}`,h('a',{href:`?domain=${domain}&mode=Normal`},'Normal'),h('a',{href:`?domain=${domain}&mode=Worst`},'Worst'),h('a',{href:`?domain=${domain}&mode=Dense`},'Dense')]),
h('main',{id:'subject',class:domain==='reader'?'reader-container':''},state.value==='EXPECTED_ERROR'?h('p',{role:'alert'},'SYNTHETIC fixture loader rejection; not production transport'):state.value!=='READY'?h('p',{role:'status'},'SYNTHETIC delayed boundary loading…'):domain==='player'?h('div',{class:'qa-stage'},[h(Adv,{dialogue:data.value[0]?.row||null,voiceStatus:mode==='Missing'?'unavailable':mode==='Delayed'?'preparing':'idle'})]):data.value.length?data.value.map((e,i)=>h(Row,{key:i,item:{row:e.row,view:resolve(e),avatar:e.row.speaker?.entityId||null},mode:lang==='JP'?'original':lang==='CN'?'translation':'bilingual',anchor:'',searchMatchIds:mode==='Dense'?new Set(data.value.map(e=>e.row.anchor.row_id)):new Set()})):h('p','SYNTHETIC 0 rows passed to component boundary'))]);}}).mount('#qa');
const style=document.createElement('style');style.textContent='*,*::before,*::after{box-sizing:border-box}html,body,#qa{margin:0;min-height:100%;font-family:var(--gs-font-body,system-ui);background:var(--gs-paper);color:var(--gs-ink)}.qa-controls{display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#eee;color:#222;font:12px system-ui}#subject{height:calc(100dvh - 64px);min-height:400px;overflow-y:auto;position:relative}.qa-stage{height:100%;position:relative;background:#d6ded9}';document.head.append(style);
