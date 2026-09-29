#!/usr/bin/env python3
"""Build bounded, audited SSR wallpaper / opaque scene menus. Default: report only.

Reads the existing published metadata and asset mount; never extracts RAW, fixes
card semantics, changes a source image, or copies the complete public tree.
Requires Pillow. Generated terminal assets are create-only/content-addressed.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any
from PIL import Image, ImageOps

ID = re.compile(r'^[a-z0-9_]+$')
BG = re.compile(r'^bg[a-z0-9_]+$')
MAX_MANIFEST = 1_500_000

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def encode(obj: Any) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n').encode('utf-8')

def read_json(path: Path) -> tuple[Any, str]:
    raw = path.read_bytes()
    return json.loads(raw.decode('utf-8-sig')), digest(raw)

def inside(root: Path, relative: str) -> Path:
    candidate = root / relative
    if candidate.is_symlink() or not candidate.resolve().is_relative_to(root.resolve()):
        raise ValueError(f'Unsafe or linked input/output: {candidate}')
    return candidate

def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise ValueError(f'Refusing symlink output: {path}')
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as file:
        file.write(content)
        temp = Path(file.name)
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)

def image_info(path: Path, orientation: str | None = None, *, allow_alpha: bool = False) -> tuple[Image.Image, dict]:
    raw = path.read_bytes()
    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert('RGBA')
        image.load()
    w, h = image.size
    if w < 16 or h < 16:
        raise ValueError('image-too-small')
    if orientation == 'portrait' and w >= h or orientation == 'landscape' and w <= h:
        raise ValueError('orientation-mismatch')
    has_alpha = image.getchannel('A').getextrema()[0] != 255
    if has_alpha and not allow_alpha:
        raise ValueError('non-opaque-image')
    return (image if has_alpha else image.convert('RGB')), {'width': w, 'height': h, 'sha256': digest(raw), 'bytes': len(raw)}

def preference_score(card: dict) -> int:
    # Same explicit preference as generate-archive-manifest.mjs, not input order.
    tutorial = str(card.get('title', '')).startswith('チュートリアル') or int(card.get('card_id') or 0) >= 90000000
    return (0 if tutorial else 100) + len(card.get('home_voice_cues') or []) + len(card.get('scenario_entries') or [])

def point(value: Any, default: list[int]) -> list[float]:
    if isinstance(value, list) and len(value) == 2 and all(type(n) in (int, float) and 0 <= n <= 100 for n in value):
        return value
    return default

def build(public_root: Path, card_art_root: Path, *, derivatives: bool = False,
          art_direction: dict | None = None, wallpaper_limit: int = 0) -> tuple[dict, dict, dict, dict[str, bytes]]:
    public_root, card_art_root = public_root.resolve(), card_art_root.resolve()
    if not card_art_root.is_dir():
        raise ValueError(f'Card art mount not found: {card_art_root}')
    sources: dict[str, str] = {}
    def load(relative: str):
        obj, sha = read_json(inside(public_root, relative)); sources[relative] = sha; return obj
    cards = load('data/masterdata/card_index.json')
    manifest = load('data/archive_manifest.json')
    backgrounds = load('data/masterdata/background_catalog.json')
    idols = load('data/masterdata/idol_unit_dictionary.json')
    if not isinstance(cards.get('cards'), list) or not isinstance(manifest.get('card_assets_by_id'), dict) or not isinstance(backgrounds.get('backgrounds'), dict):
        raise ValueError('Source schema mismatch; do not guess a different metadata shape')
    evidence = {'source_hashes': sources, 'rejected': [], 'images': [], 'selected_ssr_resources': 0,
                'wallpaper_derivatives': derivatives, 'notes': ['base/p are resource variants, NOT approved training-state labels.',
                'Scenes are opaque published catalogue assets, NOT an original-game Home eligibility whitelist.']}
    output_assets: dict[str, bytes] = {}
    direction = art_direction or {}
    source_signature = digest(encode({'sources': sources, 'direction': direction, 'derivatives': derivatives, 'limit': wallpaper_limit}))
    def derivative(image: Image.Image, stem: str, width: int, quality: int) -> tuple[str, int, int]:
        img = image.copy()
        if img.width > width:
            img = img.resize((width, max(1, round(img.height * width / img.width))), Image.Resampling.LANCZOS)
        stream = io.BytesIO(); img.save(stream, 'WEBP', quality=quality, method=4)
        raw = stream.getvalue()
        name = f'assets/terminal/{stem}-{digest(raw)[:16]}.webp'
        output_assets[name] = raw
        return '/' + name, img.width, img.height
    canonical = {}
    for card in cards['cards']:
        resource = card.get('resource_id')
        if not isinstance(resource, str) or not ID.fullmatch(resource):
            evidence['rejected'].append({'resource': resource, 'reason': 'invalid-resource-id'}); continue
        current = canonical.get(resource)
        if current is None or preference_score(card) > preference_score(current):
            canonical[resource] = card
    wallpaper_entries = []
    for resource, card in sorted(canonical.items()):
        if card.get('rarity') != 'SSR':
            continue
        evidence['selected_ssr_resources'] += 1
        flags = manifest['card_assets_by_id'].get(resource, {})
        idol_code = str(card.get('character_id') or '')
        identity = (idols.get('by_idol_code') or {}).get(idol_code, {})
        for variant, prefix, suffix in [('base', 'normal', ''), ('p', 'awakened', 'p')]:
            key = f'{resource}:{variant}'
            if not flags.get(f'{prefix}_portrait') or not flags.get(f'{prefix}_landscape'):
                evidence['rejected'].append({'id': key, 'reason': 'published-pair-missing'}); continue
            if wallpaper_limit and len(wallpaper_entries) >= wallpaper_limit:
                evidence['rejected'].append({'id': key, 'reason': 'explicit-batch-limit'}); continue
            entry = {'id': key, 'resourceId': resource, 'variant': variant, 'variantLabel': '卡面 A' if variant == 'base' else '卡面 B',
                     'rarity': 'SSR', 'label': card.get('title') or resource, 'idolCode': idol_code,
                     'idolName': identity.get('display_name') or idol_code}
            rule = direction.get(key, {})
            try:
                pair = []
                for orientation in ['portrait', 'landscape']:
                    filename = f'image_card_{"portrait_hide" if orientation == "portrait" else "landscape"}_{resource}{suffix}.png'
                    asset = inside(card_art_root, f'image_card_{orientation}/{filename}')
                    image, info = image_info(asset, orientation, allow_alpha=True)
                    url = f'/assets/card-art/{orientation}/{filename}'
                    item = {'url': url, 'width': info['width'], 'height': info['height'], 'sourceSha256': info['sha256'],
                            'position': point(rule.get(orientation), [50, 40])}
                    pair.append((orientation, image, info, item))
                # Encode only after both original images passed; no orphan half-pairs.
                for orientation, image, info, item in pair:
                    if derivatives:
                        url, w, h = derivative(image, f'{resource}{suffix}-{orientation}', 720 if orientation == 'portrait' else 1600, 82)
                        item.update(url=url, width=w, height=h)
                    entry[orientation] = item
                    evidence['images'].append({'id': key, 'orientation': orientation, **info})
                entry['thumbnail'] = derivative(pair[0][1], f'{resource}{suffix}-thumb', 160, 74)[0]
                wallpaper_entries.append(entry)
            except (OSError, ValueError, Image.DecompressionBombError) as error:
                evidence['rejected'].append({'id': key, 'reason': str(error)})
    scene_entries = []
    for bg_id, meta in sorted(backgrounds['backgrounds'].items()):
        if not BG.fullmatch(bg_id) or meta.get('asset_exists') is not True:
            evidence['rejected'].append({'id': bg_id, 'reason': 'scene-not-published'}); continue
        try:
            asset = inside(public_root, f'assets/bg/{bg_id}.png')
            image, info = image_info(asset, 'landscape')
            names = [x for x in meta.get('names', []) if isinstance(x, str) and x]
            variants = [str(x.get('variant')) for x in meta.get('picture_studio_scenes', []) if x.get('variant')]
            label = ' / '.join(dict.fromkeys(names + variants)) or bg_id
            scene_entries.append({'id': bg_id, 'label': label, 'published': True, 'url': f'/assets/bg/{bg_id}.png',
                                  'thumbnail': derivative(image, f'{bg_id}-thumb', 240, 72)[0],
                                  'sourceSha256': info['sha256']})
            evidence['images'].append({'id': bg_id, 'orientation': 'scene', **info})
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            evidence['rejected'].append({'id': bg_id, 'reason': str(error)})
    # Generation is deterministic, hash binds the source metadata, while each entry binds source image bytes.
    wall = {'schemaVersion': 1, 'kind': 'wallpapers', 'sourceSignature': source_signature, 'entries': wallpaper_entries}
    scene = {'schemaVersion': 1, 'kind': 'backgrounds', 'sourceSignature': source_signature, 'entries': scene_entries}
    evidence.update(wallpapers=len(wallpaper_entries), scenes=len(scene_entries), generated_asset_files=len(output_assets),
                    generated_asset_bytes=sum(map(len, output_assets.values())), source_signature=source_signature)
    return wall, scene, evidence, output_assets

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-root', type=Path, required=True)
    parser.add_argument('--card-art-root', type=Path, required=True)
    parser.add_argument('--art-direction', type=Path)
    parser.add_argument('--derivatives', action='store_true', help='Create 720px portrait / 1600px landscape WebP derivatives; originals untouched')
    parser.add_argument('--wallpaper-limit', type=int, default=0, help='Explicit batch cap; 0 means all eligible pairs')
    parser.add_argument('--budget-mib', type=float, default=96, help='Fail before publication if generated asset bytes exceed this budget')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--report', type=Path, default=Path('.analysis/terminal-media-audit.json'))
    args = parser.parse_args()
    if args.wallpaper_limit < 0 or args.budget_mib <= 0:
        parser.error('limit must be >= 0 and budget > 0')
    if args.report.resolve().is_relative_to(args.public_root.resolve()):
        parser.error('Audit reports must stay outside public')
    direction = read_json(args.art_direction)[0] if args.art_direction else {}
    wall, scene, report, assets = build(args.public_root, args.card_art_root, derivatives=args.derivatives,
                                     art_direction=direction, wallpaper_limit=args.wallpaper_limit)
    atomic_write(args.report, encode(report))
    for menu in [wall, scene]:
        if len(encode(menu)) > MAX_MANIFEST:
            raise SystemExit(f'{menu["kind"]} exceeds metadata size budget')
    if report['generated_asset_bytes'] > args.budget_mib * 1024**2:
        raise SystemExit('Asset budget exceeded. Review report and use an explicit batch cap; nothing published.')
    if not wall['entries'] or not scene['entries']:
        raise SystemExit('No complete SSR pairs or no opaque scenes. Check roots and report; nothing published.')
    targets = {f'data/terminal/{x["kind"]}.json': encode(x) for x in [wall, scene]}
    if args.check:
        for relative, raw in {**assets, **targets}.items():
            file = inside(args.public_root, relative)
            if not file.exists() or file.read_bytes() != raw:
                raise SystemExit(f'Stale or missing output: {relative}')
    elif args.write:
        # Create immutable images first; then atomically swap the two independent menus.
        for relative, raw in assets.items():
            file = inside(args.public_root, relative)
            if file.exists() and file.read_bytes() != raw:
                raise SystemExit(f'Content-addressed asset collision: {file}')
        for relative, raw in assets.items():
            file = inside(args.public_root, relative)
            if not file.exists(): atomic_write(file, raw)
        for relative, raw in targets.items(): atomic_write(inside(args.public_root, relative), raw)
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'report-only',
                      'wallpapers': report['wallpapers'], 'scenes': report['scenes'],
                      'generated_bytes': report['generated_asset_bytes'], 'report': str(args.report)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
