"""Replay source Smoke sheet layout through native renderer context and UV writer."""
import argparse, hashlib, json, runpy, struct, sys
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-engine', required=True)
p.add_argument('--unicorn-path')
p.add_argument('--write', action='store_true')
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
sys.argv = [str(root / 'scripts/prepare-chibi-smoke-billboard-fixture.py'), '--native-engine', args.native_engine]
if args.unicorn_path:
    sys.argv += ['--unicorn-path', args.unicorn_path]
n = runpy.run_path(sys.argv[0])
uc, floats, execute = n['uc'], n['floats'], n['original_execute']
from unicorn import UC_HOOK_CODE
hook = uc.hook_add(UC_HOOK_CODE, n['n']['free_null'], begin=0x306258, end=0x306258)
context, uv_module, frames, output, secondary = 0x20a0000, 0x2093830, 0x20d0000, 0x20d1000, 0x20d2000
cases = []
for particle in n['source']['particles']:
    if 'UVModule' not in particle['modules']:
        continue
    uv = particle['modules']['UVModule']
    assert uv['mode'] == uv['timeMode'] == uv['animationType'] == 0
    assert uv['flipU'] == uv['flipV'] == 0 and uv['cycles'] == 1
    assert uv['startFrame']['minMaxState'] == 0 and uv['startFrame']['scalar'] == 0
    initial = particle['modules']['InitialModule']
    n['vertices']([0, 0, 0], False, particle['transformChain'], 1, {}, position=[.6, -.4, .2],
                  particleSize=[initial[k]['scalar'] for k in ['startSize', 'startSizeY', 'startSizeZ']],
                  sizeBounds=[particle['rendererBounds'][k] for k in ['m_MinParticleSize', 'm_MaxParticleSize']], viewHeight=7.2)
    uc.mem_write(uv_module, bytes(0x100))
    uc.mem_write(uv_module + 8, b'\x01')
    uc.mem_write(uv_module + 0x60, struct.pack('<II', uv['tilesX'], uv['tilesY']))
    uc.mem_write(uv_module + 0x74, struct.pack('<i', uv['uvChannelMask']))
    execute(0x6c505c, [0x20e0000, 0x2090000, 0x20e4000, 0, context, 0x20a1000, 0])
    flags = struct.unpack('<I', uc.mem_read(context + 0x148, 4))[0]
    tile_count = struct.unpack('<f', uc.mem_read(context + 0x140, 4))[0]
    assert flags & 0x3ff == uv['tilesX'] and (flags >> 10) & 0x1ff == uv['tilesY']
    assert tile_count == uv['tilesX'] * uv['tilesY'] and flags & 0x2000000
    for values in [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [.9999, 1.0001, 11.9987, 11.9988]]:
        floats(frames, values)
        uc.mem_write(output, bytes(0x1000))
        uc.mem_write(secondary, bytes(0x1000))
        execute(0x813330, [context, frames, (flags >> 19) & 63, uv_module, 1, output, secondary])
        raw = struct.unpack('<32f', uc.mem_read(output, 128))
        expected = [[[raw[corner * 8 + lane], raw[corner * 8 + 4 + lane]] for corner in range(4)] for lane in range(4)]
        cases.append(dict(source={k: particle[k] for k in ['serializedFile', 'pathId', 'parameterTreeSha256']},
                          flags=flags, tileCount=tile_count, frames=values, expected=expected))
uc.hook_del(hook)
windows = []
for address, size in [(0x813330, 256), (0x6c505c, 128), (0x6d8fe0, 44), (0x86ecc8, 256)]:
    raw = bytes(uc.mem_read(address, size))
    windows.append(dict(address=hex(address), bytes=raw.hex(), sha256=hashlib.sha256(raw).hexdigest()))
proof = dict(schemaVersion=1, binarySha256=n['proof']['binarySha256'],
             sourceSha256=hashlib.sha256(n['source_path'].read_bytes()).hexdigest(), sourceWindows=windows,
             cases=cases, boundary='Two source down systems, native source hierarchy/context builder then UV writer, all twelve frames and controlled frame-index boundaries. Only free(NULL) ABI adapter. Frame indices are controlled inputs; this does not execute the UV animation update/cache generator, emission clock, texture upload/filtering, fragment shader or scene consumer.')
target = root / 'scripts/fixtures/chibi-smoke-uv-native.json'
if args.write:
    target.write_text(json.dumps(proof, separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
else:
    assert json.loads(target.read_text(encoding='utf8')) == proof, 'Changed native Smoke UV evidence'
print(json.dumps(dict(systems=2, batches=len(cases), quads=len(cases) * 4, status='controlled_native_uv_layout')))
