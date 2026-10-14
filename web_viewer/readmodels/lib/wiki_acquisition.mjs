import { assert } from './common.mjs';

// Wikiwiki acquisition evidence (scripts/extract-wikiwiki-acquisition.py) confirms what the client
// master data could only infer: the cards each gasha offered, and how event and campaign cards were won.
// The extractor already checked every listing against our own records; these joins re-check the
// invariants they rely on so a stale evidence file fails the build instead of mislabelling cards.

export function wikiSource(wiki, key) {
  const source = wiki.sources[key];
  assert(source?.url?.startsWith('https://wikiwiki.jp/sidem-gstars/'), `Unknown wiki source: ${key}`);
  return { title: source.title, url: source.url, checkedAt: wiki.checked_at };
}

const poolCardIds = pool => pool.series ? pool.series.cards : pool.cards.map(card => card.resource_id);

/** Marks wiki-listed gasha pickups confirmed and links ticket-only pools to the cards they introduced. */
export function confirmGashaPickups(gashas, gashaIndex, wiki, tickets) {
  const gashaById = new Map(gashas.map(gasha => [String(gasha.id), gasha]));
  const ticketRows = new Map(tickets.rows.map(row => [row.id, row]));
  const confirmed = new Map(), ticketRelations = new Map();
  for (const pool of wiki.gasha_pools) {
    const source = wikiSource(wiki, pool.source);
    if (pool.announcement_id) {
      const gasha = gashaById.get(String(pool.announcement_id));
      assert(gasha, `Wiki pool for unknown gasha: ${pool.announcement_id}`);
      // A later announcement of the same pool offers its primary's cards, as the gasha page lists them.
      const offered = gasha.derived_pickup_cards?.length ? gasha.derived_pickup_cards : gasha.related_pickup_cards || [];
      const derived = offered.map(card => card.card_resource_id);
      // A series pool lists "フォトN種類"; its count, not card names, is what the wiki states.
      if (pool.series) assert(pool.series.count === derived.length, `Series count differs: ${gasha.id}`);
      else assert(derived.length === pool.cards.length && pool.cards.every(card => derived.includes(card.resource_id)),
        `Wiki pickups differ from the gasha's cards: ${gasha.id}`);
      gasha.wiki_confirmation = { kind: pool.series ? 'series' : 'cards', title: pool.title, cardCount: derived.length, source };
      for (const id of derived) confirmed.set(`${gasha.id}:${id}`, source);
      continue;
    }
    for (const groupId of pool.ticket_group_ids) {
      const row = ticketRows.get(groupId);
      assert(row && !row.matched_ids.length, `Wiki pool for unknown ticket group: ${groupId}`);
      // A rerun shares its card list with the first run; cards keep the pool they were introduced in.
      if (pool.series?.rerun) continue;
      for (const id of poolCardIds(pool)) {
        assert(!gashaIndex.relations_by_card?.[id], `Ticket pool card already has a gasha relation: ${id}`);
        if (ticketRelations.has(id)) continue;
        ticketRelations.set(id, { announcement_id: groupId, title: row.source_name, start_at: pool.start_at, end_at: pool.end_at,
          relation_type: 'wiki_gasha_listing', evidence_level: 'curated', banner_url: null, source });
      }
    }
  }
  return {
    confirmed, ticketRelations,
    relationFor(resourceId, relation) {
      if (relation) {
        const source = confirmed.get(`${relation.announcement_id}:${resourceId}`);
        return source ? { ...relation, evidence_level: 'curated', relation_type: 'wiki_gasha_listing', source } : relation;
      }
      return ticketRelations.get(resourceId) || null;
    },
  };
}

const EVENT_MISSION = /^イベント楽曲のライブを(累計)?(\d+)回クリアしよう$/u;
const SONG_MISSION = /^『(.+)』をオリジナルメンバーで(\d+)回クリアしよう$/u;

export function eventMissionLabel(condition) {
  const match = condition.match(EVENT_MISSION);
  assert(match, `Unrecognised event mission condition: ${condition}`);
  return `活动限时任务：活动曲 LIVE ${match[1] ? '累计' : ''}通关 ${match[2]} 次`;
}

export function songMissionLabel(condition) {
  const match = condition.match(SONG_MISSION);
  assert(match, `Unrecognised campaign mission condition: ${condition}`);
  return `以原版成员通关『${match[1]}』${match[2]} 次`;
}

/** Wiki reward listings keyed by event code, checked against the reward table and the exchange evidence. */
export function wikiEventRewards(wiki, exchange) {
  const exchangeByCode = new Map(exchange.events.map(event => [String(event.eventCode), event]));
  const byCode = new Map();
  for (const row of wiki.event_rewards) {
    assert(row.event_code && !byCode.has(row.event_code), `Duplicate or unmatched wiki event: ${row.title}`);
    const extras = row.cards.filter(card => !card.in_reward_table);
    const exchangeEvent = exchangeByCode.get(row.event_code);
    if (exchangeEvent) {
      const listed = exchangeEvent.cards.map(card => card.resourceId).sort();
      assert(JSON.stringify(listed) === JSON.stringify(extras.map(card => card.resource_id).sort()),
        `Carnival wiki cards differ from exchange evidence: ${row.event_code}`);
    } else assert(extras.every(card => card.mission && card.source), `Wiki event card without a mission: ${row.event_code}`);
    byCode.set(row.event_code, { row, exchange: exchangeEvent || null });
  }
  return byCode;
}

/** Campaign missions (not tied to an event) that awarded a card. */
export function missionAcquisitions(wiki) {
  const missions = new Map();
  for (const mission of wiki.missions) for (const card of mission.cards) {
    assert(!missions.has(card.resource_id), `Card awarded by two missions: ${card.resource_id}`);
    missions.set(card.resource_id, { title: mission.title, startAt: mission.start_at, endAt: mission.end_at,
      condition: card.condition, label: songMissionLabel(card.condition), source: wikiSource(wiki, mission.source) });
  }
  return missions;
}
