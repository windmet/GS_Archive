"""Classify unresolved RAW story voice references without inventing aliases."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from archive_paths import add_sources_config_argument, load_archive_sources
from extract_raw_story_candidate import extract_text_assets


SHORT_VOICE = re.compile(r"^(?P<letter>[a-z])\d+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    add_sources_config_argument(parser)
    parser.add_argument("--coverage", type=Path)
    parser.add_argument("--cue-index", type=Path)
    parser.add_argument("--raw-root", type=Path)
    parser.add_argument("--public-voice-root", type=Path)
    parser.add_argument("--legacy-voice-root", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def full_cue_and_bank(gap: dict[str, Any], bank_stems: list[str]) -> tuple[str, str]:
    voice = str(gap["voice"])
    short = SHORT_VOICE.fullmatch(voice)
    if short:
        resource_id = str(gap["resource_id"])
        bank = f"{resource_id}_{short.group('letter')}"
        return f"{resource_id}_{voice}", bank
    matching_banks = [bank for bank in bank_stems if voice.startswith(f"{bank}_")]
    return voice, max(matching_banks, key=len) if matching_banks else voice.rsplit("_", 1)[0]


def names_in_lipsync(raw_assets: Path, bank: str) -> tuple[bool, set[str]]:
    bundle = raw_assets / f"lipsync_{bank}.unity3d"
    if not bundle.is_file():
        return False, set()
    return True, {name for name, _payload in extract_text_assets(bundle)}


def main() -> int:
    args = parse_args()
    sources = load_archive_sources(args.sources_config)
    coverage_path = (
        args.coverage or sources.inventory_path("story", "coverage.json")
    ).resolve()
    cue_index_path = (
        args.cue_index
        or sources.inventory_path("audio", "cue-index", "cue_index.json")
    ).resolve()
    raw_root = (args.raw_root or sources.raw_root).resolve()
    public_voice_root = (
        args.public_voice_root or sources.published_path("assets", "voice")
    ).resolve()
    legacy_voice_root = (
        args.legacy_voice_root.resolve() if args.legacy_voice_root else None
    )
    output = (
        args.output
        or sources.inventory_path("story", "voice_gap_audit.json")
    ).resolve()
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    cue_index = json.loads(cue_index_path.read_text(encoding="utf-8"))
    cues = cue_index["cues"]
    raw_audio = raw_root / "audio"
    raw_assets = raw_root / "asset"
    bank_stems = sorted(path.stem for path in raw_audio.glob("*.acb"))
    gaps = []

    for source in coverage["unresolved_voices"]:
        full_cue, bank = full_cue_and_bank(source, bank_stems)
        lipsync_bundle_exists, lipsync_names = names_in_lipsync(raw_assets, bank)
        exact_public = (public_voice_root / f"{full_cue}.m4a").is_file()
        exact_legacy = (
            (legacy_voice_root / f"{full_cue}.ogg").is_file()
            if legacy_voice_root
            else False
        )
        alternate = full_cue.replace("2_3_013_02_", "2_4_013_02_", 1)
        alternate_exists = alternate != full_cue and (
            alternate in cues
            or (public_voice_root / f"{alternate}.m4a").is_file()
            or alternate in names_in_lipsync(raw_assets, "2_4_013_02")[1]
        )
        acb_bank_exists = (raw_audio / f"{bank}.acb").is_file()
        exact_cue_exists = full_cue in cues
        exact_lipsync_exists = full_cue in lipsync_names
        classification = (
            "raw_authored_dangling"
            if acb_bank_exists
            and lipsync_bundle_exists
            and not exact_cue_exists
            and not exact_lipsync_exists
            and not exact_public
            and not exact_legacy
            else "requires_review"
        )
        gaps.append(
            {
                **source,
                "expected_full_cue": full_cue,
                "expected_bank": bank,
                "raw_acb_bank_exists": acb_bank_exists,
                "raw_exact_cue_exists": exact_cue_exists,
                "raw_lipsync_bundle_exists": lipsync_bundle_exists,
                "raw_exact_lipsync_exists": exact_lipsync_exists,
                "public_exact_m4a_exists": exact_public,
                "legacy_exact_ogg_exists": exact_legacy,
                "same_number_2_4_alternate": alternate if alternate != full_cue else None,
                "same_number_2_4_alternate_exists": alternate_exists,
                "alternate_policy": (
                    "not_equivalent_story_do_not_substitute"
                    if alternate != full_cue
                    else None
                ),
                "classification": classification,
            }
        )

    counts = Counter(gap["classification"] for gap in gaps)
    report = {
        "schema_version": 1,
        "sources": {
            "coverage": str(coverage_path),
            "cue_index": str(cue_index_path),
            "raw_root": str(raw_root),
            "public_voice_root": str(public_voice_root),
            "legacy_voice_root": (
                str(legacy_voice_root) if legacy_voice_root else None
            ),
        },
        "summary": {
            "unresolved_references": len(gaps),
            **dict(sorted(counts.items())),
            "all_are_raw_authored_dangling": counts["raw_authored_dangling"] == len(gaps),
        },
        "gaps": gaps,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    return 0 if report["summary"]["all_are_raw_authored_dangling"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
