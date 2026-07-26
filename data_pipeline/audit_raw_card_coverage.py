"""Compare master-data card identities with original RAW card bundles."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_ROOT = REPO_ROOT / "RAW"
DEFAULT_CARD_INDEX = (
    REPO_ROOT / "web_viewer" / "public" / "data" / "masterdata" / "card_index.json"
)
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "card"
    / "coverage.json"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument("--card-index", type=Path, default=DEFAULT_CARD_INDEX)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    raw_root = args.raw_root.resolve()
    card_index = args.card_index.resolve()
    cards = json.loads(card_index.read_text(encoding="utf-8")).get("cards", [])
    grouped_cards: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for card in cards:
        if card.get("resource_id"):
            grouped_cards[str(card["resource_id"])].append(card)
    by_resource_id = {
        resource_id: rows[0] for resource_id, rows in grouped_cards.items()
    }

    bundle_paths = sorted((raw_root / "asset").glob("card_*.unity3d"))
    bundle_by_resource_id = {
        path.stem.removeprefix("card_"): path for path in bundle_paths
    }
    master_ids = set(by_resource_id)
    bundle_ids = set(bundle_by_resource_id)
    matched_ids = sorted(master_ids & bundle_ids)
    missing_ids = sorted(master_ids - bundle_ids)
    extra_ids = sorted(bundle_ids - master_ids)

    rarities = sorted(
        {str(card.get("rarity") or "unknown") for card in by_resource_id.values()}
    )
    by_rarity = {}
    for rarity in rarities:
        row_count = sum(
            1
            for card in cards
            if str(card.get("rarity") or "unknown") == rarity
        )
        ids = {
            resource_id
            for resource_id, card in by_resource_id.items()
            if str(card.get("rarity") or "unknown") == rarity
        }
        by_rarity[rarity] = {
            "masterdata_rows": row_count,
            "unique_resource_ids": len(ids),
            "raw_bundle": len(ids & bundle_ids),
            "missing": len(ids - bundle_ids),
        }

    missing_records = [
        {
            "card_id": by_resource_id[resource_id].get("card_id"),
            "resource_id": resource_id,
            "character_id": by_resource_id[resource_id].get("character_id"),
            "rarity": by_resource_id[resource_id].get("rarity"),
            "title": by_resource_id[resource_id].get("title"),
            "release_at": by_resource_id[resource_id].get("release_at"),
        }
        for resource_id in missing_ids
    ]
    missing_by_character = dict(
        sorted(
            Counter(
                str(record.get("character_id") or "unknown")
                for record in missing_records
            ).items()
        )
    )

    report = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "card_index": card_index.relative_to(REPO_ROOT).as_posix(),
            "raw_asset_root": "RAW/asset",
            "bundle_pattern": "card_<resource_id>.unity3d",
        },
        "summary": {
            "masterdata_card_rows": len(cards),
            "masterdata_unique_resource_ids": len(master_ids),
            "duplicate_resource_ids": sum(
                1 for rows in grouped_cards.values() if len(rows) > 1
            ),
            "raw_card_bundles": len(bundle_ids),
            "matched": len(matched_ids),
            "missing_raw_bundle": len(missing_ids),
            "extra_raw_bundle": len(extra_ids),
            "coverage_ratio": round(len(matched_ids) / len(master_ids), 6)
            if master_ids
            else 0,
        },
        "by_rarity": by_rarity,
        "duplicate_masterdata_resources": [
            {
                "resource_id": resource_id,
                "rows": [
                    {
                        "card_id": card.get("card_id"),
                        "rarity": card.get("rarity"),
                        "title": card.get("title"),
                        "release_at": card.get("release_at"),
                    }
                    for card in rows
                ],
            }
            for resource_id, rows in sorted(grouped_cards.items())
            if len(rows) > 1
        ],
        "missing_by_character": missing_by_character,
        "missing_cards": missing_records,
        "extra_raw_bundles": [
            {
                "resource_id": resource_id,
                "relative_path": bundle_by_resource_id[resource_id]
                .relative_to(raw_root)
                .as_posix(),
            }
            for resource_id in extra_ids
        ],
    }
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(json.dumps(report["by_rarity"], ensure_ascii=False))
    if missing_records:
        print("missing:", ", ".join(record["resource_id"] for record in missing_records))
    if extra_ids:
        print("extra:", ", ".join(extra_ids))
    print(f"report: {output}")


if __name__ == "__main__":
    main()
