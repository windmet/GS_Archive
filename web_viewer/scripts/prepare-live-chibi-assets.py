#!/usr/bin/env python3
"""Prepare the web-readable live-character preview asset set.

The game stores the live character in three independent layers:
  * one setup skeleton per body type;
  * one costume atlas/texture per idol and costume;
  * animation-only Spine binaries inside Unity bundles.

The build exports every discovered idol/costume atlas, all five shared body
setups, the common motion library, a cross-body compatibility pack, and the
body-1 song choreography catalog.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))

from archive_paths import add_sources_config_argument, load_archive_sources
from live_chibi_raw_semantics import load_raw_live_semantics


DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi"
DEFAULT_COSTUME_SELECTION_PATH = DEFAULT_OUTPUT_ROOT / "inventory.json"
MUSIC_CATALOG_PATH = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"
SPEAKER_DICTIONARY_PATH = PROJECT_ROOT / "public" / "data" / "masterdata" / "speaker_dictionary.json"
COSTUME_DICTIONARY_PATH = PROJECT_ROOT / "public" / "data" / "masterdata" / "costume_dictionary.json"
IDOL_DICTIONARY_PATH = PROJECT_ROOT / "public" / "data" / "masterdata" / "idol_unit_dictionary.json"

# Body setup normalization measured from actual visible canvas pixels in the
# wait pose. Each idol is then scaled by official height relative to Touma
# (175 cm), rather than incorrectly forcing every idol to the same height.
TOUMA_HEIGHT_CM = 175
BODY_PREVIEW_BASE_SCALES = {1: 0.3053, 2: 0.2904, 3: 0.3176, 4: 0.3712, 5: 0.3144}
PREVIEW_SCALE_CAPS = {5: 0.28}
COMPATIBILITY_MOTION_IDS = [4001, 12001, 16004, 32005, 56011]
MOTION_LABELS = {
    "armup1": "抬手 1",
    "armup2": "抬手 2",
    "bye": "告别",
    "chop": "手刀",
    "open": "展开双手",
    "fist": "握拳",
    "waist": "叉腰",
    "rider": "骑士姿势",
    "trouble": "困扰",
    "future": "指向未来",
    "wait": "待机",
    "heyhey": "Hey Hey",
    "forward": "向前",
    "clock": "时钟动作",
    "side": "侧身",
    "breast": "胸前动作",
    "match": "Match",
    "jump": "跳跃",
    "wiper": "挥臂",
    "tray": "托盘姿势",
    "finger": "指尖动作",
    "bow": "鞠躬",
    "spread": "展开",
    "salute": "敬礼",
    "walk": "行走",
    "ear": "侧耳倾听",
    "squat": "下蹲",
    "LR": "左右摆动",
    "foryou": "For You",
}


def read_varint(data: bytes, position: int) -> tuple[int, int]:
    value = 0
    while True:
        byte = data[position]
        position += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, position


def first_animation_name(data: bytes) -> tuple[int, str]:
    animation_count, position = read_varint(data, 0)
    string_size, position = read_varint(data, position)
    # Spine binary string sizes include the null/non-null marker.
    raw_name = data[position : position + max(0, string_size - 1)]
    return animation_count, raw_name.decode("utf-8", errors="replace")


def motion_slug(animation_name: str) -> str:
    match = re.search(r"_3dance(?:_1)?_(.+)$", animation_name)
    return match.group(1) if match else animation_name


def unity_text_payload(text_asset) -> str:
    payload = text_asset.m_Script
    if isinstance(payload, bytes):
        return payload.decode("utf-8-sig")
    return payload


def load_live_character_body_types(raw_asset_root: Path) -> dict[str, int]:
    environment = UnityPy.load(
        str(raw_asset_root / "live_character_info_data_list.unity3d")
    )
    for asset in environment.assets:
        for obj in asset.objects.values():
            if obj.type.name != "TextAsset":
                continue
            text_asset = obj.read()
            if text_asset.m_Name != "live_character_info_data_list":
                continue
            data = json.loads(unity_text_payload(text_asset))
            return {item["idolId"]: int(item["bodyType"]) for item in data["dataList"]}
    raise FileNotFoundError("live_character_info_data_list TextAsset")


def text_asset_payload(text_asset) -> bytes:
    payload = text_asset.m_Script
    return (
        payload
        if isinstance(payload, bytes)
        else payload.encode("utf-8", errors="surrogateescape")
    )


def raw_animation_payloads(raw_asset_root: Path) -> dict[tuple[int, int], bytes]:
    payloads: dict[tuple[int, int], bytes] = {}
    pattern = re.compile(r"^live_costume_animation_(\d+)_(\d+)$")
    for bundle in sorted(raw_asset_root.glob("live_costume_animation_*.unity3d")):
        environment = UnityPy.load(str(bundle))
        for obj in environment.objects:
            if obj.type.name != "TextAsset":
                continue
            text_asset = obj.read()
            match = pattern.fullmatch(text_asset.m_Name)
            if not match:
                continue
            key = (int(match.group(1)), int(match.group(2)))
            payload = text_asset_payload(text_asset)
            previous = payloads.setdefault(key, payload)
            if previous != payload:
                raise ValueError(f"Conflicting animation payloads for {key}")
    return payloads


def selected_costume_models(selection_path: Path) -> list[str]:
    inventory = json.loads(selection_path.read_text(encoding="utf-8"))
    models = sorted(
        {
            row["modelId"]
            for row in inventory.get("costumes", [])
            if row.get("modelId")
        }
    )
    if not models:
        raise ValueError(f"No costume model IDs in {selection_path}")
    return models


def atlas_stats(path: Path) -> dict[str, int]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {
        "pages": sum(1 for line in lines if re.search(r"\.(?:png|jpg)$", line.strip(), re.I)),
        "regions": sum(1 for line in lines if line.strip().startswith("rotate:")),
    }


def export_character_shadow(output_root: Path) -> str:
    """Export the game's shared 241 px character shadow from a source atlas."""
    atlas_path = output_root / "costumes" / "001tom_005_00" / "cos.atlas"
    texture_path = output_root / "costumes" / "001tom_005_00" / "cos.png"
    lines = atlas_path.read_text(encoding="utf-8", errors="replace").splitlines()
    try:
        region_index = next(index for index, line in enumerate(lines) if line.strip() == "tex_chara_shadow")
    except StopIteration as error:
        raise FileNotFoundError("tex_chara_shadow atlas region") from error
    xy_match = re.search(r"xy:\s*(\d+)\s*,\s*(\d+)", "\n".join(lines[region_index : region_index + 8]))
    size_match = re.search(r"size:\s*(\d+)\s*,\s*(\d+)", "\n".join(lines[region_index : region_index + 8]))
    if not xy_match or not size_match:
        raise ValueError("tex_chara_shadow atlas coordinates are incomplete")
    x, y = (int(value) for value in xy_match.groups())
    width, height = (int(value) for value in size_match.groups())
    destination = output_root / "shared" / "character-shadow.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(texture_path) as texture:
        texture.crop((x, y, x + width, y + height)).save(destination)
    return destination.relative_to(output_root).as_posix()


def export_all_characters(
    body_types: dict[str, int],
    raw_asset_root: Path,
    output_root: Path,
    costume_models: list[str],
) -> tuple[list[dict], dict]:
    speaker_data = json.loads(SPEAKER_DICTIONARY_PATH.read_text(encoding="utf-8"))["speakers"]
    idol_data = json.loads(IDOL_DICTIONARY_PATH.read_text(encoding="utf-8"))["by_idol_code"]
    costume_rows = json.loads(COSTUME_DICTIONARY_PATH.read_text(encoding="utf-8"))["costumes"]
    costume_names = {
        row["model_resource_id"]: row.get("costume_name")
        for row in costume_rows
        if row.get("model_resource_id")
    }
    grouped: dict[str, list[str]] = {}
    model_pattern = re.compile(r"^([0-9]{3}[a-z]{3})_(.+)$", re.I)
    for model_id in costume_models:
        match = model_pattern.fullmatch(model_id)
        if not match:
            continue
        grouped.setdefault(match.group(1), []).append(model_id)

    missing_body_types = sorted(set(grouped) - set(body_types))
    if missing_body_types:
        raise ValueError(f"Costume idols missing body type mappings: {missing_body_types}")

    for body_type in sorted(set(body_types.values())):
        bundle = raw_asset_root / f"live_costume_setup_{body_type}.unity3d"
        environment = UnityPy.load(str(bundle))
        expected_name = f"live_costume_setup_{body_type}.skel"
        payload = next(
            (
                text_asset_payload(obj.read())
                for obj in environment.objects
                if obj.type.name == "TextAsset"
                and obj.read().m_Name == expected_name
            ),
            None,
        )
        if payload is None:
            raise FileNotFoundError(f"{expected_name} in {bundle}")
        destination = output_root / "setup" / f"body-{body_type}.skel"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)

    characters = []
    inventory_costumes = []
    body_costume_counts: dict[int, int] = {}
    for idol_id in sorted(grouped):
        body_type = body_types[idol_id]
        costumes = []
        for model_id in grouped[idol_id]:
            costume_id = model_id[len(idol_id) + 1 :]
            relative = Path("costumes") / model_id
            bundle = raw_asset_root / f"costume_{model_id}.unity3d"
            if not bundle.is_file():
                raise FileNotFoundError(bundle)
            environment = UnityPy.load(str(bundle))
            atlas_object = None
            texture = None
            for obj in environment.objects:
                if obj.type.name == "TextAsset":
                    text_asset = obj.read()
                    if text_asset.m_Name == "cos.atlas":
                        atlas_object = obj
                elif obj.type.name == "Texture2D":
                    candidate = obj.read()
                    if candidate.m_Name == "cos":
                        texture = candidate
            if atlas_object is None or texture is None:
                raise FileNotFoundError(f"cos.atlas/cos Texture2D in {bundle}")
            atlas_target = output_root / relative / "cos.atlas"
            texture_target = output_root / relative / "cos.png"
            atlas_target.parent.mkdir(parents=True, exist_ok=True)
            atlas_target.write_bytes(atlas_object.get_raw_data())
            texture.image.save(texture_target)
            stats = atlas_stats(atlas_target)
            label = costume_names.get(model_id) or f"服装 {costume_id}"
            costumes.append(
                {
                    "id": costume_id,
                    "label": f"{label} · {costume_id}",
                    "atlas": (relative / "cos.atlas").as_posix(),
                    "texture": (relative / "cos.png").as_posix(),
                    "atlasPages": stats["pages"],
                    "atlasRegions": stats["regions"],
                }
            )
            inventory_costumes.append(
                {
                    "modelId": model_id,
                    "idolId": idol_id,
                    "bodyType": body_type,
                    **stats,
                    "textureBytes": texture_target.stat().st_size,
                }
            )
            body_costume_counts[body_type] = body_costume_counts.get(body_type, 0) + 1

        default_costume = "005_00" if any(item["id"] == "005_00" for item in costumes) else costumes[0]["id"]
        height_cm = idol_data.get(idol_id, {}).get("height") or TOUMA_HEIGHT_CM
        preview_scale = round(
            BODY_PREVIEW_BASE_SCALES[body_type] * height_cm / TOUMA_HEIGHT_CM,
            4,
        )
        if body_type in PREVIEW_SCALE_CAPS:
            preview_scale = min(preview_scale, PREVIEW_SCALE_CAPS[body_type])
        character = {
            "id": idol_id,
            "name": speaker_data.get(idol_id, {}).get("display_name", idol_id),
            "bodyType": body_type,
            "defaultCostume": default_costume,
            "heightCm": height_cm,
            "previewScale": preview_scale,
            "setup": f"setup/body-{body_type}.skel",
            "costumes": costumes,
        }
        characters.append(character)

    inventory = {
        "schemaVersion": 1,
        "characterCount": len(characters),
        "costumeCount": len(inventory_costumes),
        "bodyTypeCostumeCounts": {str(key): body_costume_counts[key] for key in sorted(body_costume_counts)},
        "costumes": inventory_costumes,
    }
    return characters, inventory


def export_common_motions(
    body_type: int,
    animation_payloads: dict[tuple[int, int], bytes],
    output_root: Path,
) -> list[dict]:
    motions = []

    for (payload_body_type, motion_id), payload in sorted(animation_payloads.items()):
        if payload_body_type != body_type or not 2 <= motion_id <= 61:
            continue
        animation_count, animation_name = first_animation_name(payload)
        slug = motion_slug(animation_name)
        relative_path = Path("motions") / "common" / str(body_type) / f"{motion_id}.motion"
        output_path = output_root / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(payload)

        motions.append(
            {
                "id": motion_id,
                "name": slug,
                "label": MOTION_LABELS.get(slug, slug.replace("_", " ").title()),
                "animationCount": animation_count,
                "file": relative_path.as_posix(),
            }
        )

    return sorted(motions, key=lambda item: item["id"])


def parse_number(value: str, default: int = 0) -> int:
    try:
        return int(float(value.strip()))
    except (TypeError, ValueError):
        return default


def parse_optional_number(value: str) -> int | None:
    try:
        stripped = value.strip()
        return int(float(stripped)) if stripped else None
    except (AttributeError, TypeError, ValueError):
        return None


def parse_hide_transition(row: list[str], show_duration: int = 1) -> tuple[bool, int]:
    """Read both live-effect CSV layouts used by hide commands.

    Most scripts store the hide flag/duration in columns 17/18, while a
    smaller newer group shifts the same pair to 19/20.
    """
    for flag_index, duration_index in ((17, 18), (19, 20)):
        if len(row) > flag_index and row[flag_index].strip() == "1":
            return True, (
                parse_number(row[duration_index], 1)
                if len(row) > duration_index
                else 1
            )
    return False, show_duration


def choreography_identity(path: Path) -> tuple[str, str]:
    marker = "_live_effect"
    stem = path.stem
    marker_index = stem.find(marker)
    if marker_index < 0:
        return stem, ""
    return stem[:marker_index], stem[marker_index + len(marker) :].lstrip("_")


def build_stage_position_map(
    motion_positions: list[int], position_events: list[dict], singer_events: list[dict]
) -> dict[int, int]:
    """Map per-song motion slots to the game's left-to-right five stage positions."""
    performer_slots = sorted({position for position in motion_positions if position > 0})
    if not performer_slots:
        return {}

    canonical_positions = {
        1: [3],
        2: [2, 3],
        3: [2, 3, 4],
        4: [1, 2, 3, 4],
        5: [1, 2, 3, 4, 5],
    }
    singer_positions = sorted(
        {
            position
            for event in singer_events
            for position in event["singers"]
            if 1 <= position <= 5
        }
    )
    stage_positions = (
        singer_positions
        if len(singer_positions) == len(performer_slots)
        else canonical_positions.get(len(performer_slots), performer_slots)
    )

    initial_by_slot = {}
    for event in sorted(position_events, key=lambda item: (item["time"], item["position"])):
        if event["position"] in performer_slots and event["position"] not in initial_by_slot:
            initial_by_slot[event["position"]] = event
    ordered_slots = sorted(
        performer_slots,
        key=lambda slot: (initial_by_slot.get(slot, {}).get("x", slot), slot),
    )
    return dict(zip(ordered_slots, stage_positions))


def read_choreography_scripts(
    effect_scripts: dict[str, bytes],
    music_catalog_path: Path,
) -> tuple[list[dict], set[int]]:
    music_catalog = json.loads(music_catalog_path.read_text(encoding="utf-8")).get(
        "songs", {}
    )
    songs = []
    referenced_motion_ids: set[int] = set()

    for asset_name, payload in sorted(effect_scripts.items()):
        csv_path = Path(f"{asset_name}.csv")
        events = []
        singer_events = []
        position_events = []
        camera_events = []
        backmonitor_events = []
        image_layer_events = []
        object_layer_events = []
        lyric_events = []
        whole_screen_color_events = []
        character_light_events = []
        spotlight_events = []
        pinspotlight_events = []
        laserlight_events = []
        motion_group_events = []
        motion_group_changes = []
        with io.StringIO(payload.decode("utf-8-sig"), newline="") as handle:
            for row in csv.reader(handle):
                if not row:
                    continue
                if row[0] == "SwitchSinger" and len(row) >= 7:
                    states = [parse_number(value) for value in row[2:7]]
                    singer_events.append(
                        {
                            "time": parse_number(row[1]),
                            "singers": [index + 1 for index, state in enumerate(states) if state > 0],
                        }
                    )
                    continue
                if row[0] == "Livechara_position" and len(row) >= 6:
                    position_events.append(
                        {
                            "time": parse_number(row[1]),
                            "position": parse_number(row[2], 1),
                            "x": parse_number(row[3]),
                            "y": parse_number(row[4]),
                            "scale": parse_number(row[5], 1000),
                        }
                    )
                    continue
                if row[0] == "Camera" and len(row) >= 10:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    camera_events.append(
                        {
                            "time": event_time,
                            "zoom": parse_optional_number(row[2]),
                            "zoomDuration": parse_optional_number(row[3]),
                            "focusSlot": parse_optional_number(row[4]),
                            "x": parse_optional_number(row[5]),
                            "y": parse_optional_number(row[6]),
                            "moveDuration": parse_optional_number(row[7]),
                            "rotation": parse_optional_number(row[8]),
                            "rotationDuration": parse_optional_number(row[9]),
                        }
                    )
                    continue
                if row[0] == "Backmonitor" and len(row) >= 9:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    backmonitor_events.append(
                        {
                            "time": event_time,
                            "movie": row[2].strip() or None,
                            "transition": row[3].strip() or None,
                            "x": parse_optional_number(row[4]),
                            "y": parse_optional_number(row[5]),
                            "scale": parse_optional_number(row[6]),
                            "rotation": parse_optional_number(row[7]),
                            "opacity": parse_optional_number(row[8]),
                        }
                    )
                    continue
                if row[0] in {"Image_layer", "Image_layer_2"} and len(row) >= 4:
                    event_time = parse_optional_number(row[1])
                    asset = row[2].strip()
                    if event_time is None or not asset:
                        continue
                    image_layer_events.append(
                        {
                            "time": event_time,
                            "asset": asset,
                            "layerType": row[0],
                            "depth": parse_optional_number(row[3]),
                            "hide": any(
                                len(row) > index and row[index].strip() == "1"
                                for index in (17, 18)
                            ),
                            "raw19": row[19].strip() if len(row) > 19 and row[19].strip() else None,
                        }
                    )
                    continue
                if row[0] == "Object_layer" and len(row) >= 3:
                    event_time = parse_optional_number(row[1])
                    asset = row[2].strip()
                    if event_time is None or not asset:
                        continue
                    hide = len(row) > 17 and row[17].strip() == "1"
                    object_layer_events.append(
                        {
                            "time": event_time,
                            "asset": asset,
                            "duration": (
                                parse_number(row[18], 1)
                                if hide and len(row) > 18
                                else parse_number(row[3], 1)
                            ),
                            "x": parse_optional_number(row[4]),
                            "y": parse_optional_number(row[5]),
                            "scale": parse_optional_number(row[6]),
                            "depth": parse_optional_number(row[7]),
                            "hide": hide,
                            "raw19": row[19].strip()
                            if len(row) > 19 and row[19].strip()
                            else None,
                        }
                    )
                    continue
                if row[0] == "Lyric" and len(row) >= 4:
                    event_time = parse_optional_number(row[1])
                    text = row[2].strip()
                    if event_time is not None and text:
                        lyric_events.append(
                            {
                                "time": event_time,
                                "text": text,
                                "duration": parse_number(row[3], 10000),
                            }
                        )
                    continue
                if row[0] == "Whole_screen_color" and len(row) >= 6:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    hide = len(row) > 17 and row[17].strip() == "1"
                    whole_screen_color_events.append(
                        {
                            "time": event_time,
                            "color": row[2].strip() or None,
                            "opacity": parse_optional_number(row[3]),
                            "duration": (
                                parse_number(row[18], 1)
                                if hide and len(row) > 18
                                else parse_number(row[4], 1)
                            ),
                            "depth": parse_optional_number(row[5]),
                            "hide": hide,
                        }
                    )
                    continue
                if row[0] == "Livechara_Foot_Color" and len(row) >= 6:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    character_light_events.append(
                        {
                            "time": event_time,
                            "color": row[2].strip() or "#ffffff",
                            "opacity": parse_number(row[3]),
                            "duration": parse_number(row[4], 1),
                            "depth": parse_optional_number(row[5]),
                        }
                    )
                    continue
                if row[0] == "Spotlight" and len(row) >= 11:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    hide, duration = parse_hide_transition(row, parse_number(row[5], 1))
                    spotlight_events.append(
                        {
                            "time": event_time,
                            "id": parse_number(row[2]),
                            "targetSlot": parse_optional_number(row[3]),
                            "x": parse_optional_number(row[4]),
                            "duration": duration,
                            "beamColor": row[6].strip() or None,
                            "characterDepth": parse_optional_number(row[7]),
                            "environmentColor": row[8].strip() or None,
                            "environmentOpacity": parse_optional_number(row[9]),
                            "depth": parse_optional_number(row[10]),
                            "hide": hide,
                        }
                    )
                    continue
                if row[0] == "Pinspotlight" and len(row) >= 13:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    hide, duration = parse_hide_transition(row, parse_number(row[5], 1))
                    pinspotlight_events.append(
                        {
                            "time": event_time,
                            "id": parse_number(row[2]),
                            "asset": row[3].strip() or None,
                            # The client prefab proves column 5 is the position
                            # tween duration and column 6 is the performer slot.
                            "parameter4": parse_optional_number(row[4]),
                            "targetSlot": parse_optional_number(row[6]),
                            "x": parse_optional_number(row[7]),
                            "y": parse_optional_number(row[8]),
                            "beamColor": row[9].strip() or None,
                            "environmentColor": row[10].strip() or None,
                            "environmentOpacity": parse_optional_number(row[11]),
                            "depth": parse_optional_number(row[12]),
                            "duration": duration,
                            "hide": hide,
                        }
                    )
                    continue
                if row[0] == "Laserlight" and len(row) >= 14:
                    event_time = parse_optional_number(row[1])
                    if event_time is None:
                        continue
                    hide, duration = parse_hide_transition(row)
                    laserlight_events.append(
                        {
                            "time": event_time,
                            "id": parse_number(row[2]),
                            "style": parse_optional_number(row[3]),
                            "sweepDuration": parse_optional_number(row[4]),
                            "angle": parse_optional_number(row[5]),
                            "direction": row[6].strip() or None,
                            "length": parse_optional_number(row[7]),
                            "x": parse_optional_number(row[8]),
                            "y": parse_optional_number(row[9]),
                            "color": row[10].strip() or None,
                            "width": parse_optional_number(row[11]),
                            "depth": parse_optional_number(row[12]),
                            "parameter13": parse_optional_number(row[13]),
                            "duration": duration,
                            "hide": hide,
                        }
                    )
                    continue
                if row[0] == "Livechara_motion_group" and len(row) >= 5:
                    motion_id = parse_number(row[3])
                    motion_group_events.append(
                        {
                            "time": parse_number(row[1]),
                            "group": parse_number(row[2], 1),
                            "motion": motion_id,
                            "weight": parse_number(row[4], 1),
                        }
                    )
                    referenced_motion_ids.add(motion_id)
                    continue
                if row[0] == "Livechara_motion_group_change" and len(row) >= 3:
                    motion_group_changes.append(
                        {"time": parse_number(row[1]), "group": parse_number(row[2], 1)}
                    )
                    continue
                if row[0] != "Livechara_motion" or len(row) < 11:
                    continue
                motion_id = parse_number(row[2], -1)
                if motion_id < 0:
                    continue
                event = {
                    "time": parse_number(row[1]),
                    "motion": motion_id,
                    "speed": parse_number(row[3], 1000),
                    "position": parse_number(row[4], 1),
                    "x": parse_number(row[5]),
                    "y": parse_number(row[6]),
                    "pauseTime": parse_number(row[9]),
                    "mode": parse_number(row[10]),
                }
                events.append(event)
                referenced_motion_ids.add(motion_id)

        if not events:
            continue

        song_code, variant = choreography_identity(csv_path)
        title = music_catalog.get(song_code, {}).get("title", song_code.upper())
        if variant:
            title = f"{title} · {variant}"
        performer_slots = sorted({event["position"] for event in events if event["position"] > 0})
        stage_position_map = build_stage_position_map(
            performer_slots, position_events, singer_events
        )
        for event in events:
            event["stagePosition"] = stage_position_map.get(event["position"], event["position"])
        for event in camera_events:
            focus_slot = event.get("focusSlot")
            event["stagePosition"] = (
                stage_position_map.get(focus_slot) if focus_slot and focus_slot > 0 else None
            )
        for light_events in (spotlight_events, pinspotlight_events):
            for event in light_events:
                target_slot = event.get("targetSlot")
                event["stagePosition"] = (
                    stage_position_map.get(target_slot)
                    if target_slot and target_slot > 0
                    else None
                )
        positions = sorted(stage_position_map.values())
        songs.append(
            {
                "id": csv_path.stem,
                "songCode": song_code,
                "variant": variant,
                "title": title,
                "source": csv_path.name,
                "startTime": min(0, min(event["time"] for event in events)),
                "duration": max(event["time"] for event in events) + 2000,
                "positions": positions,
                "performerSlots": performer_slots,
                "stagePositionMap": [
                    {"performerSlot": slot, "stagePosition": stage_position_map[slot]}
                    for slot in performer_slots
                ],
                "motionIds": sorted(
                    {event["motion"] for event in events}
                    | {event["motion"] for event in motion_group_events}
                ),
                "events": sorted(events, key=lambda event: (event["time"], event["position"])),
                "singerEvents": sorted(singer_events, key=lambda event: event["time"]),
                "positionEvents": sorted(
                    position_events, key=lambda event: (event["time"], event["position"])
                ),
                "cameraEvents": sorted(camera_events, key=lambda event: event["time"]),
                "backmonitorEvents": sorted(
                    backmonitor_events, key=lambda event: event["time"]
                ),
                "imageLayerEvents": sorted(
                    image_layer_events,
                    key=lambda event: (event["time"], event["depth"] or 0, event["asset"]),
                ),
                "objectLayerEvents": sorted(
                    object_layer_events,
                    key=lambda event: (event["time"], event["depth"] or 0, event["asset"]),
                ),
                "lyricEvents": sorted(lyric_events, key=lambda event: event["time"]),
                "wholeScreenColorEvents": sorted(
                    whole_screen_color_events, key=lambda event: event["time"]
                ),
                "characterLightEvents": sorted(
                    character_light_events, key=lambda event: event["time"]
                ),
                "spotlightEvents": sorted(
                    spotlight_events, key=lambda event: (event["time"], event["id"])
                ),
                "pinspotlightEvents": sorted(
                    pinspotlight_events, key=lambda event: (event["time"], event["id"])
                ),
                "laserlightEvents": sorted(
                    laserlight_events, key=lambda event: (event["time"], event["id"])
                ),
                "motionGroupEvents": sorted(
                    motion_group_events,
                    key=lambda event: (event["time"], event["group"], event["motion"]),
                ),
                "motionGroupChanges": sorted(
                    motion_group_changes, key=lambda event: event["time"]
                ),
            }
        )

    return songs, referenced_motion_ids


def export_live_lip_sync(
    live_lip_sync_sources: dict[str, bytes],
    output_root: Path,
) -> dict[str, dict]:
    """Export the original 60 Hz ADX lip channel in a compact web format."""
    catalog = {}
    for asset_name, payload in sorted(live_lip_sync_sources.items()):
        song_code = asset_name.removesuffix("_for_lipsync")
        source_name = f"{asset_name}.json"
        data = json.loads(payload.decode("utf-8-sig"))
        scales = data.get("scales")
        if not isinstance(scales, list) or not scales:
            continue
        values = [float(sample.get("y", 0)) for sample in scales]
        relative_path = Path("lipsync") / f"{song_code}.json"
        output_path = output_root / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(
                {"sampleRate": 60, "values": values},
                ensure_ascii=False,
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        catalog[song_code] = {
            "file": relative_path.as_posix(),
            "sampleRate": 60,
            "frames": len(values),
            "duration": len(values) * 1000 / 60,
            "source": source_name,
        }
    return catalog


def export_choreography(
    body_types: list[int],
    animation_payloads: dict[tuple[int, int], bytes],
    effect_scripts: dict[str, bytes],
    live_lip_sync_sources: dict[str, bytes],
    music_catalog_path: Path,
    output_root: Path,
) -> dict:
    songs, referenced_motion_ids = read_choreography_scripts(
        effect_scripts,
        music_catalog_path,
    )
    lip_sync_catalog = export_live_lip_sync(live_lip_sync_sources, output_root)
    for song in songs:
        if song["songCode"] in lip_sync_catalog:
            song["lipSync"] = lip_sync_catalog[song["songCode"]]
    for body_type in body_types:
        available = {
            motion_id
            for payload_body_type, motion_id in animation_payloads
            if payload_body_type == body_type
        }
        missing = sorted(referenced_motion_ids - available)
        if missing:
            raise FileNotFoundError(f"Missing body-{body_type} motions: {missing[:20]}")

    catalog = []
    for motion_id in sorted(referenced_motion_ids):
        payload = animation_payloads[(body_types[0], motion_id)]
        animation_count, animation_name = first_animation_name(payload)
        slug = motion_slug(animation_name)
        for body_type in body_types:
            relative_path = (
                Path("motions") / "choreography" / str(body_type) / f"{motion_id}.motion"
            )
            destination = output_root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(animation_payloads[(body_type, motion_id)])
        catalog.append(
            {
                "id": motion_id,
                "name": slug,
                "label": MOTION_LABELS.get(slug, slug.replace("_", " ").title()),
                "animationCount": animation_count,
                "file": f"motions/choreography/{{bodyType}}/{motion_id}.motion",
            }
        )

    choreography_relative = Path("choreography") / "index.json"
    choreography = {
        "schemaVersion": 11,
        "bodyTypes": body_types,
        "stats": {
            "songs": len(songs),
            "events": sum(len(song["events"]) for song in songs),
            "singerEvents": sum(len(song["singerEvents"]) for song in songs),
            "positionEvents": sum(len(song["positionEvents"]) for song in songs),
            "cameraEvents": sum(len(song["cameraEvents"]) for song in songs),
            "backmonitorEvents": sum(
                len(song["backmonitorEvents"]) for song in songs
            ),
            "imageLayerEvents": sum(
                len(song["imageLayerEvents"]) for song in songs
            ),
            "objectLayerEvents": sum(
                len(song["objectLayerEvents"]) for song in songs
            ),
            "lyricEvents": sum(len(song["lyricEvents"]) for song in songs),
            "wholeScreenColorEvents": sum(
                len(song["wholeScreenColorEvents"]) for song in songs
            ),
            "characterLightEvents": sum(
                len(song["characterLightEvents"]) for song in songs
            ),
            "spotlightEvents": sum(len(song["spotlightEvents"]) for song in songs),
            "pinspotlightEvents": sum(
                len(song["pinspotlightEvents"]) for song in songs
            ),
            "laserlightEvents": sum(len(song["laserlightEvents"]) for song in songs),
            "lipSyncSongs": sum(1 for song in songs if song.get("lipSync")),
            "lipSyncCurves": len(lip_sync_catalog),
            "motions": len(catalog),
            "motionFiles": len(catalog) * len(body_types),
        },
        "motionCatalog": catalog,
        "songs": songs,
    }
    output_path = output_root / choreography_relative
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(choreography, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return {
        "index": choreography_relative.as_posix(),
        "bodyTypes": body_types,
        **choreography["stats"],
    }


def export_compatibility_motions(
    body_types: list[int],
    animation_payloads: dict[tuple[int, int], bytes],
    output_root: Path,
) -> list[dict]:
    catalog = []
    for body_type in body_types:
        missing = sorted(
            motion_id
            for motion_id in COMPATIBILITY_MOTION_IDS
            if (body_type, motion_id) not in animation_payloads
        )
        if missing:
            raise FileNotFoundError(f"Missing body-{body_type} compatibility motions: {missing}")

        for motion_id in COMPATIBILITY_MOTION_IDS:
            payload = animation_payloads[(body_type, motion_id)]
            relative_path = Path("motions") / "compatibility" / str(body_type) / f"{motion_id}.motion"
            destination = output_root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
            if body_type == body_types[0]:
                animation_count, animation_name = first_animation_name(payload)
                slug = motion_slug(animation_name)
                catalog.append(
                    {
                        "id": motion_id,
                        "name": slug,
                        "label": f"兼容抽查 · {slug.replace('_', ' ').title()}",
                        "animationCount": animation_count,
                        "file": f"motions/compatibility/{{bodyType}}/{motion_id}.motion",
                    }
                )
    return catalog


def legacy_effect_scripts(root: Path) -> dict[str, bytes]:
    if not root.is_dir():
        raise FileNotFoundError(root)
    return {
        path.stem: path.read_bytes()
        for path in sorted(root.glob("*.csv"))
    }


def legacy_live_lip_sync(root: Path) -> dict[str, bytes]:
    if not root.is_dir():
        raise FileNotFoundError(root)
    return {
        path.stem: path.read_bytes()
        for path in sorted(root.glob("*/*_for_lipsync.json"))
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--raw-asset-root", type=Path)
    parser.add_argument(
        "--effect-script-root",
        type=Path,
        help="Explicit legacy regression override; default reads RAW song bundles.",
    )
    parser.add_argument(
        "--live-lip-sync-root",
        type=Path,
        help="Explicit legacy regression override; default reads RAW song bundles.",
    )
    parser.add_argument(
        "--costume-selection",
        type=Path,
        default=DEFAULT_COSTUME_SELECTION_PATH,
        help=(
            "Existing live-chibi inventory whose modelId rows define the "
            "bounded costume compatibility set."
        ),
    )
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_asset_root = (args.raw_asset_root or sources.raw_root / "asset").resolve()
    output_root = args.output_root.resolve()
    costume_selection = args.costume_selection.resolve()
    if not raw_asset_root.is_dir():
        raise FileNotFoundError(raw_asset_root)
    if not costume_selection.is_file():
        raise FileNotFoundError(costume_selection)

    raw_semantics = load_raw_live_semantics(raw_asset_root)
    effect_scripts = (
        legacy_effect_scripts(args.effect_script_root.resolve())
        if args.effect_script_root
        else {
            name: record["payload"]
            for name, record in raw_semantics["choreography"].items()
        }
    )
    live_lip_sync_sources = (
        legacy_live_lip_sync(args.live_lip_sync_root.resolve())
        if args.live_lip_sync_root
        else {
            name: record["payload"]
            for name, record in raw_semantics["lipSync"].items()
        }
    )
    costume_models = selected_costume_models(costume_selection)
    body_type_map = load_live_character_body_types(raw_asset_root)
    body_types = sorted(set(body_type_map.values()))
    animation_payloads = raw_animation_payloads(raw_asset_root)
    common_by_body = {
        body_type: export_common_motions(
            body_type,
            animation_payloads,
            output_root,
        )
        for body_type in body_types
    }
    motions = common_by_body[1]
    for motion in motions:
        motion["file"] = f"motions/common/{{bodyType}}/{motion['id']}.motion"

    characters, inventory = export_all_characters(
        body_type_map,
        raw_asset_root,
        output_root,
        costume_models,
    )
    character_shadow = export_character_shadow(output_root)

    compatibility_motions = export_compatibility_motions(
        body_types,
        animation_payloads,
        output_root,
    )
    choreography = export_choreography(
        body_types,
        animation_payloads,
        effect_scripts,
        live_lip_sync_sources,
        MUSIC_CATALOG_PATH,
        output_root,
    )
    manifest = {
        "schemaVersion": 4,
        "characters": characters,
        "shared": {"characterShadow": character_shadow},
        "inventory": "inventory.json",
        "motionPacks": [
            {
                "id": "common",
                "label": "通用动作",
                "bodyTypes": body_types,
                "motions": motions,
            },
            {
                "id": "compatibility",
                "label": "兼容抽查动作",
                "bodyTypes": body_types,
                "motions": compatibility_motions,
            },
        ],
        "choreography": choreography,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_root / "inventory.json").write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Prepared {len(characters)} characters and {inventory['costumeCount']} costumes, "
        f"{len(motions)} common motions for {len(body_types)} body types, "
        f"{len(compatibility_motions)} compatibility motions, and "
        f"{choreography['motions']} choreography motions across "
        f"{choreography['songs']} scripts in {output_root}"
    )


if __name__ == "__main__":
    main()
