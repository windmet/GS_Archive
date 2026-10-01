import translations from '../../public/translations/zh-CN/archive-general.json' with {type: 'json'};
import {archiveGeneralText} from './ArchiveGeneralTextCore.mjs';
export {honorBondSource} from './HonorBondSource.mjs';

// Exact source + metadata domain + field binding. No broad text replacement or dialogue fallback.
export function resolveArchiveGeneralText(kind, source, field = 'name', locale = 'zh-CN') {
  return archiveGeneralText(translations.entries, kind, source, field, locale);
}
