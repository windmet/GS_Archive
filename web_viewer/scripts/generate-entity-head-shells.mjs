// Entity head shells: a copy of the built index.html per idol (/idols/<id>/index.html), unit
// (/units/<code>/index.html), card (/cards/<resource_id>/index.html), song (/songs/<song_code>/index.html) and event
// (/events/<410001 | 10019>/index.html) and gasha (/gashas/<210003 | ticket-…>/index.html), plus one per section root
// (/cards/index.html, /items/index.html, …), whose <head> carries that page's title, description, canonical and Open Graph
// tags. The body and scripts are untouched, so the SPA boots as usual and reads the path locator. Link
// previews (X, Discord, LINE) and crawlers that do not run JavaScript see the entity instead of the generic page.
//   node scripts/generate-entity-head-shells.mjs [--dist=.analysis/build-check] [--origin=https://…] [--check]
// Static HTML is zh-CN (docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md §0.1). Names come from the same
// sources the app uses: bootstrap idols for identity and units, zh-CN entity translations for display names,
// the card index and the zh-CN card title overlay for cards, the song catalog for songs, and the event supplement
// index, event media and the archive manifest's legacy event ids for events (song and event titles are not
// translated anywhere in the app).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { archiveCardName, archiveEntityTitle, archiveSectionTitle } from '../src/presentation/ArchiveDocumentTitle.js'
import { ARCHIVE_SECTION_PATHS } from '../src/core/archiveRoute.js'
import { translatedGashaName } from '../src/data/gashaTicketCatalog.js'
import { SONG_PERFORMER_SCOPES } from '../src/presentation/SongPresentation.js'
import { eventKindLabels, historicalDate } from '../src/presentation/DomainPresentation.mjs'

export const DEFAULT_ORIGIN = 'https://gs-archive-preview.pages.dev'
const SITE = 'GS Archive'
const IDOL_ID = /^[0-9]{3}[a-z]{3}$/
const UNIT_CODE = /^[0-9]{2}[a-z0-9]{3}$/  // W is 05w00
const CARD_ID = /^[0-9]{3}[a-z]{3}_[a-z]{1,3}[0-9]{2}$/
const SONG_CODE = /^[a-z0-9]{6}$/
// Read-model event ids and their path segment (archiveRoute.js PUBLIC_PATH_ROUTES).
const EVENT_ID = /^(4[0-9]{5}|event:[1-9][0-9]{4})$/
export const eventPathSegment = id => id.replace(/^event:/, '')
const GASHA_ID = /^([0-9]{6,8}|ticket-[0-9a-f]{16})$/
// Section roots (archiveRoute.js SECTION_PATH_ROUTES): the view whose section name titles the page, and what it lists.
export const SECTION_SHELLS = Object.freeze({
  idols: { view: 'idols', description: 'SideM GROWING STARS 全部偶像一览：按组合浏览档案、卡片与剧情。' },
  units: { view: 'unit_catalog', description: 'SideM GROWING STARS 全部组合一览：成员、团体剧情、活动与歌曲。' },
  cards: { view: 'cards', description: 'SideM GROWING STARS 全部卡片一览：按偶像、稀有度与属性筛选，查看卡面、技能与获得方式。' },
  songs: { view: 'song_catalog', description: 'SideM GROWING STARS 全部歌曲一览：演唱成员、试听、谱面与相关活动。' },
  events: { view: 'event_catalog', description: 'SideM GROWING STARS 历史活动一览：活动剧情、报酬卡与参加偶像。' },
  gashas: { view: 'gashas', description: 'SideM GROWING STARS 历史卡池一览：开放时间、Pickup 卡片与抽取道具。' },
  stories: { view: 'story_catalog', description: 'SideM GROWING STARS 剧情一览：主线、活动、个人故事、生日与季节企划。' },
  items: { view: 'collection_catalog', kind: 'items', description: 'SideM GROWING STARS 道具图鉴：用途、获得来源与相关卡片。' },
  honors: { view: 'collection_catalog', kind: 'honors', description: 'SideM GROWING STARS 称号图鉴：获得条件与相关偶像、组合。' },
  photos: { view: 'photo_catalog', description: 'SideM GROWING STARS 摄影资源：服装、背景、滤镜与贴纸素材。' },
})

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

function headTags({ title, description, url, image, type }) {
  const e = escapeHtml
  return [
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}" />`,
    `<link rel="canonical" href="${e(url)}" />`,
    `<meta property="og:type" content="${e(type)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${e(title)}" />`,
    `<meta property="og:description" content="${e(description)}" />`,
    `<meta property="og:url" content="${e(url)}" />`,
    `<meta property="og:image" content="${e(image)}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].map(tag => `    ${tag}`).join('\n')
}

function withHead(template, tags) {
  const titles = template.match(/<title>[\s\S]*?<\/title>/g) || []
  if (titles.length !== 1) throw new Error(`index.html must have exactly one <title>, found ${titles.length}`)
  if ((template.match(/<\/head>/g) || []).length !== 1) throw new Error('index.html must have exactly one </head>')
  return template.replace(/[ \t]*<title>[\s\S]*?<\/title>\r?\n?/, '').replace('</head>', `${tags}\n  </head>`)
}

// idols: bootstrap `idols[]` ({ id, name, kana, unitCode, unitName }); idolNames: { [id]: zh-CN display name };
// cards: card index rows ({ resource_id, character_id, rarity, title }); cardTitles: { [source title]: zh-CN };
// songs: song catalog rows ({ song_code, title, jacket_url, performance_mapping });
// events: publishedEvents() rows ({ id, code, title, kind, openAt, image }).
// gashas: publishedGashas() rows ({ id, name, openAt, image }); sections: include the section root shells.
export function renderEntityHeadShells({ template, idols, idolNames = {}, cards = [], cardTitles = {}, songs = [], events = [], gashas = [], sections = false, origin = DEFAULT_ORIGIN }) {
  const base = origin.replace(/\/$/, '')
  const display = idol => idolNames[idol.id] || idol.name
  const shells = []
  const units = new Map()
  for (const idol of idols) {
    if (!IDOL_ID.test(idol.id)) throw new Error(`Unexpected idol id ${idol.id}`)
    const name = display(idol)
    const aside = [idol.name && idol.name.replace(/\s+/g, '') !== name.replace(/\s+/g, '') ? idol.name : '', idol.unitName || ''].filter(Boolean)
    const location = `/idols/${idol.id}/`
    shells.push({
      path: `idols/${idol.id}/index.html`,
      kind: 'idol', id: idol.id, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(name),
        description: `${name}${aside.length ? `（${aside.join('，')}）` : ''}的卡牌、剧情、歌曲与相关档案。`,
        url: base + location,
        image: `${base}/assets/idols/icons/image_chara_icon_${idol.id}.png`,
        type: 'profile',
      })),
    })
    if (idol.unitCode) {
      if (!units.has(idol.unitCode)) units.set(idol.unitCode, { code: idol.unitCode, name: idol.unitName || idol.unitCode, members: [] })
      units.get(idol.unitCode).members.push(name)
    }
  }
  for (const unit of units.values()) {
    if (!UNIT_CODE.test(unit.code)) throw new Error(`Unexpected unit code ${unit.code}`)
    const location = `/units/${unit.code}/`
    shells.push({
      path: `units/${unit.code}/index.html`,
      kind: 'unit', id: unit.code, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(unit.name),
        description: `${unit.name}（${unit.members.join('、')}）的成员、卡牌、剧情与歌曲档案。`,
        url: base + location,
        image: `${base}/assets/units/logos/image_unit_logo_${unit.code}.png`,
        type: 'website',
      })),
    })
  }
  const idolById = new Map(idols.map(idol => [idol.id, idol]))
  for (const card of cards) {
    if (!CARD_ID.test(card.resource_id)) throw new Error(`Unexpected card id ${card.resource_id}`)
    const idol = idolById.get(card.character_id)
    if (!idol) throw new Error(`Card ${card.resource_id} has no idol ${card.character_id}`)
    const title = cardTitles[card.title] || card.title
    const name = archiveCardName(title, display(idol))
    const location = `/cards/${card.resource_id}/`
    shells.push({
      path: `cards/${card.resource_id}/index.html`,
      kind: 'card', id: card.resource_id, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(name),
        description: `${display(idol)}的${card.rarity}卡片「${title}」${title !== card.title ? `（${card.title}）` : ''}：卡面、技能、语音与相关剧情。`,
        url: base + location,
        image: `${base}/assets/cards/icons/image_card_icon_${card.resource_id}.png`,
        type: 'website',
      })),
    })
  }
  for (const song of songs) {
    if (!SONG_CODE.test(song.song_code)) throw new Error(`Unexpected song code ${song.song_code}`)
    if (!song.title) throw new Error(`Song ${song.song_code} has no title`)
    if (!/^\/assets\/songs\/[a-z0-9_]+\.png$/.test(song.jacket_url || '')) throw new Error(`Song ${song.song_code} has no jacket`)
    // Same performer label as the song catalogue: the confirmed unit, else the special-lineup scope.
    const mapping = song.performance_mapping || {}
    const unit = mapping.confirmed_unit?.unit_name || ''
    const scope = unit ? '' : SONG_PERFORMER_SCOPES[mapping.performer_scope]?.[0] || ''
    const location = `/songs/${song.song_code}/`
    shells.push({
      path: `songs/${song.song_code}/index.html`,
      kind: 'song', id: song.song_code, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(song.title),
        description: `${unit ? `${unit}演唱的` : ''}歌曲「${song.title}」${scope ? `（${scope}）` : ''}：演唱成员、试听、谱面与相关剧情。`,
        url: base + location,
        image: base + song.jacket_url,
        type: 'website',
      })),
    })
  }
  for (const event of events) {
    if (!EVENT_ID.test(event.id)) throw new Error(`Unexpected event id ${event.id}`)
    if (!event.title) throw new Error(`Event ${event.id} has no title`)
    if (!/^\/assets\/domain-images\/event\/[a-z0-9_/]+\.png$/.test(event.image || '')) throw new Error(`Event ${event.id} has no image`)
    const location = `/events/${eventPathSegment(event.id)}/`
    shells.push({
      path: `events/${eventPathSegment(event.id)}/index.html`,
      kind: 'event', id: event.id, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(event.title),
        // Seventeen 315 CARNIVAL events share one title; the start date tells them apart. Reprints say 復刻 in the title.
        description: `${eventKindLabels[event.kind] || ''}活动「${event.title}」，${historicalDate(event.openAt)}开始：活动剧情、报酬卡与参加偶像。`,
        url: base + location,
        image: base + event.image,
        type: 'website',
      })),
    })
  }
  for (const gasha of gashas) {
    if (!GASHA_ID.test(gasha.id)) throw new Error(`Unexpected gasha id ${gasha.id}`)
    if (!gasha.name) throw new Error(`Gasha ${gasha.id} has no name`)
    if (!/^\/assets\/[a-z0-9_/.-]+\.(png|jpg|webp)$/i.test(gasha.image || '')) throw new Error(`Gasha ${gasha.id} has no image`)
    const location = `/gashas/${gasha.id}/`
    shells.push({
      path: `gashas/${gasha.id}/index.html`,
      kind: 'gasha', id: gasha.id, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(gasha.name),
        description: `卡池「${gasha.name}」${gasha.openAt ? `，${historicalDate(gasha.openAt)}开放` : ''}：Pickup 卡片、开放时间与抽取道具。`,
        url: base + location,
        image: base + gasha.image,
        type: 'website',
      })),
    })
  }
  if (sections) for (const prefix of ARCHIVE_SECTION_PATHS) {
    const section = SECTION_SHELLS[prefix]
    if (!section) throw new Error(`Section ${prefix} has no head shell`)
    const location = `/${prefix}/`
    shells.push({
      path: `${prefix}/index.html`,
      kind: 'section', id: prefix, url: base + location,
      html: withHead(template, headTags({
        title: archiveEntityTitle(archiveSectionTitle(section.view, section.kind)),
        description: section.description,
        url: base + location,
        image: `${base}/assets/brand/image_chara_icon_producer.png`,  // the site icon, as index.html
        type: 'website',
      })),
    })
  }
  return shells
}

// Every gasha with a detail page: the read model's announcements (gasha_index.gashas) and the ticket-only pools the
// catalogue adds from gasha-ticket-evidence.json. Names are the zh-CN pool names the gasha page shows.
export function publishedGashas(gashaIndex, ticketEvidence) {
  const gashas = [
    ...gashaIndex.gashas.map(gasha => ({ id: String(gasha.id), source: gasha.display_name, openAt: gasha.start_at || 0, image: gasha.banner_url })),
    ...ticketEvidence.rows.filter(row => !row.matched_ids.length).map(row => ({ id: row.id, source: row.source_name,
      openAt: row.wiki_pools?.[0]?.start_at || 0, image: row.tickets[0]?.image?.url || '' })),
  ].map(({ source, ...gasha }) => ({ ...gasha, name: translatedGashaName(source, 'zh-CN') || source }))
  if (new Set(gashas.map(gasha => gasha.id)).size !== gashas.length) throw new Error('Duplicate gasha id')
  return gashas
}

// The event catalogue the read model publishes (readmodels/lib/domain_expansion.mjs): one row per supplement
// entry; theater and tour events keep their legacy id from the archive manifest, the rest are event:<code>.
// The banner is the image; the two Whiteday events have none and use their logo.
export function publishedEvents(supplementIndex, eventMedia, manifest) {
  const legacy = new Map((manifest.unit_event_relations || []).map(row => [String(row.event_code), String(row.event_id)]))
  const verified = image => image?.status === 'verified-local-file' ? image.url : ''
  const events = supplementIndex.entries.map(event => {
    const media = eventMedia.entries[`event:${event.id}`]
    return { id: legacy.get(event.eventCode) || `event:${event.eventCode}`, code: event.eventCode, title: event.name, kind: event.eventKind,
      openAt: event.term?.openAt || 0,
      image: verified(media?.banner) || verified(media?.logo) }
  })
  if (new Set(events.map(event => event.id)).size !== events.length) throw new Error('Duplicate event id')
  return events
}

// The published card catalog leaves out the tutorial copies (card_id 9xxxxxx), which reuse a real card's
// resource_id; every remaining resource_id is unique.
export function publishedCards(cardIndex) {
  const cards = cardIndex.cards.filter(card => card.card_id < 9000000)
  if (new Set(cards.map(card => card.resource_id)).size !== cards.length) throw new Error('Duplicate card resource_id')
  return cards
}

export function loadEntitySources(root) {
  const bootstrap = JSON.parse(readFileSync(path.join(root, 'readmodels/bootstrap.inline.json'), 'utf8'))
  const translations = JSON.parse(readFileSync(path.join(root, 'public/translations/zh-CN/entities/idols.json'), 'utf8'))
  const idolNames = Object.fromEntries(Object.entries(translations.entries || {}).map(([id, entry]) => [id, entry?.name]).filter(([, name]) => name))
  const cards = publishedCards(JSON.parse(readFileSync(path.join(root, 'public/data/masterdata/card_index.json'), 'utf8')))
  const cardTitles = JSON.parse(readFileSync(path.join(root, 'public/translations/zh-CN/archive-general/cards.json'), 'utf8')).entries?.card?.title || {}
  // Every song with a read-model detail page: the primaries listed in the catalogue and their variants.
  const songs = Object.values(JSON.parse(readFileSync(path.join(root, 'public/data/song_catalog.json'), 'utf8')).songs)
    .sort((a, b) => a.song_code.localeCompare(b.song_code))
  const json = file => JSON.parse(readFileSync(path.join(root, 'public/data', file), 'utf8'))
  const events = publishedEvents(json('masterdata/domains/event_supplement_index.json'), json('masterdata/domains/event_media.json'), json('archive_manifest.json'))
  const gashas = publishedGashas(json('masterdata/gasha_index.json'), json('editorial/gasha-ticket-evidence.json'))
  return { idols: bootstrap.idols, idolNames, cards, cardTitles, songs, primarySongs: bootstrap.counts?.primary_songs, events, gashas, sections: true, release: bootstrap.release }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const option = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const dist = path.resolve(root, option('dist') || '.analysis/build-check')
  const origin = option('origin') || DEFAULT_ORIGIN
  const check = process.argv.includes('--check')
  const templatePath = path.join(dist, 'index.html')
  if (!existsSync(templatePath)) throw new Error(`No built index.html at ${templatePath}; run npm run build:check first`)
  const template = readFileSync(templatePath, 'utf8')
  const shells = renderEntityHeadShells({ template, ...loadEntitySources(root), origin })
  let stale = 0
  for (const shell of shells) {
    const file = path.join(dist, shell.path)
    if (check) { if (!existsSync(file) || readFileSync(file, 'utf8') !== shell.html) stale++; continue }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, shell.html)
  }
  const count = kind => shells.filter(s => s.kind === kind).length
  if (check && stale) { console.error(`${stale}/${shells.length} entity head shells are missing or stale in ${dist}`); process.exitCode = 1 }
  else console.log(`Entity head shells ${check ? 'up to date' : 'written'}: ${count('idol')} idols + ${count('unit')} units + ${count('card')} cards + ${count('song')} songs + ${count('event')} events + ${count('gasha')} gashas + ${count('section')} section roots in ${path.relative(root, dist) || dist} (origin ${origin})`)
}
