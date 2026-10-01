"""Real-corpus regressions for web joins, conflicts and remaining search scope."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('honor_web', Path(__file__).with_name('merge-honor-web-evidence.py'))
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


class WebEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(web.REGISTRY.read_text(encoding='utf-8'))
        cls.pb = web.ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb'
        cls.baseline = web.scan.run(cls.pb)['honor_acquisition_catalog.json']
        tables, _ = web.scan.project_named_tables(list(web.scan.iter_top_records(cls.pb.read_bytes())))
        domains, _ = web.scan.build_all(tables, {})
        cls.honors = domains['honor_catalog.json']
        cls.honors['source'] = cls.baseline['source']
        cls.catalog, cls.templates = web.merge(cls.baseline, cls.honors, cls.registry)
        cls.by_id = {h['id']: h for h in cls.catalog['entries']}

    def test_existing_pb_sources_are_preserved_exactly_and_input_is_not_mutated(self):
        for original in self.baseline['entries']:
            result = self.by_id[original['id']]
            self.assertEqual(result['sources'][:len(original['sources'])], original['sources'])
            self.assertEqual(result['pbStatus'], original['status'])
            self.assertFalse(any(s['type'] == 'normal_mission' for s in original['sources']))
        self.assertEqual(sum(h['pbStatus'] == 'known-source' for h in self.catalog['entries']), 886)

    def test_only_explicit_22_pairs_bind_without_wire_product_or_mission_id(self):
        mapped = [h for h in self.catalog['entries'] if h['status'].startswith('web-')]
        self.assertEqual(len(mapped), 22)
        self.assertEqual(sum(h['honorType'] == 2 for h in mapped), 2)
        for h in mapped:
            s = h['sources'][-1]
            self.assertIsNone(s['sourceId'])
            self.assertIsNone(s['product'])
            self.assertIsNone(s['rawEvidence'])
            self.assertTrue(s['externalEvidence']['citations'])
        for t in self.templates:
            self.assertEqual(t['honorIds'], [])
        trust = next(t for t in self.templates if t['key'] == 'idol-trust')
        self.assertEqual(trust['otherRewardKinds'], ['talk'])

    def test_level_conflict_survives_and_is_not_a_resolved_value(self):
        h = self.by_id[10013002]
        s = h['sources'][-1]
        self.assertEqual(h['status'], 'web-conflict')
        self.assertEqual(s['condition']['requiredCount'], 300)
        self.assertEqual(s['externalEvidence']['conflicts'][0]['condition']['requiredCount'], 315)
        self.assertEqual(sum(h['status'] == 'web-conflict' for h in self.catalog['entries']), 1)

    def test_remaining_214_plus_conflict_excludes_events_and_defers_36_placeholders(self):
        queue = web.search_queue(self.catalog, self.registry)
        self.assertEqual(len(queue), 215)
        self.assertEqual(sum(r['priority'] == 'conflict' for r in queue), 1)
        self.assertEqual(sum(r['nameLooksLikePlaceholder'] for r in queue), 36)
        self.assertEqual(sum(r['nameLooksLikeInternalConditionLabel'] for r in queue), 24)
        self.assertEqual(sum(r['priority'] == 'search' for r in queue), 154)
        self.assertFalse(any(r['honorType'] == 3 for r in queue))
        self.assertEqual(sum(h['status'] == 'unknown' for h in self.catalog['entries']), 705)
        self.assertEqual(sum(h['status'] == 'unknown' and h['honorType'] == 1 for h in self.catalog['entries']), 94)
        self.assertEqual(sum(h['status'] == 'unknown' and h['honorType'] == 2 for h in self.catalog['entries']), 120)
        self.assertEqual(len(web.handoff({'webMappedHonors': 22, 'webConflictHonors': 1,
            'unknownNonEventHonors': 214, 'unknownByHonorType': {'1': 94, '2': 120},
            'placeholderUnknownHonors': 36, 'internalConditionLabelHonors': 24}, queue, self.templates).splitlines()) > 200, True)

    def test_bad_identity_or_ambiguous_name_rejects(self):
        registry = copy.deepcopy(self.registry)
        registry['mappings'][0]['nameJa'] = 'unproved-name'
        with self.assertRaises(ValueError):
            web.merge(self.baseline, self.honors, registry)
        registry = copy.deepcopy(self.registry)
        registry['mappings'][0]['honorId'] = 999999
        with self.assertRaises(ValueError):
            web.merge(self.baseline, self.honors, registry)
        baseline, honors = copy.deepcopy(self.baseline), copy.deepcopy(self.honors)
        duplicate = self.registry['mappings'][0]['nameJa']
        baseline['entries'][0]['nameJa'] = duplicate
        honors['entries'][0]['nameJa'] = duplicate
        with self.assertRaises(ValueError):
            web.merge(baseline, honors, self.registry)

    def test_wrong_scope_duplicate_mapping_and_missing_provenance_reject(self):
        registry = copy.deepcopy(self.registry)
        registry['mappings'][0]['honorType'] = 3
        with self.assertRaises(ValueError):
            web.merge(self.baseline, self.honors, registry)
        registry = copy.deepcopy(self.registry)
        registry['mappings'].append(registry['mappings'][0])
        with self.assertRaises(ValueError):
            web.merge(self.baseline, self.honors, registry)
        registry = copy.deepcopy(self.registry)
        registry['mappings'][0]['evidence'] = ['nonexistent-source']
        with self.assertRaises(ValueError):
            web.merge(self.baseline, self.honors, registry)
        honors = copy.deepcopy(self.honors)
        honors['source'] = {**honors['source'], 'decodedPbSha256': 'different-source'}
        with self.assertRaises(ValueError):
            web.merge(self.baseline, honors, self.registry)


if __name__ == '__main__':
    unittest.main()
