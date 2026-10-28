import { PORTAL_PRELOAD } from './lib/portal-preload.mjs'
// Entity head shells: one shell per bootstrap idol, unit, published card, song, event, gasha and section root, each with exactly one title/description/canonical/OG
// set pointing at its path locator, escaped text, and a body byte-identical to index.html.
//   node scripts/verify-entity-head-shells.mjs              pure checks against a synthetic template (CI)
//   node scripts/verify-entity-head-shells.mjs --dist=DIR   also checks the shells written into a built DIR
//     [--origin=https://…]   the origin that build's shells were rendered for (default DEFAULT_ORIGIN)
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ORIGIN, SECTION_SHELLS, escapeHtml, eventPathSegment, loadEntitySources, loadStoryHeadSources, storyHeadCandidate, publishedEvents, renderEntityHeadShells } from './generate-entity-head-shells.mjs'
import { ARCHIVE_SITE_TITLE, archiveCardName, archiveDocumentTitle, archiveIdolPlaceName, archiveSectionTitle, archiveTabSectionTitle } from '../src/presentation/ArchiveDocumentTitle.js'
import { ARCHIVE_SECTION_PATHS, readArchiveRoute } from '../src/core/archiveRoute.js'
import { archiveBootstrapPlugin } from './lib/archive-bootstrap-plugin.mjs'
import { portalPreloadLink, withPortalScopePreload } from './lib/portal-preload.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const template = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>GROWING STARS 资料馆 · 偶像大师 SideM</title>
    <script type="module" crossorigin src="/_app/index-abc.js"></script>
<link rel="preload" href="/_catalog/v/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/portal/index.json" as="fetch" crossorigin>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`
const body = html => html.slice(html.indexOf('</head>'))
const count = (html, pattern) => (html.match(pattern) || []).length
const attr = (html, selector) => html.match(new RegExp(`<${selector} content="([^"]*)"`))?.[1]

function checkShells(shells, { idols, cards = [], songs = [], events = [], gashas = [], storySources = null, sections = false, origin, sourceTemplate }) {
  const unitCodes = [...new Set(idols.map(idol => idol.unitCode).filter(Boolean))]
  const sectionCount = sections ? ARCHIVE_SECTION_PATHS.length : 0
  const offices = idols.filter(idol => idol.home_available !== false)
  const storyCount = storySources ? storySources.collections.length + storySources.campaigns.length + 2 * idols.length : 0
  assert.equal(shells.length, idols.length + offices.length + idols.length + unitCodes.length + cards.length + songs.length + events.length + gashas.length + sectionCount + storyCount,
    'one shell per idol, office, mobile page, unit, card, song, event, gasha and section root')
  assert.deepEqual(shells.filter(s => s.kind === 'office').map(s => s.path).sort(), offices.map(i => `office/${i.id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'mobile').map(s => s.path).sort(), idols.map(i => `mobile/${i.id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'gasha').map(s => s.path).sort(), gashas.map(g => `gashas/${g.id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'section').map(s => s.path).sort(), sections ? ARCHIVE_SECTION_PATHS.map(p => `${p}/index.html`).sort() : [])
  assert.deepEqual(shells.filter(s => s.kind === 'event').map(s => s.path).sort(), events.map(e => `events/${eventPathSegment(e.id)}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'song').map(s => s.path).sort(), songs.map(s => `songs/${s.song_code}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'card').map(s => s.path).sort(), cards.map(c => `cards/${c.resource_id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'idol').map(s => s.path).sort(), idols.map(i => `idols/${i.id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'unit').map(s => s.path).sort(), unitCodes.map(c => `units/${c}/index.html`).sort())
  assert.ok(shells.every(s => !(s.html.match(PORTAL_PRELOAD) || []).length), 'entity pages do not preload the Portal index')
  for (const shell of shells) {
    const { html } = shell
    const location = `${origin}/${shell.path.replace(/index\.html$/, '')}`
    assert.equal(shell.url, location)
    assert.equal(count(html, /<title>/g), 1, `${shell.path}: one title`)
    for (const tag of ['name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'property="og:image"', 'property="og:type"']) {
      assert.equal(count(html, new RegExp(tag, 'g')), 1, `${shell.path}: one ${tag}`)
    }
    assert.ok(html.includes(`<link rel="canonical" href="${location}" />`), `${shell.path}: canonical is its path`)
    assert.equal(attr(html, 'meta property="og:url"'), location)
    assert.ok(attr(html, 'meta property="og:image"').startsWith(`${origin}/assets/`), `${shell.path}: absolute image on the site`)
    assert.ok(!html.includes('偶像大师 SideM</title>'), `${shell.path}: the generic title is replaced`)
    assert.equal(body(html), body(sourceTemplate), `${shell.path}: body and scripts unchanged`)
    assert.ok(html.includes('<meta charset="UTF-8" />'), `${shell.path}: the rest of the head is kept`)
  }
}

// Synthetic sources: identity, units, display names, escaping and fallbacks.
{
  const idols = [
    { id: '001tom', name: '天ヶ瀬 冬馬', unitCode: '01jup', unitName: 'Jupiter' },
    { id: '002sht', name: '御手洗 翔太', unitCode: '01jup', unitName: 'Jupiter' },
    { id: '090xss', name: 'A<b>&"c\'', unitCode: '99tst', unitName: 'T&<U>' },
    { id: '091nou', name: '無所属', home_available: false },
  ]
  const shells = renderEntityHeadShells({ template, idols, idolNames: { '001tom': '天濑冬马' }, origin: 'https://example.test/' })
  checkShells(shells, { idols, origin: 'https://example.test', sourceTemplate: template })
  const tom = shells.find(s => s.id === '001tom').html
  assert.ok(tom.includes('<title>天濑冬马 · GROWING STARS 资料馆</title>'), 'the zh-CN display name leads the title')
  assert.ok(tom.includes('天濑冬马（天ヶ瀬 冬馬，Jupiter）的卡牌'), 'the description keeps the source name and unit')
  const sho = shells.find(s => s.id === '002sht').html
  assert.ok(sho.includes('<title>御手洗 翔太 · GROWING STARS 资料馆</title>'), 'without a translation the source name is used')
  assert.ok(sho.includes('御手洗 翔太（Jupiter）的卡牌'), 'the source name is not repeated')
  assert.ok(shells.find(s => s.id === '091nou').html.includes('无所属') === false && shells.find(s => s.id === '091nou').html.includes('無所属的卡牌'), 'no unit, no empty parentheses')
  const unsafe = shells.find(s => s.id === '090xss').html
  assert.ok(!unsafe.includes('A<b>') && unsafe.includes(escapeHtml('A<b>&"c\'')), 'names are escaped')
  assert.ok(shells.find(s => s.id === '99tst').html.includes('<title>T&amp;&lt;U&gt; · GROWING STARS 资料馆</title>'))
  // An idol's 事务所 and 通信 carry the idol and the section; an idol the home does not list has no office.
  const place = kind => shells.find(s => s.kind === kind && s.id === '001tom').html
  assert.ok(place('office').includes('<title>天濑冬马 · 事务所 · GROWING STARS 资料馆</title>') && place('office').includes('content="天濑冬马的事务所：'))
  assert.ok(place('mobile').includes('<title>天濑冬马 · 通信 · GROWING STARS 资料馆</title>') && place('mobile').includes('content="天濑冬马的通信：'))
  assert.ok(place('office').includes('https://example.test/assets/idols/icons/image_chara_icon_001tom.png'))
  assert.ok(!shells.some(s => s.kind === 'office' && s.id === '091nou') && shells.some(s => s.kind === 'mobile' && s.id === '091nou'))
  assert.ok(shells.find(s => s.kind === 'mobile' && s.id === '090xss').html.includes(`<title>${escapeHtml(idols[2].name)} · 通信 · GROWING STARS 资料馆</title>`), 'place names are escaped')
  const jup = shells.find(s => s.id === '01jup').html
  assert.ok(jup.includes('Jupiter（天濑冬马、御手洗 翔太）的成员'), 'units list their members by display name')
  assert.throws(() => renderEntityHeadShells({ template: template.replace('<title>', '<title>x</title><title>'), idols }), /exactly one <title>/)
  assert.throws(() => renderEntityHeadShells({ template, idols: [{ id: '../x', name: 'x' }] }), /Unexpected idol id/)

  // Cards: the title carries the idol, since one card title is shared by many idols.
  const cards = [
    { resource_id: '001tom_n01', character_id: '001tom', rarity: 'N', title: 'スタートライン' },
    { resource_id: '002sht_ssr12', character_id: '002sht', rarity: 'SSR', title: '<未訳>' },
  ]
  const cardShells = renderEntityHeadShells({ template, idols, idolNames: { '001tom': '天濑冬马' }, cards, cardTitles: { スタートライン: '起跑线' }, origin: 'https://example.test' })
  checkShells(cardShells, { idols, cards, origin: 'https://example.test', sourceTemplate: template })
  const start = cardShells.find(s => s.id === '001tom_n01').html
  assert.ok(start.includes('<title>【起跑线】天濑冬马 · GROWING STARS 资料馆</title>'))
  assert.ok(start.includes('天濑冬马的N卡片「起跑线」（スタートライン）'), 'the description keeps the source title')
  assert.ok(start.includes('https://example.test/assets/cards/icons/image_card_icon_001tom_n01.png'))
  const untranslated = cardShells.find(s => s.id === '002sht_ssr12').html
  assert.ok(untranslated.includes('<title>【&lt;未訳&gt;】御手洗 翔太 · GROWING STARS 资料馆</title>'), 'untranslated titles stay in the source and are escaped')
  assert.ok(untranslated.includes('卡片「&lt;未訳&gt;」：'), 'no repeated source title')
  assert.throws(() => renderEntityHeadShells({ template, idols, cards: [{ ...cards[0], resource_id: '001tom' }] }), /Unexpected card id/)
  assert.throws(() => renderEntityHeadShells({ template, idols, cards: [{ ...cards[0], character_id: '099zzz' }] }), /has no idol/)

  // Songs: source titles, the confirmed unit or the special-lineup scope, the jacket.
  const songs = [
    { song_code: 'brndnf', title: 'BRAND NEW FIELD', jacket_url: '/assets/songs/jacket_brndnf.png', performance_mapping: { performer_scope: 'fixed_unit', confirmed_unit: { unit_name: 'Jupiter' } } },
    { song_code: 'grwsml', title: 'Growing <Smiles>', jacket_url: '/assets/songs/jacket_grwsml.png', performance_mapping: { performer_scope: 'configurable_formation' } },
    { song_code: 'x00000', title: 'Unknown', jacket_url: '/assets/songs/jacket_x00000.png' },
  ]
  const songShells = renderEntityHeadShells({ template, idols, songs, origin: 'https://example.test' })
  checkShells(songShells, { idols, songs, origin: 'https://example.test', sourceTemplate: template })
  const field = songShells.find(s => s.id === 'brndnf').html
  assert.ok(field.includes('<title>BRAND NEW FIELD · GROWING STARS 资料馆</title>'))
  assert.ok(field.includes('Jupiter演唱的歌曲「BRAND NEW FIELD」：'))
  assert.ok(field.includes('https://example.test/assets/songs/jacket_brndnf.png'))
  const formation = songShells.find(s => s.id === 'grwsml').html
  assert.ok(formation.includes('<title>Growing &lt;Smiles&gt; · GROWING STARS 资料馆</title>'), 'song titles are escaped')
  assert.ok(formation.includes('歌曲「Growing &lt;Smiles&gt;」（自由编成）：'), 'a special lineup names its scope, not a singer')
  assert.ok(songShells.find(s => s.id === 'x00000').html.includes('content="歌曲「Unknown」：'), 'no performer, no empty parentheses')
  assert.throws(() => renderEntityHeadShells({ template, idols, songs: [{ ...songs[0], song_code: 'BRNDNF' }] }), /Unexpected song code/)
  assert.throws(() => renderEntityHeadShells({ template, idols, songs: [{ ...songs[0], jacket_url: '' }] }), /has no jacket/)

  // Events: the path drops the event: prefix; the kind and start date tell same-titled events apart.
  const events = publishedEvents(
    { entries: [
      { id: 10001, eventCode: '10001', name: 'GROWING SIGN@L', eventKind: 'theater', term: { openAt: 1633845600 } },
      { id: 20001, eventCode: '20001', name: '315カーニバル <1>', eventKind: 'collection', term: { openAt: 1636000000 } },
      { id: 50001, eventCode: '50001', name: 'Happy Whiteday 2022', eventKind: 'whiteday', term: { openAt: 1647216000 } },
    ] },
    { entries: {
      'event:10001': { banner: { status: 'verified-local-file', url: '/assets/domain-images/event/theater/10001/permanent/image_event_banner_10001.png' } },
      'event:20001': { banner: { status: 'verified-local-file', url: '/assets/domain-images/event/collection/20001/permanent/image_event_banner_20001.png' } },
      'event:50001': { banner: { status: 'file-not-found' }, logo: { status: 'verified-local-file', url: '/assets/domain-images/event/whiteday/50001/permanent/image_event_logo_50001.png' } },
    } },
    { unit_event_relations: [{ event_id: 410001, event_code: '10001' }] })
  assert.deepEqual(events.map(e => e.id), ['410001', 'event:20001', 'event:50001'], 'legacy ids from the manifest, event:<code> otherwise')
  const eventShells = renderEntityHeadShells({ template, idols, events, origin: 'https://example.test' })
  checkShells(eventShells, { idols, events, origin: 'https://example.test', sourceTemplate: template })
  const theater = eventShells.find(s => s.id === '410001')
  assert.equal(theater.path, 'events/410001/index.html')
  assert.ok(theater.html.includes('<title>GROWING SIGN@L · GROWING STARS 资料馆</title>'))
  assert.ok(theater.html.includes('THEATER活动「GROWING SIGN@L」，2021年10月10日开始：'))
  const carnival = eventShells.find(s => s.id === 'event:20001')
  assert.equal(carnival.path, 'events/20001/index.html')
  assert.ok(carnival.html.includes('<title>315カーニバル &lt;1&gt; · GROWING STARS 资料馆</title>'), 'event titles are escaped')
  assert.ok(eventShells.find(s => s.id === 'event:50001').html.includes('image_event_logo_50001.png'), 'no banner: the logo')
  assert.throws(() => renderEntityHeadShells({ template, idols, events: [{ ...events[0], id: '10001' }] }), /Unexpected event id/)
  assert.throws(() => renderEntityHeadShells({ template, idols, events: [{ ...events[0], image: '' }] }), /has no image/)
}

// The app's tab title matches the shell title for the same entity, and other pages keep the site title.
{
  assert.equal(archiveDocumentTitle('idol_detail', '天濑冬马'), '天濑冬马 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('unit_detail', 'W'), 'W · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('card_detail', archiveCardName('起跑线', '天濑冬马')), '【起跑线】天濑冬马 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('song_detail', 'BRAND NEW FIELD'), 'BRAND NEW FIELD · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('event_detail', '315カーニバル'), '315カーニバル · GROWING STARS 资料馆')
  assert.equal(archiveCardName('起跑线', ''), '', 'a card without its idol name has no title yet')
  assert.equal(archiveDocumentTitle('idol_detail', ''), null, 'no name yet keeps the current (shell) title')
  assert.equal(archiveDocumentTitle('gasha_detail', 'Growing Twilight Live招募'), 'Growing Twilight Live招募 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('home', archiveIdolPlaceName('home', '天濑冬马')), '天濑冬马 · 事务所 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('mobile_archive', archiveIdolPlaceName('mobile_archive', '天濑冬马')), '天濑冬马 · 通信 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('home', archiveIdolPlaceName('home', '')), null, 'no idol name yet keeps the current (shell) title')
  // Section roots carry their section name, as their shells do; other pages keep the site title.
  assert.equal(archiveDocumentTitle('cards'), '卡片 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('collection_catalog', '称号'), '称号 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('about'), '关于本站 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('live'), 'LIVE · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('studio'), '摄影工作台 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('archive_status'), '资源 · GROWING STARS 资料馆')
  assert.equal(archiveDocumentTitle('spine_lab'), ARCHIVE_SITE_TITLE)
  assert.ok(template.includes(`<title>${ARCHIVE_SITE_TITLE}</title>`), 'the site title constant matches index.html')
  assert.ok(readFileSync(path.join(root, 'index.html'), 'utf8').includes(`<title>${ARCHIVE_SITE_TITLE}</title>`), 'index.html still ships the site title')
}

// The built index.html preloads the Portal index of the checked-in release (archive-bootstrap-plugin); the
// shells rendered from it, which never open on the Portal, drop that preload.
{
  const plugin = archiveBootstrapPlugin()
  plugin.configResolved({ command: 'build' })
  const page = plugin.transformIndexHtml(template.replace(/<link rel="preload"[^>]*>\n/, ''))
  const portal = JSON.parse(readFileSync(path.join(root, 'readmodels/bootstrap.inline.json'), 'utf8')).domains.portal.url
  assert.equal(count(page, new RegExp(`<link rel="preload" href="${portal}" as="fetch" crossorigin>`, 'g')), 1, 'the page preloads the pinned Portal index')
  // The preview package adds the all-idols scope from the candidate's Portal index, right after it.
  const boot = JSON.parse(readFileSync(path.join(root, 'readmodels/bootstrap.inline.json'), 'utf8'))
  const scopeUrl = `/_catalog/v/${boot.release}/portal/scopes/all.json`
  const portalIndex = { release: boot.release, data: { scopes: { all: { kind: 'portal.scope', url: scopeUrl } } } }
  const packaged = withPortalScopePreload(page, boot, portalIndex)
  assert.ok(packaged.includes(`${portalPreloadLink(portal)}\n${portalPreloadLink(scopeUrl)}`), 'the package preloads the all-idols scope beside the index')
  for (const bad of [{ ...portalIndex, release: 'f'.repeat(64) }, { ...portalIndex, data: { scopes: {} } },
    { ...portalIndex, data: { scopes: { all: { kind: 'portal.scope', url: '/_catalog/v/' + 'f'.repeat(64) + '/portal/scopes/all.json' } } } }])
    assert.throws(() => withPortalScopePreload(page, boot, bad), /pinned all-idols scope/)
  assert.throws(() => withPortalScopePreload(packaged, boot, portalIndex), /exactly the Portal index/, 'never added twice')
  const shells = renderEntityHeadShells({ template: packaged, idols: [{ id: '001tom', name: '天ヶ瀬 冬馬', unitCode: '01jup', unitName: 'Jupiter' }] })
  assert.ok(shells.every(shell => !shell.html.includes('rel="preload"') && shell.html.includes('id="archive-bootstrap"')), 'entity pages preload none of the Portal files')
}

// Real sources: every bootstrap idol has a zh-CN display name, so no title silently falls back to Japanese.
const sources = loadEntitySources(root)
{
  const missing = sources.idols.filter(idol => !sources.idolNames[idol.id]).map(idol => idol.id)
  assert.deepEqual(missing, [], 'every bootstrap idol has a zh-CN display name')
  const shells = renderEntityHeadShells({ template, ...sources })
  checkShells(shells, { idols: sources.idols, cards: sources.cards, songs: sources.songs, events: sources.events, gashas: sources.gashas, sections: true, origin: DEFAULT_ORIGIN, sourceTemplate: template })
  assert.equal(sources.cards.length, 826, 'the published card catalog: 836 index rows less 10 tutorial copies')
  const untitled = sources.cards.filter(card => !sources.cardTitles[card.title]).map(card => card.resource_id)
  assert.deepEqual(untitled, [], 'every card title has a zh-CN translation')
  // Every song detail in the read model: the catalogue's primaries plus their variants (DRIVE A LIVE パッションMAX).
  assert.equal(sources.songs.length, 61)
  assert.equal(sources.songs.filter(song => song.variant_kind === 'primary').length, sources.primarySongs, 'primaries match the bound release')
  assert.deepEqual(sources.songs.filter(song => song.variant_kind !== 'primary').map(song => song.song_code), ['drv999'])
  for (const song of sources.songs) assert.ok(existsSync(path.join(root, 'public', song.jacket_url)), `${song.song_code}: jacket exists`)
  // Every event in the read model (checked against candidate b3c1f13a): 36 theater/tour legacy ids, 23 event:<code>.
  assert.equal(sources.events.length, 59)
  assert.equal(sources.events.filter(event => /^4[0-9]{5}$/.test(event.id)).length, 36)
  assert.ok(sources.events.every(event => event.image), 'every event has a banner or a logo')
  // Every idol's 事务所 and 通信 path reads as that page and its shell is titled as the app titles it.
  for (const [kind, view, param] of [['office', 'home', 'homeIdol'], ['mobile', 'mobile_archive', 'idol']]) {
    for (const idol of sources.idols) {
      const route = readArchiveRoute(`http://x/${kind}/${idol.id}/`, { history: false })
      assert.equal(route.view, view, `${kind}/${idol.id}`); assert.equal(route[param], idol.id, `${kind}/${idol.id}`)
      const shell = shells.find(s => s.kind === kind && s.id === idol.id)
      assert.ok(shell.html.includes(`<title>${escapeHtml(archiveDocumentTitle(view, archiveIdolPlaceName(view, sources.idolNames[idol.id])))}</title>`), `${kind}/${idol.id}`)
    }
  }
}

// Gashas: the 61 read-model announcements and the 25 ticket-only pools, each at the path its page publishes.
{
  assert.equal(sources.gashas.length, 61 + 25)
  for (const gasha of sources.gashas) assert.equal(readArchiveRoute(`http://x/gashas/${gasha.id}/`, { history: false }).gasha, gasha.id, gasha.id)
  const shells = renderEntityHeadShells({ template, ...sources })
  assert.ok(shells.find(s => s.id === '210003').html.includes('<title>Growing Twilight Live招募 · GROWING STARS 资料馆</title>'), 'zh-CN pool name')
  assert.ok(shells.find(s => s.id === 'ticket-02b623e0abc38ce0').html.includes('2021年10月10日开放'), 'a wiki-dated ticket pool states its run')
  // Every section root reads as its catalogue and is titled as the app titles it.
  for (const prefix of ARCHIVE_SECTION_PATHS) {
    const route = readArchiveRoute(`http://x/${prefix}/`, { history: false })
    assert.equal(route.view, SECTION_SHELLS[prefix].view, prefix)
    assert.ok(shells.find(s => s.kind === 'section' && s.id === prefix).html.includes(`<title>${archiveDocumentTitle(route.view, SECTION_SHELLS[prefix].title)}</title>`), prefix)
  }
}

// Story heads are tested without any corpus/candidate in CI; the fixture also exercises verified loading.
{
  const idols = [{ id: '001tom', name: '天ヶ瀬 冬馬', unitCode: '01jup', unitName: 'Jupiter' }]
  const collections = [
    { id: 'main:101', domain: 'main', sectionId: '101', title: '第1章' },
    { id: 'unit_story:1', domain: 'unit_story', sectionId: '1', title: 'Jupiter 前传' },
    { id: 'extra:601', domain: 'extra', sectionId: '601', title: 'A<&" story' },
    { id: 'birthday:001tom', domain: 'birthday', sectionId: '001tom', title: '原文', subject: { kind: 'idol', code: '001tom' } },
    { id: 'birthday:producer_birthday_common', domain: 'birthday', sectionId: 'producer_birthday_common', title: '制作人生日剧情' },
    { id: 'birthday:101ken', domain: 'birthday', sectionId: '101ken', title: '山村生日剧情' },
  ]
  const campaigns = [{ id: 'valentine_2022', year: 2022, season: 'valentine' }]
  const storySources = { collections, campaigns }
  const shells = renderEntityHeadShells({ template, idols, idolNames: { '001tom': '天濑冬马' }, storySources, sections: true })
  checkShells(shells, { idols, storySources, sections: true, origin: DEFAULT_ORIGIN, sourceTemplate: template })
  for (const [location, title] of [
    ['stories/main/101', '第1章'], ['stories/unit_story/1', 'Jupiter 前传'],
    ['stories/extra/601', 'A&lt;&amp;&quot; story'], ['stories/birthday/001tom', '天濑冬马 生日剧情'],
    ['stories/birthday/producer_birthday_common', '制作人生日剧情'], ['stories/birthday/101ken', '山村生日剧情'],
    ['stories/seasonal_campaign/valentine_2022', '2022 情人节'],
    ['stories/idol_story/001tom', '天濑冬马 个人剧情'], ['stories/work/001tom', '天濑冬马 工作剧情'],
    ['stories/main', '主线剧情'], ['stories/extra', '额外剧情'], ['stories/external', '社区剧情'],
  ]) assert.ok(shells.find(shell => shell.path === `${location}/index.html`)?.html.includes(`<title>${title} · GROWING STARS 资料馆</title>`), location)

  const fixture = path.join(root, '.analysis/story-head-fixture'), release = 'a'.repeat(64)
  mkdirSync(fixture, { recursive: true })
  let serial = 0
  const descriptor = (kind, data) => {
    const bytes = JSON.stringify({ schema_version: 1, release, kind, data })
    const url = `/_catalog/v/${release}/fixture/${serial++}.json`, file = path.join(fixture, 'pages', url.slice(1))
    mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes)
    return { kind, url, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  const index = (kind, rows) => descriptor(`${kind}.index`, { count: rows.length, pages: [descriptor(`${kind}.page`, { rows })] })
  const expected = { release, idols }
  const boot = { ...expected, domains: {
    collections: index('collections', collections.map(collection => ({ id: collection.id, domain: collection.domain, sectionId: collection.sectionId,
      detail: descriptor('collections.detail', { id: collection.id, view: { collection } }) }))),
    seasonal: index('seasonal', campaigns.map(campaign => ({ id: campaign.id, detail: descriptor('seasonal.detail', { id: campaign.id, view: { campaign } }) }))),
    'idol-stories': index('idol-stories', [{ id: '001tom' }]), work: index('work', [{ id: '001tom' }]),
  } }
  const bootstrapFile = path.join(fixture, 'bootstrap.inline.json')
  writeFileSync(bootstrapFile, JSON.stringify(boot))
  assert.deepEqual(loadStoryHeadSources(fixture, expected), storySources)
  writeFileSync(bootstrapFile, JSON.stringify({ ...boot, release: 'b'.repeat(64) }))
  assert.throws(() => loadStoryHeadSources(fixture, expected), /release mismatch/)
  writeFileSync(bootstrapFile, JSON.stringify(boot))
  const pageFile = path.join(fixture, 'pages', boot.domains.collections.url.slice(1)), original = readFileSync(pageFile)
  writeFileSync(pageFile, 'changed')
  assert.throws(() => loadStoryHeadSources(fixture, expected), /checksum mismatch/)
  writeFileSync(pageFile, original)
}

// Built output: the written shells match a fresh render of that build's index.html.
const distOption = process.argv.slice(2).find(arg => arg.startsWith('--dist='))?.slice('--dist='.length)
const distOrigin = (process.argv.slice(2).find(arg => arg.startsWith('--origin='))?.slice('--origin='.length) || DEFAULT_ORIGIN).replace(/\/$/, '')
let built = ''
if (distOption) {
  const dist = path.resolve(root, distOption)
  const candidateOption = process.argv.slice(2).find(arg => arg.startsWith('--candidate='))?.slice('--candidate='.length)
  const distSources = loadEntitySources(root, { candidate: storyHeadCandidate(root, candidateOption) })
  const builtTemplate = readFileSync(path.join(dist, 'index.html'), 'utf8')
  const shells = renderEntityHeadShells({ template: builtTemplate, ...distSources, origin: distOrigin })
  checkShells(shells, { ...distSources, origin: distOrigin, sourceTemplate: builtTemplate })
  for (const shell of shells) {
    const file = path.join(dist, shell.path)
    assert.ok(existsSync(file), `${shell.path} exists in ${distOption}`)
    assert.equal(readFileSync(file, 'utf8'), shell.html, `${shell.path} is current`)
  }
  assert.ok(!existsSync(path.join(dist, '404.html')), 'no 404.html, so Cloudflare Pages keeps the SPA fallback for other paths')
  built = `; ${shells.length} built shells in ${distOption} are current for ${distOrigin}`
}

const units = new Set(sources.idols.map(idol => idol.unitCode).filter(Boolean)).size
console.log(`Entity head shells: ${sources.idols.length} idols + ${units} units + ${sources.cards.length} cards + ${sources.songs.length} songs + ${sources.events.length} events + ${sources.gashas.length} gashas + ${ARCHIVE_SECTION_PATHS.length} section roots, one escaped title/description/canonical/OG set each, body unchanged${built}`)
