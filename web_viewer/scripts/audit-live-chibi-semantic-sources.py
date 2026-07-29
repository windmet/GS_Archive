"""Compare legacy live semantic exports with TextAssets inside RAW song bundles."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import load_raw_live_semantics


DEFAULT_OUTPUT = (
    PROJECT_ROOT
    / ".analysis"
    / "raw-migration"
    / "live-chibi-semantics"
    / "audit.json"
)


def file_record(path: Path) -> dict:
    payload = path.read_bytes()
    return {
        "path": path,
        "payload": payload,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def compare_domain(raw_records: dict[str, dict], legacy_records: dict[str, dict]) -> dict:
    names = sorted(set(raw_records) | set(legacy_records))
    rows = []
    for name in names:
        raw = raw_records.get(name)
        legacy = legacy_records.get(name)
        rows.append(
            {
                "name": name,
                "rawExists": raw is not None,
                "legacyExists": legacy is not None,
                "byteIdentical": (
                    raw is not None
                    and legacy is not None
                    and raw["payload"] == legacy["payload"]
                ),
                "rawBytes": raw["bytes"] if raw else None,
                "rawSha256": raw["sha256"] if raw else None,
                "rawBundles": raw["bundles"] if raw else [],
                "rawBundleSha256": raw["bundleSha256"] if raw else None,
                "legacyBytes": legacy["bytes"] if legacy else None,
                "legacySha256": legacy["sha256"] if legacy else None,
            }
        )
    return {
        "rawCount": len(raw_records),
        "legacyCount": len(legacy_records),
        "matchedCount": sum(
            1 for row in rows if row["rawExists"] and row["legacyExists"]
        ),
        "byteIdenticalCount": sum(1 for row in rows if row["byteIdentical"]),
        "rawOnly": [row["name"] for row in rows if not row["legacyExists"]],
        "legacyOnly": [row["name"] for row in rows if not row["rawExists"]],
        "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--raw-asset-root", type=Path)
    parser.add_argument("--effect-script-root", type=Path)
    parser.add_argument("--live-lip-sync-root", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_asset_root = (args.raw_asset_root or sources.raw_root / "asset").resolve()
    if args.effect_script_root:
        effect_script_root = args.effect_script_root.resolve()
    elif sources.legacy_root:
        effect_script_root = (
            sources.legacy_root
            / "growing stars"
            / "assets"
            / "resources"
            / "liveeffectscript"
        ).resolve()
    else:
        raise ValueError("legacy_root or --effect-script-root is required")
    if args.live_lip_sync_root:
        live_lip_sync_root = args.live_lip_sync_root.resolve()
    elif sources.legacy_root:
        live_lip_sync_root = (
            sources.legacy_root
            / "scripts"
            / "lipsyncdata"
            / "adxlip_for_live"
        ).resolve()
    else:
        raise ValueError("legacy_root or --live-lip-sync-root is required")
    output = args.output.resolve()
    for required in (raw_asset_root, effect_script_root, live_lip_sync_root):
        if not required.is_dir():
            raise FileNotFoundError(required)

    raw = load_raw_live_semantics(raw_asset_root)
    legacy_choreography = {
        path.stem: file_record(path)
        for path in sorted(effect_script_root.glob("*.csv"))
    }
    legacy_lip_sync = {
        path.stem: file_record(path)
        for path in sorted(live_lip_sync_root.glob("*/*_for_lipsync.json"))
    }
    choreography = compare_domain(raw["choreography"], legacy_choreography)
    lip_sync = compare_domain(raw["lipSync"], legacy_lip_sync)
    report = {
        "schemaVersion": 1,
        "auditKind": "raw-live-chibi-semantic-sources",
        "summary": {
            "rawSongBundleCount": len(list(raw_asset_root.glob("song_*.unity3d"))),
            "rawChoreographyCount": choreography["rawCount"],
            "legacyChoreographyCount": choreography["legacyCount"],
            "byteIdenticalChoreographyCount": choreography["byteIdenticalCount"],
            "rawLipSyncCount": lip_sync["rawCount"],
            "legacyLipSyncCount": lip_sync["legacyCount"],
            "byteIdenticalLipSyncCount": lip_sync["byteIdenticalCount"],
            "rawChoreographyBytes": sum(
                row["bytes"] for row in raw["choreography"].values()
            ),
            "rawLipSyncBytes": sum(
                row["bytes"] for row in raw["lipSync"].values()
            ),
        },
        "choreography": choreography,
        "lipSync": lip_sync,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Choreography RAW-only: {choreography['rawOnly']}")
    print(f"Choreography legacy-only: {choreography['legacyOnly']}")
    print(f"Lip-sync RAW-only: {lip_sync['rawOnly']}")
    print(f"Lip-sync legacy-only: {lip_sync['legacyOnly']}")
    print(f"Audit written to {output}")


if __name__ == "__main__":
    main()
