#!/usr/bin/env python3
"""Inventory CSV Object_layer prefabs and export faithful SpriteRenderer parts."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from pathlib import Path

import UnityPy
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SIDEM_ROOT = Path(r"E:\BaiduNetdiskDownload\SideM")
SCRIPT_ROOT = SIDEM_ROOT / "growing stars" / "assets" / "resources" / "liveeffectscript"
RAW_ASSET_ROOT = SIDEM_ROOT / "RAW" / "asset"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "object-layers"


def object_references() -> dict[str, set[str]]:
    references: dict[str, set[str]] = {}
    for csv_path in sorted(SCRIPT_ROOT.glob("*.csv")):
        song_code = csv_path.stem.split("_", 1)[0]
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.reader(handle):
                if not row or row[0] != "Object_layer" or len(row) < 3:
                    continue
                asset = row[2].strip()
                if asset:
                    references.setdefault(asset, set()).add(song_code)
    return references


def safe_name(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.-]+", "_", value).strip("_") or "object"


def pptr_path_id(value) -> int:
    if isinstance(value, dict):
        return int(value.get("m_PathID", 0))
    return int(getattr(value, "path_id", 0))


def quaternion_z(rotation) -> float:
    x = float(rotation.x)
    y = float(rotation.y)
    z = float(rotation.z)
    w = float(rotation.w)
    return math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))


def multiply(left: tuple[float, ...], right: tuple[float, ...]) -> tuple[float, ...]:
    a, b, c, d, tx, ty = left
    e, f, g, h, ux, uy = right
    return (
        a * e + c * f,
        b * e + d * f,
        a * g + c * h,
        b * g + d * h,
        a * ux + c * uy + tx,
        b * ux + d * uy + ty,
    )


def local_matrix(transform) -> tuple[float, ...]:
    angle = quaternion_z(transform.m_LocalRotation)
    cosine = math.cos(angle)
    sine = math.sin(angle)
    scale_x = float(transform.m_LocalScale.x)
    scale_y = float(transform.m_LocalScale.y)
    return (
        cosine * scale_x,
        sine * scale_x,
        -sine * scale_y,
        cosine * scale_y,
        float(transform.m_LocalPosition.x),
        float(transform.m_LocalPosition.y),
    )


def relative_matrix(transform, root_path_id: int) -> tuple[float, ...]:
    chain = []
    current = transform
    while current is not None:
        go_path_id = current.m_GameObject.path_id
        if go_path_id == root_path_id:
            break
        chain.append(local_matrix(current))
        father = current.m_Father
        current = father.read() if father.path_id else None
    result = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    for matrix in reversed(chain):
        result = multiply(result, matrix)
    return result


def decompose(matrix: tuple[float, ...]) -> dict:
    a, b, c, d, tx, ty = matrix
    scale_x = math.hypot(a, b)
    determinant = a * d - b * c
    scale_y = determinant / scale_x if scale_x else math.hypot(c, d)
    rotation = math.degrees(math.atan2(b, a)) if scale_x else 0
    return {
        "x": round(tx * 100, 4),
        "y": round(-ty * 100, 4),
        "scaleX": round(scale_x, 6),
        "scaleY": round(scale_y, 6),
        "rotation": round(-rotation, 4),
    }


def renderer_materials(renderer) -> list[str]:
    names = []
    for pointer in renderer.m_Materials:
        if not pointer.path_id:
            continue
        try:
            names.append(pointer.read().m_Name)
        except Exception:
            names.append(f"path:{pointer.path_id}")
    return names


def color_metadata(color) -> tuple[int, float]:
    channels = [max(0, min(255, round(float(value) * 255))) for value in (color.r, color.g, color.b)]
    return (channels[0] << 16) | (channels[1] << 8) | channels[2], round(float(color.a), 6)


def save_sprite(image: Image.Image, target: Path, force: bool) -> dict:
    if not force and target.exists() and target.stat().st_size > 0:
        with Image.open(target) as check:
            return {"width": check.width, "height": check.height, "bytes": target.stat().st_size}
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    image.convert("RGBA").save(temporary, format="PNG", optimize=True)
    with Image.open(temporary) as check:
        if check.width <= 0 or check.height <= 0:
            raise RuntimeError(f"Invalid object sprite: {target}")
        metadata = {"width": check.width, "height": check.height}
    temporary.replace(target)
    return {**metadata, "bytes": target.stat().st_size}


def find_keeper(environment, objects_by_id: dict[int, object], asset: str):
    expected = f"liveobjectobjectlayer_{asset}".lower()
    for obj in environment.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            tree = obj.read_typetree()
            game_object = objects_by_id[pptr_path_id(tree.get("m_GameObject", {}))].read()
        except Exception:
            continue
        if game_object.m_Name.lower() == expected and any(
            key in tree for key in ("_particles", "_sprites", "_groups")
        ):
            return tree, game_object, pptr_path_id(tree.get("m_GameObject", {}))
    return None, None, 0


def inspect_asset(bundle: Path, asset: str, force: bool) -> dict | None:
    environment = UnityPy.load(str(bundle))
    objects_by_id = {int(obj.path_id): obj for obj in environment.objects}
    keeper, root, root_path_id = find_keeper(environment, objects_by_id, asset)
    if keeper is None:
        return None

    transforms_by_game_object = {}
    for obj in environment.objects:
        if obj.type.name != "Transform":
            continue
        transform = obj.read()
        transforms_by_game_object[transform.m_GameObject.path_id] = transform

    sprite_ids = [pptr_path_id(value) for value in keeper.get("_sprites", []) if pptr_path_id(value)]
    particle_ids = [pptr_path_id(value) for value in keeper.get("_particles", []) if pptr_path_id(value)]
    group_ids = [pptr_path_id(value) for value in keeper.get("_groups", []) if pptr_path_id(value)]
    textures: dict[int, dict] = {}
    instances = []
    for renderer_id in sprite_ids:
        renderer_object = objects_by_id.get(renderer_id)
        if renderer_object is None:
            continue
        renderer = renderer_object.read()
        if not renderer.m_Sprite.path_id:
            continue
        sprite = renderer.m_Sprite.read()
        sprite_id = int(renderer.m_Sprite.path_id)
        if sprite_id not in textures:
            filename = f"{safe_name(asset)}__{safe_name(sprite.m_Name)}__{abs(sprite_id)}.png"
            target = OUTPUT_ROOT / "sprites" / filename
            metadata = save_sprite(sprite.image, target, force)
            textures[sprite_id] = {
                "id": str(sprite_id),
                "name": sprite.m_Name,
                "file": f"object-layers/sprites/{filename}",
                "pivot": {
                    "x": round(float(sprite.m_Pivot.x), 6),
                    "y": round(1 - float(sprite.m_Pivot.y), 6),
                },
                "pixelsPerUnit": round(float(sprite.m_PixelsToUnits), 4),
                **metadata,
            }
        game_object = renderer.m_GameObject.read()
        transform = transforms_by_game_object.get(renderer.m_GameObject.path_id)
        if transform is None:
            continue
        tint, alpha = color_metadata(renderer.m_Color)
        materials = renderer_materials(renderer)
        instances.append(
            {
                "name": game_object.m_Name,
                "texture": str(sprite_id),
                **decompose(relative_matrix(transform, root_path_id)),
                "tint": tint,
                "alpha": alpha,
                "blendMode": "add" if any("add" in name.lower() for name in materials) else "normal",
                "sortingOrder": int(renderer.m_SortingOrder),
                "materials": materials,
            }
        )

    if instances and not particle_ids and not group_ids:
        kind = "sprite"
    elif instances:
        kind = "mixed"
    elif particle_ids:
        kind = "particle"
    elif group_ids:
        kind = "group"
    else:
        kind = "empty"
    return {
        "id": asset,
        "bundle": bundle.name,
        "kind": kind,
        "spriteCount": len(instances),
        "particleCount": len(particle_ids),
        "groupCount": len(group_ids),
        "keepOriginalOrder": bool(keeper.get("_keepOriginalOrder", 0)),
        "textures": list(textures.values()),
        "instances": instances,
    }


def candidate_bundles(asset: str, song_codes: set[str], filenames: dict[str, Path]) -> list[Path]:
    names = [f"liveobjectobjectlayer_{asset}.unity3d"]
    match = re.match(r"^fx_in_([^_]+)_", asset, re.IGNORECASE)
    if match:
        names.append(f"song_{match.group(1)}.unity3d")
    names.extend(f"song_{code}.unity3d" for code in sorted(song_codes))
    seen = set()
    result = []
    for name in names:
        path = filenames.get(name.lower())
        if path and path not in seen:
            seen.add(path)
            result.append(path)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    references = object_references()
    filenames = {path.name.lower(): path for path in RAW_ASSET_ROOT.glob("*.unity3d")}
    entries = {}
    missing = []
    for index, (asset, song_codes) in enumerate(sorted(references.items()), 1):
        entry = None
        for bundle in candidate_bundles(asset, song_codes, filenames):
            entry = inspect_asset(bundle, asset, args.force)
            if entry is not None:
                break
        if entry is None:
            missing.append(asset)
            print(f"[{index:03d}/{len(references):03d}] missing {asset}")
            continue
        entry["songs"] = sorted(song_codes)
        entries[asset] = entry
        print(
            f"[{index:03d}/{len(references):03d}] {asset}: {entry['kind']} "
            f"({entry['spriteCount']} sprites, {entry['particleCount']} particles)"
        )

    stats = {
        "referenced": len(references),
        "located": len(entries),
        "missing": len(missing),
        "spriteObjects": sum(entry["kind"] == "sprite" for entry in entries.values()),
        "mixedObjects": sum(entry["kind"] == "mixed" for entry in entries.values()),
        "particleObjects": sum(entry["kind"] == "particle" for entry in entries.values()),
        "spriteInstances": sum(entry["spriteCount"] for entry in entries.values()),
        "particleSystems": sum(entry["particleCount"] for entry in entries.values()),
        "bytes": sum(
            texture["bytes"]
            for entry in entries.values()
            for texture in entry["textures"]
        ),
    }
    index = {
        "schemaVersion": 1,
        "stats": stats,
        "missing": missing,
        "assets": entries,
    }
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_ROOT / "index.tmp.json"
    temporary.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT_ROOT / "index.json")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
