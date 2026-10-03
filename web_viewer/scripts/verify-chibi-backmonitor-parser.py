from live_chibi_backmonitor import parse_backmonitor_row
import json
from pathlib import Path

for value in ('0', '500', '1000', '1100', ''):
    event = parse_backmonitor_row(['Backmonitor', '-2000', 'movie', '', '-100', '270', '1800', '0', value])
    assert event['rawValue7'] == (float(value) if value else None)
    assert 'opacity' not in event and 'rotation' not in event
    assert event['time'] == -2000 and event['x'] == -100
assert parse_backmonitor_row(['Backmonitor']) is None
assert parse_backmonitor_row(['Backmonitor', '', '', '', '', '', '', '', '']) is None
assert parse_backmonitor_row(['Backmonitor', 'invalid', '', '', '', '', '', '', '']) is None
fixtures=json.loads(Path(__file__).with_name('fixtures').joinpath('chibi-backmonitor-apertures.json').read_text(encoding='utf-8'))
for fixture in fixtures:
    assert [parse_backmonitor_row(row) for row in fixture['rows']] == fixture['events']
assert all(e['rawValue7']==0 for e in fixtures[0]['events'])
print('Backmonitor: zero, sorting-range values and empty controls preserved without alpha semantics')
