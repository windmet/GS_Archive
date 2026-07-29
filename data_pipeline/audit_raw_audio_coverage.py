"""Audit master-data and compiled-story audio references against SideM RAW containers."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from archive_paths import add_sources_config_argument, load_archive_sources


def walk(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--music-catalog", type=Path)
    parser.add_argument("--compiled-root", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    raw_root = (args.raw_root or sources.raw_root).resolve()
    music_catalog_path = (
        args.music_catalog
        or sources.published_path("data", "masterdata", "music_catalog.json")
    ).resolve()
    compiled_root = (
        args.compiled_root or sources.published_path("data", "compiled")
    ).resolve()
    output = (
        args.output or sources.inventory_path("audio", "audit.json")
    ).resolve()
    audio_root = raw_root / "audio"
    files = sorted(path for path in audio_root.iterdir() if path.is_file())
    acb = [path for path in files if path.suffix.lower() == ".acb"]
    awb = [path for path in files if path.suffix.lower() == ".awb"]
    stems = {path.stem.lower() for path in (*acb, *awb)}
    acb_stems = {path.stem.lower() for path in acb}
    awb_stems = {path.stem.lower() for path in awb}

    catalog = json.loads(music_catalog_path.read_text(encoding="utf-8"))
    song_codes = sorted((catalog.get("songs") or {}).keys())
    master_bgm = sorted((catalog.get("bgm") or {}).keys())

    references = {
        "bgm": Counter(),
        "ambient": Counter(),
        "se": Counter(),
    }
    json_errors = []
    parsed_files = 0
    for path in compiled_root.rglob("*.json"):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            json_errors.append({"path": str(path), "error": str(error)})
            continue
        parsed_files += 1
        for record in walk(document):
            bgm = record.get("bgm")
            if isinstance(bgm, str) and bgm:
                references["bgm"][bgm] += 1
            environmental = record.get("environmental")
            if isinstance(environmental, dict):
                cue = environmental.get("cue")
                if isinstance(cue, str) and cue and cue != "0":
                    references["ambient"][cue] += 1
            se = record.get("se")
            if isinstance(se, dict):
                cue = se.get("cue")
                if isinstance(cue, str) and cue:
                    references["se"][cue] += 1
            for event in record.get("se_events") or []:
                cue = event.get("cue") if isinstance(event, dict) else None
                if isinstance(cue, str) and cue:
                    references["se"][cue] += 1

    def direct_coverage(values: Iterable[str]) -> dict[str, Any]:
        unique = sorted(set(values))
        matched = [value for value in unique if value.lower() in stems]
        return {
            "unique": len(unique),
            "direct_container_match": len(matched),
            "missing_direct_container": sorted(set(unique) - set(matched)),
        }

    song_matches = {
        code: f"song3_{code}.acb"
        for code in song_codes
        if f"song3_{code}".lower() in acb_stems
    }
    report = {
        "schema_version": 1,
        "raw": {
            "audio_files": len(files),
            "acb": len(acb),
            "awb": len(awb),
            "acb_with_same_stem_awb": len(acb_stems & awb_stems),
            "standalone_awb": sorted(awb_stems - acb_stems),
        },
        "masterdata": {
            "songs": {
                "count": len(song_codes),
                "song3_container_matches": len(song_matches),
                "missing_song3_container": sorted(set(song_codes) - set(song_matches)),
            },
            "bgm": direct_coverage(master_bgm),
        },
        "compiled": {
            "parsed_json_files": parsed_files,
            "json_errors": json_errors,
            "bgm": {
                **direct_coverage(references["bgm"]),
                "reference_count": sum(references["bgm"].values()),
            },
            "ambient": {
                **direct_coverage(references["ambient"]),
                "reference_count": sum(references["ambient"].values()),
            },
            "se": {
                "unique": len(references["se"]),
                "reference_count": sum(references["se"].values()),
                "direct_container_match": sum(
                    1 for cue in references["se"] if cue.lower() in stems
                ),
                "requires_cue_bank_index": len(references["se"]),
            },
        },
        "association_policy": {
            "song": "master song code -> RAW/audio/song3_<code>.acb -> exact cue alias",
            "bgm": "master/story bgm id -> same-stem ACB or AWB",
            "ambient": "story environmental cue -> same-stem ACB or AWB",
            "se": "story SE cue -> exact cue membership in a multi-cue ACB bank",
            "external_awb": "when ACB has no decodable subsongs, inspect/decode the same-stem AWB",
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
