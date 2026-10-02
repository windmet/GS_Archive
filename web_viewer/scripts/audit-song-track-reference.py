#!/usr/bin/env python3
"""Extract native track sprites/constants; record screenshot geometry separately."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import zipfile
import UnityPy

ROOT = Path(__file__).resolve().parents[1]
MEMBER = 'Payload/BNEI0395.app/Data/data.unity3d'
NAMES = {'live_lane_gradation', 'live_lane_gradation_left', 'live_target_line',
         'live_target_line_left', 'live_target_line_right', 'live_target_line_gradation'}
CONSTANTS = {'LaneCount': ('<i', 5), 'NotePosZBaxk': ('<f', 200),
             'NotePosZFront': ('<f', 100), 'TopLaneWidth': ('<f', 21),
             'TargetLaneWidth': ('<f', 880), 'NoteSizeAdjust': ('<i', 312)}

def sha(data): return hashlib.sha256(data).hexdigest()
def encode(value): return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def run(args):
    metadata = args.metadata.read_bytes()
    sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
    import extract_il2cpp_protobuf_schema as native
    _, sections = native.parse_header(metadata)
    strings = native.build_string_reader(metadata, sections['string'])
    types = native.read_records(metadata, sections['type_definitions'], native.TYPE_DEFINITION_FORMAT)
    fields = native.read_records(metadata, sections['fields'], native.FIELD_DEFINITION_FORMAT)
    defaults = {i: (t, pos) for i, t, pos in native.read_records(metadata, sections['field_default_values'], native.FIELD_DEFAULT_FORMAT)}
    matches = [(i, t) for i, t in enumerate(types) if strings(t[0]) == 'RhythmGameDef']
    if len(matches) != 1: raise ValueError('Ambiguous RhythmGameDef')
    index, definition = matches[0]
    constants = {}
    for i in range(definition[8], definition[8] + definition[18]):
        name = strings(fields[i][0])
        if name not in CONSTANTS: continue
        fmt, expected = CONSTANTS[name]
        type_index, relative = defaults[i]
        offset = sections['default_value_data'][0] + relative
        raw = metadata[offset:offset+4]
        value = struct.unpack(fmt, raw)[0]
        if value != expected: raise ValueError(f'Native constant changed: {name}')
        constants[name] = dict(value=value, fieldIndex=i, typeIndex=type_index,
                               byteOffset=offset, relativeOffset=relative, hex=raw.hex())
    if set(constants) != set(CONSTANTS): raise ValueError('Missing native constants')
    with zipfile.ZipFile(args.ipa) as z: binary = z.read(MEMBER)
    env = UnityPy.load(binary)
    pending = {}; sprites = []
    for obj in env.objects:
        if obj.assets_file.name != 'resources.assets' or obj.type.name != 'Sprite': continue
        sprite = obj.read()
        if sprite.m_Name not in NAMES: continue
        tree = obj.read_typetree(); image = sprite.image.convert('RGBA')
        stream = io.BytesIO(); image.save(stream, format='PNG', optimize=True)
        filename = sprite.m_Name + '.png'; data = stream.getvalue()
        if filename in pending: raise ValueError('Duplicate track sprite')
        pending[filename] = data
        sprites.append(dict(name=sprite.m_Name, spritePathId=obj.path_id,
            atlasPathId=tree['m_SpriteAtlas']['m_PathID'], renderDataKey=tree['m_RenderDataKey'],
            file=filename, width=image.width, height=image.height,
            visibleAlphaBounds=image.getchannel('A').getbbox(), pngSha256=sha(data), pixelSha256=sha(image.tobytes())))
    if len(sprites) != 6: raise ValueError('Expected six track sprites')
    note_audit = json.loads((ROOT/'config/song-chart-sprite-audit.v1.json').read_bytes())
    if note_audit['source']['dataSha256'] != sha(binary): raise ValueError('Different note sprite source')
    skins = {}
    for atlas in ['Note1SpriteAtlas', 'Note2SpriteAtlas', 'Note3SpriteAtlas']:
        skins[atlas] = {s['name'].removeprefix('live_notes_'): {k: s[k] for k in ['file', 'width', 'height', 'visibleAlphaBounds']}
                       for s in note_audit['sprites'] if s['atlas'] == atlas and s['name'] in
                       {'live_notes_normal', 'live_notes_swipe_left', 'live_notes_swipe_up', 'live_notes_swipe_right', 'live_notes_hold_line'}}
    result = dict(schemaVersion=1, checkedOn='2026-10-01',
        source=dict(package=args.ipa.name, member=MEMBER, dataSha256=sha(binary), metadataSha256=sha(metadata)),
        nativeClass=dict(name='RhythmGameDef', typeDefinitionIndex=index), constants=constants,
        trackSprites=sorted(sprites, key=lambda s: s['name']), skins=skins,
        screenshotEstimates=dict(viewBox=[1280,720], centerX=640, judgeY=570, topY=8,
            normalVisibleWidth=148, holdWidthRatio=.72, depthRatio=2,
            basis='1920x864 reference: game area x=192..1728; estimated 1.2x UI scale'),
        boundaries=dict(cameraProjection='estimated', meshSize='estimated', holdUv='estimated',
            judgePointRings='vector reconstruction', specialMapping='unverified', runtimeDefaultSkin='unverified', audioSync='unverified'))
    manifest = ROOT/'config/song-track-reference.v1.json'
    if args.check:
        if json.loads(manifest.read_bytes()) != json.loads(encode(result)): raise ValueError('Track audit drift')
        for filename, data in pending.items():
            if (ROOT/'public/assets/song-chart-track'/filename).read_bytes() != data: raise ValueError(filename)
    else:
        manifest.write_bytes(encode(result))
        for filename, data in pending.items():
            target = ROOT/'public/assets/song-chart-track'/filename
            target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    print(f"Track reference {'verified' if args.check else 'extracted'}: six sprites, six native constants; camera/UV remain estimates")

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ipa', type=Path, required=True)
    p.add_argument('--metadata', type=Path, default=ROOT/'.analysis/sidem_ios_keyfiles/global-metadata.dat')
    p.add_argument('--check', action='store_true')
    run(p.parse_args())
