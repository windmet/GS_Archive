#!/usr/bin/env python3
"""Census unimplemented stage commands in exact indexed RAW TextAssets."""
import argparse
from collections import Counter
import csv
import hashlib
import io
import json
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
    return {"commands": dict(sorted(counts.items())), "families": dict(sorted(families.items())),
            "firstRows": {cmd: next(row for _, row in source_rows if row[0] == cmd) for cmd in counts},
            "lastRows": {cmd: next(row for _, row in reversed(source_rows) if row[0] == cmd) for cmd in counts},
            "backmonitorRows": backmonitor_rows}


def summarize_records(records):
    counts, families, values = Counter(), Counter(), Counter()
    for record in records:
        counts.update(record["commands"])
        families.update(record["families"])
        values.update(row["rawValue6"] if row["rawValue6"] is not None else "<missing>"
                      for row in record["backmonitorRows"])
    return {"commands": dict(sorted(counts.items())), "families": dict(sorted(families.items())),
            "affectedArrangements": {cmd: sum(record["commands"].get(cmd, 0) > 0 for record in records)
                                     for cmd in sorted(counts)},
            "affectedFamilies": {family: sum(record["families"].get(family, 0) > 0 for record in records)
                                 for family in COMMAND_FAMILIES},
            "backmonitorRawValue6": dict(sorted(values.items())),
            "backmonitorNonzeroValue6Arrangements": sum(any(
                row["rawValue6"] not in (None, "", "0") for row in record["backmonitorRows"])
                for record in records)}


def main():
    from archive_paths import add_sources_config_argument, load_archive_sources
    from live_chibi_raw_semantics import text_asset_payload, sha256_file

    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import UnityPy  # Native input extraction only; the census helpers need just stdlib.
    sources = load_archive_sources(args.sources_config)
    output = args.output.resolve()
    if output.is_relative_to(sources.raw_root.resolve()) or output.is_relative_to(sources.publish_root.resolve()):
        parser.error("Audit output must be outside RAW and published assets")
    index_path = sources.published_path("assets/live-chibi/choreography/index.json")
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
            found[text.m_Name] = {"songId": wanted[text.m_Name]["id"], "source": text.m_Name,
                                  "bundle": path.name, "serializedFile": obj.assets_file.name,
                                  "pathId": str(obj.path_id), "textSha256": hashlib.sha256(payload).hexdigest(),
                                  **census_rows(rows)}
        if found.keys() != wanted.keys():
            raise ValueError(f"Missing RAW choreography: {wanted.keys() - found.keys()}")
        bundles.append({"name": path.name, "bytes": path.stat().st_size, "sha256": sha256_file(path)})
        records.extend(found.values())
    report = {"schemaVersion": 2, "status": "source_inventory_not_visual_acceptance",
              "choreographyIndexSha256": sha256_file(index_path), "arrangements": len(records),
              **summarize_records(records),
              "boundaries": {"lightFamilies": "not_consumed_by_current_choreography_parser",
                             "backmonitorValue6": "raw_column_preserved_for_audit_semantics_not_proven_by_method_bodies",
                             "penlight": "inventoried_only_not_this_acceptance_target"},
              "bundles": bundles, "records": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["arrangements", "families", "affectedFamilies",
                                                "backmonitorRawValue6", "backmonitorNonzeroValue6Arrangements"]}))


if __name__ == "__main__":
    main()
