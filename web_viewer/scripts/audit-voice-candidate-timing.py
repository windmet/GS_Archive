"""Measure local AAC decode alignment; this is not listening/browser acceptance."""
import hashlib
import json
from pathlib import Path
import subprocess
import wave
from datetime import datetime, timezone

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / '.analysis/voice-compression'
FFMPEG = Path(r'D:\Program Files\ffmpeg\bin\ffmpeg.exe')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alignment(reference, decoded, rate):
    """Find delay in +/-250 ms using the reference's loudest <=1 s block.

    Positive lag means decoded audio is late. Use one channel rather than a
    stereo downmix, which could cancel opposite-phase content. Low correlation
    is a review signal, not a perceptual codec-quality score.
    """
    channel = int(np.argmax(np.sum(reference.astype(np.float64) ** 2, axis=0)))
    x, y = reference[:, channel], decoded[:, channel]
    width = min(rate, len(x), len(y))
    starts = list(range(0, len(x) - width + 1, max(1, width // 2)))
    starts.append(len(x) - width)
    start = max(starts, key=lambda s: np.dot(x[s:s + width], x[s:s + width]))
    segment = x[start:start + width].astype(np.float64)
    search = rate // 4
    begin, end = max(0, start - search), min(len(y), start + width + search)
    window = y[begin:end].astype(np.float64)
    if np.dot(segment, segment) == 0 or len(window) < width:
        return {'lag_samples': None, 'correlation': None, 'reason': 'silent-or-insufficient-reference'}
    fft_size = 1 << (len(window) + width - 1).bit_length()
    correlation = np.fft.irfft(np.fft.rfft(window, fft_size)
                               * np.conj(np.fft.rfft(segment, fft_size)), fft_size)
    peak = int(np.argmax(correlation[:len(window) - width + 1]))
    matched = window[peak:peak + width]
    denominator = np.linalg.norm(segment) * np.linalg.norm(matched)
    return {'lag_samples': begin + peak - start,
            'correlation': float(correlation[peak] / denominator) if denominator else None,
            'reference_window_start': start, 'window_samples': width, 'channel': channel}


def main():
    receipt_path = WORK / 'listening-samples.json'
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    assert receipt['status'] == 'prepared-not-listening-accepted'
    assert receipt['plan_sha256'] == digest(WORK / 'listening-plan.json')
    rows = []
    for number, entry in enumerate(receipt['entries'], 1):
        for artifact in entry['artifacts'].values():
            path = (WORK / artifact['path']).resolve()
            assert path.is_relative_to(WORK.resolve())
            assert digest(path) == artifact['sha256'], str(path)
        with wave.open(str(WORK / entry['artifacts']['reference-pcm16']['path']), 'rb') as wav:
            assert wav.getsampwidth() == 2
            assert wav.getframerate() == entry['sample_rate']
            assert wav.getnchannels() == entry['channels']
            reference = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float64)
            reference = reference.reshape(-1, entry['channels']) / 32768
        assert len(reference) == entry['samples']
        for label in ('current', 'aac-64k', 'aac-72k'):
            path = WORK / entry['artifacts'][label]['path']
            result = subprocess.run([str(FFMPEG), '-nostdin', '-v', 'error', '-i', str(path),
                                     '-map', '0:a:0', '-f', 'f32le', '-acodec', 'pcm_f32le', '-'],
                                    capture_output=True, timeout=90, check=True)
            decoded = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, entry['channels'])
            assert len(decoded) and np.isfinite(decoded).all()
            measured = alignment(reference, decoded, entry['sample_rate'])
            delta = len(decoded) - len(reference)
            lag, correlation = measured['lag_samples'], measured['correlation']
            review = []
            if lag is None or abs(lag) > entry['sample_rate'] * .001:
                review.append('alignment-unknown-or-over-1ms')
            if correlation is None or correlation < .90:
                review.append('weak-waveform-match')
            if delta < 0 or delta > 1024:
                review.append('decoded-length-outside-one-AAC-frame-padding')
            rows.append({'file': entry['file'], 'variant': label, 'sample_rate': entry['sample_rate'],
                         'reference_samples': len(reference), 'decoded_samples': len(decoded),
                         'decoded_sample_delta': delta, **measured, 'review_reasons': review})
        if number % 20 == 0:
            print(f'Measured {number}/{len(receipt["entries"])} comparisons', flush=True)
    summary = {}
    for label in ('current', 'aac-64k', 'aac-72k'):
        group = [row for row in rows if row['variant'] == label]
        summary[label] = {'files': len(group), 'review_count': sum(bool(r['review_reasons']) for r in group),
                          'max_abs_lag_samples': max(abs(r['lag_samples']) for r in group if r['lag_samples'] is not None),
                          'min_correlation': min(r['correlation'] for r in group if r['correlation'] is not None),
                          'min_decoded_sample_delta': min(r['decoded_sample_delta'] for r in group),
                          'max_decoded_sample_delta': max(r['decoded_sample_delta'] for r in group)}
    output = {'kind': 'local-decoder-timing-audit', 'checked_at': datetime.now(timezone.utc).isoformat(),
              'samples_receipt_sha256': digest(receipt_path), 'plan_sha256': receipt['plan_sha256'],
              'scope': 'FFmpeg decoded sample lengths and loudest-window waveform alignment only; '
                       'AAC frame padding is recorded, not treated as browser audible duration. '
                       'No listening quality, whole-waveform identity, browser timing or lipsync acceptance.',
              'summary': summary, 'entries': rows}
    (WORK / 'candidate-timing.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
