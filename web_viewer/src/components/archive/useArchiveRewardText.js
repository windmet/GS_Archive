import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import honors from '../../../public/translations/zh-CN/archive-general/honors.json' with {type:'json'};
import photos from '../../../public/translations/zh-CN/archive-general/photos.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
import {rewardProductName} from './DomainPresentation.mjs';
import {loadArchiveNames,archiveNamedText} from './useArchiveNamedText.js';
void loadArchiveNames('cards').catch(()=>{});
const {archiveText}=createArchiveTextTools({...items.entries,...honors.entries,...photos.entries});
const kinds={item:'item',honor:'honor',card:'card',cardFragment:'card',photoFilter:'photo-filters',
  photoSticker:'photo-stickers',photoSpot:'photo-spots',photoScene:'photo-scenes',photoFrame:'photo-frames'};
export function presentRewardProductName(product) {
  const source=rewardProductName(product),kind=kinds[product?.kind];
  return kind==='card' ? archiveNamedText(kind,source,'title') : kind ? archiveText(kind,source,'name') : source;
}
