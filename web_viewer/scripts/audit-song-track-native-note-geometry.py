"""Replay native NoteMesh vertices using source Sprite textureRects.

The IL2CPP vertex body, coordinate body, Vector3 normalization, type converters
and note-scale curve run as ARM64. Min/Lerp, resource/settings lookups and Mesh
submission are controlled stubs. This is not a Unity/GPU equivalence test.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ELF_SHA = '9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
DATA_SHA = 'fb28e28793e4f9d21e76dd96be2c776a71382cb607d98acd24f65f20bed8018a'
METADATA_SHA = 'dc257cb9aaa706915fad7635acce8f0977c0416372b985e763825f5990461184'
SPEC = ROOT / 'config/song-track-native-note-geometry.v1.json'
FIXTURE = ROOT / 'scripts/fixtures/song-track-native-note-geometry.json'
sha = lambda b: hashlib.sha256(b).hexdigest()
f = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]


class NativeProbe:
    def __init__(self, binary, target):
        from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM, UC_HOOK_CODE
        import unicorn.arm64_const as registers
        self.r = registers
        self.binary = binary
        phoff = struct.unpack_from('<Q', binary, 32)[0]
        size, count = struct.unpack_from('<HH', binary, 54)
        self.segments = [struct.unpack_from('<IIQQQQQQ', binary, phoff + i * size) for i in range(count)]
        self.cpu = u = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
        u.mem_map(0, 0x4800000)
        for kind, flags, offset, start, physical, n, mem, align in self.segments:
            if kind == 1:
                u.mem_write(start, binary[offset:offset + n])
        u.mem_map(0x10000000, 0x100000)
        self.width = self.height = 256
        self.draw_scale = self.lane_rate = 1.0
        u.mem_write(0x466d136, b'\1')
        u.mem_write(0x466aaa3, b'\1')
        u.mem_write(0x466986b, b'\1')
        self.w64(0x42ed180, 0x10005000); self.w64(0x10005000, 0x10006000)
        self.w64(0x10000048, 0x10001000); self.w64(0x10001010, 0x10002000)
        self.w32(0x10001018, 5); self.w64(0x10000010, 0x10003000)
        for i in range(5):
            x = target['leftX'] + (target['rightX'] - target['leftX']) * i / 4
            u.mem_write(0x10002020 + i * 8, struct.pack('<ff', x, target['y']))
        self.lane_rate = target['laneWidthRate']
        for slot, holder, typ, stat in [
            (0x42cd0d8, 0x10050000, 0x10051000, 0x10052000),
            (0x42e60b8, 0x10053000, 0x10054000, 0x10055000),
            (0x42e19a0, 0x10056000, 0x10057000, 0x10058000)]:
            self.w64(slot, holder); self.w64(holder, typ); self.w64(typ + 0xb8, stat)
        self.w64(0x10052008, 0x10003000)
        self.w64(0x10055018, 0x10059000); self.w32(0x10059018, 10)
        for i in range(10):
            self.w64(0x10059040 + i * 0x28, 0x10062000)
        self.w64(0x10052020, 0x10061000); self.w32(0x10061018, 4)
        self.w64(0x10052028, 0x10066000); self.w32(0x10066018, 6)
        self.w64(0x10063000, 0x10064000)
        self.w64(0x10064178, 0x10070000); self.w64(0x10064198, 0x10070010)
        self.w64(0x10040060, 0x10067000)
        self.stubs = [0x1afcd88, 0x1c1b4f8, 0x145f2f0, 0x2ae4d38, 0x2ae4d5c,
            0x11f5104, 0x11f4ed0, 0x10070000, 0x10070010, 0x20bbfc4, 0x1afb028,
            0x1c1b4bc, 0x1afea30, 0x11dd748, 0x11de6f4]
        for address in self.stubs:
            u.hook_add(UC_HOOK_CODE, self.stub, begin=address, end=address)

    def read(self, address, length):
        for kind, flags, offset, start, physical, n, mem, align in self.segments:
            if kind == 1 and start <= address and address + length <= start + n:
                return self.binary[offset + address - start:offset + address - start + length]
        raise ValueError(f'RVA outside file: {address:x}')

    def w64(self, address, value): self.cpu.mem_write(address, struct.pack('<Q', value))
    def w32(self, address, value): self.cpu.mem_write(address, struct.pack('<I', value))
    def setf(self, register, value): self.cpu.reg_write(register, struct.unpack('<I', struct.pack('<f', value))[0])
    def setd(self, register, value): self.cpu.reg_write(register, struct.unpack('<Q', struct.pack('<d', value))[0])
    def getf(self, register): return struct.unpack('<f', struct.pack('<I', self.cpu.reg_read(register)))[0]
    def getd(self, register): return struct.unpack('<d', struct.pack('<Q', self.cpu.reg_read(register)))[0]

    def stub(self, cpu, address, size, data):
        r = self.r
        if address in [0x1afcd88, 0x20bbfc4, 0x1afb028]:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x10004000)
        elif address in [0x1c1b4f8, 0x1c1b4bc]:
            self.setf(r.UC_ARM64_REG_S0, self.lane_rate if address == 0x1c1b4f8 else self.draw_scale)
        elif address == 0x145f2f0:
            self.setd(r.UC_ARM64_REG_D0, min(self.getd(r.UC_ARM64_REG_D0), self.getd(r.UC_ARM64_REG_D1)))
        elif address in [0x2ae4d38, 0x2ae4d5c]:
            x, y, t = (self.getf(reg) for reg in [r.UC_ARM64_REG_S0, r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2])
            if address == 0x2ae4d38: t = max(0, min(1, t))
            self.setf(r.UC_ARM64_REG_S0, f(x + f(f(y - x) * t)))
        elif address == 0x11f5104:
            for register, value in zip([r.UC_ARM64_REG_S0, r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2, r.UC_ARM64_REG_S3], [0, 0, self.width, self.height]):
                self.setf(register, value)
        elif address == 0x11f4ed0:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x10063000)
        elif address in [0x10070000, 0x10070010]:
            cpu.reg_write(r.UC_ARM64_REG_X0, 4096)
        elif address == 0x1afea30:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x10000000)
            cpu.reg_write(r.UC_ARM64_REG_PC, 0x242404c)
            return
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    def setup_call(self):
        self.cpu.reg_write(self.r.UC_ARM64_REG_SP, 0x10030000)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X30, 0x1003f000)

    def integer_call(self, address, value):
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, value)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X1, 0)
        self.cpu.emu_start(address, 0x1003f000, count=3000)
        value = self.cpu.reg_read(self.r.UC_ARM64_REG_X0) & 0xffffffff
        return value if value < 0x80000000 else value - 0x100000000

    def quad(self, lane, fraction, width, height, draw_scale, note_type):
        r = self.r
        self.width, self.height, self.draw_scale = width, height, draw_scale
        self.setup_call()
        self.cpu.reg_write(r.UC_ARM64_REG_X0, 0x10000000)
        self.setd(r.UC_ARM64_REG_D0, f(lane)); self.setd(r.UC_ARM64_REG_D1, -fraction)
        self.cpu.emu_start(0x242404c, 0x1003f000, count=3000)
        point = [self.getf(reg) for reg in [r.UC_ARM64_REG_S0, r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2, r.UC_ARM64_REG_S3]]
        self.w32(0x10040018, note_type)
        self.w32(0x10040038, 1); self.w32(0x100400a8, 1)
        self.cpu.mem_write(0x10040020, struct.pack('<f', lane))
        self.setup_call()
        self.cpu.reg_write(r.UC_ARM64_REG_X0, 0x10040000)
        self.setd(r.UC_ARM64_REG_D0, -fraction)
        for register, value in zip([r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2, r.UC_ARM64_REG_S3, r.UC_ARM64_REG_S4], point):
            self.setf(register, value)
        self.cpu.emu_start(0x20bd010, 0x1003f000, count=10000)
        return [list(struct.unpack('<fff', self.cpu.mem_read(0x10061020 + i * 12, 12))) for i in range(4)]


def extract_sources(args, probe):
    import UnityPy
    metadata = args.metadata.read_bytes()
    if sha(metadata) != METADATA_SHA: raise ValueError('Different Android metadata')
    with zipfile.ZipFile(args.ipa) as package:
        data = package.read('Payload/BNEI0395.app/Data/data.unity3d')
    if sha(data) != DATA_SHA: raise ValueError('Different IPA serialized source')
    literal_offset, literal_size, data_offset, data_size = struct.unpack_from('<4I', metadata, 8)
    slots = [0x42ea460, 0x4314a80, 0x42fea98, 0x42eccf8, 0x42dcf40, 0x434c568, 0x42ccbb8, 0x434d6c0, 0x4305528]
    draw_sprites = {}
    for index, slot in enumerate(slots, 1):
        pointer = struct.unpack('<Q', probe.read(slot, 8))[0]
        encoded = struct.unpack('<Q', probe.read(pointer, 8))[0]
        if encoded >> 29 != 5 or not encoded & 1: raise ValueError('Expected StringLiteral usage')
        literal = (encoded & 0x1ffffffe) >> 1
        length, relative = struct.unpack_from('<II', metadata, literal_offset + literal * 8)
        draw_sprites[str(index)] = dict(name=metadata[data_offset + relative:data_offset + relative + length].decode(),
                                       usageRva=hex(slot), literalIndex=literal)
    rendering = json.loads((ROOT / 'config/song-note-rendering.v1.json').read_bytes())
    raw_types = {e['name']: e['value'] for e in rendering['nativeEnums']['EventNoteType']['values']}
    sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
    import extract_il2cpp_protobuf_schema as native
    _, sections = native.parse_header(metadata)
    strings = native.build_string_reader(metadata, sections['string'])
    types = native.read_records(metadata, sections['type_definitions'], native.TYPE_DEFINITION_FORMAT)
    fields = native.read_records(metadata, sections['fields'], native.FIELD_DEFINITION_FORMAT)
    defaults = {index: relative for index, ty, relative in native.read_records(metadata, sections['field_default_values'], native.FIELD_DEFAULT_FORMAT)}
    matches = [(index, definition) for index, definition in enumerate(types)
               if strings(definition[0]) == 'EventNoteType' and strings(definition[1]) == 'Growing.Live']
    if len(matches) != 1: raise ValueError('Ambiguous Android EventNoteType')
    type_index, definition = matches[0]
    android_types = {strings(fields[index][0]): struct.unpack_from('<i', metadata,
        sections['default_value_data'][0] + defaults[index])[0]
        for index in range(definition[8], definition[8] + definition[18]) if index in defaults}
    if android_types != raw_types: raise ValueError('Android/iOS EventNoteType values differ')
    type_draw = {name: probe.integer_call(0x20b85c0, value) for name, value in raw_types.items() if value >= 0}
    head_types = {name: probe.integer_call(0x1f474e0, raw_types[name]) for name in ['HOLD', 'VARIABLE_HOLD', 'LARGE_HOLD', 'LARGE_VARIABLE_HOLD']}
    end_types = {name: probe.integer_call(0x1f461cc, value) for name, value in
                 [('END_NORMAL', 0), ('END_FLICK_LEFT', 1), ('END_FLICK_UP', 2), ('END_FLICK_RIGHT', 3)]}
    roles = {name: draw_sprites[str(type_draw[name])]['name'].removeprefix('live_notes_')
             for name in type_draw if type_draw[name] != 0}
    for name, value in head_types.items():
        roles[name] = draw_sprites[str(probe.integer_call(0x20b85c0, value))]['name'].removeprefix('live_notes_')
    for name, value in end_types.items():
        roles[name] = draw_sprites[str(probe.integer_call(0x20b85c0, value))]['name'].removeprefix('live_notes_')
    env = UnityPy.load(data)
    objects = {o.path_id: o for o in env.objects if o.assets_file.name == 'resources.assets'}
    skins = {}
    for skin, sprites in rendering['skins'].items():
        skins[skin] = {}
        for role in ['normal', 'p_skill', 'swipe_left', 'swipe_up', 'swipe_right', 'sp', 'middle']:
            old = sprites[role]
            sprite = objects[old['spritePathId']].read()
            if sprite.m_Name != 'live_notes_' + role: raise ValueError('Sprite role binding changed')
            atlas = sprite.m_SpriteAtlas.read()
            rd = next(value for key, value in atlas.m_RenderDataMap if key == sprite.m_RenderDataKey)
            if (rd.settingsRaw >> 2) & 15 or ((rd.settingsRaw >> 1) & 1) != 1:
                raise ValueError('Rotated/tight packing needs a different texture adapter')
            rect = rd.textureRect
            left, bottom = round(rect.x), round(rect.y)
            right, top = round(rect.x + rect.width), round(rect.y + rect.height)
            if [right - left, top - bottom] != [old['width'], old['height']]:
                raise ValueError('Exported PNG crop dimensions differ')
            png = (ROOT / 'public' / old['url'].lstrip('/')).read_bytes()
            if sha(png) != rendering['assets'][old['url']]['sha256']: raise ValueError('Published PNG drift')
            skins[skin][role] = dict(url=old['url'], spritePathId=str(old['spritePathId']),
                pngWidth=old['width'], pngHeight=old['height'], textureWidth=rect.width, textureHeight=rect.height,
                # SpriteHelper crops to rounded integer edges then flips Y.
                # Native Rect.xMax/yMax are float32 additions, not PNG edges.
                uv=dict(left=rect.x - left, right=f(rect.x + rect.width) - left,
                        top=top - f(rect.y + rect.height), bottom=top - rect.y),
                textureRect=[rect.x, rect.y, rect.width, rect.height], settingsRaw=rd.settingsRaw,
                pngSha256=sha(png))
    return dict(dataSha256=sha(data), metadataSha256=sha(metadata), androidEnumTypeDefinitionIndex=type_index,
                nativeEnumValues=android_types, drawSprites=draw_sprites,
                typeToDraw=type_draw, holdBeginTypes=head_types, holdEndTypes=end_types, roles=roles), skins


def run(args):
    if args.unicorn_runtime: sys.path.insert(0, str(args.unicorn_runtime))
    binary = args.native_elf.read_bytes()
    if sha(binary) != ELF_SHA: raise ValueError('Different ELF; establish RVAs first')
    plane_bytes = (ROOT / 'config/song-track-native-geometry.v1.json').read_bytes()
    plane = json.loads(plane_bytes)
    if plane['source']['elfSha256'] != ELF_SHA: raise ValueError('Different coordinate contract')
    probe = NativeProbe(binary, plane['target'])
    source, skins = extract_sources(args, probe)
    methods = [('NoteMesh.UpdateFromGameCreateMesh', 0x20bd010, 1588),
        ('RhythmGameDef.GetNoteScaleRateByNoteTime', 0x1afc78c, 36),
        ('NoteDrawManager.GetSpriteInfos', 0x20b69fc, 1164),
        ('NoteDrawManager.ConvertNoteTypeToDrawType', 0x20b85c0, 32),
        ('ToHoldBeginNoteType', 0x1f474e0, 172), ('EndType.ToEventNoteType', 0x1f461cc, 28),
        ('HoldMesh.Create', 0x21cf2c4, 1600), ('LiveSettingsData.get_noteDrawScale', 0x1c1b4bc, 60),
        ('LiveSettingsData..ctor', 0x1c1b6e0, 220)]
    source.update(elfSha256=ELF_SHA, coordinateContractSha256=sha(plane_bytes),
        methods=[dict(name=name, rva=hex(address), bytes=length, sha256=sha(probe.read(address, length))) for name, address, length in methods],
        constants={name: dict(rva=hex(address), hex=probe.read(address, 4).hex(), value=struct.unpack('<f', probe.read(address, 4))[0])
                   for name, address in [('sizeAdjust', 0x32d4814), ('heightAdjust', 0x32d4818), ('heightRate', 0x317a32c), ('farScale', 0x32cc6e0), ('settingsScaleDivisor', 0x3168e80)]})
    design, size = struct.unpack('<ii', probe.read(0x32cce20, 8))
    default_scale = f(f(size / source['constants']['settingsScaleDivisor']['value']) / plane['target']['laneWidthRate'])
    source['defaultSettings'] = dict(rva='0x32cce20', hex=probe.read(0x32cce20, 8).hex(),
                                     noteDesign=design, noteSize=size, noteDrawScale=default_scale)
    role_types = {source['roles'][name]: source['nativeEnumValues'][name]
                  for name, draw in source['typeToDraw'].items() if draw != 0}
    dimensions = sorted({(s['textureWidth'], s['textureHeight']) for roles in skins.values() for s in roles.values()})
    cases = []
    for width, height in dimensions:
        for note_type in [0, 9]:
            for draw_scale in [.8, 1, 1.2]:
                for lane in [0, 2, 2.35, 4]:
                    for fraction in [0, .1, .5, .9, 1]:
                        vertices = probe.quad(lane, fraction, width, height, draw_scale, note_type)
                        cases.append(dict(lane=lane, fraction=fraction, textureWidth=width, textureHeight=height,
                                          drawScale=draw_scale, noteType=note_type, vertices=vertices))
    spec = dict(schemaVersion=1, source=source, skins=skins, roleNoteTypes=role_types,
                defaultDrawScale=default_scale,
                boundaries=dict(vertices='native quad math at controlled normalized time',
                    timing='common lead and per-note speed including Special verified separately; saved player preferences and arbitrary reflection not replayed',
                    renderer='SVG bitmap/canvas adapter; original shaders, depth compositing and particles pending'))
    fixture = dict(schemaVersion=1, source=source, target=plane['target'],
        execution='Unicorn ARM64; native vertex/coordinate/normalization/scale bodies; resource, settings, scalar helper and Mesh submission stubs',
        stubRvas=[hex(a) for a in probe.stubs], cases=cases)
    for path, result in [(SPEC, spec), (FIXTURE, fixture)]:
        if args.write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8', newline='\n')
        elif json.loads(path.read_text(encoding='utf8')) != result:
            raise ValueError(f'Native note geometry drift: {path.name}')
    print(f'Native note geometry: 21 Sprite rects/type bindings, {len(methods)} method hashes, {len(cases)} ARM64 quads verified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--ipa', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
