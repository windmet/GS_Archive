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

// Terminal menus join source background names and scene variants with this
// delimiter. Translate each source field without guessing unnamed resource IDs.
export function archiveBackgroundLabel(entries, source, locale = 'zh-CN') {
  if (typeof source !== 'string') return '';
  if (locale !== 'zh-CN') return source;
  return source.split(' / ').map(part => {
    const name = archiveGeneralText(entries, 'background', part, 'name', locale);
    return name === part ? archiveGeneralText(entries, 'background-variant', part, 'name', locale) : name;
  }).join(' / ');
}
