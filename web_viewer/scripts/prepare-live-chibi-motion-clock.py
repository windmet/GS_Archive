"""Bind native conductor clocks to the exact RAW song and choreography corpus."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import UnityPy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent/'data_pipeline'))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import text_asset_payload, sha256_file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument('--native-elf', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    elf = args.native_elf.read_bytes()
    assert hashlib.sha256(elf).hexdigest() == '9843113b723d183882ee1a0a0881806518022d293c2dd7d23ed3960facbd810e'
    assert elf[:6] == b'\x7fELF\x02\x01'
    phoff = struct.unpack_from('<Q', elf, 32)[0]
    size, count = struct.unpack_from('<HH', elf, 54)
    segments = [struct.unpack_from('<IIQQQQQQ', elf, phoff+i*size) for i in range(count)]
    def read(rva, size):
        for kind, flags, offset, address, physical, file_size, memory_size, align in segments:
            if kind == 1 and address <= rva and rva+size <= address+file_size:
                return elf[offset+rva-address:offset+rva-address+size]
        raise ValueError('Unmapped native address')
    assert struct.unpack('<d', read(0x32d48d8, 8))[0] == 480
    assert struct.unpack('<d', read(0x32d48d0, 8))[0] == 60
    index_path = ROOT/'public/assets/live-chibi/choreography/index.json'
    index_hash = sha256_file(index_path)
    songs = json.loads(index_path.read_text(encoding='utf-8'))['songs']
    tracks = {}
    for code in sorted({song['songCode'] for song in songs}):
        bundle = sources.raw_root/'asset'/f'song_{code}.unity3d'
        bundle_hash = sha256_file(bundle)
        env = UnityPy.load(str(bundle))
        matches = [o.read() for o in env.objects if o.type.name == 'TextAsset' and o.read().m_Name == f'{code}_fumen']
        assert len(matches) == 1, code
        payload = text_asset_payload(matches[0])
        raw = json.loads(payload)
        tempos = [event for event in raw['timeline'] if event['track'] == 0 and 'tempo' in event]
        # Source order is the conductor order; never sort malformed input into validity.
        assert tempos and tempos[0]['tick'] == 0
        time_ms = 0
        rows = []
        previous = None
        for event in tempos:
            tick, bpm = event['tick'], event['tempo']
            assert isinstance(tick, int) and tick >= 0 and math.isfinite(bpm) and bpm > 0
            if previous:
                assert tick >= previous['tick']
                time_ms += (tick-previous['tick'])*60/(480*previous['tempo'])*1000
            rows.append(dict(tick=tick, timeMs=time_ms, bpm=bpm))
            previous = event
        # NoteManager conductor absTime starts at zero. BGM_offset belongs to
        # LiveSoundDirector's audio/live-clock mapping, not this tempo integral.
        assert math.isfinite(raw['offset'])
        tracks[code] = dict(tempos=rows, bgmOffsetSeconds=raw['offset'],
                            raw=dict(bundle=bundle.name, bundleSha256=bundle_hash,
                                     textAsset=f'{code}_fumen', textSha256=hashlib.sha256(payload).hexdigest()))
        assert sha256_file(bundle) == bundle_hash
    assert sha256_file(index_path) == index_hash
    data = dict(schemaVersion=1, ticksPerBeat=480, clock='native-live-seconds',
                choreographyIndexSha256=index_hash, tracks=tracks,
                songs={song['id']: dict(songCode=song['songCode'], source=song['source']) for song in songs})
    path = ROOT/'public/data/stage-motion-clock.json'
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n'
    if args.check:
        assert json.loads(path.read_text(encoding='utf-8')) == data
    else:
        path.write_bytes(encoded.encode('utf-8'))
    receipt = dict(elfSha256=hashlib.sha256(elf).hexdigest(),
        methods={name:dict(rva=hex(rva),bytes=size,sha256=hashlib.sha256(read(rva,size)).hexdigest())
                 for name,rva,size in [('ticksToSec',0x20bb600,188),('conductorStep',0x20bae50,264),
                    ('baseTimeScale',0x221b270,104),('runtimeSkeletonAsset',0x139c714,152),
                    ('skeletonAssetCtor',0x13a164c,256),('fillMix',0x139d204,228),
                    ('normalMotionCallback',0x1bbe040,660),('audioLiveClock',0x1f27cb4,228)]},
        constants={'ticksPerBeat':dict(rva='0x32d48d8',type='double',value=480),
                   'secondsPerMinute':dict(rva='0x32d48d0',type='double',value=60)},
        clockSha256=hashlib.sha256(encoded.encode()).hexdigest(), arrangements=len(songs), tracks=len(tracks))
    fixture = ROOT/'scripts/fixtures/chibi-native-motion-clock.json'
    if args.check:
        assert json.loads(fixture.read_text(encoding='utf-8')) == receipt
    else:
        fixture.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(f'PASS native ELF clock constants/method hashes and RAW conductor export: {len(tracks)} songs, {len(songs)} arrangements')


if __name__ == '__main__':
    main()
