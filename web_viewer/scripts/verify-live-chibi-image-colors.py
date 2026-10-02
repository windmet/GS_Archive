"""Named RAW image tint controls; preserve malformed source commands without guessing."""
import json
from pathlib import Path
from live_chibi_image_colors import image_color_events

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-image-colors.json').read_text(encoding='utf-8'))
for code, song in fixture['songs'].items():
    header = song['header']
    rows = [header, *[[raw.get(field, '') for field in header] for raw in song['raw']]]
    assert image_color_events(rows) == song['events']
    assert image_color_events([list(reversed(row)) for row in rows]) == song['events']
    if code.startswith('tkstp'):
        assert len(song['events']) == 115
        assert all(not event.get('unresolvedReason') for event in song['events'])
        for changes in [{'time': 'NaN'}, {'value4': '-1'}, {'value1': ''}]:
            raw = dict(song['raw'][0], **changes)
            try:
                image_color_events([header, [raw.get(field, '') for field in header]])
            except ValueError:
                pass
            else:
                raise AssertionError('Invalid interval/target accepted')
    else:
        assert all(event['unresolvedReason'] == 'invalid_image_color_command' for event in song['events'])
assert fixture['songs']['ominut']['events'][0]['color'] == '#727eb10'
assert fixture['songs']['plmask']['events'][0]['asset'] == '#00bfff'
assert fixture['songs']['plmask']['events'][0]['opacity'] == 1200
print('Image color RAW: 230 Take controls, reordered columns and 4 unresolved source commands passed')
