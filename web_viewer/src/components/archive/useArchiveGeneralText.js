import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {archiveGeneralText} from '../../presentation/ArchiveGeneralTextCore.mjs';

export function createArchiveTextTools(entries) {
  return {
    archiveText: (kind, source, field = 'name') => archiveGeneralText(entries, kind, source, field, uiLocale.value),
    archiveSearchText: (kind, source, field = 'name') => `${source || ''} ${archiveGeneralText(entries, kind, source, field, 'zh-CN')}`,
  };
}
