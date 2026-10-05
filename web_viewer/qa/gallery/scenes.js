// Page gallery scenes: real archive components mounted with real public/data, for
// before/after screenshots. Dev-only (served by Vite from qa/); never part of the build.
const json = path => fetch(`/data/${path}`).then(response => {
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
})
const load = paths => Promise.all(paths.map(json))
const component = async name => (await import(`/src/components/archive/${name}.vue`)).default

async function identity() {
  const dictionary = await json('masterdata/idol_unit_dictionary.json')
  return { dictionary, idolName: code => dictionary.by_idol_code?.[code]?.display_name || code }
}

async function cards() {
  const { mergeCardDetail } = await import('/src/data/archiveSelectors.js')
  const [index, details] = await load(['masterdata/card_index.json', 'masterdata/card_detail_index.json'])
  return index.cards.map(card => mergeCardDetail(card, details))
}

async function storyDomains() {
  const { buildStoryCatalog } = await import('/src/data/archiveSelectors.js')
  const { buildMainStoryDomainIdentity, buildExtraStoryDomainIdentity, buildBirthdayStoryDomainIdentity } = await import('/src/data/storyDomainIdentityIndex.js')
  const [storyData, presentation, gashas, extraVisuals, dictionary, speakers, birthdays] = await load([
    'masterdata/story_catalog.json', 'masterdata/story_presentation_index.json', 'masterdata/gasha_index.json',
    'masterdata/extra_story_visual_index.json', 'masterdata/idol_unit_dictionary.json', 'masterdata/speaker_dictionary.json',
    'masterdata/birthday_story_semantic_index.json',
  ])
  return {
    storyData,
    entries: buildStoryCatalog(storyData, presentation),
    mainDomain: buildMainStoryDomainIdentity(storyData),
    extraDomain: buildExtraStoryDomainIdentity(storyData, gashas, extraVisuals),
    birthdayDomain: buildBirthdayStoryDomainIdentity(storyData, dictionary, speakers, birthdays),
  }
}

const storyCatalog = domain => async () => ({
  component: await component('ArchiveStoryCatalog'),
  props: { mode: 'portal', domain, idolName: (await identity()).idolName, ...(await storyDomains()) },
})

export const SCENES = {
  'card-detail': { label: '卡片详情 · 天ヶ瀬 冬馬 SSR', async mount() {
    const all = await cards(), { idolName } = await identity()
    return { component: await component('ArchiveCardDetail'), props: { card: all.find(card => card.resource_id === '001tom_ssr01'), idolName } }
  } },
  'card-list': { label: '卡片列表 · 天ヶ瀬 冬馬', async mount() {
    const all = await cards()
    return { component: await component('ArchiveCardList'), props: { cards: all.filter(card => card.character_id === '001tom') } }
  } },
  'song-detail': { label: '歌曲详情 · BRAND NEW FIELD', async mount() {
    const { buildSongPresentation } = await import('/src/presentation/SongPresentation.js')
    const [catalog, dictionary, manifest, playback, experiments] = await load(['song_catalog.json', 'masterdata/idol_unit_dictionary.json', 'archive_manifest.json', 'song_playback_audio.json', 'song_experimental_audio.json'])
    const song = catalog.songs.brndnf
    return { component: await component('ArchiveSongDetail'), props: {
      song: buildSongPresentation(song, dictionary, { playbackTrack: playback.songs[song.song_code], audioExperiment: experiments.songs[song.song_code], manifest }),
      idolDirectory: dictionary.idols, idolName: code => dictionary.by_idol_code?.[code]?.display_name || code,
    } }
  } },
  'gasha-detail': { label: '卡池详情', async mount() {
    const [index] = await load(['masterdata/gasha_index.json']), { idolName } = await identity()
    return { component: await component('ArchiveGashaDetail'), props: { gasha: index.gashas.find(gasha => gasha.derived_pickup_cards?.length) || index.gashas[0], idolName } }
  } },
  'story-main': { label: '故事目录 · 主线', mount: storyCatalog('main') },
  'story-extra': { label: '故事目录 · 额外剧情', mount: storyCatalog('extra') },
  'story-birthday': { label: '故事目录 · 生日剧情', mount: storyCatalog('birthday') },
  'story-collection': { label: '故事合集 · 主线第 1 章', async mount() {
    const { buildStoryCollections } = await import('/src/data/storyCollections.js')
    const domains = await storyDomains(), [idolEpisodes] = await load(['masterdata/idol_episode_index.json'])
    const collections = buildStoryCollections(domains.storyData, domains.entries, { extraDomain: domains.extraDomain, birthdayDomain: domains.birthdayDomain, idolEpisodes })
    return { component: await component('ArchiveStoryCollection'), props: { collection: collections.find(collection => collection.chapters?.length > 3) || collections[0] } }
  } },
  'work-story': { label: '工作剧情 · 天ヶ瀬 冬馬', async mount() {
    const [index] = await load(['masterdata/work_story_index.json'])
    return { component: await component('ArchiveWorkStory'), props: { idol: index.idols[0], idols: index.idols } }
  } },
  'seasonal': { label: '季节企划', async mount() {
    const [index] = await load(['masterdata/seasonal_campaign_index.json'])
    return { component: await component('ArchiveSeasonalCampaign'), props: { campaign: index.campaigns[0], campaigns: index.campaigns } }
  } },
  'mobile-archive': { label: '通信 · 个人聊天', async mount() {
    // The read-model projection needs node:crypto; prepare.mjs writes its production shape.
    const response = await fetch('/qa/gallery/generated/mobile-001tom.json')
    if (!response.ok) throw new Error('Run qa/gallery/prepare.mjs (capture-gallery does this) first')
    const [idolUnit] = await load(['masterdata/idol_unit_dictionary.json'])
    return { component: await component('ArchiveMobileArchive'), props: {
      idolData: await response.json(), mode: 'personal', selectedIdol: '001tom', idols: idolUnit.idols, units: idolUnit.units,
    } }
  } },
}
