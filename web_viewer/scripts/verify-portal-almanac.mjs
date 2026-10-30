// 315 岁时记 (batch D): the all-idol Portal scope carries a 12-month almanac whose birthdays, events and gasha
// openings are checked here against the read model's own idol details, event and gasha directories and the
// ticket-pool evidence, with the month taken by
// Intl in Asia/Tokyo (an independent route from the generator's offset arithmetic). Idol scopes carry no
// almanac and the all-idol scope stays under its budget. The 运营轨迹 timeline it replaced is retired: the Portal
// has no fallback, so prepare-readmodel-preview runs this before any release is packaged.
//   node scripts/verify-portal-almanac.mjs <read-model candidate root>
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ALMANAC_MONTHS, buildPortalAlmanac, parseIdolBirthday, portalAlmanacMonth, almanacEventDate, birthdayCollectionTarget, almanacEventTarget, almanacGashaTarget } from '../src/presentation/PortalAlmanac.js'

const root = process.argv[2]
assert.ok(root && fs.existsSync(path.join(root, 'bootstrap.inline.json')), 'Supply a build_readmodels output root')
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const payload = file => { const value = json(file); return value.data ?? value }
const bootstrap = payload(path.join(root, 'bootstrap.inline.json'))
const pages = path.join(root, 'pages', '_catalog', 'v')
const release = fs.readdirSync(pages).find(name => /^[a-f0-9]{64}$/.test(name))
const base = path.join(pages, release)
const allFile = path.join(base, 'portal', 'scopes', 'all.json')
const all = payload(allFile).overview
const almanac = all.almanac
assert.ok(almanac?.months, 'the all-idol scope carries the almanac')
assert.deepEqual(Object.keys(almanac.months).map(Number), ALMANAC_MONTHS, 'twelve months, 1–12')

// Birthdays: every bootstrap idol exactly once, in the month and day of its profile.
const idols = bootstrap.idols
const profiles = Object.fromEntries(fs.readdirSync(path.join(base, 'idols', 'detail')).map(file => payload(path.join(base, 'idols', 'detail', file)))
  .map(detail => [detail.id, detail.view?.profile?.birthday]))
const birthdays = ALMANAC_MONTHS.flatMap(month => almanac.months[month].birthdays.map(row => ({ ...row, listedMonth: month })))
assert.equal(birthdays.length, idols.length, `${idols.length} idols, one birthday each`)
assert.deepEqual(new Set(birthdays.map(row => row.idolCode)), new Set(idols.map(idol => idol.id)))
for (const row of birthdays) {
  const text = String(profiles[row.idolCode] ?? '')
  const match = [...text.matchAll(/(\d+)月(\d+)日/g)].at(-1)
  assert.ok(match, `${row.idolCode} has a profile birthday`)
  assert.deepEqual([row.listedMonth, row.month, row.day], [Number(match[1]), Number(match[1]), Number(match[2])], `${row.idolCode} birthday`)
}
const aslan = birthdays.find(row => row.idolCode === '029ass')
assert.deepEqual(aslan && [aslan.month, aslan.day], [10, 9], 'Aslan: the Maya calendar line is skipped, 10月9日 kept')
assert.deepEqual(parseIdolBirthday('マヤ歴5174年\n10月9日'), { month: 10, day: 9 })
assert.equal(parseIdolBirthday('不明'), null)
for (const month of ALMANAC_MONTHS) {
  const days = almanac.months[month].birthdays.map(row => row.day)
  assert.deepEqual(days, [...days].sort((a, b) => a - b), `month ${month} birthdays by day`)
}

// Events: every directory event once, in its Japan-time opening month, reprints included and marked.
const catalog = fs.readdirSync(path.join(base, 'events', 'catalog')).sort().flatMap(file => {
  const page = payload(path.join(base, 'events', 'catalog', file)); return page.rows ?? page })
const tokyoMonth = seconds => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'numeric' }).format(new Date(seconds * 1000)))
const events = ALMANAC_MONTHS.flatMap(month => almanac.months[month].events.map(row => ({ ...row, listedMonth: month })))
assert.equal(events.length, catalog.length, `${catalog.length} directory events, each listed once`)
const byId = new Map(catalog.map(row => [String(row.id), row]))
for (const row of events) {
  const source = byId.get(row.id)
  assert.ok(source, `${row.id} is a directory event`)
  assert.equal(row.releaseAt, source.release_at, `${row.id} opening time`)
  assert.equal(row.listedMonth, tokyoMonth(source.release_at), `${row.id} listed in its Japan-time month`)
  assert.equal(row.isReprint, Boolean(source.isReprint), `${row.id} reprint flag`)
  assert.ok(row.title && row.image?.url && row.kind, `${row.id} has a title, banner and kind`)
}
assert.ok(events.some(row => row.isReprint), 'reprints are counted, not dropped')
for (const month of ALMANAC_MONTHS) {
  const times = almanac.months[month].events.map(row => row.releaseAt)
  assert.deepEqual(times, [...times].sort((a, b) => a - b), `month ${month} events by date`)
}
assert.equal(almanacEventDate(1633845600), '2021.10.10')

// Gashas: every directory pool once at its start, and every wiki-dated run of a ticket-only pool once, each in
// its Japan-time month. Read from the gasha directory and the evidence file, not through the catalogue helpers.
const gashaDirectory = fs.readdirSync(path.join(base, 'gashas', 'catalog')).sort().flatMap(file => {
  const page = payload(path.join(base, 'gashas', 'catalog', file)); return page.rows ?? page })
const evidence = json(new URL('../public/data/editorial/gasha-ticket-evidence.json', import.meta.url))
const expectedRuns = [...gashaDirectory.map(row => ({ id: String(row.id), startAt: row.start_at, banner: row.banner_url, reprint: Boolean(row.is_reprint) })),
  ...evidence.rows.filter(row => !row.matched_ids.length).flatMap(row => (row.wiki_pools || []).map(run => ({ id: row.id, startAt: run.start_at, banner: null, reprint: false })))]
const gashas = ALMANAC_MONTHS.flatMap(month => almanac.months[month].gashas.map(row => ({ ...row, listedMonth: month })))
assert.ok(gashaDirectory.length > 0 && expectedRuns.length > gashaDirectory.length, 'the directory and the ticket runs both contribute')
assert.equal(gashas.length, expectedRuns.length, `${expectedRuns.length} gasha openings, each listed once`)
const runKey = row => `${row.id}@${row.startAt}`
assert.deepEqual(new Set(gashas.map(runKey)), new Set(expectedRuns.map(runKey)))
const expectedByKey = new Map(expectedRuns.map(row => [runKey(row), row]))
for (const row of gashas) {
  const source = expectedByKey.get(runKey(row))
  assert.equal(row.listedMonth, tokyoMonth(row.startAt), `${runKey(row)} listed in its Japan-time month`)
  assert.equal(row.isReprint, source.reprint, `${runKey(row)} reprint flag`)
  assert.ok(row.title && row.kind, `${runKey(row)} has a title and kind`)
  if (source.banner) assert.equal(row.image?.url, source.banner, `${runKey(row)} shows its announcement banner`)
}
for (const month of ALMANAC_MONTHS) {
  const times = almanac.months[month].gashas.map(row => row.startAt)
  assert.deepEqual(times, [...times].sort((a, b) => a - b), `month ${month} gashas by date`)
}

// Idol scopes keep 活动足迹; a scope without the almanac falls back; the all-idol scope fits its budget.
const scopes = fs.readdirSync(path.join(base, 'portal', 'scopes')).filter(file => file !== 'all.json')
assert.ok(scopes.length > 0 && scopes.every(file => !payload(path.join(base, 'portal', 'scopes', file)).overview.almanac), 'idol scopes carry no almanac')
assert.equal(portalAlmanacMonth(undefined, 10), null)
assert.equal(portalAlmanacMonth({ months: {} }, 10), null)
assert.deepEqual(portalAlmanacMonth({ months: { 10: { birthdays: [], events: [] } } }, 10).gashas, [], 'an older almanac shows no pools')
const bytes = fs.statSync(allFile).size
assert.ok(bytes <= 64 * 1024, `all-idol scope ${bytes} B within its 64 KiB budget`)
assert.deepEqual(birthdayCollectionTarget('029ass'), { domain: 'collections', view: 'story_collection', collectionId: 'birthday:029ass', storyDomain: 'birthday', sectionId: '029ass' })
assert.deepEqual(almanacEventTarget(410001), { domain: 'events', view: 'event_detail', eventId: '410001' })
assert.deepEqual(almanacGashaTarget(210003), { domain: 'gashas', view: 'gasha_detail', gashaId: '210003' })
assert.deepEqual(buildPortalAlmanac({}).months[1], { birthdays: [], events: [], gashas: [] })

const perMonth = ALMANAC_MONTHS.map(month => `${month}:${almanac.months[month].birthdays.length}/${almanac.months[month].events.length}/${almanac.months[month].gashas.length}`).join(' ')
console.log(`PASS Portal almanac: ${birthdays.length} birthdays, ${events.length} events (${events.filter(row => row.isReprint).length} reprints) and ${gashas.length} gasha openings by Japan-time month [${perMonth}]; idol scopes without it; all-idol scope ${bytes} B`)
