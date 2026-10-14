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
    assert [{key:parse_backmonitor_row(row)[key] for key in expected} for row,expected in zip(fixture['rows'],fixture['events'])] == fixture['events']
assert all(e['rawValue7']==0 for e in fixtures[0]['events'])
print('Backmonitor: zero, sorting-range values and empty controls preserved without alpha semantics')

native=parse_backmonitor_row(['Backmonitor','0','movie','','0','360','1000','1','1100','1250','logo'])
assert native['glowAlpha']==1.1 and native['sortingOrder']==1250 and native['logo']=='logo'
