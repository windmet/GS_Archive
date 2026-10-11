import {shallowRef} from 'vue';
import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {archiveGeneralText, archiveBackgroundLabel} from '../../presentation/ArchiveGeneralTextCore.mjs';
import translationRelease from '../../../config/translation-release.json' with {type:'json'};
import {createBoundedTextTransport} from '../../utils/BoundedTextTransport.js';
import {flowForLocale} from '../../../shared/reading/ReadingTypography.js';
import {presentProducerAddressingText} from '../../presentation/ProducerAddressingText.js';

// Shell titles and catalogue search need these names without eagerly loading metadata.
const entries=shallowRef({}), pending=new Map(), status=shallowRef({});
// The card-lines shard alone is over 1 MiB (every card line, touch voice and call title).
const transport=createBoundedTextTransport({maxBytes:4*1024*1024,cacheBytes:8*1024*1024});
const record=value=>value !== null && typeof value === 'object' && !Array.isArray(value);
const loaders=Object.fromEntries(['cards','costumes','photos','profiles','card-lines','chats'].map(domain=>[domain,async()=>{
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
// stays Japanese. Callers start loadArchiveNames(domain) once in setup.
// Operational voice cues (scout change etc.) repeat card lines and touch voices word for word.
export const ANY_CARD_LINE=Object.freeze([['card-line','extra'],['card-line','normal'],['card-line','awakened'],['card-touch','text']]);
export function archiveLineText(domain,keys,source) {
  const text=typeof source === 'string' ? source : '';
  const original={text:presentProducerAddressingText(text,'ja'),lang:'ja',pending:false};
  if(uiLocale.value !== 'zh-CN' || !text) return original;
  if(status.value[domain] === 'loading') return {...original,pending:true};
  for(const [kind,field] of keys) {
    const translated=archiveGeneralText(entries.value,kind,text,field,'zh-CN');
    if(translated && translated !== text) return {text:flowForLocale(presentProducerAddressingText(translated,'zh-CN'),'zh-CN'),lang:'zh-CN',pending:false};
  }
  return original;
}
