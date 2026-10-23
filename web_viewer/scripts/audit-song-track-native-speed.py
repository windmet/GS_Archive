"""Execute the pinned 2.6.10 ARM64 GetReadTime method to check its fixture.

Requires Unicorn (or --unicorn-runtime pointing to an existing installation).
No source assets are copied. --write updates only the small speed fixture.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'config/song-track-native-speed.v1.json'
ELF_SHA = '9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'


def run(args):
    if args.unicorn_runtime:
        sys.path.insert(0, str(args.unicorn_runtime))
    from unicorn import Uc, UC_ARCH_ARM64, UC_MODE_ARM
    from unicorn.arm64_const import UC_ARM64_REG_X0, UC_ARM64_REG_X30, UC_ARM64_REG_S0
    binary = args.native_elf.read_bytes()
    sha = lambda data: hashlib.sha256(data).hexdigest()
    if sha(binary) != ELF_SHA:
        raise ValueError('Different ELF: establish version and addresses before reuse')
    phoff = struct.unpack_from('<Q', binary, 32)[0]
    size, count = struct.unpack_from('<HH', binary, 54)
    segments = [struct.unpack_from('<IIQQQQQQ', binary, phoff + i * size) for i in range(count)]

    def read(address, length):
        for kind, flags, offset, start, physical, n, mem, align in segments:
            if kind == 1 and start <= address and address + length <= start + n:
                return binary[offset + address - start:offset + address - start + length]
        raise ValueError(f'RVA outside file: {address:x}')

    cpu = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
    for page in [0x1c1b000, 0x32cc000, 0x317a000]:
        cpu.mem_map(page, 4096)
        cpu.mem_write(page, read(page, 4096))
    cpu.mem_map(0x10000000, 4096)
    cpu.mem_map(0x11000000, 4096)
    cases = []
    for setting in range(10, 111):
        cpu.mem_write(0x10000010, struct.pack('<i', setting))
        cpu.reg_write(UC_ARM64_REG_X0, 0x10000000)
        cpu.reg_write(UC_ARM64_REG_X30, 0x11000000)
        cpu.emu_start(0x1c1b160, 0x11000000, count=100)
        seconds = struct.unpack('<f', struct.pack('<I', cpu.reg_read(UC_ARM64_REG_S0)))[0]
        cases.append(dict(setting=setting, displaySpeed=setting / 10, seconds=seconds))
    result = dict(schemaVersion=1, source=dict(elfSha256=sha(binary), clientVersion='2.6.10',
        method='LiveSettingsData.GetReadTime', rva='0x1c1b160', bytes=36,
        methodSha256=sha(read(0x1c1b160, 36)),
        constant120=dict(rva='0x32cc844', hex=read(0x32cc844, 4).hex()),
        constantStep=dict(rva='0x317a310', hex=read(0x317a310, 4).hex()),
        execution='Unicorn ARM64; native instructions; no JS formula used'), cases=cases)
    if args.write:
        FIXTURE.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8', newline='\n')
    elif json.loads(FIXTURE.read_text(encoding='utf8')) != result:
        raise ValueError('Native speed fixture drift')
    print(f'Native speed: ELF/method/constants verified; {len(cases)} ARM64 executions match')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--unicorn-runtime', type=Path)
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args())
