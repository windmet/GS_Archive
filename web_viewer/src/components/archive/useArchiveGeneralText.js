import {uiLocale} from '../../localization/ui/UiLocaleStore.js';
import {resolveArchiveGeneralText} from '../../presentation/ArchiveGeneralText.mjs';

export const archiveText = (kind, source, field = 'name') => resolveArchiveGeneralText(kind, source, field, uiLocale.value);
// Search both source and Chinese display, even when the interface is in Japanese.
export const archiveSearchText = (kind, source, field = 'name') => `${source || ''} ${resolveArchiveGeneralText(kind, source, field, 'zh-CN')}`;
