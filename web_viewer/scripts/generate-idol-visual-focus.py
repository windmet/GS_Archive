"""Measure where each story/birthday visual's figure stands, so heroes centre the person, not the image.

The visuals are cut-outs of very different widths (395-846 px) with the figure anywhere from 30% to
59% across; aligning by the image edge put every idol somewhere else. focusX is the horizontal
centre of opaque pixels in the upper two thirds (head and torso decide where a figure reads).
python scripts/generate-idol-visual-focus.py [--check]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'src' / 'presentation' / 'idolVisualFocus.json'
SOURCES = ['public/assets/stories/characters', 'public/assets/stories/birthday']


def focus_x(path: Path) -> float:
    alpha = np.asarray(Image.open(path).convert('RGBA').getchannel('A'), dtype=np.float64)
    upper = alpha[: alpha.shape[0] * 2 // 3]
    columns = upper.sum(axis=0)
    return round(float((columns * np.arange(alpha.shape[1])).sum() / columns.sum() / alpha.shape[1]), 3)


focus = {}
for folder in SOURCES:
    for path in sorted((ROOT / folder).glob('*.png')):
        focus['/' + path.relative_to(ROOT / 'public').as_posix()] = focus_x(path)
output = json.dumps({'schemaVersion': 1, 'kind': 'idol-visual-focus', 'focusX': focus}, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    if not TARGET.exists() or TARGET.read_text(encoding='utf-8') != output:
        sys.exit('idolVisualFocus.json is stale; run python scripts/generate-idol-visual-focus.py')
    print(f'Idol visual focus: {len(focus)} visuals in sync')
else:
    TARGET.write_text(output, encoding='utf-8', newline='\n')
    print(f'Wrote {len(focus)} visual focus points')
