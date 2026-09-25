import { pick } from './common.mjs';

const scenarioFields = ['id', 'kind', 'title', 'compiled_file', 'compiled_exists', 'release_condition', 'term'];
const topicFields = ['id', 'talk_room_id', 'open_time', 'close_time', 'interval_day', 'compiled_file', 'compiled_exists'];

function compactBundle(bundle) {
  return {
    id: bundle.id, kind: bundle.kind, file: bundle.file, exists: bundle.exists,
    title: bundle.title, releaseAt: bundle.releaseAt,
    scenarios: bundle.scenarios.map(scenario => pick(scenario, scenarioFields)),
    unlocks: bundle.unlocks, cardIds: bundle.cardIds,
  };
}

function referencedCards(bundles, cards) {
  const ids = new Set(bundles.flatMap(bundle => bundle.cardIds || []).map(Number));
  return cards.filter(card => ids.has(Number(card.card_id)))
    .map(card => pick(card, ['card_id', 'resource_id', 'title', 'title_full', 'character_id']));
}

function referencedEpisodes(bundles, episodeIndex) {
  const ids = new Set(bundles.flatMap(bundle => bundle.unlocks || [])
    .filter(unlock => unlock.kind === 'idol_story_episode_finished')
    .map(unlock => Number(unlock.condition?.param_a)));
  const result = [];
  for (const chapter of episodeIndex.chapters || []) {
    for (const section of chapter.sections || []) {
      for (const episode of section.episodes || []) {
        if (ids.has(Number(episode.id))) result.push({
          id: episode.id, idolCode: chapter.idol_code, sectionId: section.id,
          sectionName: section.name, scenarioTitle: section.scenario_title,
          episodeName: episode.name,
        });
      }
    }
  }
  return result;
}

export function buildMobileRecords({ mobileArchive, randomTalkPresentation, compiledIndex,
  idolUnit, archiveManifest, cardIndex, idolEpisode }, selectors) {
  const titleMap = selectors.buildCompiledGroupTitleMap(compiledIndex);
  const scenarioById = new Map((mobileArchive.scenarios || []).map(scenario => [scenario.id, scenario]));
  const group = (ids, kind) => selectors.groupMobileScenarios((ids || [])
    .map(id => scenarioById.get(id)).filter(scenario => scenario?.kind === kind), titleMap)
    .map(compactBundle);
  const idolRecords = Object.keys(mobileArchive.by_idol_code || {}).map(idolCode => {
    const ids = mobileArchive.by_idol_code[idolCode];
    const personalBundles = group(ids, 'idol_talk');
    const phoneBundles = group(ids, 'idol_phone');
    const randomBundles = selectors.buildRandomTalkBundles(mobileArchive, idolCode, titleMap,
      randomTalkPresentation).map(bundle => ({
      id: bundle.id, file: bundle.file, exists: bundle.exists, title: bundle.title,
      topics: bundle.topics.map(topic => ({
        ...pick(topic, topicFields),
        presentation: topic.presentation ? pick(topic.presentation,
          ['id', 'title', 'start_step', 'end_step', 'dialogue_count', 'choice_count']) : null,
      })),
    }));
    const room = mobileArchive.rooms?.personal?.find(entry => entry.idol_code === idolCode);
    const topicIds = new Set(randomBundles.flatMap(bundle => bundle.topics.map(topic => Number(topic.talk_room_id))));
    const randomIntros = (mobileArchive.random_talk?.intros || [])
      .filter(intro => topicIds.has(Number(intro.talk_room_id)))
      .map(intro => pick(intro, ['id', 'talk_room_id', 'intro_id', 'script_name', 'script_label',
        'join_probability', 'open_time', 'close_time', '_source']));
    const idol = idolUnit.by_idol_code[idolCode] || {};
    const membership = archiveManifest.unit_membership_by_idol?.[idolCode] || {};
    const bundles = [...personalBundles, ...phoneBundles];
    const sourceEvidence = {
      scenarios: (ids || []).map(id => scenarioById.get(id)).filter(scenario => scenario?._source)
        .map(scenario => ({ id: scenario.id, source: scenario._source })),
      topics: (mobileArchive.random_talk?.topics || []).filter(topic => topic.idol_code === idolCode && topic._source)
        .map(topic => ({ id: topic.id, source: topic._source })),
      intros: randomIntros.filter(intro => intro._source).map(intro => ({ id: intro.id, source: intro._source })),
      room: room?._source || null,
    };
    return { id: idolCode, summary: {
      idolCode, name: idol.display_name || idolCode, color: idol.color || '',
      unitCode: membership.unit_code || idol.unit_code || '',
      personalCount: personalBundles.reduce((sum, bundle) => sum + bundle.scenarios.length, 0),
      phoneCount: phoneBundles.reduce((sum, bundle) => sum + bundle.scenarios.length, 0),
      randomTopicCount: randomBundles.reduce((sum, bundle) => sum + bundle.topics.length, 0),
    }, view: {
      personalBundles, phoneBundles, randomBundles, randomIntros,
      room: room ? pick(room, ['id', 'profile_text', '_source']) : null,
      cardRefs: referencedCards(bundles, cardIndex.cards || []),
      episodeRefs: referencedEpisodes(bundles, idolEpisode), sourceEvidence,
    } };
  });
  const unitRecords = Object.keys(mobileArchive.by_unit_code || {}).map(unitCode => {
    const unit = (idolUnit.units || []).find(entry => entry.unit_code === unitCode) || {};
    const unitBundles = group(mobileArchive.by_unit_code[unitCode], 'unit_talk');
    const room = mobileArchive.rooms?.unit?.find(entry => entry.unit_code === unitCode);
    const sourceEvidence = {
      scenarios: (mobileArchive.by_unit_code[unitCode] || []).map(id => scenarioById.get(id))
        .filter(scenario => scenario?._source).map(scenario => ({ id: scenario.id, source: scenario._source })),
      room: room?._source || null,
    };
    return { id: unitCode, summary: {
      unitCode, name: unit.unit_name || unitCode, color: unit.unit_color || '',
      scenarioCount: unitBundles.reduce((sum, bundle) => sum + bundle.scenarios.length, 0),
    }, view: {
      unitBundles, room: room ? pick(room, ['id', '_source']) : null,
      cardRefs: referencedCards(unitBundles, cardIndex.cards || []),
      episodeRefs: referencedEpisodes(unitBundles, idolEpisode), sourceEvidence,
    } };
  });
  return { idolRecords, unitRecords };
}
