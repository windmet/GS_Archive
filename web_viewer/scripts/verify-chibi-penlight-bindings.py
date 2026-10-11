#!/usr/bin/env python3
"""Media-free native binding fixture and deliberate PPtr/controller corruption."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

spec = importlib.util.spec_from_file_location('penlight_bindings', Path(__file__).with_name('audit-chibi-penlight-bindings.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
fixture = Path(__file__).with_name('fixtures') / 'chibi-penlight-bindings.json'
source = json.loads(fixture.read_text(encoding='utf8'))
decoded = module.decode_evidence(source)
by_name = {p['name']: p for p in decoded['prefabs']}
assert {name: (p['pairCount'], p['frontMiddleObjCount']) for name, p in by_name.items()} == {
    'LiveObjectPenlight_1': (82, 39), 'LiveObjectPenlight_2': (29, 20)}
for prefab in decoded['prefabs']:
    assert len(prefab['excludedSprites']) == 1
    assert prefab['excludedSprites'][0]['route'].endswith('/Shadow')
assert by_name['LiveObjectPenlight_2']['pairs'][19]['route'].endswith('/Back/02/Penlight')
# Preserve native count=20; hierarchy names are not substituted for this field.
assert by_name['LiveObjectPenlight_2']['frontMiddleObjCount'] == 20
controller = next(iter(decoded['controllers'].values()))
expected = [('Beat1', '1244', True), ('Beat2', '1245', True), ('Beat3', '1246', True),
            ('Yeah1', '1251', False), ('Yeah2', '1252', False), ('Yeah3', '1253', False),
            ('Wiper1', '1247', True), ('Wiper2', '1248', True), ('Wiper3', '1249', True), ('Wiper4', '1250', True)]
assert [(s['name'], s['clip']['pathId'], s['loop']) for s in controller['states']] == expected
# Close the state binding against the independently decoded native curve fixture.
curve_evidence = json.loads((fixture.parent / 'chibi-penlight-streamed-clips.json').read_text(encoding='utf8'))
assert curve_evidence['source'] == source['source']
assert curve_evidence['fullTypedEvidenceSha256'] == source['fullTypedEvidenceSha256']
curve_spec = importlib.util.spec_from_file_location('penlight_curves', Path(__file__).with_name('audit-chibi-streamed-animation.py'))
curves_module = importlib.util.module_from_spec(curve_spec)
curve_spec.loader.exec_module(curves_module)
curves = {clip['name']: clip for c in curve_evidence['animationEvidence'].values()
          for clip in map(curves_module.decode_clip, c['clips'])}
assert set(curves) == {state['name'] for state in controller['states']}
for state_binding in controller['states']:
    clip = curves[state_binding['name']]
    assert state_binding['clip'] == {key: clip[key] for key in ('serializedFile', 'pathId', 'sha256')}
    assert state_binding['duration'] == clip['duration'] and state_binding['loop'] == clip['loop']
if len(sys.argv) > 1:
    full_bytes = Path(sys.argv[1]).read_bytes()
    assert hashlib.sha256(full_bytes).hexdigest() == source['fullTypedEvidenceSha256']
    full = json.loads(full_bytes)
    assert decoded == module.decode_evidence(full), 'Fixture projection differs from full native evidence'


def script(evidence):
    return next(c for c in evidence['prefabs'][0]['components'] if c['type'] == 'MonoBehaviour')


def alter_raw(evidence, change):
    component = script(evidence)
    raw = bytearray.fromhex(component['rawHex'])
    change(raw)
    component.update(rawHex=raw.hex(), bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def state(evidence):
    return next(iter(evidence['animationEvidence'].values()))['typetree']['m_Controller']['m_StateMachineArray'][0]['data']['m_StateConstantArray'][0]['data']


def mutate_controller(evidence, change):
    change(next(iter(evidence['animationEvidence'].values())))


cases = 0
changes = [
    lambda e: script(e).__setitem__('sha256', '0' * 64),
    lambda e: alter_raw(e, lambda b: b.extend(b'\0\0\0\0')),
    lambda e: alter_raw(e, lambda b: struct.pack_into('<i', b, 32, 501)),
    lambda e: alter_raw(e, lambda b: struct.pack_into('<i', b, len(b) - 4, 999)),
    lambda e: alter_raw(e, lambda b: struct.pack_into('<i', b, 36, 1)),
    lambda e: alter_raw(e, lambda b: b.__setitem__(slice(48, 60), b[36:48])),
    # Swap two valid sprite references: both resolve, but index pairing breaks.
    lambda e: alter_raw(e, lambda b: b.__setitem__(slice(36, 60), b[48:60] + b[36:48])),
    lambda e: alter_raw(e, lambda b: struct.pack_into('<q', b, 40, 999999999)),
    lambda e: state(e).__setitem__('m_Speed', 2),
    lambda e: state(e).__setitem__('m_SpeedParamID', 1),
    lambda e: state(e).__setitem__('m_Loop', False),
    lambda e: state(e).__setitem__('m_NameID', 0),
    lambda e: state(e)['m_BlendTreeConstantArray'][0]['data']['m_NodeArray'][0]['data'].__setitem__('m_ClipID', 9),
    lambda e: state(e)['m_BlendTreeConstantArray'][0]['data']['m_NodeArray'][0]['data'].__setitem__('m_ClipID', 10),
    lambda e: mutate_controller(e, lambda c: c['typetree']['m_AnimationClips'][0].__setitem__('m_FileID', 1)),
    lambda e: mutate_controller(e, lambda c: c['typetree']['m_Controller']['m_StateMachineArray'][0]['data']['m_StateConstantArray'].pop()),
    lambda e: e['animationEvidence'].clear(),
    lambda e: e['prefabs'].append(copy.deepcopy(e['prefabs'][0])),
]
for change in changes:
    invalid = copy.deepcopy(source)
    change(invalid)
    try:
        module.decode_evidence(invalid)
    except ValueError:
        cases += 1
    else:
        raise AssertionError(f'Corruption case {cases + 1} accepted')
print(json.dumps({'status': 'pass_native_bindings_not_render_acceptance', 'prefabs': 2,
                  'pairs': 111, 'states': 10, 'corruptionCasesRejected': cases,
                  'fullEvidenceCompared': len(sys.argv) > 1}))
