import copy
import json
from pathlib import Path
from live_chibi_image_objects import image_object_events

fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-take-image-objects.json').read_text(encoding='utf-8'))
for code, raw in fixture['raw'].items():
    header = raw['header']
    rows = [header, *[[event.get(field, '') for field in header] for event in raw['events']]]
    expected = fixture['index']['songs'][code + '_live_effect']['events']
    assert image_object_events(rows) == expected
    # Controls are named fields even when a CSV producer changes column ordering.
    assert image_object_events([list(reversed(row)) for row in rows]) == expected
    assert len(expected) == 24
    assert len([e for e in expected if e['type'] == 'create']) == 8
    assert len([e for e in expected if e['type'] == 'hide']) == 8
    invalid = copy.deepcopy(rows)
    invalid[1][header.index('value1')] = ''
    try:
        image_object_events(invalid)
    except ValueError:
        pass
    else:
        raise AssertionError('Missing identity must not map to an arbitrary object')
print('ImageObject RAW fixtures: both exact pilots, stable order and named hide fields passed')
