import translations from '../../public/translations/zh-CN/archive-general.json' with {type: 'json'};
import bonds from '../../public/data/editorial/honor-bonds.json' with {type: 'json'};

// Exact source + metadata domain + field binding. No broad text replacement or dialogue fallback.
export function resolveArchiveGeneralText(kind, source, field = 'name', locale = 'zh-CN') {
  if (typeof source !== 'string') return '';
  if (locale !== 'zh-CN' || !Object.hasOwn(translations.entries, kind)) return source;
  const fields = translations.entries[kind];
  if (!Object.hasOwn(fields, field)) return source;
  return Object.hasOwn(fields[field], source) ? fields[field][source] : source;
}
export function honorBondSource(entry) {
  const record = bonds.entries[entry?.id];
  return record && record.sourceName === entry.nameJa && record.resourceId === entry.resourceId ? record : null;
}
