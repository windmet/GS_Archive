import {loadArchiveNames,archiveNamedText,archiveNamedSearchText} from './useArchiveNamedText.js';
void loadArchiveNames('cards').catch(()=>{});
export const archiveText=archiveNamedText,archiveSearchText=archiveNamedSearchText;
export function archiveCardFullTitle(card) {
  const source=card?.title_full || '', title=archiveText('card',card?.title,'title');
  const prefix=`【${card?.title || ''}】`;
  return source.startsWith(prefix) && card?.title ? `【${title}】${source.slice(prefix.length)}` : source || title;
}
