"""Archive-domain orchestration using the common named-row core."""
from collections import Counter, defaultdict
from .named_schema import TABLE_IDS
from .domain_common import PHOTO_TABLES, clean, index, group, term_info, envelope
from .products import ProductResolver
from .event_rewards import build_event_rewards
from .items import build_items
from .honors import build_honors
from .photo import build_photo

def build_all(tables: dict[int, list[dict]], source: dict) -> tuple[dict, dict]:
    resolver = ProductResolver(tables)
    diagnostics: list[dict] = []
    reward_rows: list[dict] = []
    empty_products: list[dict] = []
    backlinks: dict[str, list[dict]] = defaultdict(list)
    ids = {t: index(rows) for t, rows in tables.items()}

    def fk(table: int, ident: int, origin: str, *, optional: bool=False) -> bool:
        if optional and ident == 0:
            return True
        valid = ident in ids.get(table, {})
        if not valid:
            diagnostics.append({'kind': 'missing-foreign-key', 'origin': origin, 'targetTable': table, 'targetId': ident})
        return valid

    def reward(row: dict, table: int, field: str, product: dict, context: dict, ordinal: int=0) -> dict:
        resolved = resolver.resolve(product)
        key = f"{table}:{row['id']}:{field}:{ordinal}:{context.get('eventId', 'global')}:{context.get('scope', '')}"
        record = {'key': key, 'sourceTable': table, 'sourceRowId': row['id'], 'sourceField': field, **context, 'product': resolved}
        reward_rows.append(record)
        if resolved['entityKey']:
            backlinks[resolved['entityKey']].append({'relation': 'reward', 'rewardKey': key, **context})
        if resolved['referenceStatus'] in ('missing-entity', 'unknown-type', 'known-type-unexpanded-domain'):
            diagnostics.append({'kind': 'unresolved-product', 'rewardKey': key, 'product': resolved})
        return record
    event_entries, event_details = build_event_rewards(tables, ids, reward, fk, backlinks, diagnostics)
    source_fields = {TABLE_IDS['MainStoryProducts']: ['product'], TABLE_IDS['IdolStoryProducts']: ['product'], TABLE_IDS['EpisodeZeroStoryProducts']: ['product'], TABLE_IDS['BirthdayStoryProducts']: ['product'], TABLE_IDS['HomeStoryProducts']: ['product'], TABLE_IDS['LoginBonusProducts']: ['product'], TABLE_IDS['CampaignLoginBonusProducts']: ['product'], TABLE_IDS['ProducerLevels']: ['product', 'repeatedRewardProduct'], TABLE_IDS['ProducerRanks']: ['product']}
    for t, product_fields in source_fields.items():
        for row in tables.get(t, []):
            for field in product_fields:
                if field in row and (not clean(row[field])):
                    empty_products.append({'table': t, 'rowId': row['id'], 'field': field})
                    continue
                if field in row:
                    context = {'scope': 'source-table', 'sourceDomain': str(t)}
                    context.update({k: row[k] for k in ('groupId', 'dayCount', 'level', 'sumFanAmount') if k in row})
                    reward(row, t, field, row[field], context)
    for row in tables.get(TABLE_IDS['CardAwakeningItems'], []):
        item_id = row.get('itemId', 0)
        fk(TABLE_IDS['Items'], item_id, f"19:{row['id']}.itemId")
        backlinks[f'item:{item_id}'].append({'relation': 'card-awakening-cost', 'sourceTable': TABLE_IDS['CardAwakeningItems'], 'sourceRowId': row['id'], 'cardRarityId': row.get('cardRarityId', 0), 'idolType': row.get('idolType', 0), 'amount': row.get('itemAmount', 0)})
    login_campaigns = []
    for row in tables.get(TABLE_IDS['CampaignLoginBonuses'], []):
        gid = row.get('campaignLoginBonusProductGroupId', 0)
        products = [r for r in reward_rows if r['sourceTable'] == 117 and r.get('groupId') == gid]
        login_campaigns.append({**clean(row), 'termInfo': term_info(row.get('term')), 'rewards': products})
        if gid and (not products):
            diagnostics.append({'kind': 'missing-campaign-reward-group', 'campaignId': row['id'], 'groupId': gid})
    items = build_items(tables)
    honors = build_honors(tables)
    photo = build_photo(tables, fk, diagnostics)
    requirements = []
    for t in [TABLE_IDS['Items'], TABLE_IDS['Honors'], TABLE_IDS['PhotoFaces'], TABLE_IDS['PhotoPoses'], TABLE_IDS['PhotoFilters'], TABLE_IDS['PhotoStickers'], TABLE_IDS['PhotoSpots'], TABLE_IDS['PhotoScenes'], TABLE_IDS['PhotoFrames'], TABLE_IDS['Events'], TABLE_IDS['PhotoPoseVoices'], TABLE_IDS['MenuBackgrounds'], TABLE_IDS['HomeBgms'], TABLE_IDS['EventNotifications']]:
        for r in tables.get(t, []):
            for key, value in r.items():
                if key in ('resourceId', 'prefabResourceId', 'rarityResourceId', 'backgroundResourceId', 'effectResourceId', 'iconResourceId', 'scenarioResourceId', 'animationName', 'logoResourceId', 'resultBgResourceId', 'bannerResourceId', 'bgmResourceId', 'cueName') and value:
                    requirements.append({'bindingKey': f"{t}:{r['id']}:{key}", 'sourceTable': t, 'sourceRowId': r['id'], 'role': key, 'resourceId': value, 'cueSheetName': r.get('cueSheetName') if key == 'cueName' else None, 'status': 'not-checked'})
    outputs = {'item_catalog.json': envelope('gs-item-catalog', {'entries': items}, source), 'honor_catalog.json': envelope('gs-honor-catalog', {'entries': honors}, source), 'login_campaign_catalog.json': envelope('gs-login-campaign-catalog', {'entries': login_campaigns}, source), 'product_type_catalog.json': envelope('gs-product-types', {'entries': clean(tables.get(TABLE_IDS['ProductResources'], []))}, source), 'event_supplement_index.json': envelope('gs-event-supplement-index', {'entries': event_entries}, source), 'reward_catalog.json': envelope('gs-reward-catalog', {'entries': reward_rows, 'scope': 'selected-client-masterdata-sources-not-exhaustive'}, source), 'entity_backlinks.json': envelope('gs-entity-backlinks', {'byEntityKey': dict(sorted(backlinks.items()))}, source), 'photo_catalog.json': envelope('gs-photo-catalog', photo, source), 'resource_requirements.json': envelope('gs-resource-requirements', {'entries': requirements}, source), 'supplementary_catalog.json': envelope('gs-supplementary-catalog', {'tables': {str(t): clean(tables[t]) for t in [TABLE_IDS['CardAwakeningItems'], TABLE_IDS['ProducerLevels'], TABLE_IDS['ProducerRanks'], TABLE_IDS['ItemDays'], TABLE_IDS['LoginBonuses'], TABLE_IDS['LoginBonusProducts'], TABLE_IDS['LoginBonusResources'], TABLE_IDS['LoginBonusResourceSchedules'], TABLE_IDS['IdolBirthdayLoginBonuses'], TABLE_IDS['ProducerSkills'], TABLE_IDS['ProducerSkillEffects'], TABLE_IDS['MenuBackgrounds'], TABLE_IDS['CampaignLoginBonuses'], TABLE_IDS['CampaignLoginBonusProducts'], TABLE_IDS['HomeBgms'], TABLE_IDS['HomeSchedules'], TABLE_IDS['PremiumPacks'], TABLE_IDS['SnsShareMessages'], TABLE_IDS['EventNotifications']] if t in tables}}, source)}
    skill_effect_groups = group(tables.get(TABLE_IDS['SkillDetailEffects'], []), 'groupId')
    producer_groups = group(tables.get(TABLE_IDS['ProducerLevels'], []), 'level')
    effect_refs = {r.get('skillDetailEffectGroupId', 0) for r in tables.get(TABLE_IDS['SkillDetails'], []) if r.get('skillDetailEffectGroupId', 0)}
    skill_audit = {'fieldIdentity': {'40': 'ProducerLevels', '74': 'SkillDetailEffects', '74.4': 'EffectGroupId', '74.5': 'Param1', '74.6': 'Param2', '74.7': 'Param3', '74.8': 'SortOrder'}, 'skillCount': len(tables.get(TABLE_IDS['Skills'], [])), 'detailCount': len(tables.get(TABLE_IDS['SkillDetails'], [])), 'effectCount': len(tables.get(TABLE_IDS['SkillDetailEffects'], [])), 'referencedEffectGroupCount': len(effect_refs), 'missingEffectGroups': sorted(effect_refs - set(skill_effect_groups)), 'effectGroupIdsAlsoMatchingProducerLevels': sorted(effect_refs & set(producer_groups)), 'nextStep': 'Trace SkillData.SkillDetailGroupId -> SkillDetail.GroupId -> SkillDetailEffectGroupId -> table74.GroupId; map effect Type/Params before rendering.'}
    outputs['skill_effect_audit.json'] = envelope('gs-skill-field-audit', skill_audit, source)
    for key, detail in event_details.items():
        outputs[f'event_details/{key}.json'] = envelope('gs-event-detail-supplement', detail, source)
    stats = {'items': len(items), 'honors': len(honors), 'events': len(event_entries), 'eventTypeCounts': dict(Counter((e['eventKind'] for e in event_entries))), 'itemTypeCounts': dict(sorted(Counter((r['itemType'] for r in items)).items())), 'honorTypeCounts': dict(Counter((r.get('honorType', 0) for r in honors))), 'honorEffectCounts': dict(Counter((r.get('effectType', 0) for r in honors))), 'honorPrefabCount': sum((r['hasPrefab'] for r in honors)), 'photoCounts': {key: len(tables.get(t, [])) for key, t in PHOTO_TABLES.items()}, 'photoUniqueVoiceCues': len(photo['uniqueVoiceCues']), 'photoIdolCount': len({r.get('idolId') for r in tables.get(TABLE_IDS['PhotoPoses'], [])}), 'initialGrantCounts': {key: len(value) for key, value in photo['initialGrants'].items()}, 'rewardLinkCount': len(reward_rows), 'rewardResolutionCounts': dict(resolver.counts), 'honorsWithRewardSources': sum((bool(backlinks.get(r['key'])) for r in honors)), 'itemsWithKnownSourcesOrEventUse': sum((bool(backlinks.get(r['key'])) for r in items)), 'resourceRequirementCount': len(requirements), 'emptyProductMessageCount': len(empty_products), 'reprintStoryLinks': [{'eventId': e['id'], **rel} for e in event_entries for rel in e['storyChapterRelations'] if rel['relation'] == 'reprint'], 'diagnosticCounts': dict(Counter((d['kind'] for d in diagnostics)))}
    outputs['validation_report.json'] = envelope('gs-domain-validation', {'stats': stats, 'issues': diagnostics, 'emptyProductMessages': empty_products, 'limitations': ['Selected-source extraction, not all server-side tables.', 'No actual media inventory / runtime render / remote URL validation performed.', 'Names/field numbers validated from pinned schema; some enum semantics remain numeric.', 'Source-compatible integration into the current local checkout must be validated locally.']}, source)
    return (outputs, stats)
