"""Merge reviewed web acquisition semantics with a fresh, unchanged PB audit.

Outputs only to .analysis. Web evidence cannot manufacture Product or mission IDs.
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter, defaultdict
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'config/honor-acquisition-web-evidence.v1.json'
spec = importlib.util.spec_from_file_location('honor_scan', Path(__file__).with_name('honor-acquisition-scan.py'))
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)


def merge(baseline, honors, registry):
    if registry.get('schemaVersion') != 1 or registry.get('kind') != 'gs-honor-acquisition-web-evidence':
        raise ValueError('Unsupported web evidence registry')
    sources = scan.unique_rows(registry['sources'], 'key')
    mappings = scan.unique_rows(registry['mappings'], 'honorId')
    identities = scan.unique_rows(honors['entries'], 'id')
    original = scan.unique_rows(baseline['entries'], 'id')
    if set(identities) != set(original) or any(identities[i]['nameJa'] != original[i]['nameJa'] for i in original):
        raise ValueError('Honor catalog identity drift from current PB audit')
    for key in ('decodedPbSha256', 'compactSchemaSha256'):
        if honors['source'][key] != baseline['source'][key]:
            raise ValueError('Honor catalog provenance drift: ' + key)

    def refs(keys, roles=None):
        if not keys or len(keys) != len(set(keys)) or any(k not in sources for k in keys):
            raise ValueError('Missing or duplicate web provenance')
        result = []
        for key in keys:
            source = sources[key]
            if not source['url'].startswith('https://') or not source['locator']:
                raise ValueError('Web URL / locator missing')
            result.append({**copy.deepcopy(source), 'role': (roles or {}).get(key, 'named-condition-pair')})
        return result

    catalog = copy.deepcopy(baseline)
    catalog['coverage'] = 'client-PB-plus-reviewed-web-semantics-not-complete-server-acquisition-library'
    catalog['schemaVersion'] = 2
    for entry in catalog['entries']:
        entry['pbStatus'] = entry['status']
        entry['honorType'] = identities[entry['id']]['honorType']
        mapping = mappings.get(entry['id'])
        if not mapping:
            continue
        if (mapping['nameJa'] != entry['nameJa'] or mapping['honorType'] != entry['honorType']
                or entry['honorType'] not in (1, 2)
                or sum(h['nameJa'] == entry['nameJa'] for h in identities.values()) != 1):
            raise ValueError('Missing, ambiguous or out-of-scope exact honor identity')
        if not mapping['condition'].get('metric'):
            raise ValueError('Missing acquisition metric')
        conflicts = [{**copy.deepcopy(c), 'evidence': refs(c['evidence'])}
                     for c in mapping.get('conflicts', [])]
        source = {'type': 'normal_mission', 'sourceId': None,
                  'status': 'web-conflict' if conflicts else 'web-reported',
                  'condition': copy.deepcopy(mapping['condition']),
                  'product': None, 'rawEvidence': None,
                  'externalEvidence': {'registryKey': f"web-honor:{entry['id']}",
                      'identityJoin': 'exact-unique-name-and-reviewed-id-and-honor-type',
                      'checkedOn': registry['checkedOn'],
                      'citations': refs(mapping['evidence'], mapping.get('evidenceRoles')),
                      'conflicts': conflicts, 'resolution': mapping.get('resolution'),
                      'proofBoundary': 'reported-semantic-pair-no-encoded-Product-or-official-mission-id'}}
        entry['sources'].append(source)
        if entry['pbStatus'] != 'known-source':
            entry['status'] = 'web-conflict' if conflicts else 'web-reported-source'
    if not set(mappings).issubset(original):
        raise ValueError('Web mapping references missing honor')
    scan.unique_rows(registry['conditionTemplates'], 'key')
    templates = []
    for template in registry['conditionTemplates']:
        if not template.get('metric') or any(type(n) is not int or n <= 0 for n in template['requiredCounts']):
            raise ValueError('Invalid condition template')
        templates.append({**copy.deepcopy(template), 'status': 'condition-template-only',
            'honorIds': [], 'evidence': refs(template['evidence'],
                {k: 'condition-template-only' for k in template['evidence']})})
    return catalog, templates


def search_queue(catalog, registry):
    attempts = defaultdict(list)
    for attempt in registry.get('searchAttempts', []):
        attempts[attempt['honorId']].append(attempt)
    rows = []
    for entry in catalog['entries']:
        if entry['honorType'] not in (1, 2) or entry['status'] not in ('unknown', 'reward-only', 'web-conflict'):
            continue
        placeholder = bool(re.fullmatch(r'ダミーテキスト|\d{2}/[^_]*', entry['nameJa']))
        internal_label = bool(re.fullmatch(r'\d{2}/.*FES.*_.*', entry['nameJa']))
        rows.append({'honorId': entry['id'], 'nameJa': entry['nameJa'], 'honorType': entry['honorType'],
            'priority': 'conflict' if entry['status'] == 'web-conflict' else 'defer-label' if placeholder or internal_label else 'search',
            'status': entry['status'], 'nameLooksLikePlaceholder': placeholder,
            'nameLooksLikeInternalConditionLabel': internal_label,
            'queries': [f'"{entry["nameJa"]}" "SideM" "称号"',
                        f'"{entry["nameJa"]}" "GROWING STARS"',
                        f'"{entry["nameJa"]}" "サイスタ" "ミッション"'],
            'previousAttempts': attempts[entry['id']],
            'neededEvidence': 'Title name + explicit condition/threshold + idol/song if applicable + source URL or gameplay image; conflict additionally needs date/version.'})
    return sorted(rows, key=lambda r: ({'conflict': 0, 'search': 1, 'defer-label': 2}[r['priority']], r['honorId']))


def handoff(report, queue, templates):
    text = ['# 常驻称号：下一轮搜索清单', '',
        f"已接入 {report['webMappedHonors']} 个明确网页配对，其中 {report['webConflictHonors']} 个有冲突。",
        f"无语义来源的非活动分类称号剩 {report['unknownNonEventHonors']} 个：普通 {report['unknownByHonorType']['1']}、偶像 {report['unknownByHonorType']['2']}。",
        f"其中 {report['placeholderUnknownHonors']} 个名称呈占位文本形态，暂不优先搜索；不能据此认定未实装。",
        f"另 {report['internalConditionLabelHonors']} 个是 FES 相关条件描述形态，缺正式显示名与来源证明，也暂缓搜索。",
        '分类只用于搜索范围，不证明它们一定属于常驻 Normal Mission；FES 条件标签也不证明实装或取得条件。HonorType=3 的活动称号已排除。', '',
        '搜索目标：同一证据中给出「具体称号名 ↔ 获取条件」，包括阈值、偶像或曲目名称。附 URL 或清晰实机截图、日期/版本。',
        '任务模板只写“称号”的奖励栏不足以连接现有称号。无需每条都取得 Mission API；官方任务 ID / Product 字段仍需原始载荷。', '',
        '## 条件模板参考（不自动绑定称号）', '', '| 模板 | 阈值 | 参数 |', '| --- | --- | --- |']
    text += [f"| {t['key']} | {', '.join(map(str, t['requiredCounts'])) or '完成集合'} | {', '.join(t['parameters']) or '无'} |" for t in templates]
    text += ['', '信赖度100的模板同时奖励 Talk 与称号；仍缺每名偶像的具体称号名。',
        '391 条 ReleasedByMission 是 MobileReleaseConditions 的手机内容解锁引用，不作为称号池，也不连接此表。', '']
    for priority, heading in [('conflict', '优先核实的冲突'), ('search', '可直接反搜的称号'), ('defer-label', '保留但暂缓的占位名称与内部条件标签')]:
        text += [f'## {heading}', '', '| Honor ID | 类型 | 原名 | 建议查询 |', '| --- | --- | --- | --- |']
        for row in queue:
            if row['priority'] == priority:
                text.append(f"| {row['honorId']} | {'普通' if row['honorType'] == 1 else '偶像'} | {row['nameJa'].replace('|', '&#124;')} | {row['queries'][0].replace('|', '&#124;')} |")
        text.append('')
    return '\n'.join(text)


def run(decoded, registry_path=REGISTRY):
    # Refresh PB evidence on every merge; never trust a stale generated audit.
    baseline = scan.run(decoded)['honor_acquisition_catalog.json']
    raw = decoded.read_bytes()
    if scan.sha(raw) != baseline['source']['decodedPbSha256']:
        raise ValueError('PB changed during merge')
    tables, _ = scan.project_named_tables(list(scan.iter_top_records(raw)))
    domains, _ = scan.build_all(tables, {})
    honors = domains['honor_catalog.json']
    honors['source'] = baseline['source']
    registry_bytes = registry_path.read_bytes()
    registry = json.loads(registry_bytes)
    catalog, templates = merge(baseline, honors, registry)
    queue = search_queue(catalog, registry)
    unknown = [h for h in catalog['entries'] if h['status'] in ('unknown', 'reward-only')]
    permanent = [h for h in unknown if h['honorType'] in (1, 2)]
    by_type = Counter(str(h['honorType']) for h in permanent)
    report = {'kind': 'gs-honor-web-validation', 'honors': len(catalog['entries']),
        'pbKnownSourceHonors': sum(h['pbStatus'] == 'known-source' for h in catalog['entries']),
        'webMappedHonors': len(registry['mappings']),
        'webConflictHonors': sum(h['status'] == 'web-conflict' for h in catalog['entries']),
        'webNonConflictHonors': sum(h['status'] == 'web-reported-source' for h in catalog['entries']),
        'unknownHonors': len(unknown), 'unknownNonEventHonors': len(permanent),
        'unknownByHonorType': dict(by_type),
        'unknownEventHonorsExcludedFromSearch': sum(h['honorType'] == 3 for h in unknown),
        'placeholderUnknownHonors': sum(r['nameLooksLikePlaceholder'] for r in queue),
        'internalConditionLabelHonors': sum(r['nameLooksLikeInternalConditionLabel'] for r in queue),
        'namedUnknownSearchCandidates': sum(r['priority'] == 'search' for r in queue),
        'conditionTemplateFamilies': len(templates), 'searchQueueEntriesIncludingConflict': len(queue),
        'publicationReady': False, 'frontendChanged': False,
        'nextGate': 'Find explicit named reward pairs for non-event catalog candidates; preserve versioned conflicts; original responses are needed only for official mission/Product identity.'}
    proof = {**baseline['source'], 'webRegistrySha256': scan.sha(registry_bytes),
             'webCheckedOn': registry['checkedOn'], 'mergerVersion': 'honor-acquisition-web-v1',
             'mergerSha256': scan.sha(Path(__file__).read_bytes())}
    result = {'honor_acquisition_catalog.json': catalog,
              'normal_mission_condition_templates.json': {'kind': 'gs-normal-mission-condition-templates', 'entries': templates},
              'reverse_lookup_web_queue.json': {'kind': 'gs-honor-web-search-queue', 'entries': queue},
              'validation_report.json': report}
    for value in result.values():
        value.setdefault('schemaVersion', 1)
        value.update(source=proof)
    result['search_handoff.md'] = handoff(report, queue, templates)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decoded-masterdata', type=Path, default=ROOT / '.analysis/masterdata/client_master_data.xor_DefaultPassPhrase.pb')
    parser.add_argument('--registry', type=Path, default=REGISTRY)
    parser.add_argument('--out', type=Path, default=ROOT / '.analysis/honor-acquisition-web-v1')
    args = parser.parse_args()
    out = args.out.resolve()
    audit_root = (ROOT / '.analysis').resolve()
    if not out.is_relative_to(audit_root) or out == audit_root:
        raise ValueError('Output must be a .analysis subdirectory in this checkout')
    result = run(args.decoded_masterdata, args.registry)
    out.mkdir(parents=True, exist_ok=True)
    for name, value in result.items():
        (out / name).write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result['validation_report.json'].items() if k != 'source'}, ensure_ascii=False))
    print(out)


if __name__ == '__main__':
    main()
