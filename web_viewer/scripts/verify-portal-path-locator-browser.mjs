// Browser journey for public path locators (/idols/<id>/, /units/<code>/, /cards/<resource_id>/,
// /songs/<song_code>/, /events/<id>/): plan section 3.6, P1-P15, the card steps P16-P19, the song steps P20-P24
// the event steps P25-P31, the song/event/main-story relation steps P32-P36, the Reader revision step P37, the gasha and
// section-root steps P38-P41, office/mobile steps P42-P46 and directory pruning steps P47-P50.
//   node scripts/verify-portal-path-locator-browser.mjs [base] [outDir]
// Defaults: http://127.0.0.1:5177 and .analysis/path-locator. Needs a dev server with the read-model candidate (picked
// automatically, or SIDEM_READMODEL_CANDIDATE) and a cached Playwright Chromium; raw CDP like scripts/capture-gallery.mjs.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5177'
const out = process.argv[3] || '.analysis/path-locator'
mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const binaries = readdirSync(cache).sort().reverse().flatMap(dir => [
  path.join(cache, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), path.join(cache, dir, 'chrome-win64/chrome.exe')])
  .filter(file => existsSync(file)).sort((a, b) => Number(b.includes('headless-shell')) - Number(a.includes('headless-shell')))
if (!binaries.length) throw new Error('No cached Playwright Chromium found')
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-journey-'))
const port = 9700 + Math.floor(Math.random() * 200)
const headless = binaries[0].includes('headless-shell') ? [] : ['--headless=new']
const chrome = spawn(binaries[0], [`--remote-debugging-port=${port}`, ...headless, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let targets
for (let i = 0; i < 50 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
if (!targets?.some(target => target.type === 'page')) { chrome.kill(); throw new Error(`${binaries[0]} did not expose a browser page`) }
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
// Section roots publish /<section>/ (filters stay in the query); details publish /<section>/<id>/.
const atRoot = section => `location.pathname === '/${section}/'`
const atDetail = section => `new RegExp('^/${section}/[^/]+/$').test(location.pathname)`
const idolReady = `${atDetail('idols')} || location.search.includes('view=idol_detail') ? !!document.querySelector('[data-archive-focus-id^="idol-domain:"]') : false`
const clickText = (selector, text) => navigate(() => ev(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(n => n.textContent.trim() === ${JSON.stringify(text)})?.click()`))
const journey = async (size, label) => {
  await send('Emulation.setDeviceMetricsOverride', size)
  // P1: idol directory -> an idol publishes its path.
  await open('/?view=idols', `!!document.querySelector('.idol-card')`)
  const directory = await loc()
  await clickTo('.idol-card')
  await waitFor(atDetail('idols')); await settle()
  const detail = await loc(); await shot(`p1-${label}`)
  check(`P1 ${label} idol opens at its path`, directory === '/idols/' && idolPath.test(detail) && errors.length === 0, `${directory} -> ${detail}; errors=${errors.length}`)
  // P2: page back returns to the directory.
  await pageBack(); await waitFor(atRoot('idols'))
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
  await pageBack(); await waitFor(atRoot('idols'))
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
  await waitFor(`!location.pathname.startsWith('/idols/')`)
  const related = await loc()
  check('P6 related page leaves the idol path', !related.startsWith('/idols/'), related)
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
  await pageBack(); await waitFor(atRoot('units')); const backUnits = await loc()
  await shot('p8-units')
  check('P8 unit chain', units === '/units/' && /^\/units\/\d\d[a-z]{3}\/$/.test(unitPath) && idolPath.test(member) && backUnit === unitPath && backUnits === units, `${units} -> ${unitPath} -> ${member} -> ${backUnit} -> ${backUnits}`)
  // P9: a legacy link is rewritten in place to its path, without adding a history entry.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const lengthBefore = await ev('history.length')
  await open('/?view=unit_detail&unit=01jup&q=x', `!!document.querySelector('.unit-members')`)
  const shown = await loc(); const lengthAfter = await ev('history.length')
  await historyStep('back'); const previous = await loc()
  check('P9 legacy link becomes its path in place', shown === '/units/01jup/' && lengthAfter === lengthBefore + 1 && previous === '/about/', `shown=${shown}; history ${lengthBefore}->${lengthAfter}; previous=${previous}`)
  // P10: malformed locator falls back without an uncaught error.
  await open('/idols/xyz/', `document.body.innerText.trim().length > 40`)
  check('P10 malformed path falls back', errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P11: a Home startup preference does not take over an explicit path.
  await usePreferences('home')
  await open('/idols/001tom/', idolReady)
  check('P11 Home preference keeps the path', (await loc()) === '/idols/001tom/' && await ev(`/冬[马馬]/.test(document.body.innerText)`), await loc())
  await usePreferences('portal')
  // P12: nothing is requested relative to the path, and no same-origin request fails.
  const relative = requests.filter(r => /^\/(idols|units|cards|songs|events|gashas|stories|items|honors|photos)\/[^/]+\/.+/.test(new URL(r.url).pathname))
  const broken = requests.filter(r => r.status >= 400 && new URL(r.url).origin === new URL(base).origin)
  check('P12 no path-relative or failing same-origin requests', relative.length === 0 && broken.length === 0, `requests=${requests.length} relative=${relative.length} failing=${broken.map(r => r.status + ' ' + r.url).join(', ') || 0}`)
  // P14: unit codes with digits (W is 05w00) publish a path too.
  await open('/?view=unit_detail&unit=05w00', `!!document.querySelector('.unit-members')`)
  check('P14 W unit publishes its path', (await loc()) === '/units/05w00/' && errors.length === 0, await loc())
  // P15: the tab title follows the entity on path pages and returns to the site title elsewhere.
  const unitTitle = await ev('document.title')
  // The title waits for the translation pack, so it never shows the source name first.
  await open('/idols/001tom/', idolReady); await waitFor(`/^天濑冬马 · GROWING STARS 资料馆$/.test(document.title)`)
  const idolTitle = await ev('document.title')
  await clickTo('[data-archive-focus-id^="idol-domain:001tom:"]'); await waitFor(`location.pathname === '/'`)
  const otherTitle = await ev('document.title')
  check('P15 tab title follows the entity', unitTitle === 'W · GROWING STARS 资料馆' && /^天濑冬马 · GROWING STARS 资料馆$/.test(idolTitle) && otherTitle === 'GROWING STARS 资料馆 · 偶像大师 SideM', `unit="${unitTitle}" idol="${idolTitle}" other="${otherTitle}"`)
  // P16: a card path opens cold, keeps its address and titles the tab with the card and its idol, never the source text.
  const cardReady = `!!document.querySelector('.card-detail .card-identity')`
  const titles = []
  await open('/cards/001tom_ssr01/', cardReady)
  for (let i = 0; i < WAIT_MS / 250 && !/^【.+】天濑冬马 · GROWING STARS 资料馆$/.test(titles.at(-1) || ''); i++) { titles.push(await ev('document.title')); await sleep(250) }
  const sourceShown = titles.filter(title => /天ヶ瀬|瞳に映る/.test(title))
  check('P16 card path opens cold with its title', (await loc()) === '/cards/001tom_ssr01/' && /^【.+】天濑冬马 · GROWING STARS 资料馆$/.test(titles.at(-1)) && !sourceShown.length && errors.length === 0,
    `${await loc()} title="${titles.at(-1)}" source titles=${sourceShown.length} errors=${errors.join(' | ') || 0}`)
  // P17: with no source, page back goes to the card's idol's cards.
  await pageBack(); await waitFor(atRoot('cards'))
  const coldBack = await loc()
  check('P17 cold card back lists its idol cards', coldBack === '/cards/?idol=001tom', coldBack)
  // P18: a filtered list -> card -> page back returns to the same filtered list.
  await open('/?view=cards&idol=004ter&rarity=SSR', `!!document.querySelector('.card-archive-row')`)
  const list = await loc()
  await clickTo('.card-archive-row'); await waitFor(cardReady)
  const cardPath = await loc()
  await pageBack(); await waitFor(atRoot('cards'))
  const listBack = await loc()
  // Page back pushed an entry (as in P3): browser back reaches the card, then the list.
  await historyStep('back'); const historyCard = await loc()
  await historyStep('back'); const historyList = await loc()
  check('P18 card from a filtered list and back', list === '/cards/?idol=004ter&rarity=SSR' && /^\/cards\/004ter_ssr\d\d\/$/.test(cardPath) && listBack === list && historyCard === cardPath && historyList === list,
    `${list} -> ${cardPath} -> ${listBack}; history back ${historyCard} -> ${historyList}`)
  // P19: an old card link with list filters and a parent event is rewritten in place to the card path.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const before = await ev('history.length')
  await open('/?view=card_detail&category=cards&idol=001tom&card=001tom_n01&event=10011&q=q', cardReady)
  const legacy = await loc(); const after = await ev('history.length')
  check('P19 legacy card link becomes its path in place', legacy === '/cards/001tom_n01/' && after === before + 1, `shown=${legacy}; history ${before}->${after}`)
  // P20: a song path opens cold, keeps its address and titles the tab with the song.
  const songReady = `!!document.querySelector('.song-detail .song-detail-hero')`
  await open('/songs/brndnf/', songReady); await waitFor(`document.title === 'BRAND NEW FIELD · GROWING STARS 资料馆'`); await shot('p20-song')
  check('P20 song path opens cold with its title', (await loc()) === '/songs/brndnf/' && (await ev('document.title')) === 'BRAND NEW FIELD · GROWING STARS 资料馆' && errors.length === 0,
    `${await loc()} title="${await ev('document.title')}" errors=${errors.join(' | ') || 0}`)
  // P21: with no source, page back goes to the song catalogue.
  await pageBack(); await waitFor(atRoot('songs'))
  check('P21 cold song back lists the songs', (await loc()) === '/songs/', await loc())
  // P22: a filtered catalogue -> song -> page back returns to the same filter; browser history agrees.
  await open('/?view=song_catalog&song_scope=layered', `!!document.querySelector('.song-card')`)
  const songs = await loc()
  await clickTo('.song-card'); await waitFor(songReady)
  const songPath = await loc()
  await pageBack(); await waitFor(atRoot('songs'))
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
  await open('/events/410018/', eventReady); await waitFor(`/ · GROWING STARS 资料馆$/.test(document.title) && !document.title.startsWith('GROWING STARS')`); await shot('p25-event')
  const eventHeading = await ev(`document.querySelector('.event-detail .event-identity h2')?.textContent.trim()`)
  check('P25 event path opens cold with its title', (await loc()) === '/events/410018/' && (await ev('document.title')) === `${eventHeading} · GROWING STARS 资料馆` && errors.length === 0,
    `${await loc()} title="${await ev('document.title')}" errors=${errors.join(' | ') || 0}`)
  // P26: with no source and no placement, page back returns to the event catalogue, the event's own section.
  await pageBack(); await waitFor(atRoot('events'))
  check('P26 cold event back returns to the event catalogue', /^\/events\/(\?.*)?$/.test(await loc()), await loc())
  // P27: an event:<code> id publishes the five-digit path and opens cold.
  await open('/events/20001/', eventReady)
  check('P27 a 315 CARNIVAL event opens at its code', (await loc()) === '/events/20001/' && errors.length === 0, `${await loc()} errors=${errors.join(' | ') || 0}`)
  // P28: a filtered catalogue -> event -> page back returns to the same filter; browser history agrees.
  await open('/?view=event_catalog&event_kind=collection', `!!document.querySelector('.event-item')`)
  const eventList = await loc()
  await clickTo('.event-item'); await waitFor(eventReady)
  const eventPath = await loc()
  await pageBack(); await waitFor(atRoot('events'))
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
  // P32: a song lists its premiere and reprint events; the premiere opens and page back returns to the song.
  await open('/songs/ntalon/', `!!document.querySelector('.song-events .relation-row')`); await ev(`document.querySelector('.song-events')?.scrollIntoView({block:'center'})`); await sleep(400); await shot('p32-song-events')
  const premiereNote = await ev(`[...document.querySelectorAll('.song-gameplay .song-block-note')].find(n => n.textContent.startsWith('首发：'))?.textContent.trim() || ''`)
  const songEventLabels = await ev(`[...document.querySelectorAll('.song-events .relation-labels strong')].map(n => n.textContent.trim()).join('|')`)
  await clickTo('.song-events .relation-row'); await waitFor(eventReady)
  const premierePath = await loc(), premiereSong = await ev(`document.querySelector('.event-songs .relation-copy b')?.textContent.trim()`)
  await ev(`document.querySelector('.event-songs')?.scrollIntoView({block:'center'})`); await sleep(400); await shot('p32-event-song')
  await pageBack(); await waitFor(songReady)
  check('P32 song to its premiere event and back', premiereNote.startsWith('首发：活动「GROWING SIGN@L -Not Alone-」先行') && songEventLabels === '首发活动|复刻活动' && premierePath === '/events/410001/' && premiereSong === 'Not Alone' && (await loc()) === '/songs/ntalon/',
    `"${premiereNote}" labels=${songEventLabels} -> ${premierePath} song=${premiereSong} -> ${await loc()}`)
  // P33: a reprint event shows the original event song; it opens the song and page back returns to the event.
  await open('/events/10019/', `!!document.querySelector('.event-songs .relation-row')`)
  const reprintLabel = await ev(`document.querySelector('.event-songs .relation-labels strong')?.textContent.trim()`)
  await clickTo('.event-songs .relation-row'); await waitFor(songReady)
  const reprintSong = await loc()
  await pageBack(); await waitFor(eventReady)
  check('P33 reprint event to its song and back', reprintLabel === '原活动曲' && reprintSong === '/songs/ntalon/' && (await loc()) === '/events/10019/',
    `label=${reprintLabel} -> ${reprintSong} -> ${await loc()}`)
  // P34: a main-story unlock names its chapter and opens that chapter; page back returns to the song.
  await open('/songs/grwsml/', `!!document.querySelector('.song-unlock-link')`); await ev(`document.querySelector('.song-gameplay')?.scrollIntoView({block:'center'})`); await sleep(400); await shot('p34-song-unlock')
  const unlockText = await ev(`document.querySelector('.song-unlock-link').closest('p').textContent.trim()`)
  await clickTo('.song-unlock-link'); await waitFor(`location.search.includes('view=story_collection')`)
  const unlockRoute = await loc()
  await pageBack(); await waitFor(songReady)
  check('P34 main-story unlock opens the chapter and back', unlockText === '解锁条件：阅读主线 第1章 第1話（至 EPISODE10）' && unlockRoute.includes('story_type=main') && unlockRoute.includes('story_section=101') && (await loc()) === '/songs/grwsml/',
    `"${unlockText}" -> ${unlockRoute} -> ${await loc()}`)
  // P35: song -> its event -> reload -> page back returns to the song (the opener survives in history state).
  await open('/songs/ntalon/', `!!document.querySelector('.song-events .relation-row')`)
  await clickTo('.song-events .relation-row'); await waitFor(eventReady)
  const songEventPath = await loc(), songEventState = await ev('JSON.stringify(history.state?.sidemArchiveNav?.event || null)')
  await send('Page.reload', { ignoreCache: true }); await waitFor(eventReady); await settle()
  await pageBack(); await waitFor(songReady)
  check('P35 song event refresh and back', songEventPath === '/events/410001/' && (await loc()) === '/songs/ntalon/',
    `${songEventPath} (placement ${songEventState}) -> reload -> ${await loc()}`)
  // P36: event -> its song -> reload -> page back returns to the event.
  await open('/events/410001/', `!!document.querySelector('.event-songs .relation-row')`)
  await clickTo('.event-songs .relation-row'); await waitFor(songReady)
  const eventSongPath = await loc(), eventSongState = await ev('JSON.stringify(history.state?.sidemArchiveNav?.song || null)')
  await send('Page.reload', { ignoreCache: true }); await waitFor(songReady); await settle()
  await pageBack(); await waitFor(eventReady)
  check('P36 event song refresh and back', eventSongPath === '/songs/ntalon/' && (await loc()) === '/events/410001/',
    `${eventSongPath} (placement ${eventSongState}) -> reload -> ${await loc()}`)
  // P37: Reader and Reader playback links name the latest text by default (no reading_rev); a reloaded
  // playback link still verifies against the current text and plays; an explicit reading_rev stays pinned.
  const readerReady = `location.search.includes('view=reader') && !!document.querySelector('.chapter-reading-segment header button:not([disabled])')`
  await open('/events/410001/', eventReady)
  await clickTo('.event-story .story-action.primary'); await waitFor(readerReady); await settle()
  const readerUrl = await loc()
  const revision = await ev(`document.querySelector('.chapter-reading-segment')?.dataset.revision || ''`)
  await clickTo('.chapter-reading-segment header button'); await waitFor(`location.search.includes('view=player')`)
  const playerUrl37 = await loc()
  await send('Page.reload', { ignoreCache: true }); await waitFor(`location.search.includes('view=player') && !!document.querySelector('.player-top-bar button')`); await settle()
  const reloadedPlayer = await loc()
  const pinnedUrl = readerUrl + '&reading_rev=' + encodeURIComponent(revision || 'sha256:missing')
  await open(pinnedUrl, readerReady)
  const pinnedLoc = await loc()
  check('P37 Reader links default to the latest text', !readerUrl.includes('reading_rev') && playerUrl37.includes('view=player') && !playerUrl37.includes('reading_rev') &&
    reloadedPlayer.includes('view=player') && (await ev(`!document.querySelector('[role=alert]')`)) !== false && pinnedLoc.includes('reading_rev=') && errors.length === 0,
    `${readerUrl.slice(0, 70)} -> ${playerUrl37.slice(0, 70)} -> reload ${reloadedPlayer.slice(0, 40)}; pinned keeps rev=${pinnedLoc.includes('reading_rev=')} errors=${errors.join(' | ') || 0}`)
  // P38: a gasha path opens cold with its title; with no source, page back returns to the gasha catalogue.
  const gashaReady = `!!document.querySelector('.gasha-detail .gasha-identity h2')`
  await open('/gashas/210003/', gashaReady); await waitFor(`/ · GROWING STARS 资料馆$/.test(document.title) && !document.title.startsWith('GROWING STARS')`); await shot('p38-gasha')
  const gashaHeading = await ev(`document.querySelector('.gasha-detail .gasha-identity h2')?.textContent.trim()`)
  const gashaTitle = await ev('document.title')
  await pageBack(); await waitFor(atRoot('gashas'))
  check('P38 gasha path opens cold and backs out to the catalogue', gashaTitle === `${gashaHeading} · GROWING STARS 资料馆` && (await loc()) === '/gashas/' && errors.length === 0,
    `title="${gashaTitle}" back=${await loc()} errors=${errors.join(' | ') || 0}`)
  // P39: a ticket-only pool has a path too; the legacy link is rewritten in place.
  await open('/?view=gasha_detail&gasha=ticket-ee75311e4c092124&q=x', gashaReady); await shot('p39-ticket-gasha')
  check('P39 ticket pool legacy link becomes its path', (await loc()) === '/gashas/ticket-ee75311e4c092124/' && errors.length === 0, `${await loc()} errors=${errors.join(' | ') || 0}`)
  // P40: a filtered gasha catalogue -> gasha -> page back returns to the same filter.
  await open('/gashas/', `!!document.querySelector('.gasha-item')`)
  await clickTo('.gasha-item'); await waitFor(gashaReady)
  const gashaPath = await loc()
  await pageBack(); await waitFor(atRoot('gashas'))
  check('P40 gasha from the catalogue and back', /^\/gashas\/([0-9]{6,8}|ticket-[0-9a-f]{16})\/$/.test(gashaPath) && (await loc()).startsWith('/gashas/') && (await ev(`!!document.querySelector('.gasha-item')`)),
    `${gashaPath} -> ${await loc()}`)
  // P41: section roots open cold at their path with the section title; the sidebar publishes the same path.
  const roots = []
  for (const [path, title, ready] of [['/units/', '组合', '.unit-entry, .unit-card'], ['/songs/', '歌曲', '.song-card'], ['/events/', '活动', '.event-item'], ['/items/', '道具', '.collection-catalog, main'], ['/honors/', '称号', '.collection-catalog, main']]) {
    await open(path, `!!document.querySelector(${JSON.stringify(ready)}) && document.title === '${title} · GROWING STARS 资料馆'`)
    roots.push(`${await loc()}=${await ev('document.title')}`)
    if ((await loc()) !== path) break
  }
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  // Each catalogue is its own sidebar link: 活动 opens events, 卡池 the gasha catalogue.
  await clickText('.archive-nav-cluster button', '活动'); await waitFor(atRoot('events'))
  const sidebarEvents = await loc()
  await clickText('.archive-nav-cluster button', '卡池'); await waitFor(atRoot('gashas'))
  const sidebarGashas = await loc()
  check('P41 section roots open at their path with section titles', roots.length === 5 && roots.every(row => row.endsWith(' · GROWING STARS 资料馆')) && sidebarEvents === '/events/' && sidebarGashas === '/gashas/' && errors.length === 0,
    `${roots.join(' ')}; sidebar ${sidebarEvents} -> ${sidebarGashas}; errors=${errors.join(' | ') || 0}`)
  // D1: tool entry paths carry their section titles, including on reload.
  for (const [prefix, title] of [['live', 'LIVE'], ['studio', '摄影工作台'], ['about', '关于本站'], ['status', '资源']]) {
    await open(`/${prefix}/`, `!!document.querySelector('main') && document.title === '${title} · GROWING STARS 资料馆'`)
    await send('Page.reload', { ignoreCache: true }); await waitFor(`document.title === '${title} · GROWING STARS 资料馆'`); await settle()
    check(`P41 ${prefix} tool root`, (await loc()) === `/${prefix}/` && (await ev('document.title')) === `${title} · GROWING STARS 资料馆` && errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  }
  // P42: an idol's office opens cold at /office/<idol>/ with the place title; the legacy query link is rewritten to it.
  const atOffice = idol => `location.pathname === '/office/${idol}/' && / · 事务所 · GROWING STARS 资料馆$/.test(document.title)`
  const atMobile = idol => `location.pathname === '/mobile/${idol}/' && / · 通信 · GROWING STARS 资料馆$/.test(document.title)`
  await open('/office/010pie/', atOffice('010pie')); await shot('p42-office')
  const officeCold = `${await loc()}=${await ev('document.title')}`
  await open('/?view=home&home_idol=010pie', atOffice('010pie'))
  const officeLegacy = await loc()
  check('P42 office path opens cold; legacy link becomes the path', officeCold.startsWith('/office/010pie/') && officeLegacy.startsWith('/office/010pie/') && errors.length === 0,
    `${officeCold}; legacy -> ${officeLegacy}; errors=${errors.join(' | ') || 0}`)
  // P43: the same for 通信; the mode stays in the query.
  await open('/mobile/010pie/', atMobile('010pie')); await shot('p43-mobile')
  const mobileCold = `${await loc()}=${await ev('document.title')}`
  await open('/?view=mobile_archive&idol=010pie&mobile_mode=phone', atMobile('010pie'))
  const mobileLegacy = await loc()
  check('P43 mobile path opens cold; legacy link keeps its mode', mobileCold.startsWith('/mobile/010pie/') && mobileLegacy.startsWith('/mobile/010pie/?') && mobileLegacy.includes('mobile_mode=phone') && errors.length === 0,
    `${mobileCold}; legacy -> ${mobileLegacy}; errors=${errors.join(' | ') || 0}`)
  // P44: with a favorite idol (002sht) the sidebar 事务所 opens that idol's office path directly; history back returns.
  await open('/idols/', atRoot('idols'))
  await clickText('.archive-nav button', '事务所'); await waitFor(atOffice('002sht'))
  const officeFavorite = `${await loc()}=${await ev('document.title')}`
  await historyStep('back')
  check('P44 sidebar office opens the favorite idol path and backs out', officeFavorite.startsWith('/office/002sht/') && (await loc()) === '/idols/' && errors.length === 0,
    `/idols/ -> ${officeFavorite} -> back ${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P45: sidebar 通信 opens the favorite's /mobile/<idol>/; switching idol rewrites the path and title, and a reload keeps it.
  await clickText('.archive-nav-cluster button', '通信'); await waitFor(atMobile('002sht'))
  const mobileFavorite = await loc()
  await navigate(() => ev(`(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === '001tom')); s.value = '001tom'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`))
  await waitFor(atMobile('001tom'))
  const mobileSwitched = `${await loc()}=${await ev('document.title')}`
  await send('Page.reload', { ignoreCache: true }); await waitFor(atMobile('001tom')); await settle()
  check('P45 sidebar mobile path; idol switch and reload', mobileFavorite.startsWith('/mobile/002sht/') && mobileSwitched.startsWith('/mobile/001tom/') && (await loc()).startsWith('/mobile/001tom/') && errors.length === 0,
    `${mobileFavorite} -> ${mobileSwitched} -> reload ${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P46: a path that addresses nothing starts like `/`: the 资料馆 for a portal preference, the startup idol's office for a Home one.
  await open('/', `document.body.innerText.trim().length > 40 && location.search.includes('view=')`)
  const bareStart = await loc()
  const malformed = []
  for (const bad of ['/office/010PIE/', '/mobile/', '/idols/xyz/']) { await open(bad, `location.pathname === '/' && location.search.includes('view=')`); malformed.push(`${bad}->${await loc()}`) }
  await usePreferences('home')
  await open('/office/xyz/', atOffice('002sht'))
  const homeStart = await loc()
  await usePreferences('portal')
  check('P46 malformed paths start like the bare entry', bareStart.startsWith('/?view=portal') && malformed.every(row => row.endsWith('->' + bareStart)) && homeStart.startsWith('/office/002sht/'),
    `/ -> ${bareStart}; ${malformed.join(' ')}; home preference /office/xyz/ -> ${homeStart}`)
  // P47: real sidebar transition must not carry a birthday collection's state.
  await open('/?view=story_collection&story_type=birthday&story_section=029ass', `!!document.querySelector('main article')`)
  await clickText('.archive-nav button', '卡片'); await waitFor(atRoot('cards')); await settle()
  check('P47 birthday collection to cards drops story context', (await loc()) === '/cards/' && errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P48/P49 check loaded controls, not just the address, after a cold refresh.
  await open('/songs/?idol=001tom', `document.body.innerText.includes('天濑冬马')`)
  await send('Page.reload', { ignoreCache: true }); await waitFor(`document.body.innerText.includes('天濑冬马')`); await settle()
  check('P48 song idol filter survives refresh', (await loc()) === '/songs/?idol=001tom' && (await ev(`document.body.innerText.includes('天濑冬马')`)) && errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  await open('/events/?idol=001tom&q=315', `!!document.querySelector('input[type=search]')`)
  await send('Page.reload', { ignoreCache: true }); await waitFor(`document.body.innerText.includes('天濑冬马') && document.querySelector('input[type=search]')?.value === '315'`); await settle()
  check('P49 event idol and search survive refresh', (await loc()) === '/events/?idol=001tom&q=315' && (await ev(`document.body.innerText.includes('天濑冬马') && document.querySelector('input[type=search]')?.value === '315'`)) && errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  await open('/about/', `document.title.startsWith('关于本站')`)
  const cardsHistoryBefore = await ev('history.length')
  await open('/?view=cards&story_type=main&rarity=SSR', `location.pathname === '/cards/' && !!document.querySelector('main')`)
  const legacyCards = await loc(), cardsHistoryAfter = await ev('history.length')
  await historyStep('back')
  check('P50 old card URL is replaced without adding history', legacyCards === '/cards/?rarity=SSR' && cardsHistoryAfter === cardsHistoryBefore + 1 && (await loc()) === '/about/' && errors.length === 0, `${legacyCards}; history ${cardsHistoryBefore}->${cardsHistoryAfter}; back ${await loc()}`)
  // P13: phone width for P1-P3.
  await journey({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, 'phone')
} finally {
  socket.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2))
process.exitCode = results.every(r => r.ok) ? 0 : 1
