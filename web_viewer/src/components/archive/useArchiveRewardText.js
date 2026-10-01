import cards from '../../../public/translations/zh-CN/archive-general/cards.json' with {type:'json'};
import items from '../../../public/translations/zh-CN/archive-general/items.json' with {type:'json'};
import honors from '../../../public/translations/zh-CN/archive-general/honors.json' with {type:'json'};
import photos from '../../../public/translations/zh-CN/archive-general/photos.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
import {rewardProductName} from './DomainPresentation.mjs';
const {archiveText}=createArchiveTextTools({...cards.entries,...items.entries,...honors.entries,...photos.entries});
const kinds={item:'item',honor:'honor',card:'card',cardFragment:'card',photoFilter:'photo-filters',
  photoSticker:'photo-stickers',photoSpot:'photo-spots',photoScene:'photo-scenes',photoFrame:'photo-frames'};
export function presentRewardProductName(product) {
  const source=rewardProductName(product),kind=kinds[product?.kind];
  return kind ? archiveText(kind,source,kind==='card'?'title':'name') : source;
}
