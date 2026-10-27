import {shallowRef} from 'vue';
import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {archiveGeneralText, archiveBackgroundLabel} from '../../presentation/ArchiveGeneralTextCore.mjs';
import translationRelease from '../../../config/translation-release.json' with {type:'json'};
import {createBoundedTextTransport} from '../../utils/BoundedTextTransport.js';
import {cardLineShardFile,cardLineShardKey,validateCardLineShard} from '../../presentation/CardLineShards.mjs';
import {flowForLocale} from '../../../shared/reading/ReadingTypography.js';
import {presentProducerAddressingText} from '../../presentation/ProducerAddressingText.js';

// Shell titles and catalogue search need these names without eagerly loading metadata.
const entries=shallowRef({}), pending=new Map(), status=shallowRef({});
const transport=createBoundedTextTransport({maxBytes:4*1024*1024,cacheBytes:8*1024*1024});
const record=value=>value !== null && typeof value === 'object' && !Array.isArray(value);
// Card lines are not a domain here: they load per line (loadArchiveLines below).
const loaders=Object.fromEntries(['cards','costumes','photos','profiles','chats'].map(domain=>[domain,async()=>{
    const url=`/translations/zh-CN/archive-general/${domain}.json?rev=${translationRelease.release}`;
    try {
      const data=JSON.parse(await transport.load(url));
      if (data.schemaVersion !== 1 || !record(data.entries) ||
          Object.values(data.entries).some(fields=>!record(fields) ||
            Object.values(fields).some(names=>!record(names) || Object.values(names).some(text=>typeof text !== 'string'))))
        throw Error('Invalid archive name overlay');
      return {default:data};
    } catch(error) {transport.invalidate(url);throw error;}
  }]));
const setStatus=(domain,value)=>{status.value={...status.value,[domain]:value};};
export function loadArchiveNames(domain) {
  if(!Object.hasOwn(loaders,domain)) return Promise.resolve();
  if(!pending.has(domain)) {
    setStatus(domain,'loading');
    pending.set(domain,loaders[domain]().then(module=>{
      entries.value={...entries.value,...module.default.entries};setStatus(domain,'ready');
    }).catch(error=>{pending.delete(domain);setStatus(domain,'failed');throw error;}));
  }
  return pending.get(domain);
}
// The whole card-lines overlay is over 1 MiB while a page shows a few lines, so each line's
// translation comes from the shard its source text hashes to (src/presentation/CardLineShards.mjs).
const lineShards=new Map(), lineStatus=shallowRef({});
const mergeEntries=(base,add)=>{
  const merged={...base};
  for(const [kind,fields] of Object.entries(add)) {
    merged[kind]={...merged[kind]};
    for(const [field,texts] of Object.entries(fields)) merged[kind][field]={...merged[kind][field],...texts};
  }
  return merged;
};
// A failed shard is retried by itself, LINE_SHARD_RETRY_MS apart, and given up after the last; its lines
// show the source text meanwhile (only the first attempt hides them), and turn Chinese if a retry lands.
export const LINE_SHARD_RETRY_MS=Object.freeze([1000,4000]);
const lineAttempts=new Map();
function loadLineShard(key) {
  if(!lineShards.has(key)) {
    const attempt=lineAttempts.get(key) || 0;
    if(attempt > LINE_SHARD_RETRY_MS.length) return Promise.reject(Error(`Card line shard ${key} unavailable`));
    lineAttempts.set(key,attempt+1);
    const url=`/translations/zh-CN/archive-general/${cardLineShardFile(key)}?rev=${translationRelease.release}`;
    if(!lineStatus.value[key]) lineStatus.value={...lineStatus.value,[key]:'loading'};
    lineShards.set(key,transport.load(url).then(text=>{
      entries.value=mergeEntries(entries.value,validateCardLineShard(JSON.parse(text),key).entries);
      lineStatus.value={...lineStatus.value,[key]:'ready'};
    }).catch(error=>{
      transport.invalidate(url);lineShards.delete(key);lineStatus.value={...lineStatus.value,[key]:'failed'};
      if(attempt < LINE_SHARD_RETRY_MS.length) setTimeout(()=>{
        if(lineStatus.value[key] === 'failed' && !lineShards.has(key)) loadLineShard(key).catch(()=>{});
      },LINE_SHARD_RETRY_MS[attempt]);
      throw error;
    }));
  }
  return lineShards.get(key);
}
// For code that needs lines translated before it continues (voice previews, story readiness);
// archiveLineText requests its own line's shard.
export function loadArchiveLines(sources) {
  const keys=new Set(sources.filter(source=>typeof source === 'string' && source).map(cardLineShardKey));
  return Promise.all([...keys].map(loadLineShard));
}
// Settled once a domain's overlay has loaded or failed: titles wait for it instead of flashing the source text.
export const archiveNamesSettled=domain=>['ready','failed'].includes(status.value[domain]);
export const archiveNamedText=(kind,source,field='name')=>archiveGeneralText(entries.value,kind,source,field,uiLocale.value);
export const archiveNamedSearchText=(kind,source,field='name')=>`${source || ''} ${archiveGeneralText(entries.value,kind,source,field,'zh-CN')}`;
export const archiveNamedBackground=source=>archiveBackgroundLabel(entries.value,source,uiLocale.value);
export const archiveNamedBackgroundSearch=source=>`${source || ''} ${archiveBackgroundLabel(entries.value,source,'zh-CN')}`;
// The zh-CN translation regardless of the archive locale (the story player follows its own text setting).
export const archiveNamedTranslation=(kind,source,field='name')=>{
  const text=archiveGeneralText(entries.value,kind,source,field,'zh-CN');
  return text && text !== source ? text : '';
};

// Spoken lines (card lines, home touch voices, call titles, chats): the one path from a source line
// to what a page shows. keys are [kind, field] pairs looked up in order in the domain's shard. Overlays
// keep the source's Producer macros, resolved here in the language of the text actually shown. While
// the shard loads the line is pending (callers hide it, no Japanese flash); without a translation it
// stays Japanese. Callers start loadArchiveNames(domain) once in setup; card lines fetch the line's
// shard on first lookup instead (pending until it arrives), so a page loads only what it shows.
// Operational voice cues (scout change etc.) repeat card lines and touch voices word for word.
export const ANY_CARD_LINE=Object.freeze([['card-line','extra'],['card-line','normal'],['card-line','awakened'],['card-touch','text'],['card-voice','text']]);
// locale: the language to show this line in; defaults to the archive's A-level language (the home dialogue box passes its own).
export function archiveLineText(domain,keys,source,locale=uiLocale.value) {
  const text=typeof source === 'string' ? source : '';
  const original={text:presentProducerAddressingText(text,'ja'),lang:'ja',pending:false};
  if(locale !== 'zh-CN' || !text) return original;
  if(domain === 'card-lines') {
    const key=cardLineShardKey(text), state=lineStatus.value[key];
    // Requested after this render: a lookup runs inside render/computed, which must not write state.
    if(!state) queueMicrotask(()=>loadLineShard(key).catch(error=>console.warn('Card line translations unavailable',error)));
    if(!state || state === 'loading') return {...original,pending:true};
  } else if(status.value[domain] === 'loading') return {...original,pending:true};
  for(const [kind,field] of keys) {
    const translated=archiveGeneralText(entries.value,kind,text,field,'zh-CN');
    if(translated && translated !== text) return {text:flowForLocale(presentProducerAddressingText(translated,'zh-CN'),'zh-CN'),lang:'zh-CN',pending:false};
  }
  return original;
}
