#!/usr/bin/env python3
"""Independent polynomial witnesses and fail-closed native curve decoding."""
import copy
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

spec = importlib.util.spec_from_file_location('streamed_animation', Path(__file__).with_name('audit-chibi-streamed-animation.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def words(frames):
    raw = b''.join(struct.pack('<fi', time, len(keys)) + b''.join(
        struct.pack('<i4f', index, *coeff) for index, coeff in keys) for time, keys in frames)
    return list(struct.unpack('<' + 'I' * (len(raw) // 4), raw))


def rejects(function, *args):
    try:
        function(*args)
    except ValueError:
        return
    raise AssertionError('Malformed or unsupported data was accepted')


# Analytic smoothstep: x=2+3t^2-2t^3, and an independent stepped channel.
frames = [(module.FLOAT_MIN, [(0, (0, 0, 0, 2)), (1, (0, 0, 0, -1))]),
          (0, [(0, (-2, 3, 0, 2)), (1, (0, 0, 0, -1))]),
          (1, [(0, (0, 0, 0, 3)), (1, (0, 0, 0, 5))]), (math.inf, [])]
curves, receipt = module.decode_stream(words(frames), 2)
assert receipt['frames'] == 3
for t, expected in ((0, 2), (.25, 2.15625), (.5, 2.5), (.75, 2.84375), (1, 3), (4, 3)):
    assert module.sample_curve(curves[0], t) == expected
assert module.sample_curve(curves[1], .999) == -1
assert module.sample_curve(curves[1], 1) == 5
# Sparse curve frames must retain their own key origin, not the previous frame.
sparse = [(module.FLOAT_MIN, [(0, (0, 0, 0, 10)), (1, (0, 0, 0, 1))]),
          (0, [(0, (0, 0, 2, 10))]), (.5, [(1, (0, 0, 0, 2))]),
          (1, [(0, (0, 0, 0, 12))]), (math.inf, [])]
sparse_curves, _ = module.decode_stream(words(sparse), 2)
assert module.sample_curve(sparse_curves[0], .75) == 11.5
assert module.sample_curve(sparse_curves[1], .25) == 1
for t in (-1, math.nan, math.inf):
    rejects(module.sample_curve, curves[0], t)
for invalid in ([], [0], words(frames)[:-1], words(frames[:-1]), [-1], [2**32], [True]):
    rejects(module.decode_stream, invalid, 2)
for bad_frames in (
        frames[1:],
        [(module.FLOAT_MIN, [(0, (0, 0, 0, 2))])] + frames[1:],
        frames[:1] + [(.5, [(0, (0, 0, 0, 2)), (0, (0, 0, 0, 2))])] + frames[2:],
        frames[:1] + [(0, [(2, (0, 0, 0, 2))])] + frames[2:],
        frames[:1] + [(0, [(0, (math.nan, 0, 0, 2))])] + frames[2:],
        frames[:1] + [(1.5, [])] + frames[2:],
        frames[:-1] + [(math.inf, [(0, (0, 0, 0, 3))])],
        frames + [(2, [])]):
    rejects(module.decode_stream, words(bad_frames), 2)

def verify_native(path):
    evidence = json.loads(Path(path).read_text(encoding='utf-8'))
    controller = next(iter(evidence['animationEvidence'].values()))
    decoded = {c['name']: c for c in map(module.decode_clip, controller['clips'])}
    assert set(decoded) == {'Beat1', 'Beat2', 'Beat3', 'Yeah1', 'Yeah2', 'Yeah3', 'Wiper1', 'Wiper2', 'Wiper3', 'Wiper4'}
    assert all(c['stream']['bytes'] and c['validation']['maxEndpointError'] < 1e-4 for c in decoded.values())
    # Observed native authoring keys, checked independently of the cubic sampler.
    wiper = {c['channel']: c for c in decoded['Wiper1']['curves']}
    assert abs(module.sample_curve(wiper['position.x'], .25) - 1.5) < 1e-6
    assert abs(module.sample_curve(wiper['position.y'], .25) + .3) < 1e-6
    assert abs(module.sample_curve(wiper['eulerDegrees.z'], .25) + 20) < 1e-6
    assert decoded['Yeah2']['loop'] is False and decoded['Wiper1']['loop'] is True
    native = controller['clips'][0]
    for mutate in (
            lambda t: t['m_ClipBindingConstant']['genericBindings'][0].update(path=1),
            lambda t: t['m_ClipBindingConstant']['genericBindings'][0].update(typeID=114),
            lambda t: t['m_ClipBindingConstant']['genericBindings'][0].update(customType=1),
            lambda t: t['m_MuscleClip']['m_Clip']['data']['m_DenseClip'].update(m_CurveCount=1),
            lambda t: t['m_MuscleClip']['m_Clip']['data']['m_ConstantClip'].update(data=[1]),
            lambda t: t.update(m_Events=[{}]),
            lambda t: t['m_MuscleClip'].update(m_StartTime=1)):
        bad = copy.deepcopy(native)
        mutate(bad['typetree'])
        rejects(module.decode_clip, bad)
    # Corrupt a known constant x segment into t^3: its following x=0 key
    # contradicts the polynomial. The endpoint validator must reject it.
    bad = copy.deepcopy(native)
    stream = bad['typetree']['m_MuscleClip']['m_Clip']['data']['m_StreamedClip']
    assert stream['data'][34] == 0  # first real frame, x curve index
    stream['data'][35] = 0x3f800000
    rejects(module.decode_clip, bad)
    print(f'Native Penlight: {len(decoded)} clips, ' + str(sum(c['validation']['continuousEndpoints'] for c in decoded.values())) + ' continuous endpoints checked')


verify_native(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('fixtures') / 'chibi-penlight-streamed-clips.json')
print('Streamed animation: analytic cubic/step/sparse witnesses and malformed input checks passed')
