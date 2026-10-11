"""Independent archive-domain generation through the existing production CLI."""
from .archive_domains import build_all
from .named_schema import EXPECTED_PB_SHA, project_named_tables
from .domain_common import envelope


def public_domain_names(outputs):
    indexes = {'item_catalog.json', 'honor_catalog.json', 'event_supplement_index.json',
        'photo_index.json', 'photo_materials.json', 'login_campaign_catalog.json'}
    return [name for name in outputs if name in indexes
        or name.startswith(('event_details/', 'photo_idols/', 'entity_sources/item/', 'entity_sources/honor/'))]


def generate_archive_domains(inputs):
    if inputs.records and inputs.decoded_sha256 != EXPECTED_PB_SHA:
        raise ValueError('Archive-domain decoded PB hash differs from the reviewed baseline')
    tables, schema_verification = project_named_tables(inputs.records)
    source = {'decodedPbSha256': inputs.decoded_sha256, 'generatorVersion': 'gs-archive-domains-v1',
        'compactSchemaSha256': schema_verification['compactSchemaSha256']}
    outputs, stats = build_all(tables, source)
    rewards = outputs['reward_catalog.json']['entries']
    by_key = {row['key']: row for row in rewards}
    if len(by_key) != len(rewards):
        raise ValueError('Duplicate reward identities')
    report = outputs['validation_report.json']
    blocking = [issue for issue in report['issues'] if issue['kind'] != 'unresolved-product']
    if blocking:
        raise ValueError('Archive domain joins failed: ' + str(blocking))
    report.update(schemaVerification=schema_verification, publicationReady=False,
        inputStatus='reviewed-baseline' if inputs.records else 'synthetic-empty',
        publicationBlockers=['resource bindings and mounted validation', 'frontend contracts and route acceptance'])
    for name, payload in list(outputs.items()):
        if name.startswith('event_details/'):
            payload['rewards'] = [by_key[key] for key in payload['rewardKeys']]
    photo = outputs['photo_catalog.json']
    actor_ids = sorted({row.get('idolId', 0) for row in photo['poses'] + photo['faces']})
    outputs['photo_index.json'] = envelope('gs-photo-index', {'actorIds': actor_ids,
        'counts': stats['photoCounts'], 'materialsPath': 'photo_materials.json',
        'actorPathPattern': 'photo_idols/{id}.json', 'mediaStatus': 'not-checked'}, source)
    outputs['photo_materials.json'] = envelope('gs-photo-materials', {key: photo[key] for key in
        ('filters', 'stickers', 'spots', 'scenes', 'frames', 'initialGrants', 'sceneIdsBySpotId')}, source)
    for actor_id in actor_ids:
        poses = [row for row in photo['poses'] if row.get('idolId') == actor_id]
        pose_ids = {row['id'] for row in poses}
        outputs[f'photo_idols/{actor_id}.json'] = envelope('gs-photo-idol', {'idolId': actor_id,
            'faces': [row for row in photo['faces'] if row.get('idolId') == actor_id], 'poses': poses,
            'poseVoices': [row for row in photo['poseVoices'] if row.get('photoPoseId') in pose_ids],
            'mediaStatus': 'not-checked'}, source)
    for entity_key, links in outputs['entity_backlinks.json']['byEntityKey'].items():
        kind, ident = entity_key.split(':')
        outputs[f'entity_sources/{kind}/{ident}.json'] = envelope('gs-entity-sources', {
            'entityKey': entity_key, 'links': links,
            'rewards': [by_key[link['rewardKey']] for link in links if 'rewardKey' in link]}, source)
    return outputs
