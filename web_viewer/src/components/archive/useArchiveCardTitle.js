import cards from '../../../public/translations/zh-CN/archive-general/cards.json' with {type:'json'};
import {createArchiveTextTools} from './useArchiveGeneralText.js';
export const {archiveText,archiveSearchText}=createArchiveTextTools(cards.entries);
export function archiveCardFullTitle(card) {
  const source=card?.title_full || '', title=archiveText('card',card?.title,'title');
  const prefix=`【${card?.title || ''}】`;
  return source.startsWith(prefix) && card?.title ? `【${title}】${source.slice(prefix.length)}` : source || title;
}
