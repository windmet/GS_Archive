"""Verify native constants and PB release references without promoting them to rewards."""
import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

path = Path(__file__).with_name('scan-honor-native-evidence.py')
spec = importlib.util.spec_from_file_location('honor_native', path)
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


class NativeEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = (native.ROOT / '.analysis/sidem_ios_keyfiles/global-metadata.dat').read_bytes()
        cls.full = json.loads(native.FULL_SCHEMA.read_bytes())
        cls.compact, _ = native.verified_schema()
        cls.enums = native.extract_enums(cls.data, cls.full)
        pb = (native.ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb').read_bytes()
        cls.records = list(native.iter_top_records(pb))
        cls.refs = native.release_references(cls.records, cls.full, cls.compact, cls.enums)

    def test_enum_names_values_and_original_bytes(self):
        enums = {e['fullName']: e for e in self.enums}
        self.assertEqual(len(enums), 10)
        expected = {
            native.PREFIX + 'ProductType': {'Honor': 6},
            native.PREFIX + 'ProductRouteType': {'Mission': 19, 'LoginBonus': 21, 'EventExchange': 15},
            native.PREFIX + 'ReleaseConditionData.Types.Type': {'ReleasedByMission': 2},
            native.PREFIX + 'HonorData.Types.HonorType': {'Normal': 1, 'Idol': 2, 'Event': 3},
        }
        for name, values in expected.items():
            actual = {v['name']: v['value'] for v in enums[name]['members']}
            for key, value in values.items():
                self.assertEqual(actual[key], value)
        for enum in enums.values():
            for member in enum['members']:
                evidence = member['rawEvidence']
                offset = evidence['defaultValueFileOffset']
                raw = self.data[offset:offset + 4]
                self.assertEqual(raw.hex(), evidence['int32Hex'])
                self.assertEqual(int.from_bytes(raw, 'little', signed=True), member['value'])
                self.assertEqual(evidence['defaultClrType'], 'System.Int32')

    def test_mismatched_metadata_fails_before_extracting(self):
        with self.assertRaisesRegex(ValueError, 'schema source'):
            native.extract_enums(self.data + b'\0', self.full)

    def test_release_provenance_and_no_invented_mission_parameters(self):
        by_offset = {r[1]: r for r in self.records}
        self.assertEqual(len(self.refs['references']), 3851)
        mission = self.refs['missionReferences']
        self.assertEqual(len(mission), 391)
        self.assertEqual(self.refs['missionReferencesWithExplicitParameters'], 0)
        self.assertEqual({r['table'] for r in mission}, {native.TABLE_IDS['MobileReleaseConditions']})
        for ref in self.refs['references']:
            self.assertEqual(ref['status'], 'release-reference-only-not-honor-acquisition')
            record = by_offset[ref['rawEvidence']['topOffset']]
            self.assertEqual(native.sha(record[4]), ref['rawEvidence']['recordSha256'])
            selected = [f for f in native.fields(record[4]) if f.number == ref['fieldNumber']]
            field = selected[ref['ordinal']]
            self.assertEqual(native.sha(field.value), ref['rawEvidence']['conditionSha256'])
        for ref in mission:
            self.assertEqual(ref['condition'], {'type': 2})
            self.assertEqual(ref['presentFieldNumbers'], [1])
            self.assertNotIn('honorId', ref)

    def test_unknown_wire_field_duplicate_identity_and_schema_drift_rejected(self):
        payload = b'\x08\x01\x1a\x04\x08\x02\x20\x01'
        record = (180, 0, 0, len(payload), payload)
        with self.assertRaisesRegex(ValueError, 'Unknown release condition'):
            native.release_references([record], self.full, self.compact, self.enums)
        valid = b'\x08\x01\x1a\x02\x08\x02'
        row = (180, 0, 0, len(valid), valid)
        with self.assertRaisesRegex(ValueError, 'duplicate reference row'):
            native.release_references([row, row], self.full, self.compact, self.enums)
        bad = copy.deepcopy(self.full)
        bad['models_by_full_name'][native.PREFIX + 'ReleaseConditionData']['fields'][1]['name'] = 'MissionId'
        with self.assertRaisesRegex(ValueError, 'schema drift'):
            native.release_references([], bad, self.compact, self.enums)

    def test_sqlite_receipt_is_read_only_and_does_not_ignore_nonempty_wal(self):
        audit_root = native.ROOT / '.analysis'
        with tempfile.TemporaryDirectory(prefix='honor-native-test-', dir=audit_root) as folder:
            root = Path(folder)
            self.assertTrue(root.resolve().is_relative_to(audit_root.resolve()))
            db = root / 'Library/HTTPStorages/jp.co.bandainamcoent.BNEI0395/httpstorages.sqlite'
            db.parent.mkdir(parents=True)
            conn = sqlite3.connect(db)
            conn.execute('CREATE TABLE response_cache (id INTEGER)')
            conn.commit()
            conn.close()
            before = db.read_bytes()
            receipt = native.container_receipt(root)
            self.assertEqual(receipt['httpDatabase']['tables'][0]['name'], 'response_cache')
            self.assertEqual(before, db.read_bytes())
            db.with_name(db.name + '-wal').write_bytes(b'not-empty')
            receipt = native.container_receipt(root)
            self.assertEqual(receipt['httpDatabase']['status'], 'nonempty-WAL-requires-snapshot-inspection')
            self.assertNotIn('tables', receipt['httpDatabase'])

    def test_singular_release_condition_and_missing_primary_key_rejected(self):
        # SongRemixIdolUnitData field 7 is singular ReleaseCondition.
        payload = b'\x08\x01\x3a\x02\x08\x01\x3a\x02\x08\x01'
        with self.assertRaisesRegex(ValueError, 'Duplicate singular release condition'):
            native.release_references([(52, 0, 0, len(payload), payload)], self.full, self.compact, self.enums)
        missing_id = b'\x1a\x02\x08\x02'
        with self.assertRaisesRegex(ValueError, 'Missing/duplicate reference row identity'):
            native.release_references([(180, 0, 0, len(missing_id), missing_id)], self.full, self.compact, self.enums)


if __name__ == '__main__':
    unittest.main()
