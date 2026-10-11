"""Source-bound enum constants and mission-release references, never acquisition guesses."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
import extract_il2cpp_protobuf_schema as metadata
from sidem_masterdata.named_schema import EXPECTED_PB_SHA, FULL_SCHEMA, TABLE_IDS, verified_schema
from sidem_masterdata.named_wire import decode, fields
from sidem_masterdata.wire import iter_top_records

PREFIX = 'Growing.Models.Data.'
ENUM_NAMES = {
    PREFIX + 'ProductType', PREFIX + 'ProductRouteType', PREFIX + 'MissionTransitionType',
    PREFIX + 'MissionStatusType', PREFIX + 'ReleaseConditionData.Types.Type',
    PREFIX + 'FeatureReleaseConditionData.Types.Type', PREFIX + 'FeatureReleaseConditionData.Types.FeatureType',
    PREFIX + 'HonorData.Types.HonorType', PREFIX + 'HonorData.Types.EffectType',
    'Growing.Theater.MissionTopView.MissionType',
}
EXTRA_ROOT_MODELS = {
    'MainStoryChapters': 'MainStoryChapterData', 'MainStorySections': 'MainStorySectionData',
    'MainStoryEpisodes': 'MainStoryEpisodeData', 'IdolStoryChapters': 'IdolStoryChapterData',
    'IdolStorySections': 'IdolStorySectionData', 'IdolStoryEpisodes': 'IdolStoryEpisodeData',
    'EpisodeZeroStoryChapters': 'EpisodeZeroStoryChapterData',
    'EpisodeZeroStorySections': 'EpisodeZeroStorySectionData',
    'EpisodeZeroStoryEpisodes': 'EpisodeZeroStoryEpisodeData',
    'HomeStoryEpisodes': 'HomeStoryEpisodeData', 'MobileReleaseConditions': 'MobileReleaseConditionData',
    'SongDifficulties': 'SongDifficultyData', 'SongRemixIdolUnits': 'SongRemixIdolUnitData',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def extract_enums(data, full):
    if sha(data) != full['source']['sha256']:
        raise ValueError('Metadata differs from the protobuf schema source')
    _, sections = metadata.parse_header(data)
    strings = metadata.build_string_reader(data, sections['string'])
    types = metadata.read_records(data, sections['type_definitions'], metadata.TYPE_DEFINITION_FORMAT)
    field_rows = metadata.read_records(data, sections['fields'], metadata.FIELD_DEFINITION_FORMAT)
    nested = metadata.read_records(data, sections['nested_types'], '<i')
    parents = {}
    for number, row in enumerate(types):
        for pos in range(row[12], row[12] + row[20]) if row[20] else ():
            child = nested[pos][0]
            if not 0 <= child < len(types) or child in parents:
                raise ValueError('Ambiguous nested metadata type')
            parents[child] = number

    def fullname(number, seen=()):
        if number in seen:
            raise ValueError('Nested metadata cycle')
        row = types[number]
        name = strings(row[0])
        if number in parents:
            return fullname(parents[number], seen + (number,)) + '.' + name
        namespace = strings(row[1])
        return (namespace + '.' if namespace else '') + name

    defaults = {}
    for field_index, type_index, relative in metadata.read_records(data, sections['field_default_values'], metadata.FIELD_DEFAULT_FORMAT):
        if field_index in defaults:
            raise ValueError('Duplicate field default')
        defaults[field_index] = (type_index, relative)
    int32_types = [row[2] for row in types if strings(row[0]) == 'Int32' and strings(row[1]) == 'System']
    if len(int32_types) != 1:
        raise ValueError('Ambiguous System.Int32 metadata definition')
    result = []
    for number, row in enumerate(types):
        name = fullname(number)
        if name not in ENUM_NAMES:
            continue
        if not row[24] & 2:
            raise ValueError('Target is not a metadata enum: ' + name)
        values = []
        for field_index in range(row[8], row[8] + row[18]):
            field_name_index, field_type_index, token = field_rows[field_index]
            field_name = strings(field_name_index)
            if field_name == 'value__':
                continue
            type_index, relative = defaults[field_index]
            if type_index != int32_types[0] or not 0 <= relative <= sections['default_value_data'][1] - 4:
                raise ValueError('Enum default type/range mismatch')
            offset = sections['default_value_data'][0] + relative
            value = struct.unpack_from('<i', data, offset)[0]
            values.append({'name': field_name, 'value': value, 'rawEvidence': {
                'fieldIndex': field_index, 'fieldToken': token, 'fieldTypeIndex': field_type_index,
                'defaultTypeIndex': type_index, 'defaultClrType': 'System.Int32',
                'defaultValueFileOffset': offset, 'int32Hex': data[offset:offset + 4].hex()}})
        result.append({'fullName': name, 'typeDefinitionIndex': number, 'members': values})
    if {r['fullName'] for r in result} != ENUM_NAMES:
        raise ValueError('Missing required native enum')
    return result


def release_references(records, full, compact, enums):
    condition_fields = full['models_by_full_name'][PREFIX + 'ReleaseConditionData']['fields']
    if [(f['number'], f['name'], f['backing_type_index']) for f in condition_fields] != [
            (1, 'Type', 48929), (2, 'ParamA', 30746), (3, 'ParamB', 30746)]:
        raise ValueError('ReleaseConditionData schema drift')
    rules = {'ReleaseConditionData': {'fields': {str(f['number']): {'name': f['name'], 'type': 'u'}
                                               for f in condition_fields}}}
    enum = next(e for e in enums if e['fullName'] == PREFIX + 'ReleaseConditionData.Types.Type')
    names = {v['value']: v['name'] for v in enum['members']}
    mapping = {int(k): v for k, v in compact['table_models'].items()}
    mapping.update({TABLE_IDS[k]: v for k, v in EXTRA_ROOT_MODELS.items()})
    refs, probes, seen_rows = [], {}, set()
    for record in records:
        table, offset, _, _, payload = record
        model = mapping.get(table)
        declared = full['models_by_full_name'].get(PREFIX + str(model), {}).get('fields', [])
        selected = {f['number']: f for f in declared if f['name'] in ('ReleaseCondition', 'ReleaseConditions')}
        if not selected:
            continue
        for f in selected.values():
            expected = 20333 if f['name'] == 'ReleaseConditions' else 34044
            if f['backing_type_index'] != expected:
                raise ValueError('Release-condition reference type drift')
        raw_fields = fields(payload)
        ids = [f.value for f in raw_fields if f.number == 1 and f.wire_type == 0]
        if len(ids) != 1 or (table, ids[0]) in seen_rows:
            raise ValueError('Missing/duplicate reference row identity')
        seen_rows.add((table, ids[0]))
        probe = probes.setdefault(table, {'table': table, 'model': model, 'rowsScanned': 0,
            'bindingBasis': 'compact-registry' if str(table) in compact['table_models'] else 'explicit-audit-adapter',
            'releaseReferenceCount': 0})
        probe['rowsScanned'] += 1
        for number, spec in selected.items():
            matches = [f for f in raw_fields if f.number == number]
            if spec['name'] == 'ReleaseCondition' and len(matches) > 1:
                raise ValueError('Duplicate singular release condition')
            for ordinal, field in enumerate(matches):
                if field.wire_type != 2:
                    raise ValueError('Release condition must be a message')
                condition = decode(field.value, 'ReleaseConditionData', rules)
                if condition.get('_unknownFields'):
                    raise ValueError('Unknown release condition field')
                present = condition.pop('_presentFields')
                refs.append({'table': table, 'model': model, 'rowId': ids[0],
                    'fieldNumber': number, 'fieldName': spec['name'], 'ordinal': ordinal,
                    'condition': condition, 'presentFieldNumbers': present,
                    'typeName': names.get(condition.get('type', 0)),
                    'status': 'release-reference-only-not-honor-acquisition',
                    'rawEvidence': {'topOffset': offset, 'recordSha256': sha(payload),
                        'conditionSha256': sha(field.value), 'fieldOffsetWithinRecord': field.offset}})
                probe['releaseReferenceCount'] += 1
    mission = [r for r in refs if r['typeName'] == 'ReleasedByMission']
    return {'kind': 'gs-mission-release-references', 'references': refs,
            'missionReferences': mission, 'probes': list(probes.values()),
            'typeCounts': dict(Counter(r['typeName'] or 'unknown' for r in refs)),
            'missionReferenceCount': len(mission),
            'missionReferencesWithExplicitParameters': sum(any(k in r['condition'] for k in ('paramA', 'paramB')) for r in mission),
            'limitations': ['Release gates are not rewards.', 'Absent ParamA/ParamB remain absent; no mission IDs are inferred.',
                'Param semantics require client logic or real server responses.']}


def container_receipt(root):
    root = root.resolve()
    documents = root / 'Documents'
    paths = sorted(p for p in root.rglob('*') if p.is_file())
    # Inspect schema only, never preferences, tokens or network hosts.
    db = root / 'Library/HTTPStorages/jp.co.bandainamcoent.BNEI0395/httpstorages.sqlite'
    result = {'kind': 'gs-local-response-search-receipt', 'root': str(root), 'filesInventoried': len(paths),
        'documentFileCount': sum(p.is_relative_to(documents) for p in paths),
        'captureCandidates': [str(p.relative_to(root)) for p in paths if p.suffix.lower() in ('.har', '.saz', '.pcap', '.pcapng', '.pb')
                              or any(k in p.name.lower() for k in ('mission', 'productroute', 'response'))],
        'scope': 'this-container-only-not-all-local-disks', 'contentsRead': 'HTTP SQLite schema only',
        'limits': ['Filenames alone do not prove absence of unnamed or encrypted responses.']}
    if db.exists():
        wal = db.with_name(db.name + '-wal')
        if wal.exists() and wal.stat().st_size:
            result['httpDatabase'] = {'status': 'nonempty-WAL-requires-snapshot-inspection'}
        else:
            connection = sqlite3.connect(db.as_uri() + '?mode=ro&immutable=1', uri=True)
            try:
                rows = list(connection.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"))
            finally:
                connection.close()
            result['httpDatabase'] = {'status': 'read-only-schema-inspected', 'sha256': sha(db.read_bytes()),
                'bytes': db.stat().st_size, 'walBytes': 0,
                'tables': [{'name': n, 'sql': sql} for n, sql in rows]}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', type=Path, default=ROOT / '.analysis/sidem_ios_keyfiles/global-metadata.dat')
    parser.add_argument('--decoded-masterdata', type=Path, default=ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb')
    parser.add_argument('--container', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / '.analysis/honor-acquisition-v1')
    args = parser.parse_args()
    out = args.out.resolve()
    if not out.is_relative_to((ROOT / '.analysis').resolve()) or out == (ROOT / '.analysis').resolve():
        raise ValueError('Output must be an audit subdirectory of this checkout')
    raw = args.decoded_masterdata.read_bytes()
    if sha(raw) != EXPECTED_PB_SHA:
        raise ValueError('Decoded PB baseline mismatch')
    full = json.loads(FULL_SCHEMA.read_bytes())
    compact, proof = verified_schema()
    native = args.metadata.read_bytes()
    enums = extract_enums(native, full)
    refs = release_references(list(iter_top_records(raw)), full, compact, enums)
    source = {'metadataSha256': sha(native), 'decodedPbSha256': sha(raw),
        'compactSchemaSha256': proof['compactSchemaSha256'], 'generatorSha256': sha(Path(__file__).read_bytes())}
    result = {'native_enum_catalog.json': {'kind': 'gs-honor-native-enums', 'enums': enums,
        'limits': ['Enum values are metadata declarations; they do not prove a particular honor source.',
                   'MissionTransitionType is a navigation enum, not a mission achievement condition.']},
        'mission_release_reference_queue.json': refs}
    if args.container:
        result['local_response_search_receipt.json'] = container_receipt(args.container)
    out.mkdir(parents=True, exist_ok=True)
    for name, value in result.items():
        value.update(schemaVersion=1, source=source)
        (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps({'enumTypes': len(enums), 'enumMembers': sum(len(e['members']) for e in enums),
        'releaseReferences': len(refs['references']), 'missionReferences': refs['missionReferenceCount'],
        'missionReferencesWithExplicitParameters': refs['missionReferencesWithExplicitParameters'],
        'outputs': list(result)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
