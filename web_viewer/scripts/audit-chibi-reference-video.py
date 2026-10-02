#!/usr/bin/env python3
"""Align a local recording to a local song and capture bounded reference frames.

This produces QA evidence only. It never changes choreography or published media.
Audio alignment is a timing witness, not a visual-fidelity acceptance result.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
from scipy.signal import correlate


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def align_audio(recording: np.ndarray, song: np.ndarray, rate: int,
                sample_start: float, sample_end: float) -> dict:
    start, end = round(sample_start * rate), round(sample_end * rate)
    if not 0 <= start < end <= len(song):
        raise ValueError('Alignment excerpt is outside the song')
    excerpt = song[start:end].astype(np.float64, copy=True)
    excerpt -= excerpt.mean()
    reference_energy = float(np.dot(excerpt, excerpt))
    if reference_energy <= 1e-12 or len(recording) < len(excerpt):
        raise ValueError('Silent excerpt or recording shorter than excerpt')
    audio = recording.astype(np.float64)
    correlation = correlate(audio, excerpt, mode='valid', method='fft')
    prefix = np.cumsum(np.r_[0.0, audio * audio])
    sums = np.cumsum(np.r_[0.0, audio])
    window_sums = sums[len(excerpt):] - sums[:-len(excerpt)]
    energy = prefix[len(excerpt):] - prefix[:-len(excerpt)]
    energy -= window_sums * window_sums / len(excerpt)
    scores = correlation / np.sqrt(np.maximum(energy * reference_energy, 1e-20))
    peak = int(np.argmax(scores))
    return {'recordingOffsetSeconds': (peak - start) / rate,
            'normalizedCorrelation': float(scores[peak]), 'sampleRate': rate,
            'songExcerptSeconds': [sample_start, sample_end]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path, required=True)
    parser.add_argument('--song-audio', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--ffprobe', type=Path, required=True)
    parser.add_argument('--times', type=float, nargs='+', required=True,
                        help='Song timeline seconds, not recording timestamps')
    parser.add_argument('--sample-start', type=float, default=10)
    parser.add_argument('--sample-end', type=float, default=20)
    parser.add_argument('--window-start', type=float, default=0)
    parser.add_argument('--window-end', type=float)
    args = parser.parse_args()
    video, song = args.video.resolve(), args.song_audio.resolve()
    output = args.output_root.resolve()
    if not video.is_file() or not song.is_file():
        raise FileNotFoundError('Both local input files are required')
    if args.window_start < 0 or (args.window_end is not None and args.window_end <= args.window_start):
        raise ValueError('Invalid recording window')
    if output in (video.parent, song.parent):
        raise ValueError('Use a dedicated QA output directory, not a media directory')
    rate = 4000

    def pcm(path: Path, window: bool = False) -> np.ndarray:
        command = [str(args.ffmpeg), '-v', 'error']
        if window:
            command += ['-ss', str(args.window_start)]
        command += ['-i', str(path)]
        if window and args.window_end is not None:
            command += ['-t', str(args.window_end - args.window_start)]
        command += ['-vn', '-ac', '1', '-ar', str(rate), '-f', 'f32le', 'pipe:1']
        return np.frombuffer(subprocess.check_output(command), dtype='<f4')

    recording_pcm, song_pcm = pcm(video, True), pcm(song)
    alignment = align_audio(recording_pcm, song_pcm, rate,
                            args.sample_start, args.sample_end)
    # A long PCM excerpt is sensitive to tiny independent recording clocks.
    # Compare two short, separated excerpts instead; do not claim frame timing
    # across the song from a single peak in an edited recording.
    check_end = min(len(song_pcm) / rate - 5, args.sample_end + 80)
    check_start = check_end - (args.sample_end - args.sample_start)
    if check_start <= args.sample_end:
        raise ValueError('Song is too short for an independent timing witness')
    witness = align_audio(recording_pcm, song_pcm, rate, check_start, check_end)
    spread = abs(witness['recordingOffsetSeconds'] - alignment['recordingOffsetSeconds'])
    if min(alignment['normalizedCorrelation'], witness['normalizedCorrelation']) < 0.75 or spread > 0.04:
        raise ValueError('Separated timing witnesses disagree: ' + str([alignment, witness]))
    witness['recordingOffsetSeconds'] += args.window_start
    alignment['recordingOffsetSeconds'] += args.window_start
    alignment['independentWitness'] = witness
    alignment['offsetSpreadSeconds'] = spread
    # Do not silently capture incorrectly matched frames (different mix/edit).
    if alignment['normalizedCorrelation'] < 0.75:
        raise ValueError('Audio match is too weak for automatic frame alignment: ' + str(alignment))
    probe = json.loads(subprocess.check_output([str(args.ffprobe), '-v', 'error',
        '-show_streams', '-show_format', '-of', 'json', str(video)]))
    duration = float(probe['format']['duration'])
    times = sorted(set(args.times))
    offsets = [(time, time + alignment['recordingOffsetSeconds']) for time in times]
    if any(time < 0 or offset < 0 or offset >= duration for time, offset in offsets):
        raise ValueError('Requested frame falls outside local recording')
    output.mkdir(parents=True, exist_ok=True)
    frames = []
    for time, offset in offsets:
        name = f'song-{time:07.3f}s.jpg'
        target = output / name
        subprocess.run([str(args.ffmpeg), '-v', 'error', '-ss', str(offset),
            '-i', str(video), '-frames:v', '1', '-vf', 'scale=960:-2',
            '-y', str(target)], check=True)
        frames.append({'songSeconds': time, 'recordingSeconds': offset,
                       'file': name, 'sha256': sha256_file(target)})
    receipt = {'schemaVersion': 1, 'status': 'reference_timing_evidence_only',
        'video': {'path': str(video), 'bytes': video.stat().st_size,
                  'sha256': sha256_file(video), 'probe': probe},
        'songAudio': {'path': str(song), 'sha256': sha256_file(song)},
        'alignment': alignment, 'frames': frames}
    (output / 'alignment-receipt.json').write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'alignment': alignment, 'frames': len(frames)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
