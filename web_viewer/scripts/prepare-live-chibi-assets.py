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

import json
import re
import shutil
import csv
from pathlib import Path

import UnityPy


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi"

SIDEM_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM")
RESOURCE_ROOT = SIDEM_ROOT / "growing stars" / "assets" / "resources"
RAW_ASSET_ROOT = SIDEM_ROOT / "RAW" / "asset"
COSTUME_ROOT = SIDEM_ROOT / "story_viewer" / "extract_output" / "cos_costumes"
ANIMATION_ROOT = RESOURCE_ROOT / "livecharacter" / "animation"
EFFECT_SCRIPT_ROOT = RESOURCE_ROOT / "liveeffectscript"
LIVE_LIP_SYNC_ROOT = SIDEM_ROOT / "scripts" / "lipsyncdata" / "adxlip_for_live"
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


def copy_required(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def unity_text_payload(text_asset) -> str:
    payload = text_asset.m_Script
    if isinstance(payload, bytes):
        return payload.decode("utf-8-sig")
    return payload


def load_live_character_body_types() -> dict[str, int]:
    environment = UnityPy.load(str(RAW_ASSET_ROOT / "live_character_info_data_list.unity3d"))
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


def atlas_stats(path: Path) -> dict[str, int]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {
        "pages": sum(1 for line in lines if re.search(r"\.(?:png|jpg)$", line.strip(), re.I)),
        "regions": sum(1 for line in lines if line.strip().startswith("rotate:")),
    }


def export_all_characters(body_types: dict[str, int]) -> tuple[list[dict], dict]:
    speaker_data = json.loads(SPEAKER_DICTIONARY_PATH.read_text(encoding="utf-8"))["speakers"]
    idol_data = json.loads(IDOL_DICTIONARY_PATH.read_text(encoding="utf-8"))["by_idol_code"]
    costume_rows = json.loads(COSTUME_DICTIONARY_PATH.read_text(encoding="utf-8"))["costumes"]
    costume_names = {
        row["model_resource_id"]: row.get("costume_name")
        for row in costume_rows
        if row.get("model_resource_id")
    }
    grouped: dict[str, list[Path]] = {}
    model_pattern = re.compile(r"^([0-9]{3}[a-z]{3})_(.+)$", re.I)
    for directory in sorted(COSTUME_ROOT.iterdir()):
        if not directory.is_dir():
            continue
        match = model_pattern.fullmatch(directory.name)
        if not match:
            continue
        grouped.setdefault(match.group(1), []).append(directory)

    missing_body_types = sorted(set(grouped) - set(body_types))
    if missing_body_types:
        raise ValueError(f"Costume idols missing body type mappings: {missing_body_types}")

    for body_type in sorted(set(body_types.values())):
        setup_source = (
            RESOURCE_ROOT
            / "livecharacter"
            / "setup"
            / str(body_type)
            / f"live_costume_setup_{body_type}.skel.bytes"
        )
        copy_required(setup_source, OUTPUT_ROOT / "setup" / f"body-{body_type}.skel")

    characters = []
    inventory_costumes = []
    body_costume_counts: dict[int, int] = {}
    for idol_id in sorted(grouped):
        body_type = body_types[idol_id]
        costumes = []
        for source in grouped[idol_id]:
            costume_id = source.name[len(idol_id) + 1 :]
            relative = Path("costumes") / source.name
            atlas_source = source / "cos.atlas"
            texture_source = source / "cos.png"
            copy_required(atlas_source, OUTPUT_ROOT / relative / "cos.atlas")
            copy_required(texture_source, OUTPUT_ROOT / relative / "cos.png")
            stats = atlas_stats(atlas_source)
            label = costume_names.get(source.name) or f"服装 {costume_id}"
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
                    "modelId": source.name,
                    "idolId": idol_id,
                    "bodyType": body_type,
                    **stats,
                    "textureBytes": texture_source.stat().st_size,
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


def export_common_motions(body_type: int) -> list[dict]:
    bundle_path = RAW_ASSET_ROOT / "live_costume_animation_2.unity3d"
    environment = UnityPy.load(str(bundle_path))
    target_pattern = re.compile(
        rf"live_costume_animation_{body_type}_(\d+)$"
    )
    motions = []

    for asset in environment.assets:
        for obj in asset.objects.values():
            if obj.type.name != "TextAsset":
                continue
            text_asset = obj.read()
            match = target_pattern.fullmatch(text_asset.m_Name)
            if not match:
                continue

            motion_id = int(match.group(1))
            payload = text_asset.m_Script.encode("utf-8", errors="surrogateescape")
            animation_count, animation_name = first_animation_name(payload)
            slug = motion_slug(animation_name)
            relative_path = Path("motions") / "common" / str(body_type) / f"{motion_id}.motion"
            output_path = OUTPUT_ROOT / relative_path
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


def read_choreography_scripts() -> tuple[list[dict], set[int]]:
    music_catalog = json.loads(MUSIC_CATALOG_PATH.read_text(encoding="utf-8")).get("songs", {})
    songs = []
    referenced_motion_ids: set[int] = set()

    for csv_path in sorted(EFFECT_SCRIPT_ROOT.glob("*.csv")):
        events = []
        singer_events = []
        position_events = []
        camera_events = []
        backmonitor_events = []
        image_layer_events = []
        lyric_events = []
        whole_screen_color_events = []
        character_light_events = []
        motion_group_events = []
        motion_group_changes = []
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
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
                "lyricEvents": sorted(lyric_events, key=lambda event: event["time"]),
                "wholeScreenColorEvents": sorted(
                    whole_screen_color_events, key=lambda event: event["time"]
                ),
                "characterLightEvents": sorted(
                    character_light_events, key=lambda event: event["time"]
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


def export_live_lip_sync() -> dict[str, dict]:
    """Export the original 60 Hz ADX lip channel in a compact web format."""
    catalog = {}
    for source in sorted(LIVE_LIP_SYNC_ROOT.glob("*/*_for_lipsync.json")):
        song_code = source.parent.name
        data = json.loads(source.read_text(encoding="utf-8-sig"))
        scales = data.get("scales")
        if not isinstance(scales, list) or not scales:
            continue
        values = [float(sample.get("y", 0)) for sample in scales]
        relative_path = Path("lipsync") / f"{song_code}.json"
        output_path = OUTPUT_ROOT / relative_path
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
            "source": source.name,
        }
    return catalog


def export_choreography(body_types: list[int]) -> dict:
    songs, referenced_motion_ids = read_choreography_scripts()
    lip_sync_catalog = export_live_lip_sync()
    for song in songs:
        if song["songCode"] in lip_sync_catalog:
            song["lipSync"] = lip_sync_catalog[song["songCode"]]
    sources_by_body = {}
    for body_type in body_types:
        source_by_id = {}
        pattern = re.compile(rf"live_costume_animation_{body_type}_(\d+)\.bytes$")
        for source in ANIMATION_ROOT.rglob(f"live_costume_animation_{body_type}_*.bytes"):
            match = pattern.fullmatch(source.name)
            if match:
                source_by_id[int(match.group(1))] = source
        missing = sorted(referenced_motion_ids - source_by_id.keys())
        if missing:
            raise FileNotFoundError(f"Missing body-{body_type} motions: {missing[:20]}")
        sources_by_body[body_type] = source_by_id

    catalog = []
    for motion_id in sorted(referenced_motion_ids):
        source = sources_by_body[body_types[0]][motion_id]
        payload = source.read_bytes()
        animation_count, animation_name = first_animation_name(payload)
        slug = motion_slug(animation_name)
        for body_type in body_types:
            relative_path = (
                Path("motions") / "choreography" / str(body_type) / f"{motion_id}.motion"
            )
            copy_required(sources_by_body[body_type][motion_id], OUTPUT_ROOT / relative_path)
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
        "schemaVersion": 8,
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
            "lyricEvents": sum(len(song["lyricEvents"]) for song in songs),
            "wholeScreenColorEvents": sum(
                len(song["wholeScreenColorEvents"]) for song in songs
            ),
            "characterLightEvents": sum(
                len(song["characterLightEvents"]) for song in songs
            ),
            "lipSyncSongs": sum(1 for song in songs if song.get("lipSync")),
            "lipSyncCurves": len(lip_sync_catalog),
            "motions": len(catalog),
            "motionFiles": len(catalog) * len(body_types),
        },
        "motionCatalog": catalog,
        "songs": songs,
    }
    output_path = OUTPUT_ROOT / choreography_relative
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


def export_compatibility_motions(body_types: list[int]) -> list[dict]:
    catalog = []
    for body_type in body_types:
        pattern = re.compile(rf"live_costume_animation_{body_type}_(\d+)\.bytes$")
        source_by_id = {}
        for source in ANIMATION_ROOT.rglob(f"live_costume_animation_{body_type}_*.bytes"):
            match = pattern.fullmatch(source.name)
            if match:
                source_by_id[int(match.group(1))] = source

        missing = sorted(set(COMPATIBILITY_MOTION_IDS) - source_by_id.keys())
        if missing:
            raise FileNotFoundError(f"Missing body-{body_type} compatibility motions: {missing}")

        for motion_id in COMPATIBILITY_MOTION_IDS:
            source = source_by_id[motion_id]
            relative_path = Path("motions") / "compatibility" / str(body_type) / f"{motion_id}.motion"
            copy_required(source, OUTPUT_ROOT / relative_path)
            if body_type == body_types[0]:
                payload = source.read_bytes()
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


def main() -> None:
    body_type_map = load_live_character_body_types()
    body_types = sorted(set(body_type_map.values()))
    common_by_body = {body_type: export_common_motions(body_type) for body_type in body_types}
    motions = common_by_body[1]
    for motion in motions:
        motion["file"] = f"motions/common/{{bodyType}}/{motion['id']}.motion"

    characters, inventory = export_all_characters(body_type_map)

    compatibility_motions = export_compatibility_motions(body_types)
    choreography = export_choreography(body_types)
    manifest = {
        "schemaVersion": 4,
        "characters": characters,
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
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT_ROOT / "inventory.json").write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Prepared {len(characters)} characters and {inventory['costumeCount']} costumes, "
        f"{len(motions)} common motions for {len(body_types)} body types, "
        f"{len(compatibility_motions)} compatibility motions, and "
        f"{choreography['motions']} choreography motions across "
        f"{choreography['songs']} scripts in {OUTPUT_ROOT}"
    )


if __name__ == "__main__":
    main()
