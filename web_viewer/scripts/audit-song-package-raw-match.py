#!/usr/bin/env python3
"""Compare supplied IPA song ACB entries with the mounted RAW audio corpus.

The command is deliberately read-only: it reads the IPA ZIP and RAW files,
records names, sizes, and SHA-256 values, and never extracts or modifies either
source.  It is intended to make the 2.6.10 package audit reproducible without
turning a local package path into a publication dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path


SONG_ACB_RE = "/Data/Raw/TutorialAssets/song3_"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def archive_info(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {
        "name": path.name,
        "size": len(data),
        "sha256": sha256(data),
    }


def package_song_entries(ipa: Path) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    with zipfile.ZipFile(ipa) as archive:
        for name in sorted(archive.namelist()):
            if SONG_ACB_RE not in name or not name.lower().endswith(".acb"):
                continue
            data = archive.read(name)
            entries.append(
                {
                    "package_entry": name,
                    "name": Path(name).name,
                    "size": len(data),
                    "sha256": sha256(data),
                }
            )
    return entries


def compare_entries(ipa: Path, raw_audio: Path) -> list[dict[str, object]]:
    comparisons: list[dict[str, object]] = []
    for entry in package_song_entries(ipa):
        raw_path = raw_audio / str(entry["name"])
        raw_data = raw_path.read_bytes() if raw_path.is_file() else None
        comparison = {
            **entry,
            "raw_present": raw_data is not None,
            "raw_size": len(raw_data) if raw_data is not None else None,
            "raw_sha256": sha256(raw_data) if raw_data is not None else None,
        }
        comparison["sha256_equal"] = bool(
            raw_data is not None and comparison["sha256"] == comparison["raw_sha256"]
        )
        comparisons.append(comparison)
    return comparisons


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ipa", type=Path, required=True)
    parser.add_argument("--raw-audio", type=Path, required=True)
    parser.add_argument("--xapk", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    ipa = args.ipa.resolve()
    raw_audio = args.raw_audio.resolve()
    if not ipa.is_file():
        raise FileNotFoundError(ipa)
    if not raw_audio.is_dir():
        raise FileNotFoundError(raw_audio)

    comparisons = compare_entries(ipa, raw_audio)
    result: dict[str, object] = {
        "schema_version": 1,
        "scope": "read_only_supplied_ipa_vs_raw_audio",
        "ipa": archive_info(ipa),
        "raw_audio": {
            "root_label": "RAW/audio",
            "song_acb_count": len(list(raw_audio.glob("song3_*.acb"))),
        },
        "song_acb_matches": comparisons,
        "summary": {
            "package_song_acb_count": len(comparisons),
            "raw_present_count": sum(item["raw_present"] for item in comparisons),
            "sha256_equal_count": sum(item["sha256_equal"] for item in comparisons),
            "sha256_mismatch_count": sum(
                item["raw_present"] and not item["sha256_equal"]
                for item in comparisons
            ),
        },
    }
    if args.xapk:
        xapk = args.xapk.resolve()
        if not xapk.is_file():
            raise FileNotFoundError(xapk)
        with zipfile.ZipFile(xapk) as archive:
            manifest = json.loads(archive.read("manifest.json"))
        result["xapk"] = {
            **archive_info(xapk),
            "package_name": manifest.get("package_name"),
            "version_name": manifest.get("version_name"),
            "version_code": manifest.get("version_code"),
            "split_apks": manifest.get("split_apks"),
        }

    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
