"""Verify staged WebP pixels against original PNGs before any R2 upload."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

def assert_lossless_webp(raw, target):
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WEBP', target
    assert int.from_bytes(raw[4:8], 'little') + 8 == len(raw), target
    chunks = []
    offset = 12
    while offset < len(raw):
        assert offset + 8 <= len(raw), target
        code = raw[offset:offset + 4]
        size = int.from_bytes(raw[offset + 4:offset + 8], 'little')
        chunks.append(code)
        offset += 8 + size + (size % 2)
        assert offset <= len(raw), target
    assert b'VP8L' in chunks and b'VP8 ' not in chunks, target

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True, type=Path)
args = parser.parse_args()
manifest_raw = args.manifest.read_bytes()
manifest = json.loads(manifest_raw)
assert manifest['kind'] == 'incremental-preview'
stage = args.manifest.parent / manifest['stage']
converted = terminal = 0
for entry in manifest['entries']:
    previous_count = converted + terminal
    target = stage.joinpath(*entry['object_key'].split('/'))
    if entry['transform'] == 'webp-lossless-alpha0-rgb0':
        assert_lossless_webp(target.read_bytes(), target)
        source = Path(entry['source'])
        source_raw = source.read_bytes()
        assert hashlib.sha256(source_raw).hexdigest() == entry['source_sha256']
        with Image.open(source) as original, Image.open(target) as deployed:
            expected = original.convert('RGBA')
            mask = expected.getchannel('A').point(lambda alpha: 255 if alpha == 0 else 0)
            expected.paste((0, 0, 0, 0), mask=mask)
            assert deployed.format == 'WEBP'
            assert deployed.size == expected.size, entry['request_key']
            assert deployed.convert('RGBA').tobytes() == expected.tobytes(), entry['request_key']
        converted += 1
    elif entry['request_key'].startswith('assets/terminal/') and target.suffix == '.webp':
        # Terminal images are separately authored responsive derivatives. Their
        # producer regression binds pixels; this gate also rejects lossy files.
        raw = target.read_bytes()
        assert_lossless_webp(raw, target)
        with Image.open(target) as deployed:
            deployed.load()
        terminal += 1
    if converted + terminal != previous_count and (converted + terminal) % 500 == 0:
        print(f'Verified images: {converted + terminal}', flush=True)
receipt = {'manifest_sha256': hashlib.sha256(manifest_raw).hexdigest(),
           'converted_pngs': converted, 'lossless_terminal_derivatives': terminal,
           'dimensions_and_visible_pixels_preserved': True, 'transparent_rgb_zeroed': True}
args.manifest.with_name('image-validation.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
