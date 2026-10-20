#!/usr/bin/env python3
"""Build the currency and resource collection group: public/data/masterdata/domains/currency_catalog.json.

Each entry in config/currency-catalog.v1.json names one ProductResources type (Star Gems, Money, ST, Producer
Exp) or one Items row (Memory Star, Memory Piece). Acquisition is every reward row of the reviewed masterdata
whose product is that type or item, aggregated by source (per event for event rewards); gasha use comes from
the Wikiwiki gasha pages already extracted to public/data/editorial/gasha-pools/. Icons are the client's
image_item_icon_<resourceId>.png, pinned by SHA-256. Shop and exchange lineups are server-delivered and are
not claimed.

  python scripts/generate-currency-catalog.py            # write
  python scripts/generate-currency-catalog.py --check    # rebuild in memory and compare
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from collections import defaultdict
from pathlib import Path

VIEWER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VIEWER.parent / 'data_pipeline'))
from archive_paths import local_config_path  # noqa: E402
sys.path.insert(0, str(VIEWER.parent / 'data_pipeline'))
from sidem_masterdata.archive_domains import build_all  # noqa: E402
from sidem_masterdata.named_schema import TABLE_IDS, project_named_tables  # noqa: E402
from sidem_masterdata.wire import iter_top_records  # noqa: E402

PB = '25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1'
CONFIG = VIEWER / 'config' / 'currency-catalog.v1.json'
OUTPUT = VIEWER / 'public' / 'data' / 'masterdata' / 'domains' / 'currency_catalog.json'
ITEMS = VIEWER / 'public' / 'data' / 'masterdata' / 'domains' / 'item_catalog.json'
MEDIA = VIEWER / 'public' / 'data' / 'masterdata' / 'domains' / 'collection_media.json'
GASHA_POOLS = VIEWER / 'public' / 'data' / 'editorial' / 'gasha-pools'
ICON_DIR = 'image/image_item/normal_release'

# Non-event reward tables, named by what the player did to receive the reward.
TABLE_SOURCES = {
    TABLE_IDS['ProducerLevels']: 'producer-level', TABLE_IDS['ProducerRanks']: 'producer-rank',
    TABLE_IDS['MainStoryProducts']: 'main-story', TABLE_IDS['IdolStoryProducts']: 'idol-story',
    TABLE_IDS['EpisodeZeroStoryProducts']: 'episode-zero-story', TABLE_IDS['HomeStoryProducts']: 'home-story',
    TABLE_IDS['LoginBonusProducts']: 'login-bonus', TABLE_IDS['CampaignLoginBonusProducts']: 'campaign-login-bonus',
}
SOURCE_ORDER = ['event-point', 'event-ranking', 'event-idol-ranking', 'event-repeated', 'event-panel', 'event-story',
                'event-valentine-level', 'event-seasonal-story', 'producer-level', 'producer-rank', 'main-story',
                'idol-story', 'episode-zero-story', 'home-story', 'login-bonus', 'campaign-login-bonus']
EVENT_SCOPES = {'point': 'event-point', 'ranking': 'event-ranking', 'idol-ranking': 'event-idol-ranking',
                'repeated': 'event-repeated', 'panel': 'event-panel', 'story-archive': 'event-story',
                'story-in-event-term': 'event-story', 'valentine-level': 'event-valentine-level',
                'seasonal-story': 'event-seasonal-story'}


def read(path: Path):
    return json.loads(path.read_text('utf-8-sig'))


def domain_image_root() -> Path:
    override = os.environ.get('SIDEM_DOMAIN_IMAGE_ROOT')
    if override:
        return Path(override)
    local = local_config_path()
    config = read(local or VIEWER / 'config' / 'archive_sources.example.json')
    return Path(config['legacy_root']) / 'GS_Res' / 'ALL_PHOTOS' / 'assets' / 'resources'


def bind_icon(root: Path, resource_id: str) -> dict:
    relative = f'{ICON_DIR}/image_item_icon_{resource_id}.png'
    file = root / relative
    if not file.is_file():
        return {'status': 'file-not-found', 'runtimeVerified': False}
    data = file.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Invalid PNG export: {file.name}')
    width, height = struct.unpack('>II', data[16:24])
    return {'status': 'verified-local-file', 'url': f'/assets/domain-images/{relative}',
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'width': width, 'height': height,
            'runtimeVerified': False}


def source_of(row: dict) -> str:
    if row.get('scope') in EVENT_SCOPES:
        return EVENT_SCOPES[row['scope']]
    source = TABLE_SOURCES.get(row['sourceTable'])
    if not source:
        raise ValueError(f'Unclassified reward source: {row["key"]}')
    return source


def acquisition(rows: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for row in rows:
        source = source_of(row)
        group = groups.setdefault(source, {'source': source, 'count': 0, 'totalAmount': 0, 'events': {}, 'range': None})
        amount = row['product'].get('amount') or 0
        group['count'] += 1
        group['totalAmount'] += amount
        if 'eventId' in row:
            event = group['events'].setdefault(row['eventId'], {'eventId': row['eventId'], 'count': 0, 'totalAmount': 0})
            event['count'] += 1
            event['totalAmount'] += amount
        # Producer levels are the one long ladder; its span is more telling than a count.
        if source == 'producer-level' and 'level' in row:
            low, high = group['range'] or (row['level'], row['level'])
            group['range'] = (min(low, row['level']), max(high, row['level']))
    result = []
    for source in SOURCE_ORDER:
        if source not in groups:
            continue
        group = groups[source]
        entry = {'source': source, 'count': group['count'], 'totalAmount': group['totalAmount']}
        if group['events']:
            entry['events'] = sorted(group['events'].values(), key=lambda e: e['eventId'])
        if group['range']:
            entry['levelRange'] = list(group['range'])
        result.append(entry)
    unknown = set(groups) - set(SOURCE_ORDER)
    if unknown:
        raise ValueError(f'Unordered reward sources: {sorted(unknown)}')
    return result


def gasha_title(page: dict) -> str:
    title = page['title']
    return title[title.index('「') + 1:title.rindex('」')] if '「' in title and '」' in title else title


def gasha_usage(pools: dict[str, dict], usage: dict) -> list[dict]:
    """Pools that take this currency, with their stated prices. Only pages that say so are listed."""
    rows = []
    for gasha_id, pool in sorted(pools.items(), key=lambda item: int(item[0]) if item[0].isdigit() else 10**12):
        for page in pool['pages']:
            kinds = {fact['kind'] for fact in page['facts']}
            prices = [price for fact in page['facts'] if fact['kind'] == 'price' for price in fact['prices']]
            steps = page['steps']
            if usage['kind'] == 'gasha':
                paid_only = kinds & {'per_user_paid', 'daily_discount_paid'} or any(step.get('paid_only') for step in steps)
                if usage['currency'] == 'any' and 'currency_any' not in kinds and not any(not p['paid_only'] for p in prices):
                    continue
                if usage['currency'] == 'paid' and 'currency_any' not in kinds and not paid_only and not prices:
                    continue
                listed = [p for p in prices if usage['currency'] == 'paid' or not p['paid_only']]
                rows.append({'gashaId': gasha_id, 'titleJa': gasha_title(page), 'url': page['url'],
                             'prices': listed,
                             'steps': [s for s in steps if usage['currency'] == 'paid' or not s.get('paid_only')],
                             'paidOnlyOffers': sorted(kinds & {'per_user_paid', 'daily_discount_paid'}) if usage['currency'] == 'paid' else []})
            elif usage['kind'] == 'gasha-exchange':
                exchanges = [e for e in page['exchanges'] if e['currency'] == usage['currency']]
                if exchanges:
                    rows.append({'gashaId': gasha_id, 'titleJa': gasha_title(page), 'url': page['url'],
                                 'exchanges': [{'heading': e['heading'], 'count': len(e['rows']),
                                                'costs': sorted({r['cost'] for r in e['rows']})} for e in exchanges]})
            break  # one row per gasha; the first page is the pool's own page
    return rows


def build(pb_path: Path) -> dict:
    raw = pb_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PB:
        raise ValueError('Decoded masterdata differs from the reviewed baseline')
    tables, _ = project_named_tables(list(iter_top_records(raw)))
    outputs, _ = build_all(tables, {})
    resources = {row['type']: row for row in outputs['product_type_catalog.json']['entries']}
    rewards = outputs['reward_catalog.json']['entries']
    items = {row['id']: row for row in read(ITEMS)['entries']}
    media = read(MEDIA)['entries']
    if read(ITEMS)['source']['decodedPbSha256'] != PB:
        raise ValueError('Mixed masterdata snapshot')
    pools = {path.stem: read(path) for path in sorted(GASHA_POOLS.glob('*.json')) if path.stem != 'index'}
    root = domain_image_root()
    config = read(CONFIG)
    entries = []
    for spec in config['entries']:
        if 'productType' in spec:
            code = spec['productType']
            resource = resources[code]
            matched = [r for r in rewards if r['product']['typeCode'] == code]
            entry = {'key': f'currency:{spec["id"]}', 'id': spec['id'], 'productType': code,
                     'nameJa': resource['name'], 'descriptionJa': resource.get('description') or '',
                     'resourceId': resource['resourceId'], 'image': bind_icon(root, resource['resourceId'])}
        else:
            item = items[spec['itemId']]
            matched = [r for r in rewards if r['product'].get('entityKey') == item['key']]
            entry = {'key': f'currency:{spec["id"]}', 'id': spec['id'], 'itemKey': item['key'],
                     'nameJa': item['nameJa'], 'descriptionJa': item['descriptionText']['plain'],
                     'resourceId': item['resourceId'], 'image': {k: v for k, v in media[item['key']]['image'].items()}}
        usage = []
        for line in spec['usage']:
            if line['kind'] in ('gasha', 'gasha-exchange'):
                usage.append({**line, 'gashas': gasha_usage(pools, line)})
            else:
                usage.append(line)
        if spec['id'] == 'memory-star':
            earned = gasha_usage(pools, {'kind': 'gasha-exchange', 'currency': 'メモリースター'})
            gasha_sources = [{'source': 'gasha-draw', 'gashas': [{'gashaId': g['gashaId'], 'titleJa': g['titleJa']} for g in earned]}]
        elif spec['id'] == 'memory-piece':
            converted = [gid for gid, pool in pools.items()
                         if any(fact['kind'] == 'memory_to_piece' for page in pool['pages'][:1] for fact in page['facts'])]
            gasha_sources = [{'source': 'memory-star-conversion', 'gashaCount': len(converted)}]
        else:
            gasha_sources = []
        entries.append({**entry, 'rewardCount': len(matched), 'acquisition': acquisition(matched),
                        'gashaSources': gasha_sources, 'usage': usage})
    if len({e['key'] for e in entries}) != len(entries):
        raise ValueError('Duplicate currency identity')
    return {'schemaVersion': 1, 'kind': 'gs-currency-catalog',
            'source': {'decodedPbSha256': PB, 'generatorVersion': 'gs-currency-catalog-v1',
                       'config': hashlib.sha256(CONFIG.read_bytes()).hexdigest()},
            'coverage': 'client-masterdata-rewards-and-wiki-gasha-pages; shop lineups are server-delivered',
            'entries': entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--decoded-masterdata', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    pb = args.decoded_masterdata
    if not pb:
        local = local_config_path()
        sources = read(local or VIEWER / 'config' / 'archive_sources.example.json')
        pb = Path(sources['archive_root']) / sources['masterdata_decoded_file']
    text = json.dumps(build(pb), ensure_ascii=False, indent=1) + '\n'
    if args.check:
        if OUTPUT.read_text('utf-8') != text:
            raise SystemExit('currency_catalog.json is stale; run scripts/generate-currency-catalog.py')
        print('currency_catalog.json is current')
        return
    OUTPUT.write_text(text, 'utf-8')
    data = json.loads(text)
    print(json.dumps({e['id']: {'rewards': e['rewardCount'], 'image': e['image']['status']} for e in data['entries']}))


if __name__ == '__main__':
    main()
