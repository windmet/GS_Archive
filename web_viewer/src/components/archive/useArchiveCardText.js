import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import cards from '../../../public/translations/zh-CN/archive-general/cards.json' with {type:'json'};
import costumes from '../../../public/translations/zh-CN/archive-general/costumes.json' with {type:'json'};
import skills from '../../../public/translations/zh-CN/archive-general/skills.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
export const {archiveText, archiveSearchText} = createArchiveTextTools({...items.entries,...cards.entries,...costumes.entries,...skills.entries});
