#!/usr/bin/env python3
"""Census unimplemented stage commands in exact indexed RAW TextAssets."""
import argparse
from collections import Counter
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT.parent / "data_pipeline"))
COMMAND_FAMILIES = ("Suspensionlight", "NewSuspensionlight", "Searchlight", "Penlight")


def command_family(command):
    return next((family for family in COMMAND_FAMILIES
                 if command == family or command.startswith(family + "_")), None)


def census_rows(rows):
    """Keep exact command spellings and raw backmonitor fields; do not infer semantics."""
    source_rows = [(index, row) for index, row in enumerate(rows, 1)
                   if row and row[0] and not row[0].startswith("#")]
    counts = Counter(row[0] for _, row in source_rows if command_family(row[0]))
    families = Counter()
    for command, count in counts.items():
        families[command_family(command)] += count
    backmonitor_rows = [{"sourceRow": index, "row": row,
                         "rawValue6": row[7].strip() if len(row) > 7 else None}
                        for index, row in source_rows if row[0] == "Backmonitor"]
    # The older four-family census cannot expose commands that never reach
    # an exporter. Inventory every active spelling, including unknown types.
    all_counts = Counter(row[0] for _, row in source_rows
                         if not (row[0] == 'type' and len(row) > 1 and row[1] == 'time'))
    non_timed = Counter()
    for _, row in source_rows:
        if row[0] == 'type' and len(row) > 1 and row[1] == 'time':
            continue
        try:
            timed = len(row) > 1 and math.isfinite(float(row[1]))
        except ValueError:
            timed = False
        if not timed:
            non_timed[row[0]] += 1
    return {"commands": dict(sorted(counts.items())), "families": dict(sorted(families.items())),
            "allCommands": dict(sorted(all_counts.items())),
            'nonTimedCommands': dict(sorted(non_timed.items())),
            "firstRows": {cmd: next(row for _, row in source_rows if row[0] == cmd) for cmd in counts},
            "lastRows": {cmd: next(row for _, row in reversed(source_rows) if row[0] == cmd) for cmd in counts},
            "backmonitorRows": backmonitor_rows}


def summarize_records(records):
    counts, families, values, all_counts, non_timed = Counter(), Counter(), Counter(), Counter(), Counter()
    for record in records:
        counts.update(record["commands"])
        families.update(record["families"])
        all_counts.update(record['allCommands'])
        non_timed.update(record['nonTimedCommands'])
        values.update(row["rawValue6"] if row["rawValue6"] is not None else "<missing>"
                      for row in record["backmonitorRows"])
    return {"commands": dict(sorted(counts.items())), "families": dict(sorted(families.items())),
            "allCommands": dict(sorted(all_counts.items())),
            'nonTimedCommands': dict(sorted(non_timed.items())),
            "allAffectedArrangements": {cmd: sum(record['allCommands'].get(cmd, 0) > 0 for record in records)
                                        for cmd in sorted(all_counts)},
            "affectedArrangements": {cmd: sum(record["commands"].get(cmd, 0) > 0 for record in records)
                                     for cmd in sorted(counts)},
            "affectedFamilies": {family: sum(record["families"].get(family, 0) > 0 for record in records)
                                 for family in COMMAND_FAMILIES},
            "backmonitorRawValue6": dict(sorted(values.items())),
            "backmonitorNonzeroValue6Arrangements": sum(any(
                row["rawValue6"] not in (None, "", "0") for row in record["backmonitorRows"])
                for record in records)}


def compact_inventory(report):
    """Publish counts/provenance, never full CSV arguments or runtime status."""
    return {'schemaVersion': 1, 'status': 'raw_source_inventory_not_visual_acceptance',
            'choreographyIndexSha256': report['choreographyIndexSha256'],
            'arrangements': report['arrangements'], 'commands': report['allCommands'],
            'nonTimedCommands': report['nonTimedCommands'],
            'affectedArrangements': report['allAffectedArrangements'],
            'bundles': report['bundles'],
            'songs': {record['songId']: {
                'source': record['source'], 'songCode': record['songCode'],
                'raw': {key: record[key] for key in ('bundle', 'serializedFile', 'pathId', 'textSha256')},
                'commands': record['allCommands'], 'nonTimedCommands': record['nonTimedCommands']}
                for record in sorted(report['records'], key=lambda record: record['songId'])}}


def main():
    from archive_paths import add_sources_config_argument, load_archive_sources
    from live_chibi_raw_semantics import text_asset_payload, sha256_file

    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument('--index', type=Path, default=PROJECT_ROOT / 'public/assets/live-chibi/choreography/index.json')
    parser.add_argument('--inventory-output', type=Path)
    parser.add_argument('--progress', action='store_true')
    args = parser.parse_args()
    import UnityPy  # Native input extraction only; the census helpers need just stdlib.
    sources = load_archive_sources(args.sources_config)
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output.is_relative_to(sources.publish_root.resolve()):
        parser.error("Audit output must be outside RAW and published assets")
    index_path = args.index.resolve()
    if output == index_path:
        parser.error('Full census evidence must not overwrite its choreography input')
    index_hash = sha256_file(index_path)
    if args.inventory_output and (args.inventory_output.resolve().is_relative_to(sources.raw_root.resolve())
                                  or args.inventory_output.resolve() in (index_path, output)):
        parser.error('Compact inventory must not overwrite RAW, choreography or full evidence')
    index = json.loads(index_path.read_text(encoding="utf-8"))
    by_code = {}
    for song in index["songs"]:
        by_code.setdefault(song["songCode"], []).append(song)
    records, bundles = [], []
    raw_root = (sources.raw_root / "asset").resolve()
    for code, songs in sorted(by_code.items()):
        path = (raw_root / f"song_{code}.unity3d").resolve()
        if path.parent != raw_root:
            raise ValueError("Unsafe indexed song bundle path")
        wanted = {song["source"].removesuffix(".csv"): song for song in songs}
        if len(wanted) != len(songs):
            raise ValueError("Duplicate indexed choreography source")
        bundle_hash = sha256_file(path)
        environment = UnityPy.load(str(path))
        found = {}
        for obj in environment.objects:
            if obj.type.name != "TextAsset":
                continue
            text = obj.read()
            if text.m_Name not in wanted:
                continue
            if text.m_Name in found:
                raise ValueError("Ambiguous RAW TextAsset identity")
            payload = text_asset_payload(text)
            rows = list(csv.reader(io.StringIO(payload.decode("utf-8-sig", errors="surrogateescape"), newline="")))
            found[text.m_Name] = {"songId": wanted[text.m_Name]["id"], "songCode": code, "source": text.m_Name,
                                  "bundle": path.name, "serializedFile": obj.assets_file.name,
                                  "pathId": str(obj.path_id), "textSha256": hashlib.sha256(payload).hexdigest(),
                                  **census_rows(rows)}
        if found.keys() != wanted.keys():
            raise ValueError(f"Missing RAW choreography: {wanted.keys() - found.keys()}")
        if sha256_file(path) != bundle_hash:
            raise ValueError(f'RAW bundle changed during census: {path.name}')
        bundles.append({"name": path.name, "bytes": path.stat().st_size, "sha256": bundle_hash})
        records.extend(found.values())
        if args.progress:
            print(f'Census {len(bundles)}/{len(by_code)} bundles; {len(records)} arrangements: {code}', file=sys.stderr, flush=True)
    if sha256_file(index_path) != index_hash:
        raise ValueError('Choreography index changed during census')
    if len({record['songId'] for record in records}) != len(index['songs']):
        raise ValueError('Duplicate or missing indexed arrangement identity')
    report = {"schemaVersion": 3, "status": "source_inventory_not_visual_acceptance",
              "choreographyIndexSha256": index_hash, "arrangements": len(records),
              **summarize_records(records),
              "boundaries": {"runtimeCoverage": "computed_by_current_consumer_registry_not_this_inventory",
                             "backmonitorValue6": "raw_column_preserved_without_runtime_claim",
                             "penlight": "inventoried_only_not_rendered"},
              "bundles": bundles, "records": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    if args.inventory_output:
        target = args.inventory_output.resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp.json')
        temporary.write_text(json.dumps(compact_inventory(report), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        temporary.replace(target)
    print(json.dumps({key: report[key] for key in ["arrangements", "families", "affectedFamilies",
                                                "backmonitorRawValue6", "backmonitorNonzeroValue6Arrangements"]}))


if __name__ == "__main__":
    main()
