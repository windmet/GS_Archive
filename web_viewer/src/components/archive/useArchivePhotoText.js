import photos from '../../../public/translations/zh-CN/archive-general/photos.json' with {type:'json'};
import costumes from '../../../public/translations/zh-CN/archive-general/costumes.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
export const {archiveText, archiveSearchText} = createArchiveTextTools({...photos.entries, ...costumes.entries});
