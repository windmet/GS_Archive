"""Replay native Smoke initial-speed scaling and force-free down-group integration."""
import argparse, hashlib, json, runpy, struct, sys
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-engine', required=True)
p.add_argument('--unicorn-path')
p.add_argument('--write', action='store_true')
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
sys.argv = [str(root / 'scripts/prepare-chibi-smoke-edge-fixture.py'), '--native-engine', args.native_engine]
if args.unicorn_path:
    sys.argv += ['--unicorn-path', args.unicorn_path]
n = runpy.run_path(sys.argv[0])
uc, floats, ptr, execute = (n[k] for k in ['uc', 'floats', 'ptr', 'execute'])
from unicorn.arm64_const import UC_ARM64_REG_X7

particles = n['particles']
context, modules, main, engine, count, dtbuf = 0x20b0000, 0x20b1000, 0x20b3000, 0x20b4000, 0x20b5000, 0x20b6000
def array(offset):
    return 0x20c0000 + offset * 8

def snapshot():
    return [[struct.unpack('<f', uc.mem_read(array(offset) + lane * 4, 4))[0]
             for offset in [0, 0x20, 0x40, 0x60, 0x80, 0xa0]] for lane in range(4)]

cases = []
assert bytes(uc.mem_read(0xee07c7, 11)) == b'startSpeed\0'
for particle in n['source']['particles']:
    initial = particle['modules']['InitialModule']
    speed = initial['startSpeed']
    assert speed['minMaxState'] == 0
    edge = next(row for row in n['cases'] if row['source']['pathId'] == particle['pathId'])
    for address in [particles, context, modules, main, engine, count, dtbuf]:
        uc.mem_write(address, bytes(0x1000))
    for offset in range(0, 0x780, 0x20):
        ptr(particles + offset, array(offset))
        floats(array(offset), [0] * 8)
    ptr(particles + 0x10, 4)
    for axis in range(3):
        floats(array(axis * 0x20), [row[axis] for row in edge['expected']])
        floats(array(0x60 + axis * 0x20), [row[axis + 3] for row in edge['expected']])
    # Native cached MinMaxCurve layout, confirmed by the runtime serializer and
    # 0x6d846c. No host-side multiplication of the direction by the speed.
    ptr(context + 0x50, modules)
    floats(modules + 0x3c, [speed['scalar']])
    uc.mem_write(modules + 0x34, struct.pack('<H', speed['minMaxState']))
    uc.reg_write(UC_ARM64_REG_X7, 0)
    execute(0x6d846c, [context, particles, 0, 4, dtbuf, dtbuf, 1])
    scaled = snapshot()
    for before, after in zip(edge['expected'], scaled):
        for axis in range(3):
            assert abs(after[axis + 3] - before[axis + 3] * speed['scalar']) < 2e-6
    row = dict(source=edge['source'], speed=speed, edgeSeed=edge['seed'], initial=edge['expected'], scaled=scaled, trajectories=[])
    # Only the two force-free down systems are admitted to this integration
    # probe. Side systems retain their real gravity and lifetime limit gap.
    if not {'ClampVelocityModule', 'VelocityModule', 'NoiseModule'} & particle['modules'].keys() and initial['gravityModifier']['scalar'] == 0:
        assert particle['main']['moveWithTransform'] == 1
        ptr(context, engine)
        ptr(context + 8, main)
        ptr(engine + 0x50, modules)
        uc.mem_write(main + 0x44, struct.pack('<I', 0))  # native local simulation enum
        for dt, steps in [(1 / 60, 12), (1 / 60, 90), (1 / 30, 45)]:
            for axis in range(3):
                floats(array(axis * 0x20), [v[axis] for v in scaled])
                floats(array(0x60 + axis * 0x20), [v[axis + 3] for v in scaled])
            ptr(count, 4)
            floats(dtbuf, [dt] * 4)
            for step in range(steps):
                execute(0x6d1e9c, [context, particles, 0, count, dtbuf, 0])
                assert struct.unpack('<Q', uc.mem_read(count, 8))[0] == 4
            final = snapshot()
            for start, end in zip(scaled, final):
                for axis in range(3):
                    assert abs(end[axis] - (start[axis] + start[axis + 3] * dt * steps)) < 1e-5
            row['trajectories'].append(dict(dt=dt, steps=steps, expected=final))
    cases.append(row)
assert sum(bool(c['trajectories']) for c in cases) == 2
windows = []
for address, size in [(0x6d846c, 1664), (0x6d1e9c, 128), (0x70facc, 256), (0x6d34f8, 256)]:
    raw = bytes(uc.mem_read(address, size))
    windows.append(dict(address=hex(address), bytes=raw.hex(), sha256=hashlib.sha256(raw).hexdigest()))
proof = dict(schemaVersion=1, binarySha256=n['n']['identity'],
             speedCache=dict(serializedNameAddress='0xee07c7', serializedName='startSpeed', curveOffset=0x30, modeOffset=0x34, scalarOffset=0x3c),
             sourceSha256=hashlib.sha256(n['source_path'].read_bytes()).hexdigest(),
             edgeSha256=hashlib.sha256((root / 'scripts/fixtures/chibi-smoke-edge-native.json').read_bytes()).hexdigest(),
             sourceWindows=windows, cases=cases,
             boundary='Native constant startSpeed scaling for all six source systems, then force-free integration for two down systems. Births replayed by the bound native edge tool. Controlled runtime cache/layout, seed, local enum, zero animated velocity and step schedule. No full initial-module entry, side gravity/limit, emission clock, retirement, moving-parent/container/camera bridge or renderer admission.')
target = root / 'scripts/fixtures/chibi-smoke-motion-native.json'
if args.write:
    target.write_text(json.dumps(proof, separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
else:
    assert json.loads(target.read_text(encoding='utf8')) == proof, 'Changed Smoke native motion evidence'
print(json.dumps(dict(speeds=len(cases), forceFreeSystems=2, trajectories=6, status='controlled_native_speed_and_force_free_integration')))
