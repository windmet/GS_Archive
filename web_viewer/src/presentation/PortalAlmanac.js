// 315 岁时记: the all-idol Portal's month view — whose birthday falls in a month, and which events and gasha
// pools opened in that month across the years (reprints and reruns included). The read-model generator builds
// it once with these same functions: birthdays and events into the all-idol scope, gasha openings into their own
// portal/almanac-gashas.json (the scope has a 64 KiB budget), which the Portal merges in. The Portal only picks a
// month. Months are Japan time, the game's own calendar.

const JST_OFFSET_SECONDS = 9 * 3600
export const ALMANAC_MONTHS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

/** Month (1–12) and day of a Unix-seconds timestamp in Japan time. */
export function japanMonthDay(unixSeconds) {
  const date = new Date((Number(unixSeconds) + JST_OFFSET_SECONDS) * 1000)
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

/** Today's month in Japan time. */
export function currentJapanMonth(now = Date.now()) {
  return japanMonthDay(Math.floor(now / 1000)).month
}

/**
 * An idol profile's birthday text to {month, day}. The text is the game's own ("6月2日"); one idol's
 * carries a calendar line first ("マヤ歴5174年\n10月9日"), so the last M月D日 is the birthday.
 */
export function parseIdolBirthday(text) {
  const last = [...String(text ?? '').matchAll(/(\d{1,2})月(\d{1,2})日/g)].at(-1)
  if (!last) return null
  const month = Number(last[1]), day = Number(last[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null
}

/**
 * Every dated opening of a gasha pool, as the gasha catalogue lists them (`catalog` is the output of
 * supplementGashaCatalog): an announced pool opens once at its start; a ticket-only pool opens once per
 * wiki-recorded run, so a reprinted ticket pool appears in each month it ran. Undated ticket pools are left out.
 * `kindLabel` maps a catalogue category to its label.
 */
export function almanacGashaRuns(catalog = [], kindLabel = category => category) {
  return catalog.flatMap(gasha => {
    const art = gasha.pool_art?.banner || gasha.pool_art?.logo || null
    const image = gasha.banner_url ? { url: gasha.banner_url, width: 940, height: 510 } : art ? { url: art.url, width: art.width, height: art.height } : null
    const base = { id: String(gasha.id), title: gasha.display_name, kind: kindLabel(gasha.category), image }
    const starts = gasha.source_type === 'item-masterdata' ? (gasha.wiki_pools || []).map(run => run.start_at) : [gasha.start_at]
    return starts.filter(Number.isFinite).map(startAt => ({ ...base, startAt, isReprint: Boolean(gasha.is_reprint) }))
  })
}

/** Generation-time builder of portal/almanac-gashas.json: the openings from almanacGashaRuns by Japan-time month. */
export function buildAlmanacGashaMonths(runs = []) {
  const months = Object.fromEntries(ALMANAC_MONTHS.map(month => [month, []]))
  for (const run of runs) months[japanMonthDay(run.startAt).month].push(run)
  for (const month of ALMANAC_MONTHS) months[month].sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id))
  return { months }
}

/**
 * Generation-time builder. `idols` are the bootstrap idols (order kept within a day), `birthdays` maps an
 * idol code to its profile birthday text, `events` are the Portal's event entries (with releaseAt, image,
 * title and a subtitle whose first part is the event kind, e.g. "THEATER · 2021年10月10日") and `reprints`
 * the set of event ids that are reprints.
 */
export function buildPortalAlmanac({ idols = [], birthdays = {}, events = [], reprints = new Set() }) {
  const months = Object.fromEntries(ALMANAC_MONTHS.map(month => [month, { birthdays: [], events: [] }]))
  for (const idol of idols) {
    const birthday = parseIdolBirthday(birthdays[idol.id])
    if (birthday) months[birthday.month].birthdays.push({ idolCode: idol.id, ...birthday })
  }
  for (const event of events) {
    if (!Number.isFinite(event?.releaseAt) || !event.image?.url) continue
    const { month } = japanMonthDay(event.releaseAt)
    months[month].events.push({ id: String(event.id), title: event.title, releaseAt: event.releaseAt,
      kind: String(event.subtitle || '').split(' · ')[0], isReprint: reprints.has(String(event.id)),
      image: { url: event.image.url, width: event.image.width, height: event.image.height } })
  }
  for (const month of ALMANAC_MONTHS) {
    months[month].birthdays.sort((a, b) => a.day - b.day)
    months[month].events.sort((a, b) => a.releaseAt - b.releaseAt)
  }
  return { months }
}

/** "2021.10.10" for an event's opening day in Japan time. */
export function almanacEventDate(unixSeconds) {
  const date = new Date((Number(unixSeconds) + JST_OFFSET_SECONDS) * 1000)
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()].map((part, index) => index ? String(part).padStart(2, '0') : part).join('.')
}

/**
 * The scope's almanac with the gasha openings merged in. `gashaMonths` is the loaded almanac-gashas payload,
 * `undefined` while it loads, or null when the release has none (built before it) or it failed to load.
 */
export function withAlmanacGashas(almanac, gashaMonths) {
  if (!almanac?.months) return almanac
  const gashaState = gashaMonths === undefined ? 'loading' : gashaMonths?.months ? 'ready' : 'unavailable'
  return { ...almanac, gashaState, months: Object.fromEntries(Object.entries(almanac.months).map(([month, row]) =>
    [month, { ...row, gashas: gashaState === 'ready' && Array.isArray(gashaMonths.months[month]) ? gashaMonths.months[month] : [] }])) }
}

/** One month of a scope's almanac, or null when the scope predates it; gashaState says whether pools show. */
export function portalAlmanacMonth(almanac, month) {
  const row = almanac?.months?.[month]
  return row && Array.isArray(row.birthdays) && Array.isArray(row.events)
    ? { ...row, gashas: Array.isArray(row.gashas) ? row.gashas : [], gashaState: almanac.gashaState || 'unavailable' } : null
}

/** The Portal targets: an idol's birthday story collection, and an event's detail page. */
export function birthdayCollectionTarget(idolCode) {
  return { domain: 'collections', view: 'story_collection', collectionId: `birthday:${idolCode}`, storyDomain: 'birthday', sectionId: idolCode }
}
export function almanacEventTarget(eventId) {
  return { domain: 'events', view: 'event_detail', eventId: String(eventId) }
}
export function almanacGashaTarget(gashaId) {
  return { domain: 'gashas', view: 'gasha_detail', gashaId: String(gashaId) }
}
