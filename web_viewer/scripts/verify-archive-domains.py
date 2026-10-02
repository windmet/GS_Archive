"""Named-domain failures, typed joins, publication boundaries and optional RAW parity."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
from sidem_masterdata.archive_domains import build_all
from sidem_masterdata.archive_domain_job import generate_archive_domains, public_domain_names
from sidem_masterdata.generation_inputs import GenerationInputs
from sidem_masterdata.named_schema import TABLE_IDS, schema_mismatches, project_named_tables, verified_schema
from sidem_masterdata.named_wire import decode, DecodeError
from sidem_masterdata.products import ProductResolver
from sidem_masterdata.domain_common import term_info
from sidem_masterdata.wire import iter_top_records
from sidem_masterdata.output_io import write_json_outputs


class DomainTests(unittest.TestCase):
    def test_registry_and_full_schema(self):
        schema, proof = verified_schema()
        self.assertEqual((TABLE_IDS['Items'], TABLE_IDS['Honors'], TABLE_IDS['SkillDetailEffects']), (16, 39, 74))
        self.assertEqual(proof['status'], 'verified-full-local-schema')
        self.assertEqual(len(schema['table_registry']), 167)

    def test_schema_identity_fails_closed(self):
        compact = {'table_registry': {'16': 'Items'}, 'models': {'ItemData': {
            'fields': {'1': {'name': 'Id'}}, 'field_set_complete': True}}}
        full = {'models_by_full_name': {'Growing.Models.Data.Masterdata': {'fields': [{'number': 16, 'name': 'Honors'}]},
            'Growing.Models.Data.ItemData': {'fields': [{'number': 1, 'name': 'WrongId'}, {'number': 2, 'name': 'Extra'}]}}}
        self.assertEqual(len(schema_mismatches(compact, full)), 3)

    def test_absent_zero_empty_and_duplicate_are_distinct(self):
        models = {'X': {'fields': {'1': {'name': 'Id', 'type': 'u'}}}}
        self.assertNotIn('id', decode(b'', 'X', models))
        self.assertEqual(decode(b'\x08\x00', 'X', models)['id'], 0)
        with self.assertRaises(DecodeError):
            decode(b'\x08\x01\x08\x02', 'X', models)
        with self.assertRaises(DecodeError):
            decode(b'\x0a\x00', 'X', models)

    def test_selected_projection_ignores_unrequested_malformed_tables(self):
        records = [(TABLE_IDS['Cards'], 0, 0, 1, b'\x80'), (TABLE_IDS['Items'], 1, 1, 3, b'\x08\x01')]
        tables, _ = project_named_tables(records, ['Items'])
        self.assertEqual(tables[TABLE_IDS['Items']][0]['id'], 1)
        with self.assertRaises(DecodeError):
            project_named_tables(records)

    def test_complete_model_unknown_field_is_rejected(self):
        with self.assertRaises(ValueError):
            project_named_tables([(16, 0, 0, 3, b'\x08\x01\xf8\x07\x01')], ['Items'])

    def test_products_keep_namespaces_defaults_and_unknowns(self):
        resolver = ProductResolver({16: [{'id': 1, 'name': 'item'}], 39: [{'id': 1, 'name': 'honor'}]})
        self.assertEqual(resolver.resolve({'type': 4, 'productId': 1})['entityKey'], 'item:1')
        self.assertEqual(resolver.resolve({'type': 6, 'productId': 1})['entityKey'], 'honor:1')
        self.assertEqual(resolver.resolve({'type': 4, 'productId': 1})['amount'], 0)
        self.assertEqual(resolver.resolve({'type': 2})['referenceStatus'], 'type-only')
        self.assertEqual(resolver.resolve({'type': 999, 'productId': 1})['referenceStatus'], 'unknown-type')

    def test_event_dispatch_and_reprint_identity(self):
        tables = {112: [{'id': 1, 'type': 2, 'eventDetailId': 7}, {'id': 2, 'type': 2, 'eventDetailId': 8}],
            118: [{'id': 7}, {'id': 8}], 124: [{'id': 7, 'songId': 999}],
            10: [{'id': 410001, 'eventId': 1, 'reprintEventId': 2}]}
        before = copy.deepcopy(tables)
        outputs, _ = build_all(tables, {})
        self.assertEqual(tables, before)
        self.assertEqual(outputs['event_details/1.json']['sourceTable'], TABLE_IDS['EventCollections'])
        self.assertNotIn('songId', outputs['event_details/1.json']['detail'])
        entries = outputs['event_supplement_index.json']['entries']
        self.assertEqual(entries[0]['storyChapterRelations'][0]['chapterId'], entries[1]['storyChapterRelations'][0]['chapterId'])
        self.assertEqual(entries[1]['storyChapterRelations'][0]['relation'], 'reprint')

    def test_missing_event_detail_is_reported(self):
        outputs, _ = build_all({112: [{'id': 1, 'type': 999}]}, {})
        self.assertEqual(outputs['validation_report.json']['issues'][0]['kind'], 'missing-event-detail')

    def test_unknown_reward_is_preserved_in_report(self):
        outputs, _ = build_all({83: [{'id': 1, 'product': {'type': 999, 'productId': 4, 'amount': 7}}]}, {})
        self.assertEqual(outputs['reward_catalog.json']['entries'][0]['product']['amount'], 7)
        self.assertEqual(outputs['validation_report.json']['issues'][0]['kind'], 'unresolved-product')

    def test_empty_product_is_not_an_invented_reward(self):
        outputs, stats = build_all({83: [{'id': 1, 'product': {'_presentFields': []}}]}, {})
        self.assertEqual(outputs['reward_catalog.json']['entries'], [])
        self.assertEqual(stats['emptyProductMessageCount'], 1)

    def test_sentinel_and_photo_group_join(self):
        self.assertTrue(term_info({'closeAt': 7258114800})['close']['sentinelCandidate'])
        tables = {107: [{'id': 1, 'photoSceneGroupId': 2}], 108: [{'id': 7, 'groupId': 2}]}
        outputs, _ = build_all(tables, {})
        self.assertEqual(outputs['photo_catalog.json']['sceneIdsBySpotId']['1'], [7])

    def test_audit_artifacts_are_not_public(self):
        names = public_domain_names({name: {} for name in ['item_catalog.json', 'named_tables.json',
            'reward_catalog.json', 'resource_requirements.json', 'entity_backlinks.json', 'validation_report.json',
            'event_details/1.json', 'entity_sources/card/1.json', 'entity_sources/honor/1.json', 'photo_idols/1.json']})
        self.assertEqual(set(names), {'item_catalog.json', 'event_details/1.json', 'entity_sources/honor/1.json', 'photo_idols/1.json'})

    def test_job_rejects_mixed_pb(self):
        with self.assertRaises(ValueError):
            generate_archive_domains(GenerationInputs([(16, 0, 0, 2, b'\x08\x01')], decoded_sha256='other'))

    def test_writer_rejects_traversal_before_file_write(self):
        with patch.object(Path, 'write_text', side_effect=AssertionError('unsafe write')):
            with self.assertRaises(ValueError):
                write_json_outputs({'../escape.json': {}}, Path('/candidate'))


def normalized(value):
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items() if k != 'source'}
    if isinstance(value, list):
        return [normalized(v) for v in value]
    return value


def mounted(decoded, reference):
    raw = decoded.read_bytes()
    outputs = generate_archive_domains(GenerationInputs(list(iter_top_records(raw)), decoded_sha256=hashlib.sha256(raw).hexdigest()))
    stats = outputs['validation_report.json']['stats']
    assert [stats[k] for k in ('items', 'honors', 'events', 'rewardLinkCount', 'photoIdolCount', 'photoUniqueVoiceCues')] == [535, 1613, 59, 7943, 49, 245]
    assert outputs['validation_report.json']['issues'] == []
    if reference:
        for name, value in outputs.items():
            if name == 'validation_report.json':
                continue
            expected = json.loads((reference / name).read_bytes())
            assert normalized(value) == normalized(expected), f'Domain semantic drift: {name}'
    print(json.dumps({'artifacts': len(outputs), 'public_artifacts': len(public_domain_names(outputs)),
        'stats': {k: stats[k] for k in ('items', 'honors', 'events', 'rewardLinkCount')},
        'full_reference_comparison': bool(reference)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path)
    parser.add_argument('--reference', type=Path)
    args = parser.parse_args()
    result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(DomainTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.decoded_masterdata:
        mounted(args.decoded_masterdata, args.reference)
