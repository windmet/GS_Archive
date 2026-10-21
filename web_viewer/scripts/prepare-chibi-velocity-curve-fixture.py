"""Replay the native single-curve Velocity worker with RAW-bound Hermite inputs."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native-engine', required=True)
parser.add_argument('--unicorn-path')
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
if args.unicorn_path:
    sys.path.insert(0, args.unicorn_path)
from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
from unicorn.arm64_const import (UC_ARM64_REG_SP, UC_ARM64_REG_CPACR_EL1,
    UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X2, UC_ARM64_REG_X3,
    UC_ARM64_REG_X4, UC_ARM64_REG_X5, UC_ARM64_REG_X6, UC_ARM64_REG_X30,
    UC_ARM64_REG_PC)

root = Path(__file__).resolve().parents[1]
binary = Path(args.native_engine).read_bytes()
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha(binary) == 'acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0'
uc = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
uc.mem_map(0x100000, 0x1400000)
phoff = struct.unpack_from('<Q', binary, 0x20)[0]
ents, count = struct.unpack_from('<HH', binary, 0x36)
for j in range(count):
    p = struct.unpack_from('<IIQQQQQQ', binary, phoff+j*ents)
    if p[0] == 1:
        uc.mem_write(0x100000+p[3], binary[p[2]:p[2]+p[5]])
uc.mem_map(0x2000000, 0x100000)
uc.reg_write(UC_ARM64_REG_SP, 0x20f0000)
uc.reg_write(UC_ARM64_REG_CPACR_EL1, 3 << 20)

def floats(address, values):
    uc.mem_write(address, struct.pack('<'+'f'*len(values), *values))

def ptr(address, value):
    uc.mem_write(address, struct.pack('<Q', value))

spec = importlib.util.spec_from_file_location('emitters', root/'scripts/prepare-chibi-object-emitters.py')
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)
data, fixture, _ = extractor.extract(only={'fx_in_ossshd_panel'}, partial=True)
model = data['assets']['fx_in_ossshd_panel']
assert not model['deferred'] and len(model['systems']) == 14
systems = [s for s in model['systems'] if s['velocity']]
assert len(systems) == 8
source = next(p for p in fixture['objects'][0]['particles'] if 'VelocityModule' in p['modules'])
rejections = []
for name in ['world-space','scaled-basis','orbital','two-curves','weighted-keys','noise-combination']:
    p = copy.deepcopy(source)
    velocity = p['modules']['VelocityModule']
    if name == 'world-space': velocity['inWorldSpace'] = True
    if name == 'scaled-basis': p['transformChain'][0]['scale']['x'] = 2
    if name == 'orbital': velocity['orbitalX']['scalar'] = 1
    if name == 'two-curves': velocity['y']['minMaxState'] = 2
    if name == 'weighted-keys': velocity['y']['maxCurve']['m_Curve'][0]['weightedMode'] = 1
    if name == 'noise-combination': p['modules']['NoiseModule'] = {'enabled': True}
    try:
        extractor.model(p, partial=True)
    except ValueError as error:
        rejections.append(dict(case=name, reason=str(error)))
    else:
        raise AssertionError(f'Unsupported velocity profile admitted: {name}')

def worker(curves, phases):
    for axis, curve in enumerate(curves):
        assert curve['mode'] == 1
        keys = curve['keys']
        assert len(keys) in (2,3) and keys[0]['time'] == 0 and keys[-1]['time'] == 1
        # The harness supplies the unweighted Hermite segment in the native
        # pre-baked polynomial slot. Native curve serialization/baking is not replayed.
        def segment(a,b):
            scale, span = curve['scalar'], b['time']-a['time']
            return [(2*a['value']-2*b['value']+span*(a['outSlope']+b['inSlope']))/span**3*scale,
                (-3*a['value']+3*b['value']-span*(2*a['outSlope']+b['inSlope']))/span**2*scale,
                a['outSlope']*scale, a['value']*scale]
        coefficients = segment(keys[0],keys[1])
        second = segment(keys[1],keys[2]) if len(keys)==3 else [0,0,0,keys[-1]['value']*curve['scalar']]
        ptr(0x2001000+axis*0x100+0x18, 0x2002000+axis*0x100)
        floats(0x2002000+axis*0x100+0x70, coefficients+second+[keys[1]['time']])
        ptr(0x2003000+0xc0+axis*0x20, 0x2004000+axis*0x100)
        floats(0x2004000+axis*0x100, [0]*4)
    ptr(0x2003000+0x3c0, 0x2005000)
    floats(0x2005000, [p*100 for p in phases])
    floats(0x2006000, [1,0,0,0, 0,1,0,0, 0,0,1,0])
    registers = [UC_ARM64_REG_X0, UC_ARM64_REG_X1, UC_ARM64_REG_X2,
        UC_ARM64_REG_X3, UC_ARM64_REG_X4, UC_ARM64_REG_X5, UC_ARM64_REG_X6]
    for reg, value in zip(registers, [0x2001000,0x2001100,0x2001200,0x2003000,0,4,0x2006000]):
        uc.reg_write(reg, value)
    uc.reg_write(UC_ARM64_REG_X30, 0x2007000)
    uc.emu_start(0x897f74, 0x2007000, count=10000)
    assert uc.reg_read(UC_ARM64_REG_PC) == 0x2007000
    xyz = [struct.unpack('<4f', uc.mem_read(0x2004000+j*0x100,16)) for j in range(3)]
    return [list(row) for row in zip(*xyz)]

cases = []
for system in systems:
    curves = [system['velocity'][axis] for axis in 'xyz']
    phases = [0,.25,.5,.9]
    cases.append(dict(source=system['source'], lifetime=system['lifetime'], curves=curves,
        phases=phases, expected=worker(curves, phases)))
windows = []
for address, size in [(0x897f74,504),(0x896ee4,3184)]:
    payload = bytes(uc.mem_read(address,size))
    windows.append(dict(address=hex(address), bytes=payload.hex(), sha256=sha(payload)))
proof = dict(schemaVersion=1, binarySha256=sha(binary), workerFunction='0x897f74',
    dispatchFunction='0x896ee4', moduleOffset='0x8f8', animatedVelocityOffsets=['0xc0','0xe0','0x100'],
    agePercentOffset='0x3c0', bundle=model['bundle'], bundleSha256=model['bundleSha256'],
    boundary='Direct native single-curve worker with harness-baked Hermite coefficients and identity local basis. Does not replay curve baking, frame scheduling, birth/RNG, or a game scene. Position quadrature is verified separately on the Web 60 Hz grid.',
    sourceWindows=windows, profileRejections=rejections, cases=cases)
target = root/'scripts/fixtures/chibi-velocity-curve-native.json'
if args.write:
    target.write_text(json.dumps(proof,separators=(',',':'))+'\n',encoding='utf-8')
else:
    assert json.loads(target.read_text(encoding='utf-8')) == proof, 'Native velocity proof drift'
print(json.dumps(dict(systems=len(cases), nativeSamples=sum(len(c['phases']) for c in cases))))
