"""Source fixture and named performer-color parsing regressions; no Unity runtime needed."""
import json
from pathlib import Path
from live_chibi_body_colors import body_color_events

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-take-body-colors.json').read_text(encoding='utf-8'))
for song in fixture['songs'].values():
    header = song['header']
    rows = [header, *[[str(event.get(field, '')) for field in header] for event in song['raw']]]
    mapping = {entry['performerSlot']: entry['stagePosition'] for entry in song['stagePositionMap']}
    assert body_color_events(rows, mapping) == song['events']
    assert body_color_events([list(reversed(row)) for row in rows], mapping) == song['events']
    assert len(song['events']) == 69
    assert mapping[1] == 3 and mapping[5] == 5
    for changes in [{'value1': '0'}, {'value1': '6'}, {'time': 'NaN'},
                    {'value2': 'white'}, {'value3': '1001'}, {'value4': '-1'}]:
        bad = dict(song['raw'][0], **changes)
        try:
            body_color_events([header, [str(bad.get(field, '')) for field in header]], mapping)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid body-color target accepted: ' + str(changes))
    commented = dict(song['raw'][0], type='#Livechara_body_color')
    assert body_color_events([header, [str(commented.get(field, '')) for field in header]], mapping) == []
print('Body color RAW: both 69-command Take fixtures, named controls, performer maps and rejection contracts passed')
