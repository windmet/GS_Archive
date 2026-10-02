"""Item catalog with source text, expiry and partial source coverage."""
from .named_schema import TABLE_IDS
from .domain_common import clean, text, term_info

def build_items(tables):
    items = []
    for row in tables.get(TABLE_IDS['Items'], []):
        entry = clean(row)
        entry.update(key=f"item:{row['id']}", nameJa=row.get('displayName') or row.get('name', ''), descriptionText=text(row.get('description', '')), termInfo=term_info(row.get('term')), historical=True, mediaStatus='not-checked', sourceCoverage='partial-client-masterdata')
        items.append(entry)
    return items
