"""Extract authored hit-effect layers and execute native selection branches.

Requires the bound local IPA, Android metadata, decrypted ELF, UnityPy and
Unicorn. Unity lookups and the final Create submission are controlled services;
this does not execute Unity particles, shaders, rendering or input judgement.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sha = lambda value: hashlib.sha256(value).hexdigest()
FIELDS = ['_touchPerfect', '_touchGreat', '_touchGood', '_touchFast', '_touchSlow',
    '_flickUpPerfect', '_flickUpGreat', '_flickUpGood', '_flickUpFast', '_flickUpSlow',
    '_flickRightPerfect', '_flickRightGreat', '_flickRightGood', '_flickRightFast', '_flickRightSlow',
    '_flickLeftPerfect', '_flickLeftGreat', '_flickLeftGood', '_flickLeftFast', '_flickLeftSlow',
    '_hold', '_nullTap', '_touchSpecial', '_touchPSkill']
METHODS = [
    ('RhythmGameNoteManager.ShowHitEffect', 0x242a430, 260),
    ('EventNoteTypeExtenions.GetNoteHitType', 0x1f475b0, 244),
    ('HitEffectManager.Create', 0x21cea5c, 480),
    ('HitEffectManager.CreateInner', 0x21cec3c, 424),
    ('LiveHitEffectPrefabsData.get_prefabDict', 0x1d7b0a0, 1460),
    ('LiveHitEffectPrefabsData.GetPrefab', 0x1d7b654, 200),
    ('EffectController.Play', 0x2047038, 216),
    ('EffectController.Stop', 0x2046c64, 336),
    ('EffectController.Update', 0x2047110, 264),
    ('FloatingTarget.EnableHoldParticle', 0x205ac98, 32),
]


def curve_evidence(curve):
    mode = curve['minMaxState']
    result = dict(mode=mode, scalar=curve['scalar'])
    if mode in [2, 3]:
        result['minScalar'] = curve['minScalar']
    if mode in [1, 3]:
        result['maxCurve'] = curve['maxCurve']
    if mode == 3:
        result['minCurve'] = curve['minCurve']
    return result


def selection(binary, base):
    from unicorn import UC_HOOK_CODE
    probe = base.NativeProbe(binary, dict(leftX=-352, rightX=352, y=-212, laneWidthRate=1))
    r = probe.r
    probe.cpu.mem_write(0x466d13e, b'\1')
    probe.cpu.mem_write(0x466986d, b'\1')
    probe.w64(0x42e19a0, 0x100e0000)
    state = {}
    resuming_address = 0x2423ea8

    def service(cpu, address, size, data):
        if address == resuming_address:
            cpu.reg_write(r.UC_ARM64_REG_X0, state['resuming'])
        elif address == 0x197d840:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100f0000)
        elif address == 0x21cea5c:
            state['selected'] = dict(lane=probe.getd(r.UC_ARM64_REG_D0),
                hitType=cpu.reg_read(r.UC_ARM64_REG_X1), evaluation=cpu.reg_read(r.UC_ARM64_REG_X2))
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    for address in [resuming_address, 0x197d840, 0x21cea5c]:
        probe.cpu.hook_add(UC_HOOK_CODE, service, begin=address, end=address)
    mapping = [dict(noteType=i, hitType=probe.integer_call(0x1f475b0, i)) for i in range(12)]
    cases = []
    for resuming in [0, 1]:
        for note_type in range(12):
            for skill, special in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                state.clear()
                state['resuming'] = resuming
                probe.setup_call()
                probe.setd(r.UC_ARM64_REG_D0, 2.25)
                for register, value in [(r.UC_ARM64_REG_X0, 0x10000000), (r.UC_ARM64_REG_X1, note_type),
                    (r.UC_ARM64_REG_X2, 4), (r.UC_ARM64_REG_X3, skill), (r.UC_ARM64_REG_X4, special)]:
                    probe.cpu.reg_write(register, value)
                probe.cpu.emu_start(0x242a430, 0x1003f000, count=3000)
                cases.append(dict(resuming=bool(resuming), noteType=note_type, producerSkill=bool(skill),
                    special=bool(special), selected=state.get('selected')))
    return probe, dict(noteTypes=mapping, showHitEffect=cases,
        controlledServices=[hex(resuming_address), '0x197d840', '0x21cea5c'])


def extract(args):
    import UnityPy
    spec = importlib.util.spec_from_file_location('native_quad', ROOT / 'scripts/audit-song-track-native-note-geometry.py')
    base = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    binary = args.elf.read_bytes()
    metadata = args.metadata.read_bytes()
    if sha(binary) != base.ELF_SHA or sha(metadata) != base.METADATA_SHA:
        raise ValueError('Different Android ELF/metadata')
    sys.path.insert(0, str(ROOT.parent / 'data_pipeline'))
    import extract_il2cpp_protobuf_schema as md
    _, sections = md.parse_header(metadata)
    strings = md.build_string_reader(metadata, sections['string'])
    definitions = md.read_records(metadata, sections['type_definitions'], md.TYPE_DEFINITION_FORMAT)
    fields = md.read_records(metadata, sections['fields'], md.FIELD_DEFINITION_FORMAT)
    definition, = [d for d in definitions if strings(d[0]) == 'LiveHitEffectPrefabsData' and strings(d[1]) == 'Growing.Live']
    order = [strings(fields[i][0]) for i in range(definition[8], definition[8] + definition[18])]
    if order[:24] != FIELDS:
        raise ValueError('Different serialized hit-effect field order')
    with zipfile.ZipFile(args.ipa) as package:
        data = package.read('Payload/BNEI0395.app/Data/data.unity3d')
    if sha(data) != base.DATA_SHA:
        raise ValueError('Different IPA data.unity3d')
    env = UnityPy.load(data)
    objects = {o.path_id: o for o in env.objects if o.assets_file.name == 'resources.assets'}
    probe, cases = selection(binary, base)
    result = dict(schemaVersion=1, source=dict(elfSha256=sha(binary), metadataSha256=sha(metadata),
        dataSha256=sha(data), methods=[dict(name=name, rva=hex(rva), bytes=size, sha256=sha(probe.read(rva, size)))
            for name, rva, size in METHODS]), selection=cases, sets=[], prefabs={})

    def pointer_info(pointer):
        if not pointer.path_id:
            return dict(fileId=pointer.file_id, pathId=0, name=None)
        target = pointer.read()
        name = getattr(target, 'm_Name', None)
        if pointer.type.name == 'Shader':
            name = target.m_ParsedForm.m_Name
        return dict(fileId=pointer.file_id, pathId=pointer.path_id, name=name)

    def prefab(path_id):
        if str(path_id) in result['prefabs']:
            return
        nodes = []

        def visit(go_id, path=''):
            go = objects[go_id].read()
            name = path + '/' + go.m_Name
            entry = dict(pathId=go_id, path=name, active=go.m_IsActive, components=[])
            nodes.append(entry)
            for component in go.m_Component:
                obj = objects[component.component.path_id]
                tree = obj.read_typetree(check_read=False)
                if obj.type.name in ['Transform', 'RectTransform']:
                    entry['transform'] = {k: tree[k] for k in ['m_LocalPosition', 'm_LocalRotation', 'm_LocalScale']}
                    for child in tree['m_Children']:
                        visit(objects[child['m_PathID']].read().m_GameObject.path_id, name)
                elif obj.type.name == 'ParticleSystem':
                    entry['components'].append(dict(type=obj.type.name, pathId=obj.path_id, sha256=sha(obj.get_raw_data()),
                        duration=tree['lengthInSec'], looping=tree['looping'], prewarm=tree['prewarm'],
                        playOnAwake=tree['playOnAwake'], autoRandomSeed=tree['autoRandomSeed'],
                        startDelay=curve_evidence(tree['startDelay']), startLifetime=curve_evidence(tree['InitialModule']['startLifetime']),
                        enabledModules=[k for k, v in tree.items() if isinstance(v, dict) and v.get('enabled')]))
                elif obj.type.name in ['ParticleSystemRenderer', 'MeshRenderer', 'SpriteRenderer']:
                    materials = []
                    for pointer in obj.read().m_Materials:
                        if not pointer.path_id:
                            continue
                        material = pointer.read()
                        materials.append(dict(**pointer_info(pointer), shader=pointer_info(material.m_Shader),
                            textures=[dict(property=key, **pointer_info(value.m_Texture))
                                for key, value in material.m_SavedProperties.m_TexEnvs]))
                    entry['components'].append(dict(type=obj.type.name, pathId=obj.path_id, sha256=sha(obj.get_raw_data()),
                        renderMode=tree.get('m_RenderMode'), sortingOrder=tree.get('m_SortingOrder'), materials=materials))

        visit(path_id)
        result['prefabs'][str(path_id)] = nodes

    for obj in objects.values():
        if obj.type.name != 'MonoBehaviour':
            continue
        tree = obj.read_typetree(check_read=False)
        name = tree.get('m_Name', '')
        if not name.startswith('LiveHitEffectPrefabsData_'):
            continue
        script = obj.read(check_read=False).m_Script.read()
        if script.m_ClassName != 'LiveHitEffectPrefabsData' or script.m_Namespace != 'Growing.Live':
            raise ValueError('Different MonoScript binding')
        raw = obj.get_raw_data()
        offset = (32 + len(name.encode()) + 3) & ~3
        refs = []
        for index, field in enumerate(FIELDS):
            file_id, path_id = struct.unpack_from('<iq', raw, offset + index * 12)
            if file_id != 0 or (path_id and path_id not in objects):
                raise ValueError('Unexpected prefab PPtr')
            refs.append(dict(field=field, pathId=path_id, name=objects[path_id].read().m_Name if path_id else None))
            if path_id:
                prefab(path_id)
        result['sets'].append(dict(name=name, pathId=obj.path_id, sha256=sha(raw), refs=refs,
            useParseCamera=bool(raw[offset + 24 * 12])))
    if len(result['sets']) != 4:
        raise ValueError('Expected four authored hit-effect sets')
    # Run the real dictionary builder and selector against the authored PPtrs.
    # Only allocation and managed Dictionary operations are controlled services.
    from unicorn import UC_HOOK_CODE
    r = probe.r
    dictionary = {}
    lookups = []

    def managed(cpu, address, size, data):
        if address == 0xd9aad8:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x100e9000)
        elif address == 0x2f25760:
            dictionary[cpu.reg_read(r.UC_ARM64_REG_X1)] = cpu.reg_read(r.UC_ARM64_REG_X2)
        elif address == 0x2f273e8:
            key = cpu.reg_read(r.UC_ARM64_REG_X1)
            value = dictionary.get(key)
            if value is not None:
                probe.w64(cpu.reg_read(r.UC_ARM64_REG_X2), value)
            cpu.reg_write(r.UC_ARM64_REG_X0, int(value is not None))
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    for address in [0xd9aad8, 0x2f24d28, 0x2f25760, 0x2f273e8]:
        probe.cpu.hook_add(UC_HOOK_CODE, managed, begin=address, end=address)
    for guard in [0x46684a1, 0x46684a2]:
        probe.cpu.mem_write(guard, b'\1')
    for prefab_set in result['sets']:
        dictionary.clear()
        for index, ref in enumerate(prefab_set['refs']):
            probe.w64(0x100e1000 + 0x18 + index * 8, ref['pathId'])
        probe.w64(0x100e10e0, 0)
        probe.setup_call()
        probe.cpu.reg_write(r.UC_ARM64_REG_X0, 0x100e1000)
        probe.cpu.emu_start(0x1d7b0a0, 0x1003f000, count=5000)
        if len(dictionary) != 25:
            raise ValueError('Incomplete native prefab dictionary')
        for hit_type in range(8):
            for evaluation in range(7):
                probe.setup_call()
                probe.cpu.reg_write(r.UC_ARM64_REG_X0, 0x100e1000)
                probe.cpu.reg_write(r.UC_ARM64_REG_X1, hit_type)
                probe.cpu.reg_write(r.UC_ARM64_REG_X2, evaluation)
                probe.cpu.emu_start(0x1d7b654, 0x1003f000, count=3000)
                lookups.append(dict(set=prefab_set['name'], hitType=hit_type, evaluation=evaluation,
                    pathId=probe.cpu.reg_read(r.UC_ARM64_REG_X0)))
    result['selection']['prefabLookups'] = lookups
    result['selection']['dictionaryControlledServices'] = ['0xd9aad8', '0x2f24d28', '0x2f25760', '0x2f273e8']
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elf', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--ipa', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    evidence = extract(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f"Hit-effect evidence: {len(evidence['sets'])} sets, {len(evidence['prefabs'])} prefabs, 96 ARM64 ShowHitEffect cases")
