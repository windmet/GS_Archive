"""Execute native middle-note generation; generic collection/clock/id services are stubs.

The caller's variable-hold predicate, Skip/Take arguments, cloning constructor,
Set and child-building lambda execute ARM64. Controlled generic Skip/Take and
ForEach adapters use the arguments actually passed by that native method.
Absolute timing and parent-id string formatting are outside these fixtures.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('quad_probe', ROOT / 'scripts/audit-song-track-native-note-geometry.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
sha = lambda data: hashlib.sha256(data).hexdigest()


class Probe(base.NativeProbe):
    def __init__(self, binary, target):
        from unicorn import UC_HOOK_CODE
        super().__init__(binary, target)
        self.cpu.mem_write(0x4669866, b'\1')
        self.cpu.mem_write(0x4667836, b'\1')
        self.extra_stubs = [0xdf63f0, 0x175d8ac, 0x3094ba8, 0x1bcfeac, 0x1bd0028,
                            0x2645eb4, 0x1be18f8, 0x20bb600, 0x1fb8900, 0x3095810]
        for address in self.extra_stubs:
            self.cpu.hook_add(UC_HOOK_CODE, self.service, begin=address, end=address)

    def allocate(self):
        address = self.next_object
        self.next_object += 0x200
        self.cpu.mem_write(address, bytes(0x200))
        return address

    def service(self, cpu, address, size, data):
        r = self.r
        x0, x1, x2 = (cpu.reg_read(reg) for reg in [r.UC_ARM64_REG_X0, r.UC_ARM64_REG_X1, r.UC_ARM64_REG_X2])
        if address == 0xdf63f0:
            cpu.reg_write(r.UC_ARM64_REG_X0, self.allocate())
        elif address == 0x175d8ac:
            pass
        elif address == 0x3094ba8:
            self.collections[x0] = []
        elif address in [0x1bcfeac, 0x1bd0028]:
            count = x1 & 0xffffffff
            values = self.collections[x0]
            address_out = self.allocate()
            self.collections[address_out] = values[count:] if address == 0x1bcfeac else values[:count]
            cpu.reg_write(r.UC_ARM64_REG_X0, address_out)
        elif address == 0x2645eb4:
            self.delegates[x0] = x1
        elif address == 0x1be18f8:
            self.actions.extend((self.delegates[x1], value) for value in self.collections[x0])
        elif address == 0x20bb600:
            self.setd(r.UC_ARM64_REG_D0, 0)
        elif address == 0x1fb8900:
            cpu.reg_write(r.UC_ARM64_REG_X0, 0x1007ff00)
        elif address == 0x3095810:
            self.collections[x0].append(x1)
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    def generate(self, note_type, tick, speed, duration, poly):
        if not self.integer_call(0x1f463dc, note_type):
            return []
        self.next_object = 0x10080000
        self.collections, self.delegates, self.actions = {}, {}, []
        parent, array = 0x10071000, 0x10070000
        self.cpu.mem_write(parent, bytes(0x100))
        self.w64(parent + 0x20, tick)
        self.w32(parent + 0x38, note_type)
        self.cpu.mem_write(parent + 0x44, struct.pack('<f', speed))
        self.w32(parent + 0x4c, duration)
        self.w64(parent + 0x50, array)
        self.w32(array + 0x18, len(poly))
        values = []
        for i, (subtick, lane) in enumerate(poly):
            obj = 0x10072000 + i * 0x100
            self.cpu.mem_write(obj + 0x10, struct.pack('<if', subtick, lane))
            self.w64(array + 0x20 + i * 8, obj)
            values.append(obj)
        self.collections[array] = values
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, parent)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X1, 0x10074000)
        self.cpu.emu_start(0x1f46e3c, 0x1003f000, count=10000)
        output_list = self.cpu.reg_read(self.r.UC_ARM64_REG_X0)
        for closure, node in self.actions:
            self.setup_call()
            self.cpu.reg_write(self.r.UC_ARM64_REG_X0, closure)
            self.cpu.reg_write(self.r.UC_ARM64_REG_X1, node)
            self.cpu.emu_start(0x1c33724, 0x1003f000, count=10000)
        out = []
        for obj in self.collections[output_list]:
            read = lambda offset, fmt: struct.unpack(fmt, self.cpu.mem_read(obj + offset, struct.calcsize(fmt)))[0]
            out.append(dict(tick=read(0x20, '<q'), lane=read(0x3c, '<f'), speed=read(0x44, '<f'),
                            type=read(0x38, '<i'), duration=read(0x4c, '<i'), endtype=read(0x58, '<i')))
        return out


def run(args):
    if args.unicorn_runtime:
        sys.path.insert(0, str(args.unicorn_runtime))
    binary = args.native_elf.read_bytes()
    if sha(binary) != base.ELF_SHA:
        raise ValueError('Different ELF; bind version/RVAs first')
    geometry = json.loads((ROOT / 'config/song-track-native-geometry.v1.json').read_bytes())
    enum_bytes = (ROOT / 'config/song-track-native-note-geometry.v1.json').read_bytes()
    native_notes = json.loads(enum_bytes)
    if native_notes['source']['nativeEnumValues']['VARIABLE_HOLD'] != 6 or native_notes['source']['nativeEnumValues']['LARGE_VARIABLE_HOLD'] != 8:
        raise ValueError('Different enum contract')
    probe = Probe(binary, geometry['target'])
    methods = [('EventNoteType.IsAnyVariableHold', 0x1f463dc, 40),
               ('EventNoteData.GetChildHoldMiddleNotes', 0x1f46e3c, 412),
               ('EventNoteData.MiddleLambda', 0x1c33724, 276),
               ('EventNoteData..ctor', 0x1f46d2c, 68), ('EventNoteData.Set', 0x1f46dc0, 124),
               ('EventData..ctor', 0x1fb88c8, 56),
               ('NoteScrObj.VariableHoldPredicate', 0x1bfeb14, 112),
               ('NoteScrObj.MiddleSelector', 0x1bfec10, 36)]
    source = dict(elfSha256=sha(binary), enumContractSha256=sha(enum_bytes), metadataSha256=native_notes['source']['metadataSha256'],
                  methods=[dict(name=name, rva=hex(a), bytes=n, sha256=sha(probe.read(a, n))) for name, a, n in methods],
                  controlledStubs=[hex(a) for a in probe.extra_stubs],
                  boundaries='Clock conversion and id string formatting are stubs; fixtures prove selection, tick/lane/speed/type/duration/endtype, not input judging')
    cases = []
    for note_type in [0, 5, 6, 7, 8, 9]:
        for poly in [[], [[0, 0], [1000, 4]], [[0, 0], [500, 2.35], [1000, 4]],
                     [[0, 0], [0, 1], [1000, 3], [1000, 4]]]:
            for speed in [1, .2, 1.5]:
                case = dict(noteType=note_type, tick=7200, speed=speed, duration=1000, poly=poly)
                case['children'] = probe.generate(note_type, 7200, speed, 1000, poly)
                cases.append(case)
    fixture = dict(schemaVersion=1, source=source, cases=cases)
    target = ROOT / 'scripts/fixtures/song-track-native-middle-nodes.json'
    if args.write:
        target.write_text(json.dumps(fixture, indent=2) + '\n', encoding='utf8', newline='\n')
    elif json.loads(target.read_bytes()) != fixture:
        raise ValueError('Native middle-node fixture drift')
    print(f'Native middle generation: {len(cases)} cases, {sum(len(c["children"]) for c in cases)} children verified')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
