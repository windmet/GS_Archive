/** Table 43 field 3 is the card scenario's title; table 32 field 3 is an internal label. */
export function cardScenarioTitle(entry) {
  const display = typeof entry?.display_title === 'string' ? entry.display_title.trim() : ''
  if (display) return display
  const table = entry?._source?.table ?? entry?._top_field
  const source = table === 43 && typeof entry?.['3'] === 'string' ? entry['3'].trim() : ''
  return source && source !== entry.resource_id ? source : '剧情标题待确认'
}
