"""Read-only ACB cue audit. Does not transcode, upload, or alter source assets."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--voice-root', type=Path, default=Path(r'E:\BaiduNetdiskDownload\SideM\GS_Res\Voice'))
    parser.add_argument('--vgmstream', type=Path, default=Path(r'E:\Program Files\vgmstream-win64\vgmstream-cli.exe'))
    parser.add_argument('--output', type=Path, default=root / '.analysis/voice-compression/source-cues.json')
    args = parser.parse_args()
    source_root = args.voice_root.resolve(strict=True)
    index_bytes = (root / 'public/data/compiled/voice_index.json').read_bytes()
    index = json.loads(index_bytes)['index']
    grouped = {}
    for filename, relative in index.items():
        grouped.setdefault(relative.replace('\\', '/'), []).append(filename)

    def inspect(item):
        relative, filenames = item
        acb = (source_root / relative).resolve(strict=True)
        if not acb.is_relative_to(source_root):
            raise ValueError(f'ACB outside source root: {relative}')
        result = subprocess.run([str(args.vgmstream), '-m', '-I', '-s', '1', '-S', '0', str(acb)],
                                capture_output=True, text=True, encoding='utf-8', errors='strict', timeout=120)
        if result.returncode:
            raise RuntimeError(f'{relative}: {result.stderr[:500]}')
        streams = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        if not streams or len(streams) != streams[0]['streamInfo']['total']:
            raise ValueError(f'Incomplete subsong inventory: {relative}')
        by_name = {}
        for stream in streams:
            by_name.setdefault(stream['streamInfo']['name'], []).append(stream)
        entries, issues = [], []
        for filename in filenames:
            matches = by_name.get(Path(filename).stem, [])
            if len(matches) != 1:
                issues.append({'file': filename, 'acb': relative, 'matches': len(matches)})
                continue
            stream = matches[0]
            entries.append({'file': filename, 'acb': relative, 'subsong': stream['streamInfo']['index'],
                            'cue': stream['streamInfo']['name'], 'sample_rate': stream['sampleRate'],
                            'channels': stream['channels'], 'samples': stream['numberOfSamples'],
                            'duration_seconds': stream['numberOfSamples'] / stream['sampleRate'],
                            'encoding': stream['encoding'], 'looping': stream.get('loopingInfo'),
                            'vgmstream_version': stream['version']})
        return entries, issues

    entries, issues, failures = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(inspect, item): item[0] for item in grouped.items()}
        for done, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                found, problems = future.result()
                entries.extend(found)
                issues.extend(problems)
            except Exception as error:
                failures.append({'acb': futures[future], 'error': str(error)})
            if done % 250 == 0 or done == len(futures):
                print(f'Inspected {done}/{len(futures)} ACBs; matched {len(entries)} cues; '
                      f'{len(issues)} ambiguous/missing cues; {len(failures)} failures', flush=True)
    report = {'kind': 'voice-source-cue-audit', 'checked_at': datetime.now(timezone.utc).isoformat(),
              'scope': 'ACB metadata identity only; PCM alignment and listening not verified',
              'voice_root': str(source_root), 'index_sha256': hashlib.sha256(index_bytes).hexdigest(),
              'indexed_files': len(index), 'acb_files': len(grouped), 'matched_files': len(entries),
              'issues': issues, 'failures': failures, 'entries': sorted(entries, key=lambda e: e['file'])}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if issues or failures or len(entries) != len(index):
        raise SystemExit('Source cue audit incomplete; inspect report before preparing samples')
    print(f'All {len(entries)} indexed cue identities matched. Report: {args.output}')


if __name__ == '__main__':
    main()
