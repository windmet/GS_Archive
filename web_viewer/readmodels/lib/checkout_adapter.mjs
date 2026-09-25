import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert, safeRead, sha256, jsonBytes, listFiles, pick } from './common.mjs';

export const INPUTS = {
 cardIndex: 'data/masterdata/card_index.json', cardDetailIndex: 'data/masterdata/card_detail_index.json',
 idolUnit: 'data/masterdata/idol_unit_dictionary.json', costumeDictionary: 'data/masterdata/costume_dictionary.json',
 archiveManifest: 'data/archive_manifest.json', uiAssetCatalog: 'data/assets/ui_asset_catalog.json',
 rawCharacterImagePromotions: 'data/assets/raw_character_image_promotions.json',
 storyCatalog: 'data/masterdata/story_catalog.json', storyPresentation: 'data/masterdata/story_presentation_index.json',
 songCatalog: 'data/song_catalog.json', songPlaybackAudio: 'data/song_playback_audio.json',
 songExperimentalAudio: 'data/song_experimental_audio.json', gashaIndex: 'data/masterdata/gasha_index.json',
 eventIndex: 'data/masterdata/event_index.json', idolEpisode: 'data/masterdata/idol_episode_index.json',
 workStory: 'data/masterdata/work_story_index.json', archiveVerification: 'data/archive_verification.json',
 mobileArchive: 'data/masterdata/mobile_archive_index.json',
 birthdayStorySemantic: 'data/masterdata/birthday_story_semantic_index.json',
 extraStoryVisualIndex: 'data/masterdata/extra_story_visual_index.json',
 speakerDictionary: 'data/masterdata/speaker_dictionary.json',
 seasonalCampaign: 'data/masterdata/seasonal_campaign_index.json',
};
const HELPERS = {
 home: 'src/data/archiveHomeState.js', cards: 'src/data/archiveSelectors.js',
 stories: 'src/data/storyCatalog.js', gashas: 'src/data/gashaCatalog.js', contracts: 'src/data/archiveDataContracts.js',
 songPresentation: 'src/presentation/SongPresentation.js', idolReference: 'src/presentation/IdolReferencePresentation.js',
 eventEpisodes: 'src/data/eventStoryEpisodes.js', idolPage: 'src/data/idolPage.js', unitPage: 'src/data/unitPage.js',
 domainIdentity: 'src/data/storyDomainIdentityIndex.js', collections: 'src/data/storyCollections.js',
 idolStories: 'src/data/idolCommunicationSelectors.js',
 characterImages: 'src/utils/CharacterImageResolver.js',
};
export function projectUnitRecord(entry, stories, songs) {
  const unit = entry.unit;
  const cardStats = pick(entry.cardStats, ['total', 'rarity_counts', 'cards_with_story', 'single_state']);
  const compactEntry = { ...entry, cardStats };
  return {
    id: String(unit.unit_id),
    summary: { name: unit.unit_name || unit.name || String(unit.unit_id),
      catalog: { unit, members: entry.members, cardStats,
        teamEventCount: entry.eventRelations.team_events.length } },
    view: { entry: compactEntry, stories, songs },
  };
}
/** Production adapter: executes the existing, checkout-owned pure selectors. No hand-reimplementation of card precedence or story identity. */
export async function readCheckout(viewer, { dataRevision, mediaEpoch }) {
  const sources = {}, data = {};
  for (const [key, name] of Object.entries(INPUTS)) {
    const bytes = await safeRead(path.join(viewer, 'public'), name);
    sources[name] = { sha256: sha256(bytes), bytes: bytes.length };
    data[key] = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  }
  const codeHashes = {};
  // Include transitive pure-module code in the release digest, not only direct import entrypoints.
  for (const dir of ['src/data','src/presentation','src/utils','shared/story']) {
    for (const name of await listFiles(path.join(viewer, dir))) {
      if (!name.endsWith('.js') && !name.endsWith('.mjs')) continue;
      codeHashes[`${dir}/${name}`] = sha256(await safeRead(viewer, `${dir}/${name}`));
    }
  }
  const modules = {};
  for (const [key, relative] of Object.entries(HELPERS)) {
    await safeRead(viewer, relative); // resolve/containment check before import.
    modules[key] = await import(pathToFileURL(path.join(viewer, relative)).href);
  }
  for (const [key, value] of Object.entries(data)) modules.contracts.validateArchivePayload(key, value);
  const homes = modules.home.buildArchiveHomeState(data.idolUnit, data.cardIndex, data.archiveManifest, data.costumeDictionary);
  const homeStats = [
    { label: '剧情文件', value: data.archiveVerification.scenarios?.parsed_files ?? data.archiveManifest.counts?.indexed_scenarios ?? 0 },
    { label: '偶像', value: data.archiveManifest.counts?.idols ?? Object.keys(data.idolUnit.by_idol_code || {}).length },
    { label: '卡片', value: data.archiveManifest.counts?.cards ?? data.cardIndex.meta?.card_count ?? data.cardIndex.cards.length },
    { label: '卡池', value: data.gashaIndex.meta?.logical_gasha_count ?? data.archiveManifest.counts?.gashas ?? 0 },
    { label: '首页语音', value: data.archiveManifest.counts?.home_voice_cues ?? data.cardIndex.meta?.home_voice_cue_count ?? 0 },
  ];
  const homeHighlights = modules.home.buildArchiveHomeHighlights(data.archiveManifest, data.uiAssetCatalog);
  const cards = [...modules.cards.buildCardMap(data.cardIndex).values()].map(card => modules.cards.mergeCardDetail(card, data.cardDetailIndex));
  // Move the actual App.vue event decoration into the producer, rather than losing it during data splitting.
  const eventByFile = new Map((data.archiveManifest.unit_event_relations || []).map(e => [e.file, e]));
  const stories = modules.stories.buildStoryCatalog(data.storyCatalog, data.storyPresentation).map(entry => {
    if (entry.domain !== 'event') return entry;
    const relation = eventByFile.get(entry.file);
    if (!relation) return { ...entry, eventScope: 'unclassified', eventScopeLabel: '活动' };
    const masterEvent = data.eventIndex.by_code?.[String(relation.event_code)] || null;
    return { ...entry, title: relation.title, subtitle: [entry.title,entry.subtitle].filter(Boolean).join(' / '),
      searchText: `${entry.searchText} ${relation.title} ${relation.attribute || ''}`.toLowerCase(),
      eventScope: relation.event_scope,
      eventScopeLabel: relation.event_scope === 'fixed_unit_event' ? '固定团活' : relation.event_scope === 'attribute_event' ? `属性·${relation.attribute}` : '跨组合团活',
      eventRelation: relation, masterEvent, rewardCardIds: masterEvent?.reward_card_ids || [] };
  });
  const gashaCatalog = modules.gashas.buildGashaCatalog(data.gashaIndex);
  const gashaMap = new Map(gashaCatalog.map(g => [String(g.id),g]));
  for (const gasha of Object.values(data.gashaIndex.by_id || {})) {
    if (!gashaMap.has(String(gasha.id))) gashaMap.set(String(gasha.id), modules.gashas.resolveGashaRelatedCards(gasha,data.gashaIndex));
  }
  const gashas = [...gashaMap.values()];
  const cardMap = new Map(cards.map(c => [c.resource_id,c]));
  const originalCardMap = modules.cards.buildCardMap(data.cardIndex);
  const storyGroups = new Map();
  for (const story of stories) {
    const key = `${story.domain}:${story.sectionId || ''}`;
    const group = storyGroups.get(key) || [];
    group.push(story);
    storyGroups.set(key, group);
  }
  const storyViews = Object.fromEntries(stories.map(story => {
    const group = storyGroups.get(`${story.domain}:${story.sectionId || ''}`) || [];
    const related = [...group].sort((a,b) => a.releaseAt - b.releaseAt || a.resourceId.localeCompare(b.resourceId))
      .slice(0,24).map(entry => pick(entry,['id','file','title','episodeLabel','domainLabel','domain','sectionId','exists']));
    const castReferences = (story.characters || []).filter(code => /^\d{3}[a-z0-9]{3}$/i.test(code))
      .map(code => modules.idolReference.buildIdolReference(code,data.idolUnit,data.archiveManifest,`story:${story.file}`));
    const birthdayIdol = story.domain === 'birthday' ? modules.characterImages.birthdayStoryIdolCode(story) : '';
    const promotedVisualUrl = birthdayIdol
      ? modules.characterImages.getPromotedCharacterImageUrl('birthday_visual',birthdayIdol,data.rawCharacterImagePromotions) : '';
    return [story.id,{ related, castReferences, promotedVisualUrl }];
  }));
  const birthdayDomain = modules.domainIdentity.buildBirthdayStoryDomainIdentity(data.storyCatalog,data.idolUnit,data.speakerDictionary,data.birthdayStorySemantic);
  const extraDomain = modules.domainIdentity.buildExtraStoryDomainIdentity(data.storyCatalog,data.gashaIndex,data.extraStoryVisualIndex);
  const mainDomain = modules.domainIdentity.buildMainStoryDomainIdentity(data.storyCatalog);
  const collections = modules.collections.buildStoryCollections(data.storyCatalog,stories,{birthdayDomain,extraDomain,idolEpisodes:data.idolEpisode});
  const unitCatalog = modules.unitPage.buildUnitCatalog(data.idolUnit,{manifest:data.archiveManifest,cardMap:originalCardMap,stories});
  const songViews = Object.fromEntries(Object.values(data.songCatalog.songs).map(song => [song.song_code,
    modules.songPresentation.buildSongPresentation(song,data.idolUnit,{playbackTrack:data.songPlaybackAudio.songs?.[song.song_code]||null,
    audioExperiment:data.songExperimentalAudio.songs?.[song.song_code]||null,manifest:data.archiveManifest})]));
  const cardContext = Object.fromEntries(cards.map(card => [card.resource_id,{
    ownerReference:modules.idolReference.buildIdolReference(card.character_id,data.idolUnit,data.archiveManifest,`card:${card.resource_id}`),
    assetStatus:data.archiveManifest.card_assets_by_id?.[card.resource_id]||null,
    eventRelation:data.archiveManifest.event_card_relations_by_card?.[card.resource_id]||null,
    gashaRelation:data.gashaIndex.relations_by_card?.[card.resource_id]||null,
  }]));
  const identities = Object.entries(data.idolUnit.by_idol_code).map(([id, profile]) => ({
    id, name: profile.display_name, kana: profile.name_fields?.kana || '', color: profile.color || '',
    unitId: String(data.archiveManifest.unit_membership_by_idol?.[id]?.unit_id || profile.unit_id || ''),
    unitCode: data.archiveManifest.unit_membership_by_idol?.[id]?.unit_code || profile.unit_code || '',
    unitName: data.archiveManifest.unit_membership_by_idol?.[id]?.unit_name || profile.unit_name || '',
  }));
  // Explicitly scoped leaves: these are source-owned domain records, not root-level index dumps.
  // The UI integration guide specifies which remaining joins must move into offline route producers.
  const extraDomains = {
    events: { searchable: true, records: (data.archiveManifest.unit_event_relations || []).map(event => {
      const story = stories.find(s => s.file === event.file) || null;
      const units = new Set((event.participating_unit_ids || []).map(String));
      return { id: String(event.event_id), summary: pick(event,['event_id','event_code','title','release_at','event_scope']), view:{
        event, masterEvent:data.eventIndex.by_code?.[String(event.event_code)]||null, story,
        episodes:modules.eventEpisodes.buildEventStoryEpisodes(event,story,data.storyCatalog),
        cards:(data.archiveManifest.event_card_relations_by_event?.[String(event.event_id)]||[]).map(relation=>({...relation,
          card_title:cardMap.get(relation.card_resource_id)?.title||relation.card_resource_id,
          character_name:data.idolUnit.by_idol_code?.[relation.character_id]?.display_name||relation.character_id})),
        idols:(event.characters||[]).map(id=>({idol_code:id,...data.idolUnit.by_idol_code?.[id]})),
        castReferences:(event.characters||[]).map(id=>({idol_code:id,
          reference:modules.idolReference.buildEventIdolReference(id,data.idolUnit,data.archiveManifest,
            data.rawCharacterImagePromotions,event)})),
        units:(data.idolUnit.units||[]).filter(unit=>units.has(String(unit.unit_id))),
      }};
    }) },
    idols: { searchable:true, records:Object.keys(data.idolUnit.by_idol_code).map(id=>({id,
      summary:{name:data.idolUnit.by_idol_code[id].display_name},view:{
        profile:modules.idolPage.buildIdolProfile(id,data.idolUnit,data.archiveManifest),
        stats:modules.idolPage.buildIdolStats(id,{cardIndex:data.cardIndex,cardMap:originalCardMap,episodes:data.idolEpisode,mobile:data.mobileArchive}),
        events:modules.idolPage.eventsForIdol(id,data.archiveManifest),
        songs:modules.idolPage.songsForIdol(id,data.songCatalog),
      }})) },
    units: { records:unitCatalog.map(entry=>projectUnitRecord(entry,
      modules.unitPage.storiesForUnit(entry.unit,stories),modules.unitPage.songsForUnit(entry.unit,data.songCatalog))) },
    collections: { searchable:true, records:collections.map(collection=>({id:collection.id,
      summary:pick(collection,['title','domain','sectionId','legacySectionIds','visualUrl','chapterCount','episodeCount']),view:{collection}})) },
    'idol-stories': { records:data.idolEpisode.chapters.map(chapter=>({id:chapter.idol_code,summary:{
      idolCode:chapter.idol_code,idolName:chapter.idol_name,
      unitName:data.idolUnit.by_idol_code?.[chapter.idol_code]?.unit_name||'',
      color:data.idolUnit.by_idol_code?.[chapter.idol_code]?.color||'#168f87',
      sectionCount:chapter.sections?.length||0,
      episodeCount:(chapter.sections||[]).reduce((sum,section)=>sum+(section.episodes?.length||0),0),
    },view:{
      page:(()=>{const page=modules.idolStories.buildIdolStoryPage(data.idolEpisode,data.mobileArchive,stories,data.idolUnit,chapter.idol_code,birthdayDomain);return page?{...page,unitName:data.archiveManifest.unit_membership_by_idol?.[chapter.idol_code]?.unit_name||page.unitName}:null})(),
    }})) },
    work: { records:data.workStory.idols.map(idol=>({id:idol.idol_code,
      summary:pick(idol,['idol_code','display_name','work_type_name']),view:{idol,
        sourceEvidence:{entries:[...(idol.short_stories||[]),...(idol.scene_lines||[])]
          .filter(entry=>entry._source).map(entry=>({id:entry.id,source:entry._source}))}}})) },
    seasonal: { searchable:true,records:data.seasonalCampaign.campaigns.map(campaign=>({id:campaign.id,
      summary:pick(campaign,['name','title','year','season','start_at','end_at']),view:{campaign,
        sourceEvidence:{campaign:campaign._source||null,
          episodes:[...(campaign.introduction||[]),...(campaign.participants||[]).flatMap(participant=>participant.episodes||[])]
            .filter(episode=>episode._source).map(episode=>({id:episode.id,source:episode._source}))}}})) },
  };
  return { product: { home: homes, homeStats, homeHighlights, identities, cards, stories, gashas,
    songs: Object.values(data.songCatalog.songs), songViews, songSummary: data.songCatalog.summary, cardContext, storyViews,
    storyCatalogView: { mainDomain, extraDomain, birthdayDomain,
      seasonalCount: data.seasonalCampaign.campaigns.length, workCount: data.workStory.idols.length },
    gashaCatalogIds:gashaCatalog.map(g=>String(g.id)),
    gashaSummary:pick(data.gashaIndex.meta,['gasha_count','logical_gasha_count','derived_pickup_count','category_counts']),
    playback: data.songPlaybackAudio.songs, experimental: data.songExperimentalAudio.songs, extraDomains },
    provenance: { sources, codeHashes, dataRevision, mediaEpoch, canonicalCounts: {
      rawCardRecords: data.cardIndex.cards.length, preferredCards: cards.length,
      storyEntries: stories.length, homeIdols: homes.length },
      followupProducers: ['story catalog identity parity and resource projections','mobile + random talk pages','resources UI/provenance','reading document locator','legacy groups/files directory aliases'],
    } };
}
