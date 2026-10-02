"""Typed event details, historical conditions and shared story identity joins."""
from .named_schema import TABLE_IDS
from .domain_common import EVENT_TYPES, clean, group, term_info

def build_event_rewards(tables, ids, reward, fk, backlinks, diagnostics):
    event_entries: list[dict] = []
    event_details: dict[str, dict] = {}
    chapter_rows = tables.get(TABLE_IDS['EventStoryChapters'], [])
    sections = group(tables.get(TABLE_IDS['EventStorySections'], []), 'eventStoryChapterId')
    episodes = group(tables.get(TABLE_IDS['EventStoryEpisodes'], []), 'eventStorySectionId')
    story_products = group(tables.get(TABLE_IDS['EventStoryProducts'], []), 'groupId')
    for row in tables.get(TABLE_IDS['Events'], []):
        code, detail_id = (row['type'], row.get('eventDetailId', 0))
        kind, detail_table = EVENT_TYPES.get(code, ('unknown', 0))
        detail = clean(ids.get(detail_table, {}).get(detail_id, {}))
        if not detail:
            diagnostics.append({'kind': 'missing-event-detail', 'eventId': row['id'], 'typeCode': code, 'detailTable': detail_table, 'detailId': detail_id})
        entry = clean(row)
        entry.update(eventCode=str(row['id']), eventKind=kind, termInfo=term_info(row.get('term')), displayTermInfo=term_info(row.get('displayTerm')), exchangeTermInfo=term_info(row.get('exchangeTerm')))
        chapter_relations = []
        for chapter in chapter_rows:
            for field, relation in [('eventId', 'original'), ('reprintEventId', 'reprint')]:
                if chapter.get(field) == row['id']:
                    chapter_relations.append({'chapterId': chapter['id'], 'relation': relation})
        entry['storyChapterRelations'] = chapter_relations
        entry['detailKey'] = str(row['id'])
        event_entries.append(entry)
        detail_doc = {'eventId': row['id'], 'eventKind': kind, 'detail': detail, 'sourceTable': detail_table, 'rewardKeys': [], 'items': [], 'coverage': {'exchangeLineItems': 'not-in-this-client-masterdata', 'liveRankings': 'not-in-this-client-masterdata'}}
        context = {'eventId': row['id'], 'eventKind': kind}

        def append_reward(r, t, field, product, **extra):
            rr = reward(r, t, field, product, {**context, **extra})
            detail_doc['rewardKeys'].append(rr['key'])
        for item_field in ('itemId', 'normalItemId', 'rareItemId'):
            item_id = detail.get(item_field, 0)
            if item_id:
                fk(TABLE_IDS['Items'], item_id, f"event:{row['id']}.{item_field}")
                detail_doc['items'].append({'role': item_field, 'itemId': item_id})
                backlinks[f'item:{item_id}'].append({'relation': 'event-material', 'eventId': row['id'], 'role': item_field})
        if detail.get('songId'):
            fk(TABLE_IDS['Songs'], detail['songId'], f"event:{row['id']}.songId")
        specs = []
        if code == 1:
            specs = [(TABLE_IDS['EventTheaterRewards'], 'eventTheaterRewardGroupId', 'point'), (TABLE_IDS['EventTheaterRankingRewards'], 'eventTheaterRankingRewardGroupId', 'ranking'), (TABLE_IDS['EventTheaterRepeatedRewards'], 'eventTheaterRepeatedRewardGroupId', 'repeated')]
        elif code == 3:
            specs = [(TABLE_IDS['EventTourRewards'], 'eventTourRewardGroupId', 'point'), (TABLE_IDS['EventTourRankingRewards'], 'eventTourRankingRewardGroupId', 'ranking'), (TABLE_IDS['EventTourSongPanelRewards'], 'eventTourSongPanelRewardGroupId', 'panel'), (TABLE_IDS['EventTourRepeatedRewards'], 'eventTourRepeatedRewardGroupId', 'repeated')]
        for table, link, reward_kind in specs:
            group_id = detail.get(link, 0)
            if not group_id:
                continue
            matched = group(tables.get(table, []), 'groupId').get(group_id, [])
            if not matched:
                diagnostics.append({'kind': 'missing-reward-group', 'eventId': row['id'], 'targetTable': table, 'groupId': group_id})
            for r in matched:
                extra = {'scope': reward_kind}
                extra.update({k: clean(v) for k, v in r.items() if k in ('totalPoint', 'isLimited', 'upperRank', 'lowerRank', 'offsetPoint', 'intervalPoint', 'limitPoint', 'totalCount', 'panels')})
                if reward_kind == 'ranking':
                    append_reward(r, table, 'honorId', {'type': 6, 'productId': r['honorId'], 'amount': 1}, **extra)
                elif 'product' in r:
                    append_reward(r, table, 'product', r['product'], **extra)
                for panel in r.get('panels', []):
                    fk(TABLE_IDS['Songs'], panel.get('songId', 0), f"panel:{r['id']}", optional=True)
        if code == 4:
            people = [r for r in tables.get(TABLE_IDS['EventValentineIdols'], []) if r['eventValentineId'] == detail_id]
            npc = [r for r in tables.get(TABLE_IDS['EventValentineSubCharacters'], []) if r['eventValentineId'] == detail_id]
            level_ids = sorted({r.get('eventValentineLevelGroupId', 0) for r in people + npc})
            detail_doc['participants'] = clean(people)
            detail_doc['subCharacters'] = clean(npc)
            detail_doc['levels'] = clean([r for r in tables.get(TABLE_IDS['EventValentineLevels'], []) if r['groupId'] in level_ids])
            for r in tables.get(TABLE_IDS['EventValentineRankingRewards'], []):
                if r.get('eventValentineId') == detail_id:
                    fk(TABLE_IDS['Idols'], r['idolId'], f"valentine-ranking:{r['id']}")
                    append_reward(r, TABLE_IDS['EventValentineRankingRewards'], 'honorId', {'type': 6, 'productId': r['honorId'], 'amount': 1}, scope='idol-ranking', idolId=r['idolId'], upperRank=r['upperRank'], lowerRank=r['lowerRank'])
            for r in tables.get(TABLE_IDS['EventValentineLevels'], []):
                if r.get('groupId') in level_ids:
                    for ordinal, product in enumerate(r.get('products', [])):
                        rr = reward(r, TABLE_IDS['EventValentineLevels'], 'products', product, {**context, 'scope': 'valentine-level', 'level': r.get('level', 0), 'totalPoint': r.get('totalPoint', 0), 'levelGroupId': r['groupId']}, ordinal)
                        detail_doc['rewardKeys'].append(rr['key'])
        if code == 5:
            parent_detail = detail.get('eventValentineId', 0)
            detail_doc['relatedValentineEventIds'] = [r['id'] for r in tables.get(TABLE_IDS['Events'], []) if r.get('type') == 4 and r.get('eventDetailId') == parent_detail]
        for chapter_rel in chapter_relations:
            for section in sections.get(chapter_rel['chapterId'], []):
                for r in story_products.get(section.get('eventStoryProductGroupId', 0), []):
                    append_reward(r, TABLE_IDS['EventStoryProducts'], 'product', r['product'], scope='story-section', sectionId=section['id'], chapterRelation=chapter_rel['relation'])
                for episode in episodes.get(section['id'], []):
                    for link, scope in [('eventStoryProductGroupId', 'story-archive'), ('inTermEventStoryProductGroupId', 'story-in-event-term')]:
                        for r in story_products.get(episode.get(link, 0), []):
                            rr = reward(r, TABLE_IDS['EventStoryProducts'], 'product', r['product'], {**context, 'scope': scope, 'episodeId': episode['id'], 'chapterRelation': chapter_rel['relation']}, episode['id'])
                            detail_doc['rewardKeys'].append(rr['key'])
        if code in (4, 5):
            for ct, st, et, actor in [(TABLE_IDS['EventValentineIdolStoryChapters'], TABLE_IDS['EventValentineIdolStorySections'], TABLE_IDS['EventValentineIdolStoryEpisodes'], 'Idol'), (TABLE_IDS['EventValentineSubCharacterStoryChapters'], TABLE_IDS['EventValentineSubCharacterStorySections'], TABLE_IDS['EventValentineSubCharacterStoryEpisodes'], 'SubCharacter')] if code == 4 else [(TABLE_IDS['EventWhitedayIdolStoryChapters'], TABLE_IDS['EventWhitedayIdolStorySections'], TABLE_IDS['EventWhitedayIdolStoryEpisodes'], 'Idol'), (TABLE_IDS['EventWhitedaySubCharacterStoryChapters'], TABLE_IDS['EventWhitedaySubCharacterStorySections'], TABLE_IDS['EventWhitedaySubCharacterStoryEpisodes'], 'SubCharacter')]:
                season = 'Valentine' if code == 4 else 'Whiteday'
                chapids = {r['id'] for r in tables.get(ct, []) if r.get(f'event{season}Id') == detail_id}
                sectionids = {r['id'] for r in tables.get(st, []) if r.get(f'event{season}{actor}StoryChapterId') in chapids}
                for ep in tables.get(et, []):
                    if ep.get(f'event{season}{actor}StorySectionId') in sectionids:
                        for ordinal, product in enumerate(ep.get('products', [])):
                            rr = reward(ep, et, 'products', product, {**context, 'scope': 'seasonal-story', 'episodeId': ep['id'], 'actorId': ep.get(actor[0].lower() + actor[1:] + 'Id')}, ordinal)
                            detail_doc['rewardKeys'].append(rr['key'])
        event_details[str(row['id'])] = detail_doc
    return (event_entries, event_details)
