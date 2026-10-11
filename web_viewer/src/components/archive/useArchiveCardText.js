import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import costumes from '../../../public/translations/zh-CN/archive-general/costumes.json' with {type:'json'};
import skills from '../../../public/translations/zh-CN/archive-general/skills.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
import {loadArchiveNames,archiveNamedText,archiveNamedSearchText} from './useArchiveNamedText.js';
void loadArchiveNames('cards').catch(()=>{});
const tools=createArchiveTextTools({...items.entries,...costumes.entries,...skills.entries});
export const archiveText=(kind,source,field='name')=>kind==='card'?archiveNamedText(kind,source,field):tools.archiveText(kind,source,field);
export const archiveSearchText=(kind,source,field='name')=>kind==='card'?archiveNamedSearchText(kind,source,field):tools.archiveSearchText(kind,source,field);
