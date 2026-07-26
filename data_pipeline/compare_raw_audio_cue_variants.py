"""Decode ambiguous RAW cue entries in memory and compare their WAV hashes."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--coverage", type=Path, required=True)
    parser.add_argument("--vgmstream", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_audio = args.raw_root.resolve() / "audio"
    coverage = json.loads(args.coverage.read_text(encoding="utf-8"))
    vgmstream = args.vgmstream.resolve()
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
                else "distinct_waveform_variants"
            ),
            "entries": decoded,
        }

    summary = {
        "ambiguous_cues": len(groups),
        "equivalent_decoded_audio": sum(
            record["classification"] == "equivalent_decoded_audio"
            for record in groups.values()
        ),
        "distinct_waveform_variants": sorted(
            cue
            for cue, record in groups.items()
            if record["classification"] == "distinct_waveform_variants"
        ),
    }
    document = {
        "schema_version": 1,
        "summary": summary,
        "cues": groups,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
