#!/usr/bin/env python3
"""Portable render-input contracts; optional full RAW/export closure checks."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys

from live_chibi_penlight import penlight_render_model


fixture = Path(__file__).parent / 'fixtures/chibi-penlight-render-inputs.json'
source = json.loads(fixture.read_text(encoding='utf8'))
model = penlight_render_model(source)
prefabs = {p['name']: p for p in model['prefabs']}
assert {k: len(p['actors']) for k, p in prefabs.items()} == {'LiveObjectPenlight_1': 82, 'LiveObjectPenlight_2': 29}
assert {k: p['frontMiddleObjCount'] for k, p in prefabs.items()} == {'LiveObjectPenlight_1': 39, 'LiveObjectPenlight_2': 20}
assert prefabs['LiveObjectPenlight_2']['actors'][19]['route'].endswith('/Back/02/Penlight')
for prefab in prefabs.values():
    nodes = {n['route']: n for n in prefab['nodes']}
    assert len(nodes) == len(prefab['nodes'])
    for node in nodes.values():
        assert node['parent'] is None or node['parent'] in nodes
    for actor in prefab['actors']:
        assert actor['route'] in nodes
        parent = nodes[nodes[actor['route']]['parent']]
        assert parent['scale']['x'] in (0.20000000298023224, 0.25, 0.3499999940395355, 0.41999998688697815)
        # Child is the animated Transform; its placement/rotation belongs to its parent.
        assert nodes[actor['route']]['position'] == {'x': 0, 'y': 0, 'z': 0}
    assert len(prefab['shadows']) == 1
front = next(n for n in prefabs['LiveObjectPenlight_1']['nodes'] if n['route'].endswith('/Front/01'))
assert front['position'] == {'x': 8.510000228881836, 'y': -3.7400002479553223, 'z': 7.059999942779541}
assert front['rotation']['z'] < 0  # Preserve quaternion sign; no center-pivot replacement.
assert {(s['name'], len(s['positions']), len(s['indices'])) for s in model['sprites'].values()} == {
    ('Penlight1', 69, 201), ('Penlight2', 69, 201), ('Shadow', 4, 6)}
for sprite in model['sprites'].values():
    if sprite['name'].startswith('Penlight'):
        assert sprite['pivot'] == {'x': 0.5, 'y': 0}
        assert sprite['rect']['width'] == 512
        assert sprite['textureRect']['width'] < sprite['rect']['width']
        assert sprite['textureRectOffset']['x'] > 0
        assert sprite['uvTransform'] == {'x': 100, 'y': 256, 'z': 100, 'w': 0}
assert len(model['clips']) == 10
assert 'camera and stage coordinate projection' in model['unresolved']
assert model['status'] == 'native_render_inputs_not_csv_or_camera_equivalence'

# Array order controls actor identity; hierarchy traversal order must not.
reordered = copy.deepcopy(source)
def reverse(node):
    node['children'].reverse()
    node['components'].reverse()
    for child in node['children']:
        reverse(child)
for root in reordered['prefabs']:
    reverse(root)
assert penlight_render_model(reordered) == model

def transform(e):
    return next(c for c in e['prefabs'][0]['components'] if c['type'] == 'Transform')

def geometry(e):
    return e['spriteEvidence']['resources.assets:1838']['typetree']

def renderer(e):
    node = e['prefabs'][0]
    while not any(c['type'] == 'SpriteRenderer' for c in node['components']):
        node = node['children'][0]
    return next(c for c in node['components'] if c['type'] == 'SpriteRenderer')

def bad_vertex(e):
    v = geometry(e)['m_RD']['m_VertexData']['m_DataSize']
    b = bytearray.fromhex(v['bytesHex'])
    struct.pack_into('<f', b, 0, float('nan'))
    v['bytesHex'] = b.hex()

changes = [
    lambda e: e.pop('spriteEvidence'),
    lambda e: transform(e)['position'].update(x=float('nan')),
    lambda e: transform(e)['scale'].update(z=float('inf')),
    lambda e: transform(e)['rotation'].update(w=0.7),
    lambda e: transform(e)['position'].pop('z'),
    lambda e: transform(e).update(serializedFile='other.assets'),
    lambda e: e['prefabs'][0]['components'].append(copy.deepcopy(transform(e))),
    lambda e: geometry(e)['m_RD'].update(settingsRaw=65),
    lambda e: geometry(e)['m_RD']['texture'].update(m_FileID=1),
    lambda e: geometry(e)['m_RD']['texture'].update(m_PathID=493),
    lambda e: geometry(e)['m_Pivot'].update(y=0.5),
    lambda e: geometry(e).update(m_PixelsToUnits=float('nan')),
    lambda e: geometry(e)['m_RD']['m_VertexData']['m_Channels'][0].update(format=1),
    lambda e: geometry(e)['m_RD']['m_VertexData'].update(m_VertexCount=68),
    lambda e: geometry(e)['m_RD']['m_IndexBuffer'].__setitem__(0, 255),
    lambda e: geometry(e)['m_RD']['m_SubMeshes'][0].update(indexCount=198),
    bad_vertex,
    lambda e: renderer(e)['materials'][0].update(shader='ohashi/SimpleAdd'),
]
for edit in changes:
    invalid = copy.deepcopy(source)
    edit(invalid)
    try:
        penlight_render_model(invalid)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid native render inputs accepted')

if len(sys.argv) > 1:
    raw = Path(sys.argv[1]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source['fullTypedEvidenceSha256']
    assert penlight_render_model(json.loads(raw)) == model
if len(sys.argv) > 2:
    root = Path(sys.argv[2])
    exported = json.loads((root / 'index.json').read_text(encoding='utf8'))
    assert exported.pop('typedEvidenceSha256') == source['fullTypedEvidenceSha256']
    textures = exported.pop('textures')
    assert exported == model
    assert len(textures) == 3
    for key, texture in textures.items():
        assert key == texture['source']['serializedFile'] + ':' + texture['source']['pathId']
        assert hashlib.sha256((root / texture['file']).read_bytes()).hexdigest() == texture['pngSha256']
print(f'Penlight hierarchy/mesh/pivot/clip closure, reorder and {len(changes)} corruption checks passed')
