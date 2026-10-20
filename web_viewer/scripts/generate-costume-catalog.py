#!/usr/bin/env python3
"""Build the costume collection group: public/data/masterdata/domains/costume_catalog.json.

One entry per costume model (model_resource_id, e.g. 001tom_002_00): the visual a StoryCostumes (table 28)
and/or LiveCostumes (table 27) row puts on the idol. Names, descriptions and release times are those rows'
(costume_dictionary.json, with the card-referenced copies in card_detail_index.json); the cards are every
card whose Live/Story costume relations name the model, with the slots they use it in. The thumbnail is the client's own
image/image_costume_icon/image_costume_icon_<model>.png, pinned by SHA-256; a model with no icon says so.

  python scripts/generate-costume-catalog.py            # write
  python scripts/generate-costume-catalog.py --check    # rebuild in memory and compare
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import struct
import sys
from collections import defaultdict
from pathlib import Path

VIEWER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VIEWER.parent / 'data_pipeline'))
from archive_paths import local_config_path  # noqa: E402
MASTERDATA = VIEWER / 'public' / 'data' / 'masterdata'
OUTPUT = MASTERDATA / 'domains' / 'costume_catalog.json'
ICON_DIR = 'image/image_costume_icon'
MODEL = re.compile(r'^[0-9]{3}[a-z]{3}_[0-9]{3}_[0-9]{2}$')
TABLES = {27: 'live', 28: 'story'}
# The card's own Live/Story costume fields; home slots are a reusable homepage choice, not a card relation
# (src/presentation/CardDetailSemantics.js keeps the same five).
SLOT_ORDER = ['live_initial', 'live_limitbreak', 'story_initial', 'story_awakened', 'story_limitbreak']


def read(path: Path):
    return json.loads(path.read_text('utf-8-sig'))


def domain_image_root() -> Path:
    override = os.environ.get('SIDEM_DOMAIN_IMAGE_ROOT')
    if override:
        return Path(override)
    local = local_config_path()
    config = read(local or VIEWER / 'config' / 'archive_sources.example.json')
    return Path(config['legacy_root']) / 'GS_Res' / 'ALL_PHOTOS' / 'assets' / 'resources'


def bind_icon(root: Path, model: str) -> dict:
    exact = root / ICON_DIR / f'image_costume_icon_{model}.png'
    # One export carries an extra variant suffix (022nat_006_00_00); accept it only when it is the sole match.
    variants = sorted((root / ICON_DIR).glob(f'image_costume_icon_{model}_[0-9][0-9].png'))
    file = exact if exact.is_file() else variants[0] if len(variants) == 1 else None
    if file is None:
        return {'status': 'file-not-found', 'runtimeVerified': False}
    data = file.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Invalid PNG export: {file.name}')
    width, height = struct.unpack('>II', data[16:24])
    return {'status': 'verified-local-file', 'url': f'/assets/domain-images/{ICON_DIR}/{file.name}',
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'width': width, 'height': height,
            **({'exportName': file.name} if file != exact else {}), 'runtimeVerified': False}


def build() -> dict:
    dictionary = read(MASTERDATA / 'costume_dictionary.json')
    details = read(MASTERDATA / 'card_detail_index.json')
    by_key = details['costumes_by_key']
    rows_by_model: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for key, row in by_key.items():
        rows_by_model[row['model_resource_id']].append((key, row))
    cards_by_model: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    for resource_id, card in details['cards_by_resource_id'].items():
        for relation in card.get('costume_relations') or []:
            if relation['slot'] not in SLOT_ORDER:
                continue
            row = by_key.get(relation['costume_key'])
            if row is None:
                raise ValueError(f'Card {resource_id} names a missing costume {relation["costume_key"]}')
            cards_by_model[row['model_resource_id']][resource_id].add(relation['slot'])
    root = domain_image_root()
    entries = []
    for costume in dictionary['costumes']:
        model = costume['model_resource_id']
        if not MODEL.match(model or ''):
            raise ValueError(f'Unsafe costume model identity: {model}')
        referenced = rows_by_model.get(model, [])
        names = {row['name'].strip() for _, row in referenced if (row.get('name') or '').strip()} | ({costume['costume_name'].strip()} if (costume.get('costume_name') or '').strip() else set())
        if len(names) > 1:
            raise ValueError(f'Costume {model} has conflicting names: {sorted(names)}')
        description = costume.get('description') or next((row.get('description') for _, row in referenced if row.get('description')), '')
        uses = sorted({TABLES[t] for t in costume['source_tables']} | {key.split(':')[0] for key, _ in referenced})
        cards = [{'resourceId': rid, 'slots': sorted(slots, key=SLOT_ORDER.index)}
                 for rid, slots in sorted(cards_by_model.get(model, {}).items())]
        entries.append({'key': f'costume:{model}', 'id': model, 'idolCode': costume['idol_code'],
                        'idolId': costume['idol_numeric_id'], 'nameJa': next(iter(names), None),
                        'descriptionJa': description or '', 'releaseAt': costume.get('release_at'),
                        'costumeIds': sorted({costume['costume_id'], *(row['costume_id'] for _, row in referenced)}),
                        'uses': uses, 'spineAvailable': bool(costume.get('spine_exists')),
                        'cards': cards, 'image': bind_icon(root, model)})
    if len({e['key'] for e in entries}) != len(entries):
        raise ValueError('Duplicate costume identity')
    entries.sort(key=lambda e: (e['idolId'], e['id']))
    sources = {name: hashlib.sha256((MASTERDATA / name).read_bytes()).hexdigest()
               for name in ('costume_dictionary.json', 'card_detail_index.json')}
    return {'schemaVersion': 1, 'kind': 'gs-costume-catalog',
            'source': {'generatorVersion': 'gs-costume-catalog-v1', 'inputs': sources},
            'entries': entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = json.dumps(build(), ensure_ascii=False, indent=1) + '\n'
    if args.check:
        if OUTPUT.read_text('utf-8') != text:
            raise SystemExit('costume_catalog.json is stale; run scripts/generate-costume-catalog.py')
        print('costume_catalog.json is current')
        return
    OUTPUT.write_text(text, 'utf-8')
    entries = json.loads(text)['entries']
    print(json.dumps({'costumes': len(entries), 'withIcon': sum(e['image']['status'] == 'verified-local-file' for e in entries),
                      'named': sum(bool(e['nameJa']) for e in entries), 'withCards': sum(bool(e['cards']) for e in entries)}))


if __name__ == '__main__':
    main()
