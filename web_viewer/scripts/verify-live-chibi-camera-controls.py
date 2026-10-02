"""Named erase fields, including reordered CSVs and comment traps."""
import copy
import json
from pathlib import Path
from live_chibi_camera_controls import camera_controls

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-camera-controls.json').read_text(encoding='utf-8'))
for code, song in fixture['songs'].items():
    rows = [song['header'], *song['raw']]
    expected = [{key: e[key] for key in ('time', 'reset', 'resetDuration')} for e in song['events']]
    assert camera_controls(rows) == expected
    assert camera_controls([list(reversed(row)) for row in rows]) == expected
study = fixture['songs']['steqmg']
assert next(e for e in study['events'] if e['time'] == 32100)['reset'] is True
assert next(e for e in study['events'] if e['time'] == 32100)['resetDuration'] == 1
header = study['header']
row = list(next(r for r in study['raw'] if r[1] == '32100'))
row[header.index('value101')] = ''
row[header.index('コメント')] = '1'
assert camera_controls([header, row])[0]['reset'] is False
for key, value in [('time', 'NaN'), ('time', '1.2'), ('value101', '2'), ('value102', '-1'), ('value102', 'Infinity')]:
    row = list(next(r for r in study['raw'] if r[1] == '32100'))
    row[header.index(key)] = value
    try:
        camera_controls([header, row])
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid camera field accepted: ' + key)
for broken in [header + ['value101'], ['x' if h == 'time' else h for h in header]]:
    try:
        camera_controls([broken])
    except ValueError:
        pass
    else:
        raise AssertionError('Ambiguous/missing camera header accepted')
print('Actual Study/Take Camera erase controls, reordered fields, comment trap and invalid inputs passed')
