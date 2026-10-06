import {shallowRef} from 'vue';
import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {archiveGeneralText, archiveBackgroundLabel} from '../../presentation/ArchiveGeneralTextCore.mjs';
import translationRelease from '../../../config/translation-release.json' with {type:'json'};
import {createBoundedTextTransport} from '../../utils/BoundedTextTransport.js';

// Shell titles and catalogue search need these names without eagerly loading metadata.
const entries=shallowRef({}), pending=new Map();
const transport=createBoundedTextTransport();
const record=value=>value !== null && typeof value === 'object' && !Array.isArray(value);
const loaders=Object.fromEntries(['cards','costumes','photos'].map(domain=>[domain,async()=>{
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
export function loadArchiveNames(domain) {
  if(!Object.hasOwn(loaders,domain)) return Promise.resolve();
  if(!pending.has(domain)) pending.set(domain,loaders[domain]().then(module=>{
    entries.value={...entries.value,...module.default.entries};
  }).catch(error=>{pending.delete(domain);throw error;}));
  return pending.get(domain);
}
export const archiveNamedText=(kind,source,field='name')=>archiveGeneralText(entries.value,kind,source,field,uiLocale.value);
export const archiveNamedSearchText=(kind,source,field='name')=>`${source || ''} ${archiveGeneralText(entries.value,kind,source,field,'zh-CN')}`;
export const archiveNamedBackground=source=>archiveBackgroundLabel(entries.value,source,uiLocale.value);
export const archiveNamedBackgroundSearch=source=>`${source || ''} ${archiveBackgroundLabel(entries.value,source,'zh-CN')}`;
