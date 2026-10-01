import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import honors from '../../../public/translations/zh-CN/archive-general/honors.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
export const {archiveText, archiveSearchText} = createArchiveTextTools({...items.entries, ...honors.entries});
