export function archiveGeneralText(entries, kind, source, field = 'name', locale = 'zh-CN') {
  if (typeof source !== 'string') return '';
  if (locale !== 'zh-CN' || !Object.hasOwn(entries, kind)) return source;
  const fields = entries[kind];
  if (!Object.hasOwn(fields, field)) return source;
  return Object.hasOwn(fields[field], source) ? fields[field][source] : source;
}

export function isArchiveResourceDescription(kind, source) {
  return kind === 'photo-scenes' && typeof source === 'string' && /^bg\d{3}_[a-z0-9_]+$/.test(source);
}
