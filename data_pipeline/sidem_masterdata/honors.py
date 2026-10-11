"""Honor metadata; prefab references do not imply restored effects."""
from .named_schema import TABLE_IDS
from .domain_common import clean, text

def build_honors(tables):
    honors = []
    for row in tables.get(TABLE_IDS['Honors'], []):
        entry = clean(row)
        entry.update(key=f"honor:{row['id']}", nameJa=row.get('name', ''), descriptionText=text(row.get('description', '')), mediaStatus='not-checked', hasPrefab=bool(row.get('prefabResourceId')), unlockConditionStatus='source-links-only-no-complete-mission-table')
        honors.append(entry)
    return honors
