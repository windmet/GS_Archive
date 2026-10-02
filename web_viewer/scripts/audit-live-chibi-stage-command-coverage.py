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

import UnityPy

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT.parent / "data_pipeline"))
from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import text_asset_payload, sha256_file

COMMANDS = {"Suspensionlight", "Penlight"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
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
            counts = Counter(row[0] for row in rows if row and row[0] in COMMANDS)
            found[text.m_Name] = {"songId": wanted[text.m_Name]["id"], "source": text.m_Name,
                                  "bundle": path.name, "serializedFile": obj.assets_file.name,
                                  "pathId": str(obj.path_id), "textSha256": hashlib.sha256(payload).hexdigest(),
                                  "commands": dict(counts),
                                  "firstRows": {cmd: next(row for row in rows if row and row[0] == cmd)
                                                for cmd in counts}}
        if found.keys() != wanted.keys():
            raise ValueError(f"Missing RAW choreography: {wanted.keys() - found.keys()}")
        bundles.append({"name": path.name, "bytes": path.stat().st_size, "sha256": sha256_file(path)})
        records.extend(found.values())
    counts = Counter()
    for record in records:
        counts.update(record["commands"])
    report = {"schemaVersion": 1, "status": "raw_commands_not_rendered",
              "choreographyIndexSha256": sha256_file(index_path), "arrangements": len(records),
              "commands": dict(counts), "affectedArrangements": {
                  cmd: sum(record["commands"].get(cmd, 0) > 0 for record in records) for cmd in sorted(COMMANDS)},
              "bundles": bundles, "records": records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["arrangements", "commands", "affectedArrangements"]}))


if __name__ == "__main__":
    main()
