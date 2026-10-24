"""Replay source Smoke moving-edge births, including Unity's static initializer."""
import argparse, hashlib, json, runpy, struct, sys
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-engine', required=True)
p.add_argument('--unicorn-path')
p.add_argument('--write', action='store_true')
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
source_path = root / 'scripts/fixtures/chibi-smoke-source.json'
source = json.loads(source_path.read_text(encoding='utf8'))
sys.argv = [str(root / 'scripts/prepare-chibi-noise-kernel-fixture.py'), '--native-engine', args.native_engine]
if args.unicorn_path:
    sys.argv += ['--unicorn-path', args.unicorn_path]
n = runpy.run_path(sys.argv[0])
uc, floats, ptr, execute = (n[k] for k in ['uc', 'floats', 'ptr', 'execute'])
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X5, UC_ARM64_REG_X6, UC_ARM64_REG_X7

module, particles, state, speed, matrix = 0x20a0000, 0x20a1000, 0x20a2000, 0x20a3000, 0x20a4000
seen = []

def observe(engine, address, size, user):
    row = {}
    for key, reg, count in [('positionMatrix', UC_ARM64_REG_X0, 16), ('shapeMatrix', UC_ARM64_REG_X1, 16),
                            ('rawPosition', UC_ARM64_REG_X5, 12), ('rawDirection', UC_ARM64_REG_X6, 12)]:
        row[key] = list(struct.unpack('<' + 'f' * count, engine.mem_read(engine.reg_read(reg), count * 4)))
    seen.append(row)

hook = uc.hook_add(UC_HOOK_CODE, observe, begin=0x8611d8, end=0x8611d8)

def birth(particle, seed):
    shape = particle['modules']['ShapeModule']
    assert shape['type'] == 12 and shape['radius']['mode'] == 0
    assert shape['randomDirectionAmount'] == shape['sphericalDirectionAmount'] == shape['randomPositionAmount'] == 0
    for address in [module, particles, state, speed, matrix]:
        uc.mem_write(address, bytes(0x1000))
    for offset in range(0, 0x780, 0x20):
        ptr(particles + offset, 0x20c0000 + offset * 8)
        floats(0x20c0000 + offset * 8, [0] * 8)
    ptr(particles + 0x10, 4)
    floats(speed, [particle['modules']['InitialModule']['startSpeed']['scalar']] * 16)
    floats(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    floats(state + 0x148, [1, 1, 1])
    uc.mem_write(module + 0xc, struct.pack('<I', 12))
    floats(module + 0x10, [shape['radius']['value']])
    for offset, key in [(0xa0, 'm_Position'), (0xac, 'm_Rotation'), (0xb8, 'm_Scale')]:
        floats(module + offset, [shape[key][axis] for axis in 'xyz'])
    uc.mem_write(module + 0x230, struct.pack('<16I', *seed))
    uc.reg_write(UC_ARM64_REG_X7, 0)
    seen.clear()
    execute(0x855d64, [module, 0, state, particles, speed, matrix, 0])
    assert len(seen) == 1
    output = [[struct.unpack('<f', uc.mem_read(0x20c0000 + offset * 8 + lane * 4, 4))[0]
               for offset in [0, 0x20, 0x40, 0x60, 0x80, 0xa0]] for lane in range(4)]
    return dict(intermediate=seen[0], expected=output,
                finalSeed=list(struct.unpack('<16I', uc.mem_read(module + 0x230, 64))))

seed0 = [(0x12345678 + i * 0x13782103) & 0xffffffff for i in range(16)]
before = bytes(uc.mem_read(0x126fe50, 0xc0))
uninitialized = birth(source['particles'][0], seed0)
execute(0x1c3d68, [])
after = bytes(uc.mem_read(0x126fe50, 0xc0))
assert before != after, 'Native startup constants must change'
initialized = birth(source['particles'][0], seed0)
assert initialized['expected'] != uninitialized['expected'], 'Missing startup must be detected by the control'
cases = []
for particle in source['particles']:
    for batch in range(5):
        seed = [((0x12345678 + i * 0x13782103) ^ (batch * 0x24919215)) & 0xffffffff for i in range(16)]
        result = birth(particle, seed)
        draws = []
        for lane in range(4):
            a, b, c, d = [seed[lane + i * 4] for i in range(4)]
            t = (a ^ (a << 11)) & 0xffffffff
            value = (d ^ (d >> 19) ^ t ^ (t >> 8)) & 0xffffffff
            assert [result['finalSeed'][lane + i * 4] for i in range(4)] == [b, c, d, value]
            draws.append((value & 0x7fffff) / 8388608)
        cases.append(dict(source={k: particle[k] for k in ['serializedFile', 'pathId', 'parameterTreeSha256']},
                          shape=particle['modules']['ShapeModule'], seed=seed, draws=draws, **result))
uc.hook_del(hook)
windows = []
for address, size in [(0x1c3d68, 0x100), (0x855d64, 0x240), (0x860774, 644), (0x8611d8, 128)]:
    raw = bytes(uc.mem_read(address, size))
    windows.append(dict(address=hex(address), bytes=raw.hex(), sha256=hashlib.sha256(raw).hexdigest()))
proof = dict(schemaVersion=1, binarySha256=n['identity'], sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
             sourceWindows=windows, initialization=dict(function='0x1c3d68', address='0x126fe50',
             before=before.hex(), after=after.hex(), seed=seed0, uninitialized=uninitialized, initialized=initialized), cases=cases,
             boundary='Full native Shape dispatch, static initializer, source shape TRS and random-edge worker. Controlled identity emitter matrix and unit system scale. Outputs are unit directions, not initial-speed-scaled velocity. No initial module, local integration, gravity, limiter, scene/camera bridge or renderer admission.')
target = root / 'scripts/fixtures/chibi-smoke-edge-native.json'
if args.write:
    target.write_text(json.dumps(proof, separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
else:
    assert json.loads(target.read_text(encoding='utf8')) == proof, 'Changed Smoke native edge evidence'
print(json.dumps(dict(systems=len(source['particles']), batches=len(cases), particles=len(cases) * 4, status='native_edge_births_only')))
