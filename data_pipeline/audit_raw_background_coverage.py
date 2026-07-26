"""Audit master-data and compiled-story background IDs against RAW bundles."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_ROOT = REPO_ROOT / "RAW"
DEFAULT_CATALOG = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "background_catalog.json"
)
DEFAULT_COMPILED_ROOT = REPO_ROOT / "web_viewer" / "public" / "data" / "compiled"
DEFAULT_PUBLIC_BG_ROOT = REPO_ROOT / "web_viewer" / "public" / "assets" / "bg"
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "background"
    / "coverage.json"
)
BACKGROUND_ID = re.compile(r"^bg[a-z0-9_]+$", re.IGNORECASE)


def collect_backgrounds(value: Any, counter: Counter[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"bg", "imageId"} and isinstance(child, str):
                if BACKGROUND_ID.fullmatch(child):
                    counter[child] += 1
            else:
                collect_backgrounds(child, counter)
    elif isinstance(value, list):
        for child in value:
            collect_backgrounds(child, counter)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--compiled-root", type=Path, default=DEFAULT_COMPILED_ROOT)
    parser.add_argument("--public-bg-root", type=Path, default=DEFAULT_PUBLIC_BG_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    raw_root = args.raw_root.resolve()
    raw_paths = sorted(
        (raw_root / "asset").glob("adv_background_*.unity3d")
    )
    raw_by_id = {
        path.stem.removeprefix("adv_background_"): path for path in raw_paths
    }
    raw_ids = set(raw_by_id)

    catalog_payload = json.loads(args.catalog.resolve().read_text(encoding="utf-8"))
    catalog_ids = set((catalog_payload.get("backgrounds") or {}).keys())

    public_ids = {
        path.stem for path in args.public_bg_root.resolve().glob("*.png")
    }

    story_counter: Counter[str] = Counter()
    compiled_files = sorted(args.compiled_root.resolve().glob("*.json"))
    parsed_files = 0
    parse_errors = []
    for path in compiled_files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            parse_errors.append({"file": path.name, "error": str(error)})
            continue
        parsed_files += 1
        collect_backgrounds(payload, story_counter)
    story_ids = set(story_counter)

    def coverage(ids: set[str]) -> dict[str, Any]:
        matched = sorted(ids & raw_ids)
        missing = sorted(ids - raw_ids)
        return {
            "ids": len(ids),
            "matched_raw": len(matched),
            "missing_raw": len(missing),
            "coverage_ratio": round(len(matched) / len(ids), 6) if ids else 0,
            "missing_ids": missing,
        }

    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "raw_background_bundles": len(raw_ids),
            "catalog_background_ids": len(catalog_ids),
            "compiled_story_background_ids": len(story_ids),
            "public_background_pngs": len(public_ids),
            "compiled_files_scanned": len(compiled_files),
            "compiled_files_parsed": parsed_files,
            "compiled_parse_errors": len(parse_errors),
        },
        "coverage": {
            "masterdata_catalog_to_raw": coverage(catalog_ids),
            "compiled_story_to_raw": coverage(story_ids),
            "public_png_to_raw": coverage(public_ids),
        },
        "compiled_reference_counts": dict(sorted(story_counter.items())),
        "raw_without_catalog_or_story_reference": sorted(
            raw_ids - catalog_ids - story_ids
        ),
        "raw_missing_public_png": sorted(raw_ids - public_ids),
        "public_png_without_raw_bundle": sorted(public_ids - raw_ids),
        "parse_errors": parse_errors,
    }
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(json.dumps(report["coverage"], ensure_ascii=False))
    print(f"report: {output}")


if __name__ == "__main__":
    main()
