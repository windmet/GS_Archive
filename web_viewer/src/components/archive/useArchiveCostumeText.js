import costumes from '../../../public/translations/zh-CN/archive-general/costumes.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
export const {archiveText,archiveSearchText}=createArchiveTextTools(costumes.entries);
