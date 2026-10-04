import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { archiveGeneralText } from '../src/presentation/ArchiveGeneralTextCore.mjs'
import { createArchiveAssetResolver } from './lib/archive-assets.mjs'
import { getCardIconUrl, getCardLandscapeUrl, getCardLargeImageUrl, getCardPortraitUrl } from '../src/utils/CardAssetResolver.js'
import { eventResources, storyEventResources } from '../src/data/eventResourceGraph.js'
import { buildPortalDesktopOverview, buildPortalSearchResults, PORTAL_SEARCH_DOMAINS,
  portalSearchPageDescriptors, validatePortalSearchRows, portalIdolPortrait, portalEventRole } from '../src/presentation/ArchivePortalPresentation.js'

const viewer = fileURLToPath(new URL('../', import.meta.url))
const read = relative => JSON.parse(readFileSync(path.join(viewer, relative), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const cardNames = read('public/translations/zh-CN/archive-general/cards.json').entries
const idolNames = read('public/translations/zh-CN/entities/idols.json').entries
const callbacks = {
  cardTitle: source => archiveGeneralText(cardNames, 'card', source, 'title', 'zh-CN'),
  cardSearch: source => [source, archiveGeneralText(cardNames, 'card', source, 'title', 'zh-CN')].join(' '),
  idolName: (id, fallback) => idolNames[id]?.name || fallback,
  idolSearch: (id, fallback) => [id, fallback, idolNames[id]?.name || ''].join(' '),
  songTitle: source => source,
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const stageManifest = read('public/data/song_timelines/manifest.json')

function artifactDataset(root) {
  const bootstrap = JSON.parse(readFileSync(path.join(root, 'bootstrap.inline.json'), 'utf8'))
  const load = descriptor => {
    const absolute = path.resolve(root, 'pages', descriptor.url.slice(1))
    assert.ok(absolute.startsWith(path.resolve(root, 'pages') + path.sep), 'artifact path remains below pages')
    const bytes = readFileSync(absolute)
    assert.equal(bytes.length, descriptor.bytes)
    assert.equal(hash(bytes), descriptor.sha256)
    const payload = JSON.parse(bytes.toString('utf8'))
    assert.equal(payload.schema_version, 1)
    assert.equal(payload.release, bootstrap.release)
    assert.equal(payload.kind, descriptor.kind)
    return payload.data
  }
  const indexes = {}, rowsByDomain = {}
  for (const domain of PORTAL_SEARCH_DOMAINS) {
    const index = indexes[domain] = load(bootstrap.domains[domain])
    const descriptors = portalSearchPageDescriptors(bootstrap, domain, index)
    rowsByDomain[domain] = descriptors.flatMap(descriptor => {
      const page = load(descriptor)
      assert.ok(Array.isArray(page.rows))
      return page.rows
    })
    validatePortalSearchRows(domain, rowsByDomain[domain], bootstrap, { expectedCount: index.searchCount })
  }
  const preferredIdol = bootstrap.idols.find(idol => idol.id === '001tom')
  const preferredDetail = load(rowsByDomain.idols.find(row => row.id === preferredIdol.id).detail)
  const kaoruDetail = load(rowsByDomain.idols.find(row => row.id === '005kao').detail)
  const overviewStories = indexes.stories.pages.flatMap(descriptor => load(descriptor).rows)
  assert.equal(overviewStories.length, indexes.stories.count)
  const eventIndex = load(bootstrap.domains.events)
  const overviewEvents = eventIndex.pages.flatMap(descriptor => load(descriptor).rows)
  assert.equal(overviewEvents.length, eventIndex.count)
  return { bootstrap, indexes, rowsByDomain, preferredIdol, preferredDetail, kaoruDetail, overviewStories, overviewEvents, stageManifest, actual: true }
}

// Checkout-portable boundary fixture: real identity/title strings, explicitly
// synthetic descriptors. Only --read-model-root runs actual artifact parity.
function portableDataset() {
  const bootstrap = read('readmodels/bootstrap.inline.json')
  const card = read('public/data/masterdata/card_index.json').cards.find(row => row.resource_id === '001tom_ssr01')
  const song = read('public/data/song_catalog.json').songs.drvalv
  const preferredIdol = bootstrap.idols.find(idol => idol.id === '001tom')
  const descriptor = domain => ({ kind: `${domain}.detail`, sha256: '0'.repeat(64), bytes: 1,
    url: `/_catalog/v/${bootstrap.release}/${domain}/detail/${'0'.repeat(32)}.json` })
  const rowsByDomain = {
    cards: [{ id: card.resource_id, resource_id: card.resource_id, character_id: card.character_id, title: card.title,
      rarity: card.rarity, asset_status: { normal_portrait: true, awakened_icon: true }, detail: descriptor('cards') }],
    songs: [{ song_code: song.song_code, title: song.title, kana: song.kana, jacket_url: song.jacket_url,
      performance: { scope: 'configurable_formation', unitName: '', performers: [] }, detail: descriptor('songs') }],
    idols: [{ id: preferredIdol.id, name: preferredIdol.name, detail: descriptor('idols') }],
    stories: [{ id: '1_4_001_00.json', file: '1_4_001_00.json', title: '新たな夢の開演', subtitle: 'エピソード1',
      domain: 'main', sectionId: '101', exists: true, characters: ['001tom'], detail: descriptor('stories') }],
  }
  const indexes = Object.fromEntries(PORTAL_SEARCH_DOMAINS.map(domain => {
    const count = { cards: bootstrap.counts.canonical_cards, stories: bootstrap.counts.catalog_story_entries,
      songs: bootstrap.counts.primary_songs, idols: bootstrap.idols.length }[domain]
    return [domain, { count, searchCount: count, searchPages: [{ kind: `${domain}.search`, sha256: '0'.repeat(64), bytes: 1,
      url: `/_catalog/v/${bootstrap.release}/${domain}/search/000000.json` }] }]
  }))
  return { bootstrap, indexes, rowsByDomain, preferredIdol, preferredDetail: null,
    overviewStories: rowsByDomain.stories, overviewEvents: [], stageManifest, actual: false }
}

function check(dataset) {
  const { bootstrap, indexes, rowsByDomain, preferredIdol, preferredDetail, kaoruDetail, overviewStories, overviewEvents, stageManifest, actual } = dataset
  const before = JSON.stringify(dataset)
  const options = { bootstrap, cards: rowsByDomain.cards, songs: rowsByDomain.songs,
    stories: overviewStories, events: overviewEvents, stageManifest, preferredIdol, preferredDetail, ...callbacks }
  const overview = buildPortalDesktopOverview(options)
  assert.deepEqual(overview.counts.map(row => [row.id, row.value]), [
    ['cards', bootstrap.counts.canonical_cards], ['stories', bootstrap.counts.catalog_story_entries],
    ['songs', bootstrap.counts.primary_songs], ['idols', bootstrap.idols.length],
  ])
  const preferredCards = rowsByDomain.cards.filter(row => row.character_id === preferredIdol.id)
  const orderedCards = ['SSR', 'SR', 'R', 'N'].flatMap(rarity => preferredCards.filter(row => row.rarity === rarity))
  assert.deepEqual(overview.cards.map(row => row.id), orderedCards.slice(0, 3).map(row => row.resource_id),
    'SSR/SR/R/N priority retains source order within each class; no date/popularity ordering')
  for (const card of overview.cards) {
    assert.equal(card.target.domain, 'cards'); assert.equal(card.target.cardId, card.id)
    assert.equal(card.target.idolCode, preferredIdol.id)
    assert.equal(card.idolName, callbacks.idolName(preferredIdol.id, preferredIdol.name))
    if (card.image) {
      const source = preferredCards.find(row => row.resource_id === card.id)
      const kind = card.image.kind.slice('card_'.length)
      const awakened = card.image.variant === 'p'
      assert.equal(source.asset_status[`${awakened ? 'awakened' : 'normal'}_${kind}`], true,
        'selected card image is backed by the exact source capability')
      const resolver = { icon: getCardIconUrl, portrait: getCardPortraitUrl, large: getCardLargeImageUrl, landscape: getCardLandscapeUrl }[kind]
      assert.equal(card.image.url, resolver(card.id, awakened), 'image URL retains actual card identity and variant')
      if (actual) {
        const physicalPath = card.image.url.startsWith('/assets/card-art/')
          ? createArchiveAssetResolver().cardArtPath(card.image.url.slice('/assets/card-art/'.length))
          : path.join(viewer, 'public', card.image.url.slice(1))
        assert.ok(physicalPath && existsSync(physicalPath), 'local image coverage follows the actual resource mount; it is not HTTP or Browser acceptance')
      }
    }
  }
  assert.ok(overview.songs.every(song => song.target.songCode === song.id))
  assert.equal(overview.unitCount, 16, 'combination count comes from the complete formal bootstrap unit identities')
  assert.equal(overview.preferredUnitName, 'Jupiter')
  assert.equal(overview.preferredUnitCode, '01jup', 'unit logo identity uses the formal unit code, not its numeric id or display name')
  assert.equal(buildPortalDesktopOverview({ ...options, preferredIdol: null, preferredDetail: null }).preferredUnitCode, '')
  for (const song of overview.songs) {
    if (!song.stageTarget) continue
    assert.equal(song.stageTarget.songCode, song.id)
    const reference = stageManifest.songs[song.id]?.find(row => row.id === song.stageTarget.choreographyId)
    assert.ok(reference && ['choreography_candidate', 'special_single'].includes(reference.stageKind), 'stage entry is an existing exact directory script')
    const script = read(`public${reference.url}`)
    assert.equal(script.id, song.stageTarget.choreographyId)
    assert.equal(script.source.entrySha256, reference.entrySha256)
    assert.equal(script.timeUnit, 'ms')
  }
  assert.ok(buildPortalDesktopOverview({ ...options, stageManifest: null }).songs.every(row => row.stageTarget === null))
  assert.ok(buildPortalDesktopOverview({ ...options, stageManifest: { ...stageManifest, songs: {} } }).songs.every(row => row.stageTarget === null),
    'song identity does not synthesize a stage id when the actual directory has no entry')
  // The configurable song is outside strict idol scope; this isolated fixture tests stage variant binding.
  const driveSource = rowsByDomain.songs.find(row => row.song_code === 'drvalv')
  const drive = { ...driveSource, performance: { ...driveSource.performance, performers: [{ id: preferredIdol.id }] } }
  const driveTarget = buildPortalDesktopOverview({ ...options, songs: [drive] }).songs[0].stageTarget
  assert.deepEqual(driveTarget, { songCode: 'drvalv', choreographyId: 'drvalv_live_effect_01jup' }, 'an existing formal-unit variant is preferred for a collective song')
  const base = stageManifest.songs.drvalv.find(row => !row.variant)
  const badReference = { ...base, entrySha256: 'not-a-source-hash' }
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [drive], stageManifest: { ...stageManifest, songs: { drvalv: [badReference] } } }).songs[0].stageTarget, null)
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [drive], stageManifest: { ...stageManifest, songs: { drvalv: [base], another: [base] } } }).songs[0].stageTarget, null,
    'a duplicated stage script identity cannot become an actionable target')
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [drive], stageManifest: { ...stageManifest, songs: { drvalv: [{ ...base, url: '/data/song_timelines/entries/wrong.json' }] } } }).songs[0].stageTarget, null)
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [drive], stageManifest: { ...stageManifest, songs: { drvalv: [stageManifest.songs.drvalv.find(row => row.variant === '02dra')] } } }).songs[0].stageTarget, null,
    'another unit variant is not silently used for the preferred unit')
  for (const story of overview.stories) {
    const source = overviewStories.find(row => row.id === story.id)
    assert.deepEqual(story.target, { domain: 'stories', view: 'story_detail', storyId: source.id,
      file: source.file, storyDomain: source.domain, sectionId: String(source.sectionId) })
    assert.equal(story.summary, source.preplaySynopsis?.text || '')
    const sourceCast = [...new Set(source.characters || [])].filter(id => bootstrap.idols.some(idol => idol.id === id))
    assert.deepEqual(story.cast, sourceCast.map(id => {
      const idol = bootstrap.idols.find(row => row.id === id)
      return { id, name: callbacks.idolName(id, idol.name), accentColor: idol.color || '' }
    }), 'actual cast references retain only exact formal identities, source order and localized names')
    assert.equal(story.image, null, 'a story directory without an actual cover binding never guesses a portrait')
  }
  const castSource = { ...overviewStories.find(row => row.exists === true), characters: ['002sht', '001tom', '002sht', '101ken', '047shu_001', 'group', '047shu', '001TOM'] }
  const expectedCastIds = ['002sht', '001tom', '047shu']
  const castBefore = JSON.stringify(castSource)
  const castOverview = buildPortalDesktopOverview({ ...options, stories: [castSource] }).stories[0]
  assert.deepEqual(castOverview.cast.map(row => row.id), expectedCastIds,
    'duplicates, NPCs, model aliases and differently cased identities cannot become formal idol avatars')
  assert.deepEqual(castOverview.cast.map(row => row.name), expectedCastIds.map(id => callbacks.idolName(id, bootstrap.idols.find(row => row.id === id).name)))
  const japaneseCast = buildPortalDesktopOverview({ ...options, stories: [castSource], idolName: undefined }).stories[0].cast
  assert.deepEqual(japaneseCast.map(row => row.name), expectedCastIds.map(id => bootstrap.idols.find(row => row.id === id).name),
    'Japanese fallback names and identities remain intact when no localized callback is supplied')
  assert.deepEqual(buildPortalDesktopOverview({ ...options, stories: [castSource], idolName: () => '' }).stories[0].cast, japaneseCast,
    'an empty display callback preserves source names')
  assert.equal(JSON.stringify(castSource), castBefore, 'cast filtering does not rewrite source character evidence')
  for (const characters of [[], undefined, ['101ken', 'group', '047shu_001']]) {
    assert.deepEqual(buildPortalDesktopOverview({ ...options, stories: [{ ...castSource, characters }], preferredIdol: null, preferredDetail: null }).stories[0].cast, [])
  }
  const allCastIds = bootstrap.idols.map(row => row.id).reverse()
  assert.deepEqual(buildPortalDesktopOverview({ ...options, stories: [{ ...castSource, characters: allCastIds }] }).stories[0].cast.map(row => row.id), allCastIds,
    'the presentation preserves the complete formal cast; visual consumers own any avatar count limit')
  assert.deepEqual(buildPortalDesktopOverview({ ...options, stories: [], events: [] }).stories, [])
  assert.deepEqual(buildPortalDesktopOverview({ ...options, stories: [], events: [] }).events, [])
  if (actual) {
    assert.deepEqual(overview.songs.map(row => row.id), ['brndnf', 'trhorz', 'inndgn', 'unmikn'], 'formal-unit and explicit-member songs retain source order ahead of collective defaults')
    assert.ok(overview.songs.every(row => row.isPreferredRelated))
    assert.ok(overview.events.every(row => preferredDetail.view.events.some(event => String(event.event_id) === row.id)), 'strict event scope never fills with unrelated events')
    for (const event of overview.events) {
      const source = overviewEvents.find(row => row.id === event.id)
      assert.deepEqual(event.target, { domain: 'events', view: 'event_detail', eventId: source.id })
      assert.equal(event.image?.url || null, source.image?.status === 'verified-local-file' ? source.image.url : null)
    }
    const missingImage = overviewEvents.find(row => row.image?.status === 'file-not-found')
    assert.ok(missingImage)
    assert.equal(buildPortalDesktopOverview({ ...options, events: [missingImage], preferredIdol: null, preferredDetail: null }).events[0].image, null)
    const eventStory = overviewStories.find(row => row.domain === 'event' && storyEventResources(row)?.hero)
    assert.ok(eventStory)
    const boundStory = { ...eventStory, image: storyEventResources(eventStory).hero }
    assert.equal(buildPortalDesktopOverview({ ...options, stories: [boundStory], preferredIdol: null, preferredDetail: null }).stories[0].image.url, boundStory.image.url,
      'only an explicitly passed actual graph binding can supply a story cover')
    const graphEvent = { ...overviewEvents[0], resources: eventResources(overviewEvents[0]) }
    assert.equal(buildPortalDesktopOverview({ ...options, events: [graphEvent], preferredIdol: null, preferredDetail: null }).events[0].image.url, graphEvent.resources.hero.url)
    const kaoru = bootstrap.idols.find(row => row.id === '005kao')
    const kaoruCards = rowsByDomain.cards.filter(row => row.character_id === kaoru.id)
    const kaoruOverview = buildPortalDesktopOverview({ ...options, preferredIdol: kaoru, preferredDetail: null })
    assert.deepEqual(kaoruOverview.songs.map(row => row.id), ['strclb', 'montns', 'anwhre', 'cgtocc'])
    assert.ok(kaoruOverview.stories.every(row => overviewStories.find(source => source.id === row.id).characters.includes('005kao')))
    assert.equal(kaoruOverview.preferredUnitName, 'DRAMATIC STARS')
    assert.equal(kaoruOverview.preferredUnitCode, '02dra')
    assert.ok(kaoruOverview.cards.every(row => row.image.kind === 'card_portrait'), 'Kaoru preview uses actual portrait capability with no landscape container mismatch')
    const sourceByRarity = Object.fromEntries(['N', 'R', 'SR', 'SSR'].map(rarity => [rarity, kaoruCards.find(row => row.rarity === rarity)]))
    const shortage = buildPortalDesktopOverview({ ...options, cards: ['N', 'R', 'SSR', 'SR'].map(rarity => sourceByRarity[rarity]), preferredIdol: kaoru, preferredDetail: null })
    assert.deepEqual(shortage.cards.map(row => row.rarity), ['SSR', 'SR', 'R'], 'a real SSR shortage fills with existing SR then R, keeping N last')
    assert.deepEqual(shortage.cards.map(row => row.id), ['SSR', 'SR', 'R'].map(rarity => sourceByRarity[rarity].resource_id))
    const kaoruRelations = buildPortalDesktopOverview({ ...options, preferredIdol: kaoru, preferredDetail: kaoruDetail })
    assert.deepEqual(kaoruRelations.preferredStats.map(row => row.value), [17, 5, 19, 4])
    assert.deepEqual(kaoruRelations.events.map(row => row.id), overviewEvents.filter(row => kaoruDetail.view.events.some(event => String(event.event_id) === row.id)).sort((a,b) => b.release_at - a.release_at || a.id.localeCompare(b.id)).slice(0,3).map(row => row.id),
      'strict Kaoru event relations are sorted by historical date')
    const historical = overviewEvents.find(row => row.id === 'event:20001')
    assert.ok(historical)
    assert.deepEqual(buildPortalDesktopOverview({ ...options, events: [historical], preferredIdol: null, preferredDetail: null }).events[0].target,
      { domain: 'events', view: 'event_detail', eventId: 'event:20001' }, 'historical source identity remains typed and uncoerced')
    assert.throws(() => buildPortalDesktopOverview({ ...options, events: [{ ...overviewEvents[0], event_id: 'wrong-owner' }] }))
    assert.throws(() => buildPortalDesktopOverview({ ...options, events: [overviewEvents[0], overviewEvents[0]] }))
  }
  assert.deepEqual(buildPortalDesktopOverview({ ...options, preferredDetail: null }).preferredStats.map(row => row.value), [null, null, null, null])
  const zeroDetail = { id: preferredIdol.id, view: { profile: { idol_code: preferredIdol.id }, stats: { cards: 0, stories: 0, chats: null, phones: '9' } } }
  assert.deepEqual(buildPortalDesktopOverview({ ...options, preferredDetail: zeroDetail }).preferredStats.map(row => row.value), [0, 0, null, null],
    'known zero, missing count and numeric-looking text are distinct')
  assert.throws(() => buildPortalDesktopOverview({ ...options, preferredDetail: { ...zeroDetail, id: '002sht' } }))
  assert.throws(() => buildPortalDesktopOverview({ ...options, preferredIdol: 'unknown-idol' }))
  if (actual) assert.deepEqual(overview.preferredStats.map(row => row.value), [19, 13, 20, 9])

  const all = buildPortalDesktopOverview({ ...options, preferredIdol: null, preferredDetail: null })
  assert.equal(all.collections.cards.length, rowsByDomain.cards.length)
  assert.equal(all.collections.songs.length, rowsByDomain.songs.length)
  assert.equal(all.collections.stories.length, overviewStories.filter(row => row.exists === true).length)
  assert.equal(all.collections.events.length, overviewEvents.length)
  for (const metric of overview.footprints) {
    assert.equal(metric.value, metric.id === 'events' && !preferredDetail ? null : overview.collections[metric.id].length)
    assert.equal(metric.total, all.collections[metric.id].length, 'numerator and denominator use the same identity and availability universe')
  }
  const unrelatedSongs = rowsByDomain.songs.filter(row => !row.performance?.performers?.some(person => person.id === preferredIdol.id) && row.performance?.unitName !== overview.preferredUnitName)
  const unrelatedStories = overviewStories.filter(row => !row.characters?.includes(preferredIdol.id))
  const isolated = buildPortalDesktopOverview({ ...options, songs: unrelatedSongs, stories: unrelatedStories, preferredDetail: {id:preferredIdol.id,view:{profile:{idol_code:preferredIdol.id},events:[]}} })
  assert.deepEqual(isolated.songs, [], 'shortage never fills with unrelated or configurable songs')
  assert.deepEqual(isolated.stories, [], 'shortage never fills with another idol story')
  assert.deepEqual(isolated.events, [], 'shortage never fills with global event records')
  assert.ok(buildPortalDesktopOverview({...options,loading:true}).footprints.every(row => row.value === null))
  assert.equal(buildPortalDesktopOverview({...options,available:{cards:false}}).footprints.find(row=>row.id==='cards').value,null)
  const role = {id:'410001',view:{identity:{id:'410001'},rewards:{cards:[{character_id:preferredIdol.id,card_resource_id:'owned',methods:[{kind:'point',key:'source-key'}]}],general:[{key:'source-key',scope:'point',totalPoint:10000,product:{kind:'card',target:{card:'owned'}}}]}}}
  assert.equal(portalEventRole(role,'410001',preferredIdol.id),'累计 PT 报酬')
  assert.equal(portalEventRole(role,'wrong-event',preferredIdol.id),'')
  assert.equal(portalEventRole(role,'410001','008rei'),'')
  assert.equal(portalEventRole({...role,view:{...role.view,rewards:{...role.view.rewards,general:[]}}},'410001',preferredIdol.id),'活动报酬卡','method labels alone cannot prove the PT source')
  if (overview.events.length) {
    assert.equal(overview.events[0].relationLabel,'活动关联','an idol-detail event relation alone cannot prove story appearance before enrichment')
    const castEvent = { ...overviewEvents.find(row => row.id === overview.events[0].id), resources: { storyCast: [preferredIdol.id] } }
    assert.equal(buildPortalDesktopOverview({...options,events:[castEvent]}).events[0].relationLabel,'剧情登场')
  }
  const registry = read('public/data/assets/raw_character_image_promotions.json')
  assert.ok(portalIdolPortrait(registry, preferredIdol.id)?.url.includes(preferredIdol.id))
  assert.equal(portalIdolPortrait(registry,'unknown'),null)
  assert.equal(portalIdolPortrait({entries:[{...registry.entries[0],asset_url:'/assets/stories/birthday/wrong.png'}]}, registry.entries[0].idol_code),null)

  const card = clone(preferredCards.find(row => row.rarity === 'SSR') || preferredCards[0])
  card.asset_status = { normal_portrait: true, awakened_portrait: false, awakened_icon: false }
  const normalImage = buildPortalDesktopOverview({ ...options, cards: [card] }).cards[0].image
  assert.equal(normalImage.variant, 'base'); assert.equal(normalImage.kind, 'card_portrait')
  assert.ok(normalImage.url.includes(`image_card_portrait_hide_${card.resource_id}.png`))
  card.asset_status = { normal_portrait: false, awakened_icon: 'true' }
  assert.equal(buildPortalDesktopOverview({ ...options, cards: [card] }).cards[0].image, null, 'unknown/false/string capability never guesses an image')
  delete card.asset_status
  assert.equal(buildPortalDesktopOverview({ ...options, cards: [card] }).cards[0].image, null)
  const badSong = { ...rowsByDomain.songs[0], jacket_url: 'https://unrelated.invalid/fake.png' }
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [badSong], preferredIdol: null, preferredDetail: null }).songs[0].image, null)
  const longCard = { ...card, title: '【长标题】' + '无截断的完整卡片标题'.repeat(30) }
  assert.equal(buildPortalDesktopOverview({ ...options, cards: [longCard], cardTitle: source => source }).cards[0].title, longCard.title)
  const longSong = { ...rowsByDomain.songs[0], title: 'Multiple Entertainment Show! '.repeat(12) }
  assert.equal(buildPortalDesktopOverview({ ...options, songs: [longSong], preferredIdol: null, preferredDetail: null }).songs[0].title, longSong.title)
  assert.equal(buildPortalDesktopOverview({ ...options, cardTitle: () => '', idolName: () => '' }).cards[0].title,
    orderedCards[0].title, 'empty display callback preserves the valid original title')
  assert.equal(buildPortalDesktopOverview({ ...options, idolName: undefined }).cards[0].idolName, preferredIdol.name)

  const search = query => buildPortalSearchResults({ query, rowsByDomain, bootstrap, ...callbacks })
  assert.deepEqual(buildPortalSearchResults({ query: ' \n\t ' }), [], 'empty search returns before loading/validating any corpus')
  assert.deepEqual(search('DRIVE A LIVE').filter(row => row.domain === 'songs').map(row => row.target),
    [{ domain: 'songs', view: 'song_detail', songCode: 'drvalv' }])
  assert.ok(search(callbacks.idolName(preferredIdol.id, preferredIdol.name)).some(row => row.key === `idols:${preferredIdol.id}`),
    'existing Chinese display name is searchable without changing identity')
  assert.ok(search(preferredIdol.name).some(row => row.key === `idols:${preferredIdol.id}`), 'Japanese source name remains searchable')
  const translatedCard = preferredCards.find(row => callbacks.cardTitle(row.title) !== row.title)
  assert.ok(translatedCard)
  const translated = search(callbacks.cardTitle(translatedCard.title)).find(row => row.key === `cards:${translatedCard.resource_id}`)
  assert.ok(translated); assert.equal(translated.target.idolCode, translatedCard.character_id)
  const story = rowsByDomain.stories.find(row => row.exists === true)
  const storyResult = search(story.file).find(row => row.domain === 'stories')
  assert.deepEqual(storyResult.target, { domain: 'stories', view: 'story_detail', storyId: story.id,
    file: story.file, storyDomain: story.domain, sectionId: String(story.sectionId) })
  assert.equal(search('there-is-no-such-portal-result-20261003').length, 0)
  assert.deepEqual(search('ＤＲＩＶＥ Ａ ＬＩＶＥ').map(row => row.key), search('DRIVE A LIVE').map(row => row.key), 'NFKC query is matched without editing displayed text')
  for (const row of search('a')) {
    assert.ok(PORTAL_SEARCH_DOMAINS.includes(row.domain)); assert.equal(row.target.domain, row.domain)
    assert.equal(typeof row.label, 'string'); assert.equal(typeof row.subtitle, 'string')
  }

  for (const domain of PORTAL_SEARCH_DOMAINS) {
    const rows = rowsByDomain[domain]
    validatePortalSearchRows(domain, rows, bootstrap, { expectedCount: rows.length })
    assert.throws(() => validatePortalSearchRows(domain, rows, bootstrap, { expectedCount: rows.length + 1 }))
    assert.throws(() => validatePortalSearchRows(domain, [...rows, rows[0]], bootstrap))
    assert.throws(() => validatePortalSearchRows(domain, [{ ...rows[0], detail: { ...rows[0].detail, kind: 'events.detail' } }], bootstrap))
    assert.throws(() => validatePortalSearchRows(domain, [{ ...rows[0], detail: { ...rows[0].detail, expectedId: 'wrong-owner' } }], bootstrap))
    assert.throws(() => portalSearchPageDescriptors(bootstrap, domain, { ...indexes[domain], searchCount: 0 }))
    assert.throws(() => portalSearchPageDescriptors(bootstrap, domain, { ...indexes[domain], count: indexes[domain].count + 1 }))
    assert.throws(() => portalSearchPageDescriptors({ ...bootstrap, release: 'not-pinned' }, domain, indexes[domain]))
    const page = indexes[domain].searchPages[0]
    assert.throws(() => portalSearchPageDescriptors(bootstrap, domain, { ...indexes[domain], searchPages: [page, page] }))
    assert.throws(() => portalSearchPageDescriptors(bootstrap, domain, { ...indexes[domain], searchPages: [{ ...page, kind: 'events.search' }] }))
    assert.throws(() => portalSearchPageDescriptors(bootstrap, domain, { ...indexes[domain], searchPages: [{ ...page,
      url: page.url.replace(bootstrap.release, 'f'.repeat(64)) }] }))
  }
  assert.throws(() => validatePortalSearchRows('cards', [{ ...rowsByDomain.cards[0], character_id: '002sht' }], bootstrap))
  assert.throws(() => validatePortalSearchRows('idols', [{ ...rowsByDomain.idols[0], name: 'different-owner-name' }], bootstrap))
  assert.throws(() => validatePortalSearchRows('stories', [{ ...story, file: 'wrong_file.json' }], bootstrap))
  const unavailableStory = { ...story, exists: false }
  assert.deepEqual(buildPortalSearchResults({ query: story.file, bootstrap, rowsByDomain: { stories: [unavailableStory] } }), [],
    'an absent story remains absent rather than acquiring an actionable result')
  assert.equal(JSON.stringify(dataset), before, 'all counts, rows, descriptors and statistics remain source-faithful and unmodified')
  console.log(`PASS Portal ${actual ? 'actual artifact' : 'explicit portable fixture'} ${bootstrap.release}: typed 4-domain search, source counts/portrait rarity order, preferred unit code and complete exact-id cast, preferred song/cast/event relations, exact manifest stage targets, actual bindings and source synopsis, owner binding, null/zero stats, CN/JA callbacks, long names, empty query, pinned descriptors and complete row counts.`)
}

check(portableDataset())
const args = process.argv.slice(2), roots = []
while (args.length) {
  assert.equal(args.shift(), '--read-model-root', 'expected repeatable --read-model-root <directory>')
  const root = args.shift(); assert.ok(root); roots.push(path.resolve(root))
}
for (const root of roots) check(artifactDataset(root))
if (!roots.length) console.log('No actual artifact roots requested; portable fixtures are not deployed search, Browser, HTTP or image-rendering acceptance.')
