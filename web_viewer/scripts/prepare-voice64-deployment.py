"""ACB -> temporary PCM -> AAC-LC 64k. Local, resumable, source-preserving."""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import wave

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / '.deploy/voice64'
STAGE = WORK / 'stage'
VG = Path(r'E:\Program Files\vgmstream-win64\vgmstream-cli.exe')
FF = Path(r'D:\Program Files\ffmpeg\bin\ffmpeg.exe')
PROBE = FF.with_name('ffprobe.exe')


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args):
    result = subprocess.run([str(a) for a in args], capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace')[-2000:])
    return result.stdout


def write_json(path, data):
    temporary = path.with_suffix('.writing')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--limit-groups', type=int, default=0, help='Local pilot only; never emits deployment manifest')
    args = parser.parse_args()
    assert 1 <= args.workers <= 16 and args.limit_groups >= 0
    audit_path = ROOT / '.analysis/voice-compression/source-cues.json'
    audit = json.loads(audit_path.read_text(encoding='utf-8'))
    baseline_path = ROOT / '.deploy/storage-compression/full-reupload-manifest.json'
    baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
    assert audit['index_sha256'] == sha(ROOT / 'public/data/compiled/voice_index.json')
    assert not audit['issues'] and not audit['failures']
    assert audit['matched_files'] == audit['indexed_files'] == 32421
    old = {e['request_key']: e for e in baseline['entries'] if e['request_key'].startswith('assets/voice/')}
    assert set(old) == {'assets/voice/' + e['file'] for e in audit['entries']}
    source_root = Path(audit['voice_root']).resolve(strict=True)
    groups = {}
    for entry in audit['entries']:
        assert re.fullmatch(r'[A-Za-z0-9_-]+\.m4a', entry['file'])
        groups.setdefault(entry['acb'], []).append(entry)
    for folder in (WORK / 'groups', WORK / 'temporary', STAGE / 'assets/voice'):
        folder.mkdir(parents=True, exist_ok=True)
        assert folder.resolve().is_relative_to(WORK.resolve())
    binding = {'source_audit_sha256': sha(audit_path), 'baseline_manifest_sha256': sha(baseline_path),
               'codec': 'aac-lc-64k-from-acb-pcm16-v1'}

    def prepare(item):
        relative, entries = item
        identifier = hashlib.sha256(relative.encode()).hexdigest()
        checkpoint = WORK / 'groups' / (identifier + '.json')
        acb = (source_root / relative).resolve(strict=True)
        assert acb.is_relative_to(source_root)
        sources = [acb, *sorted(acb.parent.glob(acb.stem + '*.awb'))]
        source_hashes = {str(p): sha(p) for p in sources}
        if checkpoint.exists():
            saved = json.loads(checkpoint.read_text(encoding='utf-8'))
            assert saved['binding'] == binding and saved['source_files_sha256'] == source_hashes
            assert {e['request_key'] for e in saved['entries']} == {'assets/voice/' + e['file'] for e in entries}
            for entry in saved['entries']:
                assert sha(STAGE / entry['object_key']) == entry['deployed_sha256']
                assert sha(ROOT / entry['source']) == entry['source_sha256']
            return saved['entries']
        metadata = [json.loads(line) for line in run([VG, '-m', '-I', '-s', '1', '-S', '0', acb]).decode().splitlines() if line.strip()]
        by_subsong = {s['streamInfo']['index']: s for s in metadata}
        produced = []
        for entry in entries:
            meta = by_subsong[entry['subsong']]
            assert meta['streamInfo']['name'] == entry['cue']
            assert meta['numberOfSamples'] == entry['samples']
            assert meta['sampleRate'] == entry['sample_rate'] and meta['channels'] == entry['channels']
            key = 'assets/voice/' + entry['file']
            previous = old[key]
            assert sha(ROOT / previous['source']) == previous['source_sha256']
            pcm = WORK / 'temporary' / (identifier + '.wav')
            target = STAGE / key
            run([VG, '-i', '-s', entry['subsong'], '-o', pcm, acb])
            with wave.open(str(pcm), 'rb') as wav:
                assert wav.getnframes() == entry['samples'] and wav.getsampwidth() == 2
                assert wav.getframerate() == entry['sample_rate'] and wav.getnchannels() == entry['channels']
            pcm_sha = sha(pcm)
            run([FF, '-nostdin', '-v', 'error', '-y', '-i', pcm, '-map_metadata', '-1',
                 '-c:a', 'aac', '-b:a', '64k', '-threads', '1', '-movflags', '+faststart', target])
            probe = json.loads(run([PROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', target]))
            stream = probe['streams'][0]
            assert len(probe['streams']) == 1 and stream['codec_name'] == 'aac' and stream['profile'] == 'LC'
            assert int(stream['sample_rate']) == entry['sample_rate'] and stream['channels'] == entry['channels']
            duration = float(probe['format']['duration'])
            assert abs(duration - entry['duration_seconds']) <= .002, (key, duration, entry['duration_seconds'])
            run([FF, '-nostdin', '-v', 'error', '-xerror', '-i', target, '-f', 'null', '-'])
            produced.append({**previous, 'stage': '.deploy/voice64/stage',
                             'transform': binding['codec'], 'deployed_size': target.stat().st_size,
                             'deployed_sha256': sha(target), 'deployed_content_type': 'audio/mp4',
                             'deployed_content_encoding': '', 'old_deployed_size': previous['deployed_size'],
                             'old_deployed_sha256': previous['deployed_sha256'], 'pcm_sha256': pcm_sha,
                             'raw_acb': relative, 'raw_subsong': entry['subsong'], 'raw_cue': entry['cue'],
                             'raw_samples': entry['samples'], 'sample_rate': entry['sample_rate'],
                             'channels': entry['channels'], 'duration_seconds': duration,
                             'duration_delta_seconds': duration - entry['duration_seconds']})
            # Only this worker's verified temporary PCM, under the fixed E: work directory.
            assert pcm.resolve().is_relative_to((WORK / 'temporary').resolve())
            pcm.unlink()
        assert all(sha(Path(p)) == value for p, value in source_hashes.items())
        write_json(checkpoint, {'binding': binding, 'source_files_sha256': source_hashes, 'entries': produced})
        return produced

    selected = sorted(groups.items())[:args.limit_groups or None]
    entries = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(prepare, group) for group in selected]
        for number, future in enumerate(concurrent.futures.as_completed(futures), 1):
            entries.extend(future.result())
            if number % 25 == 0 or number == len(selected):
                print(f'ACB groups {number}/{len(selected)}; verified voices {len(entries)}', flush=True)
    if args.limit_groups:
        print(f'Pilot passed: {len(entries)} voices; no deployment manifest emitted.')
        return
    assert len(entries) == len(old)
    assert {e['object_key'] for e in entries} == set(old)
    assert {p.relative_to(STAGE).as_posix() for p in STAGE.rglob('*') if p.is_file()} == set(old)
    entries.sort(key=lambda e: e['object_key'])
    manifest = {'kind': 'voice64-replacement', 'remote': 'cloudflare:sidem-archive-preview',
                'created_at': datetime.now(timezone.utc).isoformat(), **binding,
                'authorization': 'User accepted 64k listening and explicitly authorized delete-old-voice then upload; temporary 404 allowed.',
                'totals': {'files': len(entries), 'old_bytes': sum(e['old_deployed_size'] for e in entries),
                           'bytes': sum(e['deployed_size'] for e in entries)}, 'entries': entries}
    write_json(WORK / 'manifest.json', manifest)
    (WORK / 'keys.txt').write_text(''.join(e['object_key'] + '\n' for e in entries), encoding='utf-8')
    replacements = {e['object_key']: e for e in entries}
    combined = {**baseline, 'kind': 'full-preview-after-voice64', 'voice_manifest_sha256': sha(WORK / 'manifest.json'),
                'entries': [replacements.get(e['object_key'], e) for e in baseline['entries']]}
    combined.pop('groups', None)  # Old upload groups would no longer describe the physical stages.
    combined['totals'] = {'files': len(combined['entries']), 'bytes': sum(e['deployed_size'] for e in combined['entries'])}
    write_json(WORK / 'full-manifest.json', combined)
    print(json.dumps({'voice': manifest['totals'], 'full_bucket': combined['totals']}, indent=2))


if __name__ == '__main__':
    main()
