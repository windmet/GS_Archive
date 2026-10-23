"""Replay the common lead-time chain and typed NoteInfo timing, including Special.

Sequence reset, settings read time, SetDelayLeadTime, NoteInfo and EventNoteData
math execute ARM64. Clock/calculation handoff and debug preferences are explicit
services. This does not assume the debug toggle imposes a gameplay override.
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
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
sha = lambda data: hashlib.sha256(data).hexdigest()


class Probe(native.NativeProbe):
    def __init__(self, binary, target):
        from unicorn import UC_HOOK_CODE
        super().__init__(binary, target)
        self.cpu.mem_write(0x4666c11, b'\1')
        self.cpu.mem_write(0x466986c, b'\1')
        self.cpu.mem_write(0x4669869, b'\1')
        self.cpu.mem_write(0x466a54d, b'\1')
        self.services = [0x1afd000, 0x20bb100, 0x20baa30, 0x1df9818]
        for address in self.services:
            self.cpu.hook_add(UC_HOOK_CODE, self.service, begin=address, end=address)
        self.common_lead = None
        self.debug_default = None

    def service(self, cpu, address, size, data):
        r = self.r
        if address in [0x1afd000, 0x20baa30]:
            self.setd(r.UC_ARM64_REG_D0, 0)
        elif address == 0x20bb100:
            self.common_lead = self.getd(r.UC_ARM64_REG_D0)
        elif address == 0x1df9818:
            self.debug_default = cpu.reg_read(r.UC_ARM64_REG_X1)
            cpu.reg_write(r.UC_ARM64_REG_X0, self.debug_default)
        cpu.reg_write(r.UC_ARM64_REG_PC, cpu.reg_read(r.UC_ARM64_REG_X30))

    def reset(self, setting):
        self.w32(0x10004010, setting)
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, 0x10094000)
        self.cpu.reg_write(self.r.UC_ARM64_REG_X1, 0x10098000)
        self.cpu.emu_start(0x1b02384, 0x1003f000, count=5000)
        return self.common_lead

    def note_time(self, note_type, current, hit, lead, speed):
        self.w64(0x10040018, 0x10041000)
        self.w32(0x10041038, note_type)
        self.cpu.mem_write(0x10041010, struct.pack('<d', hit))
        self.cpu.mem_write(0x10041044, struct.pack('<f', speed))
        self.cpu.mem_write(0x10041060, struct.pack('<d', lead))
        self.setup_call()
        self.cpu.reg_write(self.r.UC_ARM64_REG_X0, 0x10040000)
        self.setd(self.r.UC_ARM64_REG_D0, current)
        self.cpu.emu_start(0x1edcc28, 0x1003f000, count=500)
        return self.getd(self.r.UC_ARM64_REG_D0)


def run(args):
    if args.unicorn_runtime:
        sys.path.insert(0, str(args.unicorn_runtime))
    binary = args.native_elf.read_bytes()
    if sha(binary) != native.ELF_SHA:
        raise ValueError('Different ELF; bind client/RVAs first')
    geometry = json.loads((ROOT / 'config/song-track-native-geometry.v1.json').read_bytes())
    p = Probe(binary, geometry['target'])
    p.setup_call()
    p.cpu.emu_start(0x2059fe8, 0x1003f000, count=500)
    if p.debug_default != 1:
        raise ValueError('Different debug preference default')
    settings = []
    cases = []
    for setting in [10, 50, 110]:
        lead = p.reset(setting)
        settings.append(dict(setting=setting, displaySpeed=setting / 10, commonLeadSeconds=lead))
        for note_type in [0, 9]:
            for speed in [1, .2, 1.5]:
                for current in [0, 6.5, 10, 10.25]:
                    cases.append(dict(noteType=note_type, displaySpeed=setting / 10, speed=speed,
                        currentSeconds=current, hitSeconds=10, leadSeconds=lead,
                        noteTime=p.note_time(note_type, current, 10, lead, speed)))
    enum = json.loads((ROOT / 'config/song-note-rendering.v1.json').read_bytes())['nativeEnums']['EventNoteType']['values']
    classifications = [dict(name=e['name'], noteType=e['value'],
        isHold=bool(p.integer_call(0x1f46110, e['value'])),
        usesHoldMesh=bool(p.integer_call(0x1f47364, e['value']))) for e in enum if e['value'] >= 0]
    names = sorted(set(int(line.split('\t', 1)[0], 16) for line in Path('E:/Tools/ghidra_work/sidem/names.tsv').read_text(encoding='utf8').splitlines() if '\t' in line))
    window = lambda a: min(n for n in names if n > a) - a
    methods = [('EventNoteTypeExtenions.IsAnyHold', 0x1f46110, window(0x1f46110)),
        ('EventNoteTypeExtenions.IsAnyHoldOrFlick', 0x1f47364, window(0x1f47364)),
        ('RhythmGameNoteManager.OnNewNote', 0x2426874, window(0x2426874)),
        ('HoldMesh.Create', 0x21cf2c4, window(0x21cf2c4)),
        ('SequencePlayer.ISequenceListener.OnReset', 0x1b02384, 276),
        ('RhythmGameManager.get_leadTime', 0x1b02364, 32), ('LiveSettingsData.GetReadTime', 0x1c1b160, 36),
        ('NoteManager.SetDelayLeadTime', 0x20bb0f4, 12), ('NoteManager.CalcAbsoluteTime', 0x20bb100, 844),
        ('NoteInfo.GetNoteTime', 0x1edcc28, 28), ('EventNoteData.GetNoteTime', 0x1f471cc, 32),
        ('FixSpNoteSpeedButton.get_isOn', 0x2059fe8, 76)]
    result = dict(schemaVersion=1, source=dict(elfSha256=sha(binary),
        methods=[dict(name=name, rva=hex(a), bytes=n, sha256=sha(p.read(a, n))) for name, a, n in methods],
        services=[hex(a) for a in p.services], debugPreferenceDefault=p.debug_default,
        boundaries='Default common lead and typed timing proved; static xrefs found only debug UI callers of FixSpNoteSpeedButton. This is not a claim about arbitrary reflection or saved player preferences.'),
        settings=settings, cases=cases, classifications=classifications)
    target = ROOT / 'scripts/fixtures/song-track-native-special-timing.json'
    if args.write:
        target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8', newline='\n')
    elif json.loads(target.read_bytes()) != result:
        raise ValueError('Native Special timing fixture drift')
    print(f'Native common/Special timing: {len(settings)} sequence-reset settings, {len(cases)} typed timing cases; debug default {p.debug_default}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
