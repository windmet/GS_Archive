import {shallowRef} from 'vue';
import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {archiveGeneralText, archiveBackgroundLabel} from '../../presentation/ArchiveGeneralTextCore.mjs';

// Shell titles and catalogue search need these names without eagerly loading metadata.
const entries=shallowRef({}), pending=new Map();
const loaders={
  cards:()=>import('../../../public/translations/zh-CN/archive-general/cards.json'),
  costumes:()=>import('../../../public/translations/zh-CN/archive-general/costumes.json'),
  photos:()=>import('../../../public/translations/zh-CN/archive-general/photos.json'),
};
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
