#!/usr/bin/env python3
"""Portable native source witness and color-replacement regression, without RAW."""
import copy
import json
from pathlib import Path
import sys

from live_chibi_costume_shader import shade_pixel, serialized_color_defaults, validate_evidence


fixture = json.loads((Path(__file__).parent / 'fixtures/chibi-costume-shader.json').read_text(encoding='utf8'))
assert validate_evidence(fixture) == fixture['contract']
if len(sys.argv) > 1:
    full = json.loads(Path(sys.argv[1]).read_text(encoding='utf8'))
    assert full == fixture, 'Re-extracted native material/shader evidence differs'

def close(actual, expected):
    assert len(actual) == len(expected) and all(abs(a-b) < 1e-12 for a, b in zip(actual, expected)), (actual, expected)

# These hand-derived pixel witnesses distinguish replacement from tint multiply.
tex = [.2, .1, .05, .5]
neutral = [0, 0, 0, 0]
white = [1, 1, 1, 1]
close(shade_pixel(tex, white, 10, .5, neutral, neutral, neutral), tex)
close(shade_pixel(tex, white, 0, .5, [1, 0, 0, .5], neutral, neutral), [.35, .05, .025, .5])
close(shade_pixel(tex, white, 0, .5, [1, 0, 0, .5], [0, 0, 1, .5], neutral), [.175, .025, .2625, .5])
# Both gradient color AND alpha interpolate in native local mesh Y.
close(shade_pixel(tex, white, 1, .5, neutral, [1, 0, 0, 1], [0, 0, 1, 0]), [.225, .05, .15, .5])
close(shade_pixel(tex, white, -100, .5, neutral, [1, 0, 0, 1], neutral), [.5, 0, 0, .5])
close(shade_pixel(tex, white, 100, .5, neutral, [1, 0, 0, 1], neutral), tex)
close(shade_pixel(tex, [.5, 1, .25, .4], 0, .5, [1, 0, 0, .5], neutral, neutral), [.175, .05, .00625, .2])
close(shade_pixel([0, 0, 0, 0], white, 1, .5, white, white, white), [0, 0, 0, 0])
# Blindly applying serialized white defaults washes the atlas white. Runtime input
# mapping must be established before using these defaults in the Web renderer.
close(shade_pixel(tex, white, 1, .5, white, white, white), [.5, .5, .5, .5])
assert serialized_color_defaults(fixture['materials'][1], fixture['shader'])['_BodyColor'] == {
    'value': [1, 1, 1, 1], 'origin': 'shader_default'}
assert serialized_color_defaults(fixture['materials'][0], fixture['shader'])['_BodyColor']['origin'] == 'material'
assert all(not r['hasCosTexture'] and not r['hasCosAtlas'] and r['hasComuTexture'] for r in fixture['unavailable'])

def rejected(change):
    value = copy.deepcopy(fixture)
    change(value)
    try:
        validate_evidence(value)
    except ValueError:
        return
    raise AssertionError('Invalid native shader evidence accepted')

for change in [
    lambda e: e['materials'][0]['shaderPointer'].update(m_FileID=0),
    lambda e: e['materials'][0]['shaderPointer'].update(m_FileID=2),
    lambda e: e['materials'][0]['externals'].__setitem__(0, 'archive:/wrong/wrong'),
    lambda e: e['materials'][0]['texturePointer'].update(m_PathID=0),
    lambda e: e['materials'][0].update(straightAlphaInput=1),
    lambda e: e['shader']['blend'].update(src=5),
    lambda e: e['shader'].update(vertex=e['shader']['vertex'].replace('in_POSITION0.xy;', 'in_TEXCOORD0.xy;')),
    lambda e: e['shader'].update(fragment=e['shader']['fragment'].replace('_BodyColor.www', '_BodyColor.xxx')),
    lambda e: e['materials'].append(copy.deepcopy(e['materials'][0])),
]:
    rejected(change)

print(json.dumps({'status': 'pass_native_shader_contract_not_web_or_video_acceptance',
                  'materials': 3, 'pixelWitnesses': 9, 'fullEvidenceCompared': len(sys.argv) > 1}))
