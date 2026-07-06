"""
Build an SSR Portraits bridge index that joins the legacy standalone viewer
with the current masterdata card index.

The generated JSON keeps the old viewer's shape, but replaces the display
surface with masterdata-backed names/titles and preserves both prefab and
manual viewport parameters.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from statistics import mean, median
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_VIEWER_MASTERDATA = REPO_ROOT / "web_viewer" / "public" / "data" / "masterdata"
DEFAULT_MASTER_CARD_INDEX = WEB_VIEWER_MASTERDATA / "card_index.json"
DEFAULT_MASTER_IDOL_INDEX = WEB_VIEWER_MASTERDATA / "idol_unit_dictionary.json"

LEGACY_ROOT = Path(r"E:\Web_build\SSR_Portraits")
LEGACY_DATA = LEGACY_ROOT / "data.json"
LEGACY_VIEWER_ROOT = LEGACY_ROOT / "viewer"
DEFAULT_OUTPUT = LEGACY_ROOT / "data.master.json"
DEFAULT_REPORT = WEB_VIEWER_MASTERDATA / "ssr_portraits_migration_report.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_idol_lookup(idol_index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for idol in idol_index.get("idols", []):
        idol_code = idol.get("idol_code")
        if isinstance(idol_code, str) and idol_code:
            lookup[idol_code] = idol
    return lookup


def build_card_lookup(card_index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for card in card_index.get("cards", []):
        resource_id = card.get("resource_id")
        if isinstance(resource_id, str) and resource_id:
            lookup[resource_id] = card
    return lookup


def load_prefab_config(char_code: str, ssr_key: str) -> tuple[dict[str, Any] | None, Path | None]:
    config_path = LEGACY_ROOT / "prefab" / char_code / ssr_key / "config.json"
    if not config_path.exists():
        return None, None
    try:
        return load_json(config_path), config_path
    except Exception:
        return None, config_path


def diff_options(prefab: dict[str, Any] | None, legacy: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    prefab = prefab or {}
    legacy = legacy or {}
    keys = sorted(set(prefab) | set(legacy))
    delta: dict[str, dict[str, Any]] = {}
    for key in keys:
        if prefab.get(key) != legacy.get(key):
            delta[key] = {"prefab": prefab.get(key), "legacy": legacy.get(key)}
    return delta


def build_index(
    legacy_data: dict[str, Any],
    card_lookup: dict[str, dict[str, Any]],
    idol_lookup: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    report = {
        "characters_total": 0,
        "cards_total": 0,
        "cards_with_masterdata": 0,
        "cards_with_prefab": 0,
        "cards_with_option_delta": 0,
        "missing_masterdata": [],
        "missing_prefab": [],
    }

    out_chars: list[dict[str, Any]] = []
    scale_factors: list[float] = []
    zoom_values: list[float] = []
    layout_rows: list[dict[str, Any]] = []
    for char in legacy_data.get("characters", []):
        char_id = char.get("id")
        abbr = char.get("abbr")
        if not isinstance(char_id, int) or not isinstance(abbr, str):
            continue

        char_code = f"{char_id:03d}{abbr}"
        idol = idol_lookup.get(char_code, {})

        merged_char = {
            "id": char_id,
            "abbr": abbr,
            "idol_code": char_code,
            "name_ja": idol.get("display_name") or char.get("name_ja"),
            "display_name": idol.get("display_name") or char.get("name_ja"),
            "type": idol.get("type") or char.get("type"),
            "chara_icon": char.get("chara_icon"),
            "cards": [],
            "_source": {
                "legacy_data": str(LEGACY_DATA),
                "masterdata": str(DEFAULT_MASTER_IDOL_INDEX),
            },
        }

        report["characters_total"] += 1

        for card in char.get("cards", []):
            ssr_key = card.get("ssr")
            if not isinstance(ssr_key, str):
                continue

            resource_id = f"{char_code}_{ssr_key}"
            master_card = card_lookup.get(resource_id)
            config, config_path = load_prefab_config(char_code, ssr_key)
            prefab_options = (config or {}).get("options") or {}
            legacy_options = card.get("options") or {}
            merged_options = {**prefab_options, **legacy_options}
            option_delta = diff_options(prefab_options, legacy_options)

            if master_card:
                report["cards_with_masterdata"] += 1
            else:
                report["missing_masterdata"].append(resource_id)

            if config:
                report["cards_with_prefab"] += 1
            else:
                report["missing_prefab"].append(resource_id)

            if option_delta:
                report["cards_with_option_delta"] += 1

            scale_factor = None
            camera_zoom = None
            if isinstance(prefab_options.get("scale_factor"), (int, float)):
                scale_factor = float(prefab_options["scale_factor"])
                scale_factors.append(scale_factor)
            if isinstance(prefab_options.get("camera_zoom"), (int, float)):
                camera_zoom = float(prefab_options["camera_zoom"])
                zoom_values.append(camera_zoom)

            layout_rows.append(
                {
                    "resource_id": resource_id,
                    "idol_code": char_code,
                    "title": master_card.get("title") if master_card else card.get("title"),
                    "scale_factor": scale_factor,
                    "camera_zoom": camera_zoom,
                    "position_x": prefab_options.get("position_x"),
                    "position_y": prefab_options.get("position_y"),
                }
            )

            merged_card = {
                **card,
                "resource_id": resource_id,
                "card_id": master_card.get("card_id") if master_card else None,
                "rarity": master_card.get("rarity") if master_card else card.get("rarity"),
                "ordinal": master_card.get("ordinal") if master_card else card.get("ordinal"),
                "title": master_card.get("title") if master_card else card.get("title"),
                "title_full": master_card.get("title_full") if master_card else card.get("title_full"),
                "release_at": master_card.get("release_at") if master_card else card.get("release_at"),
                "texts": master_card.get("texts") if master_card else card.get("texts"),
                "voice_base": master_card.get("voice_base") if master_card else card.get("voice_base"),
                "home_voice_cues": master_card.get("home_voice_cues") if master_card else card.get("home_voice_cues"),
                "scenario_entries": master_card.get("scenario_entries") if master_card else card.get("scenario_entries"),
                "voice_candidates": master_card.get("voice_candidates") if master_card else card.get("voice_candidates"),
                "options": merged_options,
                "legacy_options": legacy_options,
                "prefab_options": prefab_options,
                "option_delta": option_delta,
                "prefab_config": config,
                "_source": {
                    "legacy_data": str(LEGACY_DATA),
                    "masterdata_card_index": str(DEFAULT_MASTER_CARD_INDEX),
                    "prefab_config": str(config_path) if config_path else None,
                },
            }

            merged_char["cards"].append(merged_card)
            report["cards_total"] += 1

        out_chars.append(merged_char)

    out_chars.sort(key=lambda item: item["id"])
    for char in out_chars:
        char["cards"].sort(key=lambda item: item.get("ssr") or "")

    report["missing_masterdata"] = report["missing_masterdata"][:200]
    report["missing_prefab"] = report["missing_prefab"][:200]

    if scale_factors:
        report["layout_stats"] = {
            "scale_factor": {
                "count": len(scale_factors),
                "min": min(scale_factors),
                "max": max(scale_factors),
                "mean": mean(scale_factors),
                "median": median(scale_factors),
            },
            "camera_zoom": {
                "count": len(zoom_values),
                "min": min(zoom_values) if zoom_values else None,
                "max": max(zoom_values) if zoom_values else None,
                "mean": mean(zoom_values) if zoom_values else None,
                "median": median(zoom_values) if zoom_values else None,
            },
            "scale_factor_samples": sorted(
                layout_rows,
                key=lambda row: row["scale_factor"] if row["scale_factor"] is not None else -1,
            )[:10],
            "scale_factor_largest": sorted(
                layout_rows,
                key=lambda row: row["scale_factor"] if row["scale_factor"] is not None else -1,
                reverse=True,
            )[:10],
        }

    output = {
        "generated_from": {
            "legacy_data": str(LEGACY_DATA),
            "card_index": str(DEFAULT_MASTER_CARD_INDEX),
            "idol_index": str(DEFAULT_MASTER_IDOL_INDEX),
        },
        "characters": out_chars,
    }
    return output, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-data", type=Path, default=LEGACY_DATA)
    parser.add_argument("--card-index", type=Path, default=DEFAULT_MASTER_CARD_INDEX)
    parser.add_argument("--idol-index", type=Path, default=DEFAULT_MASTER_IDOL_INDEX)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    legacy_data = load_json(args.legacy_data)
    card_index = load_json(args.card_index)
    idol_index = load_json(args.idol_index)

    card_lookup = build_card_lookup(card_index)
    idol_lookup = build_idol_lookup(idol_index)

    output, report = build_index(legacy_data, card_lookup, idol_lookup)
    write_json(args.output, output)
    write_json(args.report, report)

    print(f"written {args.output}")
    print(f"written {args.report}")
    print(
        "cards: "
        f"{report['cards_total']} total, "
        f"{report['cards_with_masterdata']} masterdata hits, "
        f"{report['cards_with_prefab']} prefab hits, "
        f"{report['cards_with_option_delta']} option deltas"
    )


if __name__ == "__main__":
    main()
