"""Decode ambiguous RAW cue entries in memory and compare their WAV hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from archive_paths import add_sources_config_argument, load_archive_sources


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--coverage", type=Path)
    parser.add_argument("--vgmstream", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_audio = (args.raw_root or sources.raw_root).resolve() / "audio"
    coverage_path = (
        args.coverage
        or sources.inventory_path("audio", "cue-index", "story_se_coverage.json")
    ).resolve()
    output = (
        args.output
        or sources.inventory_path(
            "audio", "cue-index", "ambiguous_decode_comparison.json"
        )
    ).resolve()
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    vgmstream = (args.vgmstream or sources.tool_file("vgmstream")).resolve()
    groups: dict[str, Any] = {}
    for cue, entries in (coverage.get("ambiguous") or {}).items():
        decoded = []
        for entry in entries:
            source = raw_audio / Path(str(entry["source"])).name
            result = subprocess.run(
                [
                    str(vgmstream),
                    "-s",
                    str(entry["selection"]),
                    "-i",
                    "-p",
                    str(source),
                ],
                capture_output=True,
                check=True,
            )
            decoded.append(
                {
                    "bank": entry["bank"],
                    "source": entry["source"],
                    "selection": entry["selection"],
                    "decoded_wav_bytes": len(result.stdout),
                    "decoded_wav_sha256": hashlib.sha256(result.stdout).hexdigest(),
                }
            )
        groups[cue] = {
            "classification": (
                "equivalent_decoded_audio"
                if len({entry["decoded_wav_sha256"] for entry in decoded}) == 1
                else "distinct_decoded_waveforms"
            ),
            "entries": decoded,
        }

    summary = {
        "ambiguous_cues": len(groups),
        "equivalent_decoded_audio": sum(
            record["classification"] == "equivalent_decoded_audio"
            for record in groups.values()
        ),
        "distinct_decoded_waveforms": sorted(
            cue
            for cue, record in groups.items()
            if record["classification"] == "distinct_decoded_waveforms"
        ),
    }
    document = {
        "schema_version": 1,
        "summary": summary,
        "cues": groups,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
