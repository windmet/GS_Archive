"""Read the pinned IPA panel and execute the native ARM64 coordinate function.

Math.Min/Lerp and two settings getters are explicit controlled stubs. The native
coordinate function, including its rational curve and HFA return, is executed.
This is a coordinate contract, not a Unity renderer or device equivalence test.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
GEOMETRY = ROOT / 'config/song-track-native-geometry.v1.json'
FIXTURE = ROOT / 'scripts/fixtures/song-track-native-projection.json'
ELF_SHA = '9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
DATA_SHA = 'fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a'
PB_SHA = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'
METADATA_SHA = 'dc257cb9aaa706915fad7635acce8f0977c0416372b985e763825f5990461184'
MEMBER = 'Payload/BNEI0395.app/Data/data.unity3d'
sha = lambda b: hashlib.sha256(b).hexdigest()
f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]


def panel_source(ipa):
    import UnityPy
    with zipfile.ZipFile(ipa) as package:
        binary = package.read(MEMBER)
    if sha(binary) != DATA_SHA:
        raise ValueError('Different serialized source: establish version first')
    env = UnityPy.load(binary)
    scene = {o.path_id: o for o in env.objects if o.assets_file.name == 'level4'}
    camera_tree = scene[507].read_typetree()
    camera_game = scene[camera_tree['m_GameObject']['m_PathID']].read_typetree()
    if camera_game['m_Name'] != 'PreCamera' or not camera_tree['orthographic']:
        raise ValueError('Native note-layer camera binding changed')
    camera = dict(file='level4', pathId='507', name=camera_game['m_Name'],
        orthographic=camera_tree['orthographic'], orthographicSize=camera_tree['orthographic size'],
        fieldOfView=camera_tree['field of view'], cullingMask=camera_tree['m_CullingMask']['m_Bits'],
        treeSha256=sha(json.dumps(camera_tree, sort_keys=True, separators=(',', ':')).encode()))
    objects = {o.path_id: o for o in env.objects if o.assets_file.name == 'resources.assets'}
    game = objects[33705].read_typetree()
    if game['m_Name'] != 'LanePanel1':
        raise ValueError('Default panel binding changed')

    def transform(game):
        return next(objects[c['component']['m_PathID']] for c in game['m_Component']
                    if objects[c['component']['m_PathID']].type.name == 'RectTransform')

    targets = []

    def walk(obj, chain):
        tree = obj.read_typetree()
        game = objects[tree['m_GameObject']['m_PathID']].read_typetree()
        chain = chain + [dict(pathId=str(obj.path_id), name=game['m_Name'], tree=tree)]
        if re.fullmatch(r'Target[1-5]', game['m_Name']):
            x = y = 0.0
            for node in reversed(chain):
                t = node['tree']
                # For these centered anchors/pivots, resolved localPosition is
                # anchoredPosition. Stop at the panel in the root canvas plane.
                if any(t['m_Pivot'][axis] != .5 or
                       (t['m_AnchorMin'][axis] + t['m_AnchorMax'][axis]) / 2 != .5
                       for axis in ['x', 'y']):
                    raise ValueError('Non-centered RectTransform needs a layout solver')
                # GetPositionInCanvas intentionally accumulates scale/position
                # only. Panel1 has two 180-degree ancestors; do not silently
                # substitute a generic world-matrix calculation for this method.
                pos, scale = t['m_AnchoredPosition'], t['m_LocalScale']
                x = f32(f32(x * scale['x']) + pos['x'])
                y = f32(f32(y * scale['y']) + pos['y'])
            targets.append(dict(name=game['m_Name'], x=x, y=y,
                transformPathId=str(obj.path_id),
                chainSha256=sha(json.dumps(chain, sort_keys=True, separators=(',', ':')).encode())))
        for child in tree['m_Children']:
            walk(objects[child['m_PathID']], chain)

    walk(transform(game), [])
    targets.sort(key=lambda t: t['name'])
    if len(targets) != 5 or len({t['y'] for t in targets}) != 1:
        raise ValueError('Target layout changed')
    return dict(member=MEMBER, dataSha256=sha(binary), file='resources.assets',
                panel='LanePanel1', gameObjectPathId='33705', targets=targets, camera=camera)


def normal_width_source(args, read):
    sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
    from sidem_masterdata.wire import iter_top_records
    metadata = args.metadata.read_bytes()
    master = args.masterdata.read_bytes()
    if sha(metadata) != METADATA_SHA or sha(master) != PB_SHA:
        raise ValueError('Different metadata/masterdata: re-establish native bindings')
    # Decode the actual normal-width getter's string usage, not its C# name.
    pointer = struct.unpack('<Q', read(0x4325aa8, 8))[0]
    encoded = struct.unpack('<Q', read(pointer, 8))[0]
    if encoded >> 29 != 5 or not encoded & 1:
        raise ValueError('Expected an encoded v27 StringLiteral usage')
    index = (encoded & 0x1ffffffe) >> 1
    literal_offset, literal_size, data_offset, data_size = struct.unpack_from('<4I', metadata, 8)
    length, relative = struct.unpack_from('<II', metadata, literal_offset + index * 8)
    name = metadata[data_offset + relative:data_offset + relative + length].decode('utf8')
    if name != 'live_lane_width_rate_normal':
        raise ValueError('Native normal-width key changed')
    rows = []
    for table, start, payload_start, end, payload in iter_top_records(master):
        if table != 3:
            continue
        fields = {number: value for number, begin, ps, end, value in iter_top_records(payload)}
        if fields.get(2) == name.encode():
            rows.append(dict(offset=start, id=fields[1], name=name, value=fields[3]))
    if len(rows) != 1:
        raise ValueError('Expected exactly one bound BasicMasters record')
    divisor = struct.unpack('<d', read(0x3168e68, 8))[0]
    rate = f32(rows[0]['value'] / divisor)
    return dict(decodedPbSha256=sha(master), metadataSha256=sha(metadata), table=3,
        record=rows[0], usageRva='0x4325aa8', literalIndex=index,
        divisorRva='0x3168e68', divisor=divisor, rate=rate)


def run(args):
    if args.unicorn_runtime:
        sys.path.insert(0, str(args.unicorn_runtime))
    from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
    from unicorn.arm64_const import (UC_ARM64_REG_X0, UC_ARM64_REG_X30, UC_ARM64_REG_PC,
        UC_ARM64_REG_SP, UC_ARM64_REG_D0, UC_ARM64_REG_D1, UC_ARM64_REG_S0,
        UC_ARM64_REG_S1, UC_ARM64_REG_S2, UC_ARM64_REG_S3)
    binary = args.native_elf.read_bytes()
    if sha(binary) != ELF_SHA:
        raise ValueError('Different ELF: establish version and RVAs first')
    phoff = struct.unpack_from('<Q', binary, 32)[0]
    size, count = struct.unpack_from('<HH', binary, 54)
    segments = [struct.unpack_from('<IIQQQQQQ', binary, phoff + i * size) for i in range(count)]

    def read(address, length):
        for kind, flags, offset, start, physical, n, mem, align in segments:
            if kind == 1 and start <= address and address + length <= start + n:
                return binary[offset + address - start:offset + address - start + length]
        raise ValueError(f'RVA outside file: {address:x}')

    panel = panel_source(args.ipa)
    normal_width = normal_width_source(args, read)
    cpu = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
    cpu.mem_map(0, 0x4800000)
    for kind, flags, offset, start, physical, n, mem, align in segments:
        if kind == 1:
            cpu.mem_write(start, binary[offset:offset + n])
    cpu.mem_map(0x10000000, 0x40000)
    w64 = lambda address, value: cpu.mem_write(address, struct.pack('<Q', value))
    w32 = lambda address, value: cpu.mem_write(address, struct.pack('<I', value))
    bitsf = lambda value: struct.unpack('<I', struct.pack('<f', value))[0]
    bitsd = lambda value: struct.unpack('<Q', struct.pack('<d', value))[0]
    getf = lambda register: struct.unpack('<f', struct.pack('<I', cpu.reg_read(register)))[0]
    getd = lambda register: struct.unpack('<d', struct.pack('<Q', cpu.reg_read(register)))[0]
    cpu.mem_write(0x466d136, b'\1')
    w64(0x42ed180, 0x10005000)
    w64(0x10005000, 0x10006000)
    w64(0x10000048, 0x10001000)
    w64(0x10001010, 0x10002000)
    w32(0x10001018, 5)
    w64(0x10000010, 0x10003000)
    lane_rate = 1.0

    def stub(uc, address, size, data):
        if address == 0x1afcd88:
            uc.reg_write(UC_ARM64_REG_X0, 0x10004000)
        elif address == 0x1c1b4f8:
            uc.reg_write(UC_ARM64_REG_S0, bitsf(lane_rate))
        elif address == 0x145f2f0:
            uc.reg_write(UC_ARM64_REG_D0, bitsd(min(getd(UC_ARM64_REG_D0), getd(UC_ARM64_REG_D1))))
        else:
            x, y, t = (getf(r) for r in [UC_ARM64_REG_S0, UC_ARM64_REG_S1, UC_ARM64_REG_S2])
            if address == 0x2ae4d38:
                t = max(0, min(1, t))
            uc.reg_write(UC_ARM64_REG_S0, bitsf(f32(x + f32(f32(y - x) * t))))
        uc.reg_write(UC_ARM64_REG_PC, uc.reg_read(UC_ARM64_REG_X30))

    stubs = [0x1afcd88, 0x1c1b4f8, 0x145f2f0, 0x2ae4d38, 0x2ae4d5c]
    for address in stubs:
        cpu.hook_add(UC_HOOK_CODE, stub, begin=address, end=address)
    cases = []
    for target_y in [panel['targets'][0]['y'], -240]:
        for lane_rate in [1, .8]:
            for lane in [0, 1, 2, 2.35, 4]:
                for fraction in [0, .01, .1, .25, .5, .75, .9, 1, 1.1]:
                    for i, target in enumerate(panel['targets']):
                        cpu.mem_write(0x10002020 + i * 8, struct.pack('<ff', target['x'], target_y))
                    cpu.reg_write(UC_ARM64_REG_SP, 0x10030000)
                    cpu.reg_write(UC_ARM64_REG_X0, 0x10000000)
                    cpu.reg_write(UC_ARM64_REG_D0, bitsd(lane))
                    cpu.reg_write(UC_ARM64_REG_D1, bitsd(-fraction))
                    cpu.reg_write(UC_ARM64_REG_X30, 0x1003f000)
                    cpu.emu_start(0x242404c, 0x1003f000, count=3000)
                    cases.append(dict(target=dict(leftX=panel['targets'][0]['x'],
                        rightX=panel['targets'][-1]['x'], y=target_y, laneWidthRate=lane_rate),
                        lane=lane, fraction=fraction,
                        result=dict(zip(['x', 'y', 'z', 'scale'],
                            [getf(r) for r in [UC_ARM64_REG_S0, UC_ARM64_REG_S1, UC_ARM64_REG_S2, UC_ARM64_REG_S3]]))))
    methods = []
    for name, address, length in [('GetPosFromLane', 0x242404c, 600),
        ('GetPositionInCanvas', 0x237cec0, 452), ('targetPosListCallback', 0x1bad8b0, 128),
        ('get_liveLaneWidthRateNormal', 0x2328120, 124), ('GetParameterByNameAsRate', 0x2327bf0, 132)]:
        methods.append(dict(name=name, rva=hex(address), bytes=length, sha256=sha(read(address, length))))
    source = dict(elfSha256=ELF_SHA, methods=methods, serializedPanel=panel, normalWidth=normal_width)
    geometry = dict(schemaVersion=1, source=source,
        viewport=dict(width=1280, height=720, basis='Web canvas adapter; centered native coordinates, positive Y up'),
        target=dict(leftX=panel['targets'][0]['x'], rightX=panel['targets'][-1]['x'],
                    y=panel['targets'][0]['y'], laneWidthRate=normal_width['rate']),
        boundaries=dict(laneWidthRate='native normal setting; narrow/broad settings not exposed by this preview',
                        renderer='native coordinate curve; full Unity note/hold meshes and GPU projection pending'))
    fixture = dict(schemaVersion=1, source=source, execution='Unicorn ARM64 with controlled scalar/setting stubs',
                   stubRvas=[hex(a) for a in stubs], cases=cases)
    for path, result in [(GEOMETRY, geometry), (FIXTURE, fixture)]:
        if args.write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8', newline='\n')
        elif json.loads(path.read_text(encoding='utf8')) != result:
            raise ValueError(f'Native projection fixture drift: {path.name}')
    print(f'Native projection: IPA panel/camera, masterdata/{len(methods)} method hashes and {len(cases)} ARM64 coordinate cases verified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--ipa', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True, help='Decrypted Android metadata paired with this ELF')
    parser.add_argument('--masterdata', type=Path, required=True, help='Decoded archived client masterdata PB')
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
