#!/usr/bin/env python3
"""Check alignment against an independent shifted/noisy signal and bad input."""
import importlib.util
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location('reference', Path(__file__).with_name('audit-chibi-reference-video.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
rate = 4000
rng = np.random.default_rng(314)
song = rng.normal(0, 0.15, 30 * rate)
recording = np.r_[rng.normal(0, 0.03, 7 * rate), song * 0.45,
                  rng.normal(0, 0.03, 3 * rate)]
recording += rng.normal(0, 0.01, len(recording))
recording += 0.2  # independent DC offset must not change the timing peak
for start, end in ((2, 8), (20, 26)):
    result = module.align_audio(recording, song, rate, start, end)
    assert result['recordingOffsetSeconds'] == 7
    assert result['normalizedCorrelation'] > 0.98
# A clipped recording can have a negative origin; do not assume title length.
assert module.align_audio(song[3 * rate:], song, rate, 8, 14)['recordingOffsetSeconds'] == -3
for recording, song, start, end in ((song, song, 5, 4),
        (song, np.zeros_like(song), 2, 5), (song[:rate], song, 2, 8)):
    try:
        module.align_audio(recording, song, rate, start, end)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid alignment input was accepted')
print('Reference alignment: independent offset/noise/DC/clipping and invalid-input checks passed')
