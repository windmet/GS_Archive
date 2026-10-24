"""Execute native effect root/tail clock and LateUpdate transform handoff.

This is evidence preparation, not a particle simulation. Unity lookups, settings,
collection Last, Vector3.one, dictionary and Transform submissions are explicit
services. Native coordinate/timing/scale/type/hold-end bodies execute ARM64.
"""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_quad', ROOT / 'scripts/audit-song-track-native-note-geometry.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
sha = lambda data: hashlib.sha256(data).hexdigest()


class Probe(base.NativeProbe):
    def __init__(self, binary, target):
        from unicorn import UC_HOOK_CODE
        super().__init__(binary, target)
        for guard in [0x466d11e, 0x466986c, 0x4669863, 0x4669358, 0x4669355,
                      0x466aa80, 0x4666c1e, 0x466aa86, 0x466aa81]:
            self.cpu.mem_write(guard, b'\1')
        self.w64(0x10000020, 0x10091000)
        self.w64(0x10040018, 0x10041000)
        # Singleton -> game manager -> note manager.
        self.w64(0x4311160, 0x100a0000)
        self.w64(0x100a0000, 0x100a1000)
        self.w64(0x100a1000 + 0xb8, 0x100a2000)
        self.w64(0x100a2000, 0x100a3000)
        self.w64(0x100a3000 + 0x150, 0x10000000)
        self.w64(0x100a4000 + 0x10, 0x100a5000)
        # Controlled HoldMesh instance with a valid one-entry type hierarchy.
        # get_holdEndAbsTime itself executes, including its dynamic type test.
        self.w64(0x42d4140, 0x100b0000)
        self.w64(0x100b0000, 0x100b1000)
        self.cpu.mem_write(0x100b1000 + 300, b'\1')
        self.w64(0x100b1000 + 200, 0x100b2000)
        self.w64(0x100b2000, 0x100b1000)
        self.w64(0x10040028, 0x100b3000)
        self.w64(0x100b3000, 0x100b1000)
        self.services = [0x1eddf20, 0x1afea4c, 0x20b8ab8, 0x2adb9e8,
            0x30653ac, 0x30659ac, 0x306a4d8, 0x1bc5050, 0x1df983c,
            0xdf63f0, 0x301bb74, 0x301c5b0]
        for address in self.services:
            self.cpu.hook_add(UC_HOOK_CODE, self.service, begin=address, end=address)

    def service(self, cpu, address, size, data):
        r = self.r
        if address == 0x1eddf20:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x10040000)
        elif address == 0x1afea4c:
            self.setd(r.UC_ARM64_REG_D0, self.current)
        elif address == 0x20b8ab8:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100a4000)
        elif address == 0x2adb9e8:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100a6000)
        elif address == 0x1bc5050:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100a7000)
        elif address == 0x306a4d8:
            for register in [r.UC_ARM64_REG_S0, r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2]:
                self.setf(register, 1)
        elif address in [0x30653ac, 0x30659ac]:
            self.captured['position' if address == 0x30653ac else 'scale'] = [self.getf(register)
                for register in [r.UC_ARM64_REG_S0, r.UC_ARM64_REG_S1, r.UC_ARM64_REG_S2]]
        elif address == 0x1df983c:
            self.preference_default = cpu.reg_read(r.UC_ARM64_REG_X1)
            cpu.reg_write(r.UC_ARM64_REG_X0, self.preference_default)
        elif address == 0xdf63f0:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100c0000)
        elif address == 0x301bb74:
            self.dictionary = {}
        elif address == 0x301c5b0:
            self.dictionary[str(cpu.reg_read(r.UC_ARM64_REG_X1))] = cpu.reg_read(r.UC_ARM64_REG_X2)
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    def point(self, note_type, start_lane, end_lane, current, hit, tail, lead, speed, note_size, late=False):
        self.current = current
        for offset, value in [(0x10, hit), (0x60, lead)]:
            self.cpu.mem_write(0x10041000 + offset, struct.pack('<d', value))
        self.cpu.mem_write(0x100b3000 + 0x58, struct.pack('<d', tail))
        self.w32(0x10041038, note_type)
        self.w32(0x1000401c, note_size)
        for offset, value in [(0x3c, start_lane), (0x40, end_lane), (0x44, speed)]:
            self.cpu.mem_write(0x10041000 + offset, struct.pack('<f', value))
        self.cpu.mem_write(0x100a7000 + 0x14, struct.pack('<f', end_lane))
        self.captured = {}
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, 0x10000000)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X1, 123)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X2, 0x100a8000)
        self.cpu.emu_start(0x20b967c if late else 0x2423f08, 0x1003f000, count=5000)
        if late:
            if set(self.captured) != {'position', 'scale'}:
                raise ValueError('Native transform handoff did not complete')
            return self.captured
        return [self.getf(register) for register in
                [self.r.UC_ARM64_REG_S0, self.r.UC_ARM64_REG_S1, self.r.UC_ARM64_REG_S2, self.r.UC_ARM64_REG_S3]]

    def transform_point(self, transform, point):
        # Controlled authored local point and root TRS. The actual MultiplyPoint
        # body runs ARM64; this does not emulate Unity's ParticleSystem renderer.
        matrix = [0.] * 16
        matrix[0], matrix[5], matrix[10] = transform['scale']
        matrix[15] = 1
        matrix[12:15] = transform['position']
        self.cpu.mem_write(0x100d0000, struct.pack('<16f', *matrix))
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, 0x100d0000)
        registers = [self.r.UC_ARM64_REG_S0, self.r.UC_ARM64_REG_S1, self.r.UC_ARM64_REG_S2]
        for register, value in zip(registers, point):
            self.setf(register, value)
        self.cpu.emu_start(0x2ae6238, 0x1003f000, count=100)
        return [self.getf(register) for register in registers]


def native_string(probe, metadata, slot):
    pointer = struct.unpack('<Q', probe.read(slot, 8))[0]
    encoded = struct.unpack('<Q', probe.read(pointer, 8))[0]
    if encoded >> 29 != 5 or not encoded & 1:
        raise ValueError('Expected StringLiteral usage')
    table, _, data, _ = struct.unpack_from('<4I', metadata, 8)
    index = (encoded & 0x1ffffffe) >> 1
    length, offset = struct.unpack_from('<II', metadata, table + index * 8)
    return metadata[data + offset:data + offset + length].decode('utf8')


def prefab_evidence(args, probe):
    import UnityPy
    metadata = args.metadata.read_bytes()
    if sha(metadata) != base.METADATA_SHA:
        raise ValueError('Different Android metadata')
    with zipfile.ZipFile(args.ipa) as package:
        data = package.read('Payload/BNEI0395.app/Data/data.unity3d')
    if sha(data) != base.DATA_SHA:
        raise ValueError('Different IPA data.unity3d')
    env = UnityPy.load(data)
    objects = {o.path_id: o for o in env.objects if o.assets_file.name == 'resources.assets'}
    # Validate serialized custom field ordering against bound Android metadata.
    sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
    import extract_il2cpp_protobuf_schema as md
    _, sections = md.parse_header(metadata)
    strings = md.build_string_reader(metadata, sections['string'])
    definitions = md.read_records(metadata, sections['type_definitions'], md.TYPE_DEFINITION_FORMAT)
    fields = md.read_records(metadata, sections['fields'], md.FIELD_DEFINITION_FORMAT)
    definition, = [d for d in definitions if strings(d[0]) == 'NoteEffectPrefabSet' and strings(d[1]) == 'Growing.Live']
    order = [strings(fields[i][0]) for i in range(definition[8], definition[8] + definition[18])]
    if order != ['_flickUpEffectPrefab', '_flickLeftEffectPrefab', '_flickRightEffectPrefab']:
        raise ValueError('Different prefab set fields')
    probe.setup_call()
    probe.cpu.emu_start(0x20b8b9c, 0x1003f000, count=500)
    if probe.preference_default != 2:
        raise ValueError('Different default effect index')
    set_object = objects[106543]
    tree = set_object.read_typetree(check_read=False)
    if tree['m_Name'] != 'NoteEffectPrefabSet_2' or set_object.byte_size != 92:
        raise ValueError('Different default prefab set layout')
    # Its external MonoScript is checked by resolving the actual Unity object.
    script = set_object.read(check_read=False).m_Script.read()
    if script.m_ClassName != 'NoteEffectPrefabSet' or script.m_Namespace != 'Growing.Live':
        raise ValueError('Different prefab MonoScript')
    refs = [struct.unpack_from('<iq', set_object.get_raw_data(), 56 + i * 12) for i in range(3)]
    if any(file_id != 0 for file_id, _ in refs):
        raise ValueError('Unexpected external prefab reference')
    for i, (_, path_id) in enumerate(refs):
        probe.w64(0x100c1000 + 0x18 + i * 8, path_id)
    probe.setup_call()
    probe.cpu.reg_write(probe.r.UC_ARM64_REG_X0, 0x100c1000)
    probe.cpu.emu_start(0x20b8c9c, 0x1003f000, count=1500)
    if len(probe.dictionary) != 3:
        raise ValueError('Missing native effect dictionary mapping')
    result = dict(defaultIndex=probe.preference_default, resourceFormat=native_string(probe, metadata, 0x42d53e8),
        prefabSetPathId=106543, prefabSetSha256=sha(set_object.get_raw_data()), fields=order,
        nativeDictionary=probe.dictionary, layers={})
    for type_number, path_id in probe.dictionary.items():
        layers = []
        def walk(game_object, chain):
            transform = next(c.component for c in game_object.m_Component if c.component.type.name == 'Transform')
            t = transform.read()
            chain = chain + [dict(pathId=transform.path_id, name=game_object.m_Name,
                sha256=sha(t.object_reader.get_raw_data()), position=transform.read_typetree()['m_LocalPosition'],
                scale=transform.read_typetree()['m_LocalScale'], rotation=transform.read_typetree()['m_LocalRotation'])]
            for component in game_object.m_Component:
                ref = component.component
                if ref.type.name != 'ParticleSystem':
                    continue
                ps = ref.read_typetree()
                renderer = next(c.component for c in game_object.m_Component if c.component.type.name == 'ParticleSystemRenderer')
                materials = []
                for material_ref in renderer.read().m_Materials:
                    material = material_ref.read_typetree()
                    materials.append(dict(pathId=material_ref.path_id, sha256=sha(material_ref.read().object_reader.get_raw_data()),
                        name=material['m_Name'], shader=material['m_Shader'], properties=material['m_SavedProperties']))
                layers.append(dict(pathId=ref.path_id, sha256=sha(ref.read().object_reader.get_raw_data()), chain=chain,
                    settings={k: v for k, v in ps.items() if not isinstance(v, (dict, list))},
                    initial=ps['InitialModule'], uv=ps['UVModule'], velocity=ps['VelocityModule'],
                    shape=ps['ShapeModule'], size=ps['SizeModule'], rotation=ps['RotationModule'],
                    emission=ps['EmissionModule'], color=ps['ColorModule'],
                    renderer=dict(pathId=renderer.path_id, sha256=sha(renderer.read().object_reader.get_raw_data()),
                        fields={k: v for k, v in renderer.read_typetree().items() if k in
                            ['m_RenderMode', 'm_RenderAlignment', 'm_Pivot', 'm_MinParticleSize', 'm_MaxParticleSize']}),
                    materials=materials))
            for child in t.m_Children:
                walk(child.read().m_GameObject.read(), chain)
        walk(objects[path_id].read(), [])
        result['layers'][type_number] = layers
    result['textures'] = []
    for path_id in [630, 876]:
        texture = objects[path_id].read()
        result['textures'].append(dict(pathId=path_id, name=texture.m_Name,
            width=texture.m_Width, height=texture.m_Height,
            objectSha256=sha(objects[path_id].get_raw_data()),
            rgbaSha256=sha(texture.image.convert('RGBA').tobytes())))
    # Static direction markers use the authored outline/fill cells. Blur,
    # prewarm, emission, velocity and randomized particle phases stay separate.
    layouts, assets = {}, {}
    for type_number, role in [('2', 'swipe_left'), ('3', 'swipe_up'), ('4', 'swipe_right')]:
        layers = []
        for layer in result['layers'][type_number]:
            if 'blur' in layer['chain'][-1]['name']:
                continue
            parent, child = layer['chain'][1:]
            if child['position'] != dict(x=0., y=0., z=0.):
                raise ValueError('Nonzero particle child origin needs a new layout adapter')
            for node in layer['chain']:
                if any(node['rotation'][key] != 0 for key in ['x', 'y', 'z']) or node['rotation']['w'] != 1:
                    raise ValueError('Rotated emitter hierarchy needs a new adapter')
            uv = layer['uv']
            if uv['tilesX'] != 2 or uv['tilesY'] != 2 or uv['frameOverTime']['scalar'] != 0:
                raise ValueError('Animated/different marker cells need a new adapter')
            frame = int(uv['startFrame']['scalar'] * 4)
            crop = [frame % 2 * 512, frame // 2 * 512, (frame % 2 + 1) * 512, (frame // 2 + 1) * 512]
            png = io.BytesIO()
            objects[630].read().image.crop(tuple(crop)).save(png, format='PNG')
            image = png.getvalue()
            url = f'/assets/song-chart-hints/native2/frame-{frame}.png'
            path = ROOT / 'public' / url.lstrip('/')
            if args.write:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(image)
            elif path.read_bytes() != image:
                raise ValueError('Native direction-marker PNG drift')
            assets[url] = dict(bytes=len(image), sha256=sha(image), texturePathId=630, crop=crop)
            size = layer['initial']['startSize']
            if size['minMaxState'] != 0:
                raise ValueError('Randomized marker size needs a new adapter')
            authored_size = {key: base.f(base.f(size['scalar'] * child['scale'][key]) * parent['scale'][key]) for key in ['x', 'y']}
            layers.append(dict(particlePathId=layer['pathId'], offset=parent['position'],
                authoredSize=authored_size, rotation=layer['initial']['startRotation']['scalar'],
                color=layer['initial']['startColor']['maxColor'], url=url))
        if len(layers) != 2:
            raise ValueError('Missing static outline/fill layers')
        layouts[role] = layers
    result['staticMarkerLayouts'] = layouts
    result['staticMarkerAssets'] = assets
    return result


def run(args):
    if args.unicorn_runtime:
        sys.path.insert(0, str(args.unicorn_runtime))
    binary = args.native_elf.read_bytes()
    if sha(binary) != base.ELF_SHA:
        raise ValueError('Different ELF; rebind methods first')
    target = json.loads((ROOT / 'config/song-track-native-geometry.v1.json').read_bytes())['target']
    probe = Probe(binary, target)
    methods = [('RhythmGameNoteManager.GetEffectPointInfoByNoteSerialNo', 0x2423f08, 324),
        ('NoteInfo.get_noteEffectLanePos', 0x1edd7d8, 28), ('EventNoteData.get_noteEffectLanePos', 0x1f462fc, 224),
        ('NoteInfo.GetEffectTime', 0x1edd7f4, 176), ('NoteInfo.GetHoldEndNoteTime', 0x1edcc94, 68),
        ('NoteInfo.get_holdEndAbsTime', 0x1edd560, 148), ('EventNoteData.GetHoldEndNoteTime', 0x1f471ec, 28),
        ('NoteEffectManager.LateUpdateLambda', 0x20b967c, 444), ('LiveSettingsData.get_noteScale', 0x1c1b4a4, 24),
        ('RhythmGameDef.GetNoteScaleRateByNoteTime', 0x1afc78c, 36),
        ('Matrix4x4.MultiplyPoint3x4', 0x2ae6238, 88),
        ('NoteFlickEffectDebug.get_noteEffectIndex', 0x20b8b9c, 76), ('NoteEffectPrefabSet.GetPrefabDict', 0x20b8c9c, 208)]
    cases = []
    for note_type in [0, 2, 3, 4, 5, 6, 7, 8, 9]:
        for speed in [1, .2, 1.5]:
            for current in [4, 8.5, 9, 10, 12, 12.25]:
                size = [80, 100, 120][len(cases) % 3]
                sample = dict(noteType=note_type, startLane=.25, endLane=3.75, current=current,
                    hit=10, tail=12, lead=3.5, speed=speed, noteSize=size)
                values = [note_type, .25, 3.75, current, 10, 12, 3.5, speed, size]
                sample['pointInfo'] = probe.point(*values)
                sample['transform'] = probe.point(*values, late=True)
                cases.append(sample)
    prefabs = prefab_evidence(args, probe)
    for sample in cases:
        sample['staticEmitterCenters'] = {}
        for role, layers in prefabs['staticMarkerLayouts'].items():
            offset = layers[0]['offset']
            sample['staticEmitterCenters'][role] = probe.transform_point(sample['transform'], [offset[k] for k in ['x', 'y', 'z']])
    result = dict(schemaVersion=1, source=dict(elfSha256=sha(binary), metadataSha256=base.METADATA_SHA,
        dataSha256=base.DATA_SHA, methods=[dict(name=name, rva=hex(a), bytes=n, sha256=sha(probe.read(a, n)))
            for name, a, n in methods], controlledServices=[hex(a) for a in probe.stubs + probe.services],
        boundaries='Normal rendering mode only; controlled clock/lookup/collection/Vector3.one/dictionary/Transform services. Original particle emission, velocity, shader, GPU and saved preferences are not replayed.'),
        target=target, cases=cases, defaultPrefabs=prefabs)
    # UnityPy material properties contain tuples; compare their JSON form.
    result = json.loads(json.dumps(result))
    path = ROOT / 'scripts/fixtures/song-track-native-effects.json'
    if args.write:
        path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8', newline='\n')
    elif json.loads(path.read_bytes()) != result:
        raise ValueError('Native effect evidence drift')
    runtime = dict(schemaVersion=1, source=result['source'], defaultIndex=prefabs['defaultIndex'],
        layouts=prefabs['staticMarkerLayouts'], assets=prefabs['staticMarkerAssets'],
        boundary='Static emitter indicators from default prefab outline/fill. Not original particles: blur, emission/prewarm, velocity, random spawn, shaders and GPU compositing are not simulated.')
    runtime_path = ROOT / 'config/song-track-native-effects.v1.json'
    if args.write:
        runtime_path.write_text(json.dumps(runtime, indent=2) + '\n', encoding='utf8', newline='\n')
    elif json.loads(runtime_path.read_bytes()) != runtime:
        raise ValueError('Native static marker contract drift')
    print(f'Native effects: {len(cases)} point/transform cases, default prefab index {prefabs["defaultIndex"]}, '
          f'{sum(len(p) for p in prefabs["layers"].values())} serialized particle layers verified; no particle simulation claim')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--ipa', type=Path, required=True)
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
