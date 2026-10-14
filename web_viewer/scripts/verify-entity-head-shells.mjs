// Entity head shells: one shell per bootstrap idol, unit, published card and song, each with exactly one title/description/canonical/OG
// set pointing at its path locator, escaped text, and a body byte-identical to index.html.
//   node scripts/verify-entity-head-shells.mjs              pure checks against a synthetic template (CI)
//   node scripts/verify-entity-head-shells.mjs --dist=DIR   also checks the shells written into a built DIR
//     [--origin=https://…]   the origin that build's shells were rendered for (default DEFAULT_ORIGIN)
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ORIGIN, escapeHtml, loadEntitySources, renderEntityHeadShells } from './generate-entity-head-shells.mjs'
import { ARCHIVE_SITE_TITLE, archiveCardName, archiveDocumentTitle } from '../src/presentation/ArchiveDocumentTitle.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const template = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>GS Archive · SideM GROWING STARS 资料馆</title>
    <script type="module" crossorigin src="/_app/index-abc.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`
const body = html => html.slice(html.indexOf('</head>'))
const count = (html, pattern) => (html.match(pattern) || []).length
const attr = (html, selector) => html.match(new RegExp(`<${selector} content="([^"]*)"`))?.[1]

function checkShells(shells, { idols, cards = [], songs = [], origin, sourceTemplate }) {
  const unitCodes = [...new Set(idols.map(idol => idol.unitCode).filter(Boolean))]
  assert.equal(shells.length, idols.length + unitCodes.length + cards.length + songs.length, 'one shell per idol, unit, card and song')
  assert.deepEqual(shells.filter(s => s.kind === 'song').map(s => s.path).sort(), songs.map(s => `songs/${s.song_code}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'card').map(s => s.path).sort(), cards.map(c => `cards/${c.resource_id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'idol').map(s => s.path).sort(), idols.map(i => `idols/${i.id}/index.html`).sort())
  assert.deepEqual(shells.filter(s => s.kind === 'unit').map(s => s.path).sort(), unitCodes.map(c => `units/${c}/index.html`).sort())
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
    assert.ok(!html.includes('SideM GROWING STARS 资料馆</title>'), `${shell.path}: the generic title is replaced`)
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
    { id: '091nou', name: '無所属' },
  ]
  const shells = renderEntityHeadShells({ template, idols, idolNames: { '001tom': '天濑冬马' }, origin: 'https://example.test/' })
  checkShells(shells, { idols, origin: 'https://example.test', sourceTemplate: template })
  const tom = shells.find(s => s.id === '001tom').html
  assert.ok(tom.includes('<title>天濑冬马 · GS Archive</title>'), 'the zh-CN display name leads the title')
  assert.ok(tom.includes('天濑冬马（天ヶ瀬 冬馬，Jupiter）的卡牌'), 'the description keeps the source name and unit')
  const sho = shells.find(s => s.id === '002sht').html
  assert.ok(sho.includes('<title>御手洗 翔太 · GS Archive</title>'), 'without a translation the source name is used')
  assert.ok(sho.includes('御手洗 翔太（Jupiter）的卡牌'), 'the source name is not repeated')
  assert.ok(shells.find(s => s.id === '091nou').html.includes('无所属') === false && shells.find(s => s.id === '091nou').html.includes('無所属的卡牌'), 'no unit, no empty parentheses')
  const unsafe = shells.find(s => s.id === '090xss').html
  assert.ok(!unsafe.includes('A<b>') && unsafe.includes(escapeHtml('A<b>&"c\'')), 'names are escaped')
  assert.ok(shells.find(s => s.id === '99tst').html.includes('<title>T&amp;&lt;U&gt; · GS Archive</title>'))
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
  assert.ok(start.includes('<title>【起跑线】天濑冬马 · GS Archive</title>'))
  assert.ok(start.includes('天濑冬马的N卡片「起跑线」（スタートライン）'), 'the description keeps the source title')
  assert.ok(start.includes('https://example.test/assets/cards/icons/image_card_icon_001tom_n01.png'))
  const untranslated = cardShells.find(s => s.id === '002sht_ssr12').html
  assert.ok(untranslated.includes('<title>【&lt;未訳&gt;】御手洗 翔太 · GS Archive</title>'), 'untranslated titles stay in the source and are escaped')
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
  assert.ok(field.includes('<title>BRAND NEW FIELD · GS Archive</title>'))
  assert.ok(field.includes('Jupiter演唱的歌曲「BRAND NEW FIELD」：'))
  assert.ok(field.includes('https://example.test/assets/songs/jacket_brndnf.png'))
  const formation = songShells.find(s => s.id === 'grwsml').html
  assert.ok(formation.includes('<title>Growing &lt;Smiles&gt; · GS Archive</title>'), 'song titles are escaped')
  assert.ok(formation.includes('歌曲「Growing &lt;Smiles&gt;」（自由编成）：'), 'a special lineup names its scope, not a singer')
  assert.ok(songShells.find(s => s.id === 'x00000').html.includes('content="歌曲「Unknown」：'), 'no performer, no empty parentheses')
  assert.throws(() => renderEntityHeadShells({ template, idols, songs: [{ ...songs[0], song_code: 'BRNDNF' }] }), /Unexpected song code/)
  assert.throws(() => renderEntityHeadShells({ template, idols, songs: [{ ...songs[0], jacket_url: '' }] }), /has no jacket/)
}

// The app's tab title matches the shell title for the same entity, and other pages keep the site title.
{
  assert.equal(archiveDocumentTitle('idol_detail', '天濑冬马'), '天濑冬马 · GS Archive')
  assert.equal(archiveDocumentTitle('unit_detail', 'W'), 'W · GS Archive')
  assert.equal(archiveDocumentTitle('card_detail', archiveCardName('起跑线', '天濑冬马')), '【起跑线】天濑冬马 · GS Archive')
  assert.equal(archiveDocumentTitle('song_detail', 'BRAND NEW FIELD'), 'BRAND NEW FIELD · GS Archive')
  assert.equal(archiveCardName('起跑线', ''), '', 'a card without its idol name has no title yet')
  assert.equal(archiveDocumentTitle('idol_detail', ''), null, 'no name yet keeps the current (shell) title')
  assert.equal(archiveDocumentTitle('cards', 'x'), ARCHIVE_SITE_TITLE)
  assert.ok(template.includes(`<title>${ARCHIVE_SITE_TITLE}</title>`), 'the site title constant matches index.html')
  assert.ok(readFileSync(path.join(root, 'index.html'), 'utf8').includes(`<title>${ARCHIVE_SITE_TITLE}</title>`), 'index.html still ships the site title')
}

// Real sources: every bootstrap idol has a zh-CN display name, so no title silently falls back to Japanese.
const sources = loadEntitySources(root)
{
  const missing = sources.idols.filter(idol => !sources.idolNames[idol.id]).map(idol => idol.id)
  assert.deepEqual(missing, [], 'every bootstrap idol has a zh-CN display name')
  const shells = renderEntityHeadShells({ template, ...sources })
  checkShells(shells, { idols: sources.idols, cards: sources.cards, songs: sources.songs, origin: DEFAULT_ORIGIN, sourceTemplate: template })
  assert.equal(sources.cards.length, 826, 'the published card catalog: 836 index rows less 10 tutorial copies')
  const untitled = sources.cards.filter(card => !sources.cardTitles[card.title]).map(card => card.resource_id)
  assert.deepEqual(untitled, [], 'every card title has a zh-CN translation')
  // Every song detail in the read model: the catalogue's primaries plus their variants (DRIVE A LIVE パッションMAX).
  assert.equal(sources.songs.length, 61)
  assert.equal(sources.songs.filter(song => song.variant_kind === 'primary').length, sources.primarySongs, 'primaries match the bound release')
  assert.deepEqual(sources.songs.filter(song => song.variant_kind !== 'primary').map(song => song.song_code), ['drv999'])
  for (const song of sources.songs) assert.ok(existsSync(path.join(root, 'public', song.jacket_url)), `${song.song_code}: jacket exists`)
}

// Built output: the written shells match a fresh render of that build's index.html.
const distOption = process.argv.slice(2).find(arg => arg.startsWith('--dist='))?.slice('--dist='.length)
const distOrigin = (process.argv.slice(2).find(arg => arg.startsWith('--origin='))?.slice('--origin='.length) || DEFAULT_ORIGIN).replace(/\/$/, '')
let built = ''
if (distOption) {
  const dist = path.resolve(root, distOption)
  const builtTemplate = readFileSync(path.join(dist, 'index.html'), 'utf8')
  const shells = renderEntityHeadShells({ template: builtTemplate, ...sources, origin: distOrigin })
  checkShells(shells, { idols: sources.idols, cards: sources.cards, songs: sources.songs, origin: distOrigin, sourceTemplate: builtTemplate })
  for (const shell of shells) {
    const file = path.join(dist, shell.path)
    assert.ok(existsSync(file), `${shell.path} exists in ${distOption}`)
    assert.equal(readFileSync(file, 'utf8'), shell.html, `${shell.path} is current`)
  }
  assert.ok(!existsSync(path.join(dist, '404.html')), 'no 404.html, so Cloudflare Pages keeps the SPA fallback for other paths')
  built = `; ${shells.length} built shells in ${distOption} are current for ${distOrigin}`
}

const units = new Set(sources.idols.map(idol => idol.unitCode).filter(Boolean)).size
console.log(`Entity head shells: ${sources.idols.length} idols + ${units} units + ${sources.cards.length} cards + ${sources.songs.length} songs, one escaped title/description/canonical/OG set each, body unchanged${built}`)
