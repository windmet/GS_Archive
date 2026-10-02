import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import honors from '../../../public/translations/zh-CN/archive-general/honors.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {collectionAttributeName} from '../../presentation/CollectionAttributeName.mjs';
import {archiveGeneralText} from '../../presentation/ArchiveGeneralTextCore.mjs';
const entries={...items.entries,...honors.entries};
const tools=createArchiveTextTools(entries);
export function archiveText(kind,source,field='name') {
  const text=tools.archiveText(kind,source,field);
  return kind==='item' && field==='name' ? collectionAttributeName(text,uiLocale.value) : text;
}
export function archiveSearchText(kind,source,field='name') {
  const text=tools.archiveSearchText(kind,source,field);
  if(kind!=='item'||field!=='name')return text;
  return `${text} ${collectionAttributeName(archiveGeneralText(entries,kind,source,field,'zh-CN'),'zh-CN')}`;
}
