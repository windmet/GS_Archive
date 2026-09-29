"""Prepare local ACB -> PCM -> AAC listening candidates; never publish them."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import wave
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / '.analysis/voice-compression'
VG = Path(r'E:\Program Files\vgmstream-win64\vgmstream-cli.exe')
FF = Path(r'D:\Program Files\ffmpeg\bin\ffmpeg.exe')
PROBE = FF.with_name('ffprobe.exe')


def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args):
    result = subprocess.run([str(a) for a in args], capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace')[-2000:])
    return result.stdout


def main():
    plan_path = WORK / 'listening-plan.json'
    plan = json.loads(plan_path.read_text(encoding='utf-8'))
    assert sha(ROOT / 'public/data/compiled/voice_index.json') == plan['source_index_sha256']
    output = WORK / 'listening-candidates'
    output.mkdir(exist_ok=True)
    assert output.resolve().is_relative_to(ROOT)
    receipt_path = WORK / 'listening-samples.json'
    receipt = {'kind': 'local-original-source-listening-samples', 'plan_sha256': sha(plan_path),
               'created_at': datetime.now(timezone.utc).isoformat(), 'status': 'preparing',
               'listening_accepted': False, 'semantic_coverage_accepted': False, 'entries': []}
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        assert receipt['plan_sha256'] == sha(plan_path), 'Plan changed; preserve previous samples'
    done = {e['file']: e for e in receipt['entries']}
    for number, entry in enumerate(plan['entries'], 1):
        if entry['file'] in done:
            for artifact in done[entry['file']]['artifacts'].values():
                assert sha(WORK / artifact['path']) == artifact['sha256']
            continue
        acb = Path(plan['voice_root']) / entry['acb']
        sources = [acb, *sorted(acb.parent.glob(acb.stem + '*.awb'))]
        source_hashes = {str(file): sha(file) for file in sources}
        meta = json.loads(run([VG, '-m', '-I', '-s', entry['subsong'], acb]))
        assert meta['streamInfo']['name'] == entry['cue']
        assert meta['numberOfSamples'] == entry['samples']
        assert meta['sampleRate'] == entry['sample_rate'] and meta['channels'] == entry['channels']
        folder = output / Path(entry['file']).stem
        folder.mkdir(exist_ok=True)
        pcm = folder / 'reference.wav'
        # Decoder default PCM16 matches the existing extraction pipeline. The
        # reference and both candidate encodes share these exact PCM samples.
        run([VG, '-i', '-s', entry['subsong'], '-o', pcm, acb])
        with wave.open(str(pcm), 'rb') as wav:
            assert wav.getnframes() == entry['samples']
            assert wav.getframerate() == entry['sample_rate']
            assert wav.getnchannels() == entry['channels'] and wav.getsampwidth() == 2
        assert all(sha(Path(file)) == digest for file, digest in source_hashes.items())
        artifacts, probes = {}, {}
        current = folder / 'current-128k.m4a'
        shutil.copyfile(ROOT / 'public/assets/voice' / entry['file'], current)
        files = {'reference-pcm16': pcm, 'current': current}
        for rate in (64, 72):
            target = folder / f'aac-{rate}k.m4a'
            run([FF, '-nostdin', '-v', 'error', '-y', '-i', pcm, '-map_metadata', '-1',
                 '-c:a', 'aac', '-b:a', f'{rate}k', '-movflags', '+faststart', target])
            probe = json.loads(run([PROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', target]))
            stream = probe['streams'][0]
            assert stream['codec_name'] == 'aac' and stream['profile'] == 'LC'
            assert stream['channels'] == entry['channels'] and int(stream['sample_rate']) == entry['sample_rate']
            run([FF, '-nostdin', '-v', 'error', '-i', target, '-f', 'null', '-'])
            probes[str(rate)] = {'duration_seconds': float(probe['format']['duration']),
                                'duration_delta_seconds': float(probe['format']['duration']) - entry['duration_seconds'],
                                'channels': stream['channels'], 'sample_rate': stream['sample_rate']}
            files[f'aac-{rate}k'] = target
        for label, file in files.items():
            artifacts[label] = {'path': file.relative_to(WORK).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file)}
        receipt['entries'].append({**entry, 'source_files_sha256': source_hashes, 'pcm_bits': 16,
                                    'artifacts': artifacts, 'candidate_probes': probes})
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if number % 10 == 0:
            print(f'Prepared {number}/{len(plan["entries"])} original-source comparisons', flush=True)
    assert len(receipt['entries']) == len(plan['entries'])
    receipt['status'] = 'prepared-not-listening-accepted'
    receipt['total_artifact_bytes'] = sum(a['bytes'] for e in receipt['entries'] for a in e['artifacts'].values())
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Prepared {len(receipt["entries"])} comparisons, {receipt["total_artifact_bytes"]} bytes. Listening remains pending.')


if __name__ == '__main__':
    main()
