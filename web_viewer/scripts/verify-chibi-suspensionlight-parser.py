"""No Unity dependency: check unsorted source rows and distant erase columns."""
import csv
import io
import json
import copy
from pathlib import Path
from live_chibi_suspensionlight import suspensionlight_events, suspensionlight_model

buffer = io.StringIO()
writer = csv.writer(buffer)
writer.writerow(['type', 'time'] + [f'value{i}' for i in range(1, 103)])
def row(command, time, values):
    writer.writerow([command, time] + [values.get(i, '') for i in range(1, 103)])
row('NewSuspensionlight_normal_show', 200, {1: 17, 2: 0, 3: 2000, 6: 99999})
row('NewSuspensionlight_create', 100, {1: 17, 2: 'new_suspension_light_sample'})
row('NewSuspensionlight_create', 200, {1: 17, 101: 1, 102: 1})
row('NewSuspensionlight_unknown_variant', 300, {1: 17, 2: 'raw argument'})
row('#NewSuspensionlight_create', 0, {1: 999})
events = suspensionlight_events(buffer.getvalue().encode())
assert [e['sourceRow'] for e in events] == [3, 2, 4, 5]
assert events[2]['erase'] and not events[0]['erase']
assert events[3]['command'] == 'NewSuspensionlight_unknown_variant'
assert events[3]['values'][1] == 'raw argument'
assert events[2]['extraValues'] == {'value101': '1', 'value102': '1'}
prefab = json.loads(Path(__file__).with_name('fixtures').joinpath('chibi-new-suspension-prefab.json').read_text(encoding='utf-8'))
model = suspensionlight_model(prefab)
assert model['layers'][0]['rendererPathId'] == '55421'
assert model['layers'][0]['spritePathId'] == '2580'
assert model['layers'][0]['texturePathId'] == '834'
broken = copy.deepcopy(prefab)
script = next(c for c in broken['components'] if c.get('scriptClass') == 'LiveObjectNewSuspensionLight')
script['rawHex'] = '00' + script['rawHex'][2:-2] + '01'
try:
    suspensionlight_model(broken)
except ValueError:
    pass
else:
    raise AssertionError('Changed serialized PPtr evidence was accepted')
print('PASS suspension RAW parser: stable time/source order, erase flags, unknown commands, commented rows')
