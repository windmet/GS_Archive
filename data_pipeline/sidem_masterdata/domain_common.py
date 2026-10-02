"""Pure data builders. Each function consumes named rows and returns JSON data."""
from __future__ import annotations
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any
import re

from .named_schema import TABLE_IDS

EVENT_TYPES = {1: ('theater', TABLE_IDS['EventTheaters']), 2: ('collection', TABLE_IDS['EventCollections']), 3: ('tour', TABLE_IDS['EventTours']),
               4: ('valentine', TABLE_IDS['EventValentines']), 5: ('whiteday', TABLE_IDS['EventWhitedays'])}
PHOTO_TABLES = {'faces': TABLE_IDS['PhotoFaces'], 'poses': TABLE_IDS['PhotoPoses'], 'filters': TABLE_IDS['PhotoFilters'], 'stickers': TABLE_IDS['PhotoStickers'],
                'spots': TABLE_IDS['PhotoSpots'], 'scenes': TABLE_IDS['PhotoScenes'], 'frames': TABLE_IDS['PhotoFrames'], 'poseVoices': TABLE_IDS['PhotoPoseVoices']}
ENTITY_TYPES = {4: ('item', TABLE_IDS['Items']), 6: ('honor', TABLE_IDS['Honors']), 7: ('card', TABLE_IDS['Cards']),
                8: ('storyCostume', TABLE_IDS['StoryCostumes']), 9: ('liveCostume', TABLE_IDS['LiveCostumes']),
                19: ('photoFilter', TABLE_IDS['PhotoFilters']), 20: ('photoSticker', TABLE_IDS['PhotoStickers']),
                21: ('idolTalk', TABLE_IDS['IdolTalkScenarios']), 22: ('unitTalk', TABLE_IDS['IdolUnitTalkScenarios']),
                24: ('photoSpot', TABLE_IDS['PhotoSpots']), 25: ('photoScene', TABLE_IDS['PhotoScenes']),
                26: ('photoFrame', TABLE_IDS['PhotoFrames']), 30: ('cardFragment', TABLE_IDS['Cards'])}
SCALAR_TYPES = {1, 2, 3, 5, 14, 15, 100, 101}


def clean(row: Any) -> Any:
    """Public named data excludes diagnostic/raw field numbers."""
    if isinstance(row, dict):
        return {key: clean(value) for key, value in row.items() if not key.startswith('_')}
    if isinstance(row, list):
        return [clean(value) for value in row]
    return row

def index(rows: list[dict]) -> dict[int, dict]:
    result = {}
    for row in rows:
        ident = row.get('id')
        if ident is None or ident in result:
            raise ValueError(f'missing/duplicate canonical id: {ident}')
        result[ident] = row
    return result

def group(rows: list[dict], key: str) -> dict[int, list[dict]]:
    result: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        result[row.get(key, 0)].append(row)
    return result

def text(value: str) -> dict:
    """Text-only UI projection; source markup is kept, NEVER send to v-html.

    Recognized emoji tokens become textual labels. No HTML decoder runs after
    the stripping pass: an encoded '<script>' must remain inert text.
    """
    original = value or ''
    emojis = re.findall(r'<emoji>([^<>]*)</emoji>', original)
    plain = re.sub(r'<emoji>([^<>]*)</emoji>', lambda m: '['+m[1]+']', original)
    plain = re.sub(r'<[^>]*>', '', plain)
    return {'source': original, 'plain': plain, 'emojiKeys': emojis,
            'renderMode': 'text-only'}

def date_info(value: int | None) -> dict | None:
    if value is None:
        return None
    try:
        dt = datetime.fromtimestamp(value, timezone.utc)
        return {'unixSeconds': value, 'utc': dt.isoformat(),
                'jst': dt.astimezone(timezone(timedelta(hours=9))).isoformat(),
                'sentinelCandidate': dt.year >= 2099 or dt.year <= 2000}
    except (ValueError, OverflowError, OSError):
        return {'unixSeconds': value, 'utc': None, 'jst': None, 'sentinelCandidate': True}

def term_info(term: dict | None) -> dict | None:
    if term is None:
        return None
    return {'open': date_info(term.get('openAt')), 'close': date_info(term.get('closeAt')),
            'interpretation': 'historical-config-not-current-availability'}

def envelope(kind: str, data: Any, source: dict, **extra: Any) -> dict:
    return {'schemaVersion': 1, 'kind': kind, 'source': source, **extra, **data}
