"""Regression gates for offline honor acquisition evidence, using the real PB."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name('honor-acquisition-scan.py')
spec = importlib.util.spec_from_file_location('honor_acquisition_scan', SCRIPT)
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)
from sidem_masterdata.named_schema import project_named_tables, verified_schema
from sidem_masterdata.wire import iter_top_records


class HonorAcquisitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pb = scan.ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb'
        cls.records = list(iter_top_records(cls.pb.read_bytes()))
        cls.tables, _ = project_named_tables(cls.records)
        cls.outputs, _ = scan.build_all(cls.tables, {})
        cls.result = scan.run(cls.pb)
        cls.compact, _ = verified_schema()
        cls.full = json.loads(scan.FULL_SCHEMA.read_bytes())

    def test_every_original_source_and_condition_survives(self):
        actual = [s['rawEvidence']['rewardRecord']
            for h in self.result['honor_acquisition_catalog.json']['entries'] for s in h['sources']]
        expected = [r for r in self.outputs['reward_catalog.json']['entries'] if r['product']['kind'] == 'honor']
        self.assertEqual({r['key']: r for r in actual}, {r['key']: r for r in expected})
        self.assertEqual(len(actual), len(expected))
        for honor in self.result['honor_acquisition_catalog.json']['entries']:
            for source in honor['sources']:
                reward = source['rawEvidence']['rewardRecord']
                for key in ('upperRank', 'lowerRank', 'idolId', 'totalPoint'):
                    if key in reward:
                        self.assertEqual(source['condition'][key], reward[key])

    def test_raw_evidence_hash_offsets_and_event_join(self):
        by_offset = {r[1]: r for r in self.records}
        for honor in self.result['honor_acquisition_catalog.json']['entries']:
            for source in honor['sources']:
                chain = source['rawEvidence']['chain']
                self.assertEqual([r['role'] for r in chain], ['reward', 'event', 'event-detail'])
                for evidence in chain:
                    record = by_offset[evidence['topOffset']]
                    self.assertEqual(evidence['table'], record[0])
                    self.assertEqual(evidence['recordSha256'], scan.sha(record[4]))
                self.assertEqual(source['sourceId'], chain[1]['namedRow']['id'])
                self.assertEqual(chain[1]['namedRow']['eventDetailId'], chain[2]['namedRow']['id'])
                self.assertEqual(honor['id'], source['product']['productId'])
                reward_row, detail = chain[0]['namedRow'], chain[2]['namedRow']
                table = chain[0]['table']
                group_fields = {114: 'eventTheaterRewardGroupId', 115: 'eventTheaterRankingRewardGroupId',
                                125: 'eventTourRankingRewardGroupId', 126: 'eventTourRewardGroupId'}
                if table in group_fields:
                    self.assertEqual(reward_row['groupId'], detail[group_fields[table]])
                elif table == 150:
                    self.assertEqual(reward_row['eventValentineId'], detail['id'])
                    self.assertEqual(reward_row['idolId'], source['condition']['idolId'])
                else:
                    self.fail(f'Unexpected real-corpus honor source table {table}')

    def test_independent_pb_product_probe_equals_existing_sources(self):
        _, hits = scan.product_probe(self.records, self.full, self.compact)
        actual = {(h['table'], h['rowId'], h['field'], h['honorId']) for h in hits}
        expected = {(r['sourceTable'], r['sourceRowId'], r['sourceField'], r['product']['productId'])
            for r in self.outputs['reward_catalog.json']['entries'] if r['product']['kind'] == 'honor'}
        self.assertEqual(actual, expected)

    def test_unknowns_equal_missing_baseline_and_keywords_are_hints(self):
        catalog = self.result['honor_acquisition_catalog.json']['entries']
        linked = {r['product']['productId'] for r in self.outputs['reward_catalog.json']['entries'] if r['product']['kind'] == 'honor'}
        unknown = {h['id'] for h in catalog if h['status'] == 'unknown'}
        self.assertEqual(unknown, {h['id'] for h in catalog} - linked)
        self.assertTrue(all(not h['sources'] for h in catalog if h['id'] in unknown))
        queue = self.result['reverse_lookup_keyword_queue.json']['unknownHonors']
        self.assertEqual(unknown, {h['honorId'] for h in queue})
        self.assertTrue(all(h['status'] == 'search-hints-only-not-source-evidence' for h in queue))

    def test_item_id_collision_is_not_honor_and_duplicate_product_rejected(self):
        # SongReward ID=1, GroupId=1; item Type=4 with a real honor's numeric ID.
        payload = b'\x08\x01\x10\x01\x1a\x04\x08\x04\x10\x01'
        _, hits = scan.product_probe([(51, 0, 0, len(payload), payload)], self.full, self.compact)
        self.assertEqual(hits, [])
        duplicate = payload + b'\x1a\x04\x08\x06\x10\x01'
        with self.assertRaisesRegex(ValueError, 'Duplicate singular'):
            scan.product_probe([(51, 0, 0, len(duplicate), duplicate)], self.full, self.compact)
        # SongData.CostProduct is a consumption reference, never acquisition.
        cost = b'\x08\x01\xaa\x01\x04\x08\x06\x10\x01'
        _, hits = scan.product_probe([(46, 0, 0, len(cost), cost)], self.full, self.compact)
        self.assertEqual(hits, [])

    def test_extra_probe_schema_drift_rejected(self):
        bad = copy.deepcopy(self.full)
        bad['models_by_full_name']['Growing.Models.Data.SongRewardData']['fields'][2]['name'] = 'CostProduct'
        with self.assertRaisesRegex(ValueError, 'schema drift'):
            scan.product_probe([], bad, self.compact)

    def test_duplicate_and_missing_honor_identity_rejected(self):
        minimal = {'honor_catalog.json': {'entries': [{'id': 1, 'key': 'honor:1', 'nameJa': 'unknown'}]},
                   'reward_catalog.json': {'entries': []}}
        with self.assertRaisesRegex(ValueError, 'Duplicate PB primary key'):
            scan.acquisition_catalog(minimal, {}, [(39, 0, 0, 2, b'\x08\x01'), (39, 3, 3, 5, b'\x08\x01')], [])
        with self.assertRaisesRegex(ValueError, 'missing honor'):
            scan.acquisition_catalog(minimal, {}, [], [{'honorId': 2}])

    def test_api_presence_does_not_invent_root_mission_table(self):
        models = self.result['protobuf_keyword_scan.json']['models']
        self.assertTrue(any(m['fullName'] == 'Growing.Services.MissionNormalMissionListReply' for m in models))
        roots = self.result['protobuf_keyword_scan.json']['masterdataRootTables']
        self.assertEqual([r['name'] for r in roots if 'Mission' in r['name']], ['MissionCategories'])
        field = next(m for m in models if m['fullName'] == 'Growing.Models.Data.NormalMissionData')['fields'][0]
        self.assertIsNone(field['fieldType']['clrType'])


if __name__ == '__main__':
    unittest.main()
