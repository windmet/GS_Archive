"""Replay source Smoke side gravity, general lifetime curve and native motion pipeline."""
import argparse, hashlib, json, runpy, struct, sys
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-engine', required=True)
p.add_argument('--unicorn-path')
p.add_argument('--write', action='store_true')
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
sys.argv = [str(root / 'scripts/prepare-chibi-smoke-motion-fixture.py'), '--native-engine', args.native_engine]
if args.unicorn_path:
    sys.argv += ['--unicorn-path', args.unicorn_path]
n = runpy.run_path(sys.argv[0])
uc, floats, ptr, execute, array, snapshot = (n[k] for k in ['uc', 'floats', 'ptr', 'execute', 'array', 'snapshot'])
from unicorn import UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X30, UC_ARM64_REG_PC, UC_ARM64_REG_Q0

def absent_physics(engine, address, size, user):
    engine.reg_write(UC_ARM64_REG_X0, 0)
    engine.reg_write(UC_ARM64_REG_PC, engine.reg_read(UC_ARM64_REG_X30))

hook = uc.hook_add(UC_HOOK_CODE, absent_physics, begin=0x3901f0, end=0x3901f0)
uc.mem_write(0x126bc38, b'\x01')  # fallback diagnostic already issued
particles, context, modules, main, engine, count, dtbuf = (n[k] for k in ['particles', 'context', 'modules', 'main', 'engine', 'count', 'dtbuf'])
state, curve, keys, times, random_input = 0x20b7000, 0x20d0000, 0x20d1000, 0x20d2000, 0x20d3000

def setup(particle, seeds, dt):
    for address, size in [(particles, 0x1000), (context, 0x1000), (modules, 0x2000), (main, 0x1000),
                          (engine, 0x1000), (state, 0x1000), (curve, 0x1000), (keys, 0x1000)]:
        uc.mem_write(address, bytes(size))
    for offset in range(0, 0x780, 0x20):
        ptr(particles + offset, array(offset))
        floats(array(offset), [0] * 8)
    ptr(particles + 16, 4)
    ptr(context, engine)
    ptr(context + 8, main)
    ptr(context + 16, state)
    ptr(engine + 0x50, modules)
    floats(main + 0x28, [1])
    # Controlled native local-space enum and identity inverse; emitter/container
    # matrix construction is not part of this motion-only proof.
    floats(state + 0xcc, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])
    gravity = particle['modules']['InitialModule']['gravityModifier']
    assert gravity['minMaxState'] == 3
    uc.mem_write(modules + 0x154, struct.pack('<H', 3))
    floats(modules + 0x158, [gravity['minScalar'], gravity['scalar']])
    limit = particle['modules']['ClampVelocityModule']
    assert not limit['separateAxis'] and not limit['inWorldSpace']
    assert limit['drag']['minMaxState'] == 0 and limit['drag']['scalar'] == 0
    magnitude = limit['magnitude']
    assert magnitude['minMaxState'] == 1
    clamp = modules + 0xbf0
    uc.mem_write(clamp + 8, b'\x01')
    floats(clamp + 0xb4, [limit['dampen']])
    uc.mem_write(clamp + 0x74, struct.pack('<H', 1))
    floats(clamp + 0x7c, [magnitude['scalar']])
    ptr(clamp + 0x88, curve)
    # Actual general AnimationCurve layout; leave fast-cache flag off. The
    # native evaluator builds its own Hermite coefficients from these keys.
    floats(curve + 4, [float('inf'), 0])
    source_curve = magnitude['maxCurve']
    source_keys = source_curve['m_Curve']
    ptr(curve + 0x38, keys)
    ptr(curve + 0x48, len(source_keys))
    uc.mem_write(curve + 0x58, struct.pack('<II', source_curve['m_PreInfinity'], source_curve['m_PostInfinity']))
    uc.mem_write(curve + 0x60, struct.pack('<I', 4))
    for i, key in enumerate(source_keys):
        assert key['weightedMode'] == 0
        uc.mem_write(keys + i * 28, struct.pack('<ffffIff', *[key[k] for k in
                     ['time', 'value', 'inSlope', 'outSlope', 'weightedMode', 'inWeight', 'outWeight']]))
    bound = next(c for c in n['cases'] if c['source']['pathId'] == particle['pathId'])
    for axis in range(3):
        floats(array(axis * 0x20), [v[axis] for v in bound['scaled']])
        floats(array(0x60 + axis * 0x20), [v[axis + 3] for v in bound['scaled']])
    uc.mem_write(array(0x380), struct.pack('<4I', *seeds))
    floats(dtbuf, [dt] * 4)
    ptr(count, 4)
    return clamp, bound

def gravity_draw(seed):
    a = (seed - 0x1d483c3d) & 0xffffffff
    b = (a * 0x6ab51b9d + 0x714acb3f) & 0xffffffff
    t = (a ^ (a << 11)) & 0xffffffff
    return ((b ^ (b >> 19) ^ t ^ (t >> 8)) & 0x7fffff) / 8388608

cases, curve_cases = [], []
for particle in n['n']['source']['particles']:
    if 'ClampVelocityModule' not in particle['modules']:
        continue
    for seeds in [[0, 1, 0x12345678, 0xffffffff], [42, 0x80000000, 0x22222222, 0x87654321]]:
        for dt, steps, checkpoints in [(1 / 60, 480, [1, 12, 60, 180, 480]), (1 / 30, 240, [1, 6, 30, 90, 240])]:
            clamp, bound = setup(particle, seeds, dt)
            initial = snapshot()
            # Record an isolated source-gravity step before testing the joined
            # native pipeline, so JS random/acceleration can be checked too.
            execute(0x70dae8, [modules, main, state, particles, 0, 4, dtbuf])
            gravity_step = snapshot()
            for axis in range(3):
                floats(array(0x60 + axis * 0x20), [v[axis + 3] for v in initial])
            execute(0x6deb6c, [clamp + 0x70])
            fast = uc.reg_read(UC_ARM64_REG_X0)
            assert fast == 0, 'Nonzero/nonunit source endpoints must reject the fast cache'
            trace = []
            life = particle['modules']['InitialModule']['startLifetime']['scalar']
            assert dt * steps < life
            for step in range(steps):
                # Explicit post-step phase input, as in existing Bloom probes;
                # the original engine clock/retirement is outside this fixture.
                floats(array(0x3c0), [(step + 1) * dt / life * 100] * 4)
                execute(0x6db88c, [context, particles, 0, 4, dtbuf, 0])
                execute(0x6d1e9c, [context, particles, 0, count, dtbuf, 0])
                assert struct.unpack('<Q', uc.mem_read(count, 8))[0] == 4
                if step + 1 in checkpoints:
                    trace.append(dict(step=step + 1, expected=snapshot()))
            cases.append(dict(source=bound['source'], gravity=particle['modules']['InitialModule']['gravityModifier'],
                              limit=particle['modules']['ClampVelocityModule'], life=life, seeds=seeds,
                              gravityDraws=[gravity_draw(seed) for seed in seeds], dt=dt, steps=steps,
                              initial=initial, gravityStep=gravity_step, fastCacheAccepted=bool(fast), trace=trace))
    clamp, bound = setup(particle, [0, 1, 2, 3], 1 / 60)
    source_keys = particle['modules']['ClampVelocityModule']['magnitude']['maxCurve']['m_Curve']
    phases = [-.1, 0, .001, source_keys[0]['time'] - .00001, source_keys[0]['time'],
              source_keys[0]['time'] + .00001, .1, .3, .5, .9, source_keys[1]['time'] - .00001,
              source_keys[1]['time'], source_keys[1]['time'] + .00001, 1, 1.1, .2]
    for i in range(0, len(phases), 4):
        floats(times, phases[i:i + 4])
        execute(0x6e1838, [clamp + 0x70, times, random_input])
        expected = list(struct.unpack('<4f', uc.reg_read(UC_ARM64_REG_Q0).to_bytes(16, 'little')))
        curve_cases.append(dict(source=bound['source'], phases=phases[i:i + 4], expected=expected))
uc.hook_del(hook)
windows = []
for address, size in [(0x70dae8, 2288), (0x6db88c, 0x260), (0x6f8e28, 256), (0x6e1838, 128),
                      (0x66334c, 128), (0x65e98c, 128), (0x6d1e9c, 128)]:
    raw = bytes(uc.mem_read(address, size))
    windows.append(dict(address=hex(address), bytes=raw.hex(), sha256=hashlib.sha256(raw).hexdigest()))
proof = dict(schemaVersion=1, binarySha256=n['n']['n']['identity'],
             sourceSha256=hashlib.sha256(n['n']['source_path'].read_bytes()).hexdigest(),
             motionSha256=hashlib.sha256((root / 'scripts/fixtures/chibi-smoke-motion-native.json').read_bytes()).hexdigest(),
             sourceWindows=windows, cases=cases, curveCases=curve_cases,
             boundary='Four source side systems: native general curve (fast cache rejected), TwoConstants gravity and joined 0x6db88c then 0x6d1e9c. Controlled seeds, identity local inverse, runtime module layout, explicit post-step phases, step schedule and living particles. PhysicsManager getter returns null for native built-in gravity fallback; existing libm powf ABI adapter retained. No original frame clock/seed, retirement, moving-parent/container/camera, size/color/UV or renderer admission.')
target = root / 'scripts/fixtures/chibi-smoke-side-native.json'
if args.write:
    target.write_text(json.dumps(proof, separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
else:
    assert json.loads(target.read_text(encoding='utf8')) == proof, 'Changed Smoke native side evidence'
print(json.dumps(dict(systems=4, trajectories=len(cases), steps=sum(c['steps'] for c in cases), curveBatches=len(curve_cases), status='controlled_native_side_motion')))
