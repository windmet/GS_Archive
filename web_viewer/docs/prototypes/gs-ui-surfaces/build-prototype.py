"""Read local records and emit the isolated, offline density comparison only."""
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
SKILL = Path('C:/Users/windm/.codex/skills/prototype/PICKER.md')
inputs = {}


def read_json(relative):
    path = ROOT / relative
    raw = path.read_bytes()
    inputs[relative] = hashlib.sha256(raw).hexdigest()
    return json.loads(raw)


items = read_json('public/data/masterdata/domains/item_catalog.json')
honors = read_json('public/data/masterdata/domains/honor_catalog.json')
translations = {}
for kind, filename in [('item', 'items'), ('honor', 'honors')]:
    translations[kind] = read_json(f'public/translations/zh-CN/archive-general/{filename}.json')['entries'][kind]
browse = read_json('config/collection-browse.v1.json')
events = {}
for entry in browse['entries'].values():
    for source in entry.get('sources', []):
        event = source.get('event')
        if event:
            events[str(event['event_code'])] = event

chosen = [('honor', 30025116), ('honor', 30025312), ('item', 303398), ('item', 101252), ('item', 10401),
          ('item', 101212), ('item', 10101), ('honor', 30026001), ('honor', 10001001)]
catalogs = {'item': {x['id']: x for x in items['entries']}, 'honor': {x['id']: x for x in honors['entries']}}
fixtures = []
for kind, identity in chosen:
    entry = catalogs[kind][identity]
    key = f'{kind}:{identity}'
    source_path = f'public/data/masterdata/domains/entity_sources/{kind}/{identity}.json'
    sources = read_json(source_path) if (ROOT / source_path).exists() else {'rewards': []}
    rows = sources.get('rewards', [])
    sample = []
    for row in rows[:6]:
        clean = {k: v for k, v in row.items() if k != 'product'}
        clean['amount'] = row.get('product', {}).get('amount')
        if str(row.get('eventId')) in events:
            clean['event'] = events[str(row['eventId'])]
        sample.append(clean)
    description = entry.get('descriptionText', {}).get('plain', '')
    text = translations[kind]
    fixtures.append({
        'key': key, 'kind': kind, 'id': identity,
        'nameJa': entry['nameJa'], 'nameZh': text.get('name', {}).get(entry['nameJa'], entry['nameJa']),
        'descriptionJa': description, 'descriptionZh': text.get('description', {}).get(description, description),
        'resourceId': entry.get('resourceId'), 'itemType': entry.get('itemType'),
        'honorType': entry.get('honorType'), 'maxAmount': entry.get('maxAmount'),
        'term': entry.get('term'), 'termInfo': entry.get('termInfo'),
        'sources': sample, 'sourceRecordCount': len(rows), 'sourcePath': source_path,
        'catalogPath': f'public/data/masterdata/domains/{kind}_catalog.json',
    })

data = {'itemsTotal': len(items['entries']), 'honorsTotal': len(honors['entries']),
        'fixtures': fixtures, 'release': browse['release']}
picker = SKILL.read_text(encoding='utf-8')
picker_css = picker.split('```css\n', 1)[1].split('\n```', 1)[0]
picker_js = picker.split('```js\n', 1)[1].split('\n```', 1)[0]
template = (OUT / 'index.template.html').read_text(encoding='utf-8')
html = template.replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
html = html.replace('__PICKER_STYLE__', picker_css).replace('__PICKER_WIRING__', picker_js)
(OUT / 'index.html').write_text(html, encoding='utf-8')
receipt = {'schemaVersion': 1, 'fixtureKeys': [x['key'] for x in fixtures],
           'catalogCounts': {'items': data['itemsTotal'], 'honors': data['honorsTotal']},
           'sourceLimit': 6, 'inputsSha256': inputs,
           'pickerSpecSha256': hashlib.sha256(SKILL.read_bytes()).hexdigest(),
           'dataBoundary': 'Actual catalog and translation strings; at most six raw reward records per fixture. No complete acquisition claim.'}
(OUT / 'data-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Created {OUT / "index.html"}; {len(fixtures)} records; no external runtime requests.')
