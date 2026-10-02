"""Typed Product resolution shared by every archive reward source."""
from collections import Counter
from .named_schema import TABLE_IDS
from .domain_common import ENTITY_TYPES, SCALAR_TYPES, index

class ProductResolver:

    def __init__(self, tables: dict[int, list[dict]]):
        self.tables = tables
        self.entities = {t: index(tables.get(t, [])) for _, t in ENTITY_TYPES.values()}
        self.resources = {row['type']: row for row in tables.get(TABLE_IDS['ProductResources'], [])}
        self.counts: Counter = Counter()

    def resolve(self, product: dict) -> dict:
        code = product.get('type', 0)
        ident, amount = (product.get('productId', 0), product.get('amount', 0))
        resource = self.resources.get(code, {})
        result = {'typeCode': code, 'productId': ident, 'amount': amount, 'typeNameJa': resource.get('name'), 'kind': 'unresolved', 'entityKey': None, 'nameJa': None, 'referenceStatus': 'unknown-type'}
        if code in ENTITY_TYPES:
            kind, table = ENTITY_TYPES[code]
            target = self.entities[table].get(ident)
            result.update(kind=kind, entityKey=f'{kind}:{ident}', referenceStatus='resolved-entity' if target else 'missing-entity')
            if target:
                result['nameJa'] = target.get('displayName') or target.get('name')
        elif code in SCALAR_TYPES:
            result.update(kind='scalar', entityKey=f'productType:{code}', nameJa=resource.get('name'), referenceStatus='type-only')
        elif resource:
            result['referenceStatus'] = 'known-type-unexpanded-domain'
        self.counts[result['referenceStatus']] += 1
        return result
