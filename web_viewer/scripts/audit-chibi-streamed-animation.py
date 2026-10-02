#!/usr/bin/env python3
"""Decode native root Transform streamed curves into inspectable evidence.

Input is the typed evidence from audit-chibi-light-resources.py. This does not
infer RAW animation IDs, publish assets, or claim Unity Animator equivalence.
Format reference: AssetStudio/Classes/AnimationClip.cs (StreamedClip/FindBinding).
"""
from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import math
from pathlib import Path
import struct

FLOAT_MIN = -struct.unpack('<f', struct.pack('<I', 0x7f7fffff))[0]
CHANNELS = {1: ('position', 'xyz'), 3: ('scale', 'xyz'), 4: ('eulerDegrees', 'xyz')}
FORMAT_SOURCE = 'https://github.com/Perfare/AssetStudio/blob/master/AssetStudio/Classes/AnimationClip.cs'


def decode_stream(words, curve_count):
    if type(curve_count) is not int or not 0 < curve_count <= 10000:
        raise ValueError('Invalid streamed curve count')
    if not isinstance(words, list) or not 0 < len(words) <= 1000000:
        raise ValueError('Invalid stream size')
    if any(type(w) is not int or not 0 <= w <= 0xffffffff for w in words):
        raise ValueError('Stream data must be uint32 words')
    raw = struct.pack('<' + 'I' * len(words), *words)
    curves = [{'index': i, 'initialValue': None, 'keys': []} for i in range(curve_count)]
    offset, frame_count, previous, terminal = 0, 0, None, False
    while offset < len(raw):
        if len(raw) - offset < 8:
            raise ValueError('Truncated streamed frame')
        time, count = struct.unpack_from('<fi', raw, offset)
        offset += 8
        if count < 0 or count > curve_count or offset + count * 20 > len(raw):
            raise ValueError('Invalid streamed key count or truncated keys')
        if time == math.inf:
            if count or offset != len(raw) or frame_count < 2:
                raise ValueError('Invalid terminal frame')
            terminal = True
            break
        if (frame_count == 0 and time != FLOAT_MIN) or (frame_count and (not math.isfinite(time) or time < 0)):
            raise ValueError('Missing initial sentinel or invalid key time')
        if previous is not None and time <= previous:
            raise ValueError('Streamed frame times must increase')
        seen = set()
        for _ in range(count):
            index, *coeff = struct.unpack_from('<i4f', raw, offset)
            offset += 20
            if not 0 <= index < curve_count or index in seen:
                raise ValueError('Invalid or duplicate streamed curve index')
            if not all(math.isfinite(v) for v in coeff):
                raise ValueError('Nonfinite streamed coefficient')
            seen.add(index)
            if frame_count == 0:
                if any(coeff[:3]):
                    raise ValueError('Initial sentinel has interpolated coefficients')
                curves[index]['initialValue'] = coeff[3]
            else:
                curves[index]['keys'].append({'time': time, 'coefficients': coeff})
        if frame_count == 0 and len(seen) != curve_count:
            raise ValueError('Initial sentinel does not cover every curve')
        frame_count += 1
        previous = time
    if not terminal:
        raise ValueError('Missing terminal frame')
    return curves, {'frames': frame_count, 'bytes': len(raw),
                    'sha256': hashlib.sha256(raw).hexdigest()}


def polynomial(coefficients, elapsed):
    a, b, c, d = coefficients
    return ((a * elapsed + b) * elapsed + c) * elapsed + d


def sample_curve(curve, seconds):
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError('Invalid sample time')
    keys = curve['keys']
    index = bisect.bisect_right([key['time'] for key in keys], seconds) - 1
    if index < 0:
        return curve['initialValue']
    key = keys[index]
    return polynomial(key['coefficients'], seconds - key['time'])


def decode_clip(clip):
    tree = clip['typetree']
    muscle = tree['m_MuscleClip']
    data = muscle['m_Clip']['data']
    if data['m_DenseClip']['m_CurveCount'] or data['m_DenseClip']['m_SampleArray'] or data['m_ConstantClip']['data']:
        raise ValueError('Dense/constant curves unsupported; refusing partial export')
    if any(tree.get(k) for k in ('m_RotationCurves', 'm_CompressedRotationCurves', 'm_EulerCurves',
            'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves', 'm_Events')):
        raise ValueError('Legacy curves/events unsupported; refusing partial export')
    if tree['m_Legacy'] or tree['m_Compressed']:
        raise ValueError('Legacy/compressed clip unsupported')
    binding = tree['m_ClipBindingConstant']
    if binding['pptrCurveMapping']:
        raise ValueError('Object reference curves unsupported')
    channel_names = []
    for b in binding['genericBindings']:
        if b['path'] != 0 or b['typeID'] != 4 or b['isPPtrCurve'] or b['attribute'] not in CHANNELS:
            raise ValueError('Only root position/scale/Euler Transform bindings supported')
        if b['script']['m_FileID'] or b['script']['m_PathID']:
            raise ValueError('Script bindings unsupported')
        # Unity's customType=4 marks the Euler binding; no arbitrary custom types.
        if b['customType'] != (4 if b['attribute'] == 4 else 0):
            raise ValueError('Unsupported custom binding type')
        group, axes = CHANNELS[b['attribute']]
        channel_names.extend(group + '.' + axis for axis in axes)
    if len(set(channel_names)) != len(channel_names):
        raise ValueError('Duplicate Transform binding')
    stream = data['m_StreamedClip']
    if len(channel_names) != stream['curveCount']:
        raise ValueError('Binding and streamed curve counts differ')
    curves, receipt = decode_stream(stream['data'], stream['curveCount'])
    start, stop = muscle['m_StartTime'], muscle['m_StopTime']
    if not all(math.isfinite(v) for v in (start, stop)) or start != 0 or stop <= start:
        raise ValueError('Unsupported clip time range')
    endpoint_checks, step_intervals, worst_error = 0, 0, 0
    for curve, channel in zip(curves, channel_names):
        curve['channel'] = channel
        if any(k['time'] > stop + 1e-6 for k in curve['keys']):
            raise ValueError('Curve key exceeds clip duration')
        for current, following in zip(curve['keys'], curve['keys'][1:]):
            if current['coefficients'][:3] == [0, 0, 0]:
                step_intervals += 1
                continue
            actual = polynomial(current['coefficients'], following['time'] - current['time'])
            expected = following['coefficients'][3]
            error = abs(actual - expected)
            worst_error = max(worst_error, error)
            if error > 2e-4 * max(1, abs(expected)):
                raise ValueError(f'Curve endpoint mismatch: {channel} at {following["time"]}: {error}')
            endpoint_checks += 1
    # Numerical ranges are evidence, not semantic validation of an Animator.
    ranges = {}
    for curve in curves:
        values = [sample_curve(curve, stop * i / 1000) for i in range(1001)]
        ranges[curve['channel']] = {'min': min(values), 'max': max(values)}
    return {k: clip[k] for k in ('serializedFile', 'pathId', 'bytes', 'sha256')} | {
        'name': tree['m_Name'], 'duration': stop, 'loop': muscle['m_LoopTime'],
        'stream': receipt, 'curves': curves,
        'validation': {'continuousEndpoints': endpoint_checks, 'stepIntervals': step_intervals,
                       'maxEndpointError': worst_error, 'sampledRanges': ranges}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-file', type=Path, required=True)
    parser.add_argument('--output-file', type=Path, required=True)
    args = parser.parse_args()
    if args.input_file.resolve() == args.output_file.resolve():
        raise ValueError('Evidence input cannot be overwritten')
    source_bytes = args.input_file.read_bytes()
    evidence = json.loads(source_bytes)
    if evidence.get('status') != 'typed_resource_evidence_only' or not evidence.get('animationEvidence'):
        raise ValueError('Typed native animation evidence required')
    controllers = []
    for key, controller in evidence['animationEvidence'].items():
        controllers.append({'evidenceKey': key, 'name': controller['name'],
                            'clips': [decode_clip(c) for c in controller['clips']]})
    output = {'schemaVersion': 1, 'status': 'decoded_native_curves_not_raw_mapping',
              'formatSource': FORMAT_SOURCE, 'inputSha256': hashlib.sha256(source_bytes).hexdigest(),
              'source': evidence['source'], 'controllers': controllers}
    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({'controllers': len(controllers), 'clips': sum(len(c['clips']) for c in controllers),
                      'output': str(args.output_file)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
