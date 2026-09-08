"""RAW transport/domain rules without Unity installation or candidate writes."""
import copy
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'data_pipeline'))
# Import pure APIs while making the heavyweight dependency unavailable.
with patch.dict(sys.modules, {'UnityPy': None}):
    from sidem_raw import group_scenario_assets, extract_text_asset_records, relink_voices_from_raw_cues
    import extract_raw_story_candidate as legacy
assert legacy.group_scenario_assets is group_scenario_assets
assert legacy.extract_text_asset_records is extract_text_asset_records

class Asset:
    def __init__(self, name, script, path_id, kind='TextAsset'):
        self.data = SimpleNamespace(m_Name=name, m_Script=script)
        self.path_id = path_id
        self.type = SimpleNamespace(name=kind)
    def read(self):
        assert self.type.name == 'TextAsset'
        return self.data

environment = SimpleNamespace(container={
    'assets\\story\\group\\scenario_group_b.json': Asset('scenario_group_b', b'{"Command":[]}', 2),
    'assets/story/group/scenario_group_a.json': Asset('scenario_group_a', '\ufeff{"Command":[]}', 1),
    'assets/texture': Asset('ignored', '', 99, 'Texture2D'),
})
opened = []
def load(path):
    opened.append(path)
    return environment
records = extract_text_asset_records(Path('fixture.bundle'), load_bundle=load)
assert opened == ['fixture.bundle']
assert [record['path_id'] for record in records] == [1, 2]
assert all('\\' not in record['container_path'] for record in records)
assert records[0]['payload'].startswith(b'\xef\xbb\xbf')
before = copy.deepcopy(records)
groups, excluded = group_scenario_assets(records)
assert records == before and not excluded
assert list(groups) == ['group']
assert [item['part_id'] for item in groups['group']['items']] == ['group_a', 'group_b']
assert group_scenario_assets(list(reversed(records))) == (groups, excluded)
for payload, name, reason in [(b'{', 'scenario_bad', 'invalid_json'),
                              (b'\xff', 'scenario_bad', 'invalid_json'),
                              (b'{}', 'settings', 'non_scenario_name')]:
    result, rejected = group_scenario_assets([{'name': name, 'payload': payload, 'container_path': 'assets/other/x', 'path_id': 3}])
    assert not result and rejected[0]['reason'] == reason and rejected[0]['path_id'] == 3
try:
    group_scenario_assets([*records, *[{**record, 'container_path': record['container_path'].replace('assets/', 'duplicate/')} for record in records]])
except ValueError as error:
    assert 'duplicate semantic scenario id' in str(error)
else:
    raise AssertionError('semantic collisions must fail')

scenario = {'steps': [
    {'evidence': {'source_part_id': 'a'}, 'dialogue': {'voice': voice}}
    for voice in ['exact.m4a', 'a1000.m4a', 'a2000.m4a', 'missing.m4a']
]}
audio = [{'part_id': 'a', 'cues': ['exact', 'prefix_a1000', 'one_a2000', 'two_a2000']},
         {'part_id': 'b', 'cues': ['other_a1000']}]
audio_before = copy.deepcopy(audio)
stats = relink_voices_from_raw_cues(scenario, audio)
assert stats == {'references': 4, 'resolved': 2, 'unresolved': 1, 'ambiguous': 1}
assert [step['dialogue']['voice'] for step in scenario['steps']] == ['exact.m4a', 'prefix_a1000.m4a', 'a2000.m4a', 'missing.m4a']
assert audio == audio_before
print('RAW boundaries: lazy dependency, transport provenance, grouping/order/collisions, invalid bytes and part-scoped voice ambiguity passed')
