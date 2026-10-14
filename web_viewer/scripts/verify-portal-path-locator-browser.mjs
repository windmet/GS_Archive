// Browser journey for public path locators (/idols/<id>/, /units/<code>/, /cards/<resource_id>/,
// /songs/<song_code>/, /events/<id>/): plan section 3.6, P1-P15, the card steps P16-P19, the song steps P20-P24
// and the event steps P25-P31.
//   node scripts/verify-portal-path-locator-browser.mjs [base] [outDir]
// Defaults: http://127.0.0.1:5177 and .analysis/path-locator. Needs a dev server started with
// SIDEM_READMODEL_CANDIDATE and a cached Playwright Chromium; raw CDP like scripts/capture-gallery.mjs.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5177'
const out = process.argv[3] || '.analysis/path-locator'
mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const dir = readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe')))
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-journey-'))
const port = 9700 + Math.floor(Math.random() * 200)
const chrome = spawn(path.join(cache, dir, 'chrome-win64/chrome.exe'), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let targets
for (let i = 0; i < 50 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(r => socket.addEventListener('open', r))
let seq = 0, errors = []
const pending = new Map()
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').split('\n')[0])
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; const t = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')) }, 60000)
  pending.set(id, v => { clearTimeout(t); resolve(v) }); socket.send(JSON.stringify({ id, method, params }))
})
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
const preferences = startupPage => ({ version: 3, startupPage, homeMode: 'card', startupIdol: '002sht', preferredIdol: '002sht', portalDefaultScope: 'favorite', stageLight: 'mint', onboardingComplete: true })
let preferenceScript = null
const usePreferences = async startupPage => {
  if (preferenceScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preferenceScript })
  preferenceScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', ${JSON.stringify(JSON.stringify(preferences(startupPage)))}) } catch {}` })).identifier
}
await usePreferences('portal')
const requests = []
await send('Network.enable')
// Requests the network dropped (no HTTP status). A failing check after these is a transport failure: the
// app reports it and a second click recovers, so it says nothing about the locators themselves.
const dropped = []
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Network.responseReceived') requests.push({ url: m.params.response.url, status: m.params.response.status })
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) dropped.push(m.params.errorText)
})
// A remote preview can take many seconds per cold request; a route only publishes its URL once
// its data is in, so every navigation waits for the address to change, not for a fixed delay.
const remote = !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(base)
const WAIT_MS = remote ? 60000 : 20000
const waitFor = async (expr, ms = WAIT_MS) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const settle = () => sleep(1200)
const loc = () => ev('location.pathname + location.search')
const changedFrom = before => `location.pathname + location.search !== ${JSON.stringify(before)}`
const shot = async name => writeFileSync(path.join(out, name + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const results = []
let droppedSeen = 0
const check = (id, ok, detail) => {
  const network = dropped.slice(droppedSeen); droppedSeen = dropped.length
  const note = !ok && network.length ? ` [network dropped ${network.length}: ${[...new Set(network)].join(', ')}]` : ''
  results.push({ id, ok, detail: detail + note, droppedRequests: network.length })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} — ${detail}${note}`)
}
const idolPath = /^\/idols\/0\d\d[a-z]{3}\/$/
const open = async (url, ready) => { errors = []; await send('Page.navigate', { url: base + url }); await waitFor(ready); await settle() }
const click = async selector => { await ev(`document.querySelector(${JSON.stringify(selector)})?.click()`); await settle() }
const navigate = async action => { const before = await loc(); await action(); await waitFor(changedFrom(before)); await settle() }
const clickTo = selector => navigate(() => ev(`document.querySelector(${JSON.stringify(selector)})?.click()`))
const pageBack = () => clickTo('.archive-back')
const historyStep = direction => navigate(() => ev(`history.${direction}()`))
const idolReady = `location.pathname.startsWith('/idols/') || location.search.includes('view=idol_detail') ? !!document.querySelector('[data-archive-focus-id^="idol-domain:"]') : false`
const journey = async (size, label) => {
  await send('Emulation.setDeviceMetricsOverride', size)
  // P1: idol directory -> an idol publishes its path.
  await open('/?view=idols', `!!document.querySelector('.idol-card')`)
  const directory = await loc()
  await clickTo('.idol-card')
  await waitFor(`location.pathname.startsWith('/idols/')`); await settle()
  const detail = await loc(); await shot(`p1-${label}`)
  check(`P1 ${label} idol opens at its path`, idolPath.test(detail) && errors.length === 0, `${directory} -> ${detail}; errors=${errors.length}`)
  // P2: page back returns to the directory.
  await pageBack(); await waitFor(`location.search.includes('view=idols')`)
  check(`P2 ${label} page back to directory`, (await loc()) === directory, await loc())
  // P3: page back pushed an entry, so history is [directory, detail, directory]: back, back, forward.
  await historyStep('back'); const back = await loc()
  await historyStep('back'); const back2 = await loc()
  await historyStep('forward'); const fwd = await loc()
  check(`P3 ${label} back/forward`, back === detail && back2 === directory && fwd === detail, `back=${back} back2=${back2} forward=${fwd}`)
  const overflow = await ev('document.documentElement.scrollWidth > innerWidth + 1')
  check(`P13 ${label} no sideways scroll`, !overflow, `overflow=${overflow}`)
  return { directory, detail }
}
try {
  const { directory, detail } = await journey({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, 'desktop')
  // P4: refresh on the path, then page back still reaches the directory (history source survives reload).
  await send('Page.reload', { ignoreCache: true }); await waitFor(idolReady); await settle()
  check('P4a refresh keeps the path', (await loc()) === detail, await loc())
  await pageBack(); await waitFor(`location.search.includes('view=idols')`)
  check('P4 refresh then page back', (await loc()) === directory, await loc())
  // P5: cold path and cold legacy link behave the same, including where page back lands.
  await open('/idols/001tom/', idolReady); await shot('p5-cold-path')
  const coldText = await ev(`/冬[马馬]/.test(document.body.innerText)`)
  const coldErrors = errors.length
  await pageBack(); const coldPathBack = await loc()
  await open('/?view=idol_detail&idol=001tom', idolReady)
  const legacyNormalized = await loc()
  await pageBack(); const coldLegacyBack = await loc()
  check('P5 cold path renders and backs out like the legacy link', coldText && coldErrors === 0 && coldPathBack === coldLegacyBack && legacyNormalized === '/idols/001tom/', `legacy shown as ${legacyNormalized}; path back=${coldPathBack} legacy back=${coldLegacyBack}`)
  // P6/P7: a related page from the path resets the pathname; back returns to the path.
  await open('/idols/001tom/', idolReady)
  await clickTo('[data-archive-focus-id^="idol-domain:001tom:"]')
  await waitFor(`location.pathname === '/' && location.search.includes('view=')`)
  const related = await loc()
  check('P6 related page leaves the path', related.startsWith('/?view=') && !related.includes('/idols/'), related)
  await historyStep('back')
  check('P7 back returns to the path', (await loc()) === '/idols/001tom/', await loc())
  // P8: unit directory -> unit -> member -> page back -> page back.
  await open('/?view=unit_catalog', `!!document.querySelector('.unit-entry, .unit-card')`)
  const units = await loc()
  await clickTo('.unit-entry, .unit-card'); await waitFor(`location.pathname.startsWith('/units/') && !!document.querySelector('.unit-members')`); await settle()
  const unitPath = await loc()
  await clickTo('.unit-members .archive-idol-reference'); await waitFor(`location.pathname.startsWith('/idols/')`); await settle()
  const member = await loc()
  await pageBack(); await waitFor(`location.pathname.startsWith('/units/')`); const backUnit = await loc()
  await pageBack(); await waitFor(`location.search.includes('view=unit_catalog')`); const backUnits = await loc()
  await shot('p8-units')
  check('P8 unit chain', /^\/units\/\d\d[a-z]{3}\/$/.test(unitPath) && idolPath.test(member) && backUnit === unitPath && backUnits === units, `${units} -> ${unitPath} -> ${member} -> ${backUnit} -> ${backUnits}`)
  // P9: a legacy link is rewritten in place to its path, without adding a history entry.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const lengthBefore = await ev('history.length')
  await open('/?view=unit_detail&unit=01jup&q=x', `!!document.querySelector('.unit-members')`)
  const shown = await loc(); const lengthAfter = await ev('history.length')
  await historyStep('back'); const previous = await loc()
  check('P9 legacy link becomes its path in place', shown === '/units/01jup/' && lengthAfter === lengthBefore + 1 && previous === '/?view=about', `shown=${shown}; history ${lengthBefore}->${lengthAfter}; previous=${previous}`)
  // P10: malformed locator falls back without an uncaught error.
  await open('/idols/xyz/', `document.body.innerText.trim().length > 40`)
  check('P10 malformed path falls back', errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P11: a Home startup preference does not take over an explicit path.
  await usePreferences('home')
  await open('/idols/001tom/', idolReady)
  check('P11 Home preference keeps the path', (await loc()) === '/idols/001tom/' && await ev(`/冬[马馬]/.test(document.body.innerText)`), await loc())
  await usePreferences('portal')
  // P12: nothing is requested relative to the path, and no same-origin request fails.
  const relative = requests.filter(r => /^\/(idols|units|cards|songs|events)\/[^/]+\/.+/.test(new URL(r.url).pathname))
  const broken = requests.filter(r => r.status >= 400 && new URL(r.url).origin === new URL(base).origin)
  check('P12 no path-relative or failing same-origin requests', relative.length === 0 && broken.length === 0, `requests=${requests.length} relative=${relative.length} failing=${broken.map(r => r.status + ' ' + r.url).join(', ') || 0}`)
  // P14: unit codes with digits (W is 05w00) publish a path too.
  await open('/?view=unit_detail&unit=05w00', `!!document.querySelector('.unit-members')`)
  check('P14 W unit publishes its path', (await loc()) === '/units/05w00/' && errors.length === 0, await loc())
  // P15: the tab title follows the entity on path pages and returns to the site title elsewhere.
  const unitTitle = await ev('document.title')
  // The title waits for the translation pack, so it never shows the source name first.
  await open('/idols/001tom/', idolReady); await waitFor(`/^天濑冬马 · GS Archive$/.test(document.title)`)
  const idolTitle = await ev('document.title')
  await clickTo('[data-archive-focus-id^="idol-domain:001tom:"]'); await waitFor(`location.pathname === '/'`)
  const otherTitle = await ev('document.title')
  check('P15 tab title follows the entity', unitTitle === 'W · GS Archive' && /^天濑冬马 · GS Archive$/.test(idolTitle) && otherTitle === 'GS Archive · SideM GROWING STARS 资料馆', `unit="${unitTitle}" idol="${idolTitle}" other="${otherTitle}"`)
  // P16: a card path opens cold, keeps its address and titles the tab with the card and its idol, never the source text.
  const cardReady = `!!document.querySelector('.card-detail .card-identity')`
  const titles = []
  await open('/cards/001tom_ssr01/', cardReady)
  for (let i = 0; i < WAIT_MS / 250 && !/^【.+】天濑冬马 · GS Archive$/.test(titles.at(-1) || ''); i++) { titles.push(await ev('document.title')); await sleep(250) }
  const sourceShown = titles.filter(title => /天ヶ瀬|瞳に映る/.test(title))
  check('P16 card path opens cold with its title', (await loc()) === '/cards/001tom_ssr01/' && /^【.+】天濑冬马 · GS Archive$/.test(titles.at(-1)) && !sourceShown.length && errors.length === 0,
    `${await loc()} title="${titles.at(-1)}" source titles=${sourceShown.length} errors=${errors.join(' | ') || 0}`)
  // P17: with no source, page back goes to the card's idol's cards.
  await pageBack(); await waitFor(`location.search.includes('view=cards')`)
  const coldBack = await loc()
  check('P17 cold card back lists its idol cards', /^\/\?view=cards&(category=cards&)?idol=001tom$/.test(coldBack), coldBack)
  // P18: a filtered list -> card -> page back returns to the same filtered list.
  await open('/?view=cards&idol=004ter&rarity=SSR', `!!document.querySelector('.card-archive-row')`)
  const list = await loc()
  await clickTo('.card-archive-row'); await waitFor(cardReady)
  const cardPath = await loc()
  await pageBack(); await waitFor(`location.search.includes('view=cards')`)
  const listBack = await loc()
  // Page back pushed an entry (as in P3): browser back reaches the card, then the list.
  await historyStep('back'); const historyCard = await loc()
  await historyStep('back'); const historyList = await loc()
  check('P18 card from a filtered list and back', /^\/cards\/004ter_ssr\d\d\/$/.test(cardPath) && listBack === list && historyCard === cardPath && historyList === list,
    `${list} -> ${cardPath} -> ${listBack}; history back ${historyCard} -> ${historyList}`)
  // P19: an old card link with list filters and a parent event is rewritten in place to the card path.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const before = await ev('history.length')
  await open('/?view=card_detail&category=cards&idol=001tom&card=001tom_n01&event=10011&q=q', cardReady)
  const legacy = await loc(); const after = await ev('history.length')
  check('P19 legacy card link becomes its path in place', legacy === '/cards/001tom_n01/' && after === before + 1, `shown=${legacy}; history ${before}->${after}`)
  // P20: a song path opens cold, keeps its address and titles the tab with the song.
  const songReady = `!!document.querySelector('.song-detail .song-detail-hero')`
  await open('/songs/brndnf/', songReady); await waitFor(`document.title === 'BRAND NEW FIELD · GS Archive'`); await shot('p20-song')
  check('P20 song path opens cold with its title', (await loc()) === '/songs/brndnf/' && (await ev('document.title')) === 'BRAND NEW FIELD · GS Archive' && errors.length === 0,
    `${await loc()} title="${await ev('document.title')}" errors=${errors.join(' | ') || 0}`)
  // P21: with no source, page back goes to the song catalogue.
  await pageBack(); await waitFor(`location.search.includes('view=song_catalog')`)
  check('P21 cold song back lists the songs', (await loc()) === '/?view=song_catalog', await loc())
  // P22: a filtered catalogue -> song -> page back returns to the same filter; browser history agrees.
  await open('/?view=song_catalog&song_scope=layered', `!!document.querySelector('.song-card')`)
  const songs = await loc()
  await clickTo('.song-card'); await waitFor(songReady)
  const songPath = await loc()
  await pageBack(); await waitFor(`location.search.includes('view=song_catalog')`)
  const songsBack = await loc()
  await historyStep('back'); const historySong = await loc()
  await historyStep('back'); const historySongs = await loc()
  check('P22 song from a filtered catalogue and back', /^\/songs\/[a-z0-9]{6}\/$/.test(songPath) && songsBack === songs && historySong === songPath && historySongs === songs,
    `${songs} -> ${songPath} -> ${songsBack}; history back ${historySong} -> ${historySongs}`)
  // P23: idol -> song -> refresh -> page back returns to the idol path (the parent rides the history source).
  await open('/idols/001tom/', `!!document.querySelector('[data-archive-focus-id^="idol-song:001tom:"]')`)
  await clickTo('[data-archive-focus-id^="idol-song:001tom:"]'); await waitFor(songReady)
  const idolSong = await loc()
  await send('Page.reload', { ignoreCache: true }); await waitFor(songReady); await settle()
  const reloaded = await loc()
  await pageBack(); await waitFor(`location.pathname.startsWith('/idols/')`)
  check('P23 idol song refresh and back', /^\/songs\/[a-z0-9]{6}\/$/.test(idolSong) && reloaded === idolSong && (await loc()) === '/idols/001tom/',
    `${idolSong} -> reload ${reloaded} -> ${await loc()}`)
  // P24: an old song link with a scope and the unit it was opened from is rewritten in place to the song path.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const songBefore = await ev('history.length')
  await open('/?view=song_detail&song=brndnf&song_scope=unit&parent=unit_detail&unit=01jup', songReady)
  const songLegacy = await loc(); const songAfter = await ev('history.length')
  check('P24 legacy song link becomes its path in place', songLegacy === '/songs/brndnf/' && songAfter === songBefore + 1, `shown=${songLegacy}; history ${songBefore}->${songAfter}`)
  // P25: an event path opens cold, keeps its address and titles the tab with the event.
  const eventReady = `!!document.querySelector('.event-detail .event-identity h2')`
  await open('/events/410018/', eventReady); await waitFor(`/ · GS Archive$/.test(document.title) && !document.title.startsWith('GS Archive')`); await shot('p25-event')
  const eventHeading = await ev(`document.querySelector('.event-detail .event-identity h2')?.textContent.trim()`)
  check('P25 event path opens cold with its title', (await loc()) === '/events/410018/' && (await ev('document.title')) === `${eventHeading} · GS Archive` && errors.length === 0,
    `${await loc()} title="${await ev('document.title')}" errors=${errors.join(' | ') || 0}`)
  // P26: with no source and no placement, page back returns to the event catalogue, the event's own section.
  await pageBack(); await waitFor(`location.search.includes('view=event_catalog')`)
  check('P26 cold event back returns to the event catalogue', (await loc()).startsWith('/?view=event_catalog'), await loc())
  // P27: an event:<code> id publishes the five-digit path and opens cold.
  await open('/events/20001/', eventReady)
  check('P27 a 315 CARNIVAL event opens at its code', (await loc()) === '/events/20001/' && errors.length === 0, `${await loc()} errors=${errors.join(' | ') || 0}`)
  // P28: a filtered catalogue -> event -> page back returns to the same filter; browser history agrees.
  await open('/?view=event_catalog&event_kind=collection', `!!document.querySelector('.event-item')`)
  const eventList = await loc()
  await clickTo('.event-item'); await waitFor(eventReady)
  const eventPath = await loc()
  await pageBack(); await waitFor(`location.search.includes('view=event_catalog')`)
  const eventListBack = await loc()
  await historyStep('back'); const historyEvent = await loc()
  await historyStep('back'); const historyEventList = await loc()
  check('P28 event from a filtered catalogue and back', /^\/events\/[0-9]{5,6}\/$/.test(eventPath) && eventListBack === eventList && historyEvent === eventPath && historyEventList === eventList,
    `${eventList} -> ${eventPath} -> ${eventListBack}; history back ${historyEvent} -> ${historyEventList}`)
  // P29: unit -> event -> refresh -> page back returns to the unit path (placement and source ride history state).
  await open('/units/01jup/', `!!document.querySelector('.relation-row.kind-event')`)
  await clickTo('.relation-row.kind-event'); await waitFor(eventReady)
  const unitEvent = await loc(); const placement = await ev('JSON.stringify(history.state?.sidemArchiveNav?.event || null)')
  await send('Page.reload', { ignoreCache: true }); await waitFor(eventReady); await settle()
  const eventReloaded = await loc()
  await pageBack(); await waitFor(`location.pathname.startsWith('/units/')`)
  check('P29 unit event refresh and back', /^\/events\/[0-9]{5,6}\/$/.test(unitEvent) && eventReloaded === unitEvent && (await loc()) === '/units/01jup/' && /unit_detail/.test(placement),
    `${unitEvent} (placement ${placement}) -> reload ${eventReloaded} -> ${await loc()}`)
  // P30: an old event link with list filters and a placement is rewritten in place; the placement moves to state.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const eventBefore = await ev('history.length')
  await open('/?view=event_detail&event=410018&parent=unit_detail&unit=01jup&category=idol&q=x&story_type=event', eventReady)
  const eventLegacy = await loc(); const eventAfter = await ev('history.length')
  const movedPlacement = await ev('JSON.stringify(history.state?.sidemArchiveNav?.event || null)')
  await pageBack(); await waitFor(`location.pathname.startsWith('/units/')`)
  check('P30 legacy event link becomes its path in place', eventLegacy === '/events/410018/' && eventAfter === eventBefore + 1 && /01jup/.test(movedPlacement) && (await loc()) === '/units/01jup/',
    `shown=${eventLegacy}; history ${eventBefore}->${eventAfter}; placement ${movedPlacement}; back ${await loc()}`)
  // P31: unit -> event -> play an episode -> close the player -> the event path -> page back to the unit.
  // The player keeps its own query address; leaving it moves the placement back into state.
  await open('/units/01jup/', `!!document.querySelector('.relation-row.kind-event')`)
  await clickTo('.relation-row.kind-event'); await waitFor(eventReady)
  const playedEvent = await loc()
  await clickTo('.episode-play:not([disabled])'); await waitFor(`location.search.includes('view=player')`)
  const playerUrl = await loc()
  await waitFor(`!!document.querySelector('.player-top-bar button')`)
  await clickTo('.player-top-bar button'); await waitFor(eventReady)
  const afterPlayer = await loc()
  await pageBack(); await waitFor(`location.pathname.startsWith('/units/')`)
  check('P31 event player round trip', playerUrl.includes('view=player') && afterPlayer === playedEvent && (await loc()) === '/units/01jup/',
    `${playedEvent} -> ${playerUrl.slice(0, 80)} -> ${afterPlayer} -> ${await loc()}`)
  // P13: phone width for P1-P3.
  await journey({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, 'phone')
} finally {
  socket.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2))
process.exitCode = results.every(r => r.ok) ? 0 : 1
