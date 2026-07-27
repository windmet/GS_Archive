"""Extract one RAW character-image Sprite into an isolated browser candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

import UnityPy


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW_ROOT = REPO_ROOT / "RAW"
DEFAULT_IDOL_DICTIONARY = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "idol_unit_dictionary.json"
)
DEFAULT_SPEAKER_DICTIONARY = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "speaker_dictionary.json"
)
DEFAULT_STORY_MASTER = (
    REPO_ROOT
    / "web_viewer"
    / "public"
    / "data"
    / "masterdata"
    / "story_master_index.json"
)
DEFAULT_SOURCE_MANIFEST = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "source"
    / "files.jsonl"
)
DEFAULT_PUBLIC_ASSETS = REPO_ROOT / "web_viewer" / "public" / "assets"
DEFAULT_OUTPUT_ROOT = (
    REPO_ROOT
    / "web_viewer"
    / ".analysis"
    / "raw-migration"
    / "character-image-candidate"
)
CATEGORIES = {
    "birthday_visual": {
        "prefix": "image_chara_birthday_visual_",
        "bundle_glob": "image_chara_birthday_visual_*.unity3d",
        "master_domain": "birthday",
        "runtime_target": "ArchiveStoryDetail visualUrl",
    },
    "event_story_visual": {
        "prefix": "image_chara_event_story_visual_",
        "bundle_glob": "image_chara_event_story_visuals.unity3d",
        "master_domain": "event",
        "runtime_target": "event-story character presentation",
    },
    "mobile_bustup": {
        "prefix": "image_chara_mobile_bustup_",
        "bundle_glob": "image_chara_mobile_bushups.unity3d",
        "master_domain": "mobile_archive",
        "runtime_target": "mobile conversation presentation",
    },
    "name_plate": {
        "prefix": "image_chara_name_plate_",
        "bundle_glob": "image_chara_name_plates.unity3d",
        "master_domain": "speaker_dictionary",
        "runtime_target": "AdvUI name-plate renderer",
    },
    "sign": {
        "prefix": "image_chara_sign_",
        "bundle_glob": "image_chara_signs.unity3d",
        "master_domain": "idol_profile",
        "runtime_target": "ArchiveIdolDetail profile evidence",
    },
    "story_visual": {
        "prefix": "image_chara_story_visual_",
        "bundle_glob": "image_chara_story_visuals.unity3d",
        "master_domain": "idol_story",
        "runtime_target": "ArchiveIdolStory header",
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_source_manifest(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    return {
        row["relative_path"]: row
        for row in (
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    }


def asset_identities(asset_name: str, prefix: str) -> list[str]:
    if not asset_name.startswith(prefix):
        return []
    return [
        value
        for value in asset_name.removeprefix(prefix).split("-")
        if len(value) == 6 and value[:3].isdigit()
    ]


def birthday_story_evidence(
    story_master_path: Path, idol_code: str
) -> dict[str, Any]:
    payload = json.loads(story_master_path.read_text(encoding="utf-8"))
    rows = []
    for row in payload.get("birthday", []):
        compiled_file = str(row.get("compiled_file") or "")
        if not compiled_file.startswith(f"1_x_{idol_code}_"):
            continue
        characters = row.get("compiled_summary", {}).get("characters", [])
        rows.append(
            {
                "story_id": row.get("1"),
                "resource_id": row.get("resource_id") or row.get("5"),
                "compiled_file": compiled_file,
                "compiled_exists": row.get("compiled_exists"),
                "characters": characters,
            }
        )
    return {
        "domain": "birthday",
        "reference_count": len(rows),
        "references": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=sorted(CATEGORIES))
    parser.add_argument("idol_code")
    parser.add_argument("--raw-root", type=Path, default=DEFAULT_RAW_ROOT)
    parser.add_argument(
        "--idol-dictionary", type=Path, default=DEFAULT_IDOL_DICTIONARY
    )
    parser.add_argument(
        "--speaker-dictionary", type=Path, default=DEFAULT_SPEAKER_DICTIONARY
    )
    parser.add_argument(
        "--identity-scope",
        choices=("master_idol", "npc"),
        default="master_idol",
        help=(
            "Require either a master-idol identity or an explicit NPC speaker "
            "identity. NPC candidates are never inferred automatically."
        ),
    )
    parser.add_argument("--story-master", type=Path, default=DEFAULT_STORY_MASTER)
    parser.add_argument(
        "--source-manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST
    )
    parser.add_argument("--public-assets", type=Path, default=DEFAULT_PUBLIC_ASSETS)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()

    idol_code = args.idol_code.strip().lower()
    if len(idol_code) != 6 or not idol_code[:3].isdigit() or not idol_code.isalnum():
        raise ValueError(f"invalid idol_code: {idol_code!r}")
    category = CATEGORIES[args.kind]
    prefix = str(category["prefix"])
    raw_root = args.raw_root.resolve()
    raw_asset_root = raw_root / "asset"

    idol_payload = json.loads(
        args.idol_dictionary.resolve().read_text(encoding="utf-8")
    )
    idol = (idol_payload.get("by_idol_code") or {}).get(idol_code)
    speaker_payload = json.loads(
        args.speaker_dictionary.resolve().read_text(encoding="utf-8")
    )
    speaker = (speaker_payload.get("speakers") or {}).get(idol_code)
    if args.identity_scope == "master_idol" and not idol:
        raise ValueError(
            f"{idol_code} is not a master idol; NPC candidates require a separate gate"
        )
    if args.identity_scope == "npc":
        if idol:
            raise ValueError(
                f"{idol_code} is a master idol and cannot use the NPC identity gate"
            )
        if (
            not speaker
            or speaker.get("speaker_type") != "npc"
            or speaker.get("speaker_id") != idol_code
            or speaker.get("npc_code") != idol_code
        ):
            raise ValueError(
                f"{idol_code} has no exact NPC identity in the speaker dictionary"
            )

    matches = []
    for bundle_path in sorted(raw_asset_root.glob(str(category["bundle_glob"]))):
        environment = UnityPy.load(str(bundle_path))
        for container_path, obj in environment.container.items():
            if obj.type.name != "Sprite":
                continue
            asset_name = PurePosixPath(container_path).stem
            identities = asset_identities(asset_name, prefix)
            if idol_code in identities:
                matches.append(
                    {
                        "bundle_path": bundle_path,
                        "container_path": container_path,
                        "object": obj,
                        "asset_name": asset_name,
                        "identities": identities,
                    }
                )
    if len(matches) != 1:
        raise ValueError(
            f"expected one {args.kind} Sprite for {idol_code}, found {len(matches)}"
        )
    match = matches[0]
    sprite = match["object"].read()
    image = sprite.image
    output_dir = args.output_root.resolve() / args.kind / idol_code
    resolved_dir = output_dir / "resolved"
    resolved_dir.mkdir(parents=True, exist_ok=True)
    for old_path in resolved_dir.glob("*.png"):
        old_path.unlink()
    candidate_path = resolved_dir / f"{idol_code}.png"
    image.save(candidate_path)

    source_manifest = load_source_manifest(args.source_manifest.resolve())
    relative_bundle = match["bundle_path"].relative_to(raw_root).as_posix()
    source_record = source_manifest.get(relative_bundle)
    source_hash = sha256_file(match["bundle_path"])
    if source_record and source_record.get("sha256") != source_hash:
        raise ValueError(
            f"source manifest hash mismatch for {relative_bundle}: "
            f"{source_record.get('sha256')} != {source_hash}"
        )

    texture_rect = sprite.m_RD.textureRect
    public_matches = sorted(
        str(path.relative_to(args.public_assets.resolve()).as_posix())
        for path in args.public_assets.resolve().rglob(
            f"{match['asset_name']}.png"
        )
    )
    identity_evidence: dict[str, Any] = {
        "runtime_target": category["runtime_target"],
    }
    if args.identity_scope == "master_idol":
        identity_evidence["master_idol"] = {
            "idol_id": idol.get("idol_id"),
            "idol_code": idol.get("idol_code"),
            "display_name": idol.get("display_name"),
            "birthday": idol.get("birthday"),
            "source": idol.get("_source"),
        }
    else:
        identity_evidence["npc_speaker"] = {
            "speaker_id": speaker.get("speaker_id"),
            "speaker_type": speaker.get("speaker_type"),
            "npc_id": speaker.get("npc_id"),
            "npc_code": speaker.get("npc_code"),
            "display_name": speaker.get("display_name"),
            "category": speaker.get("category"),
            "birthday": speaker.get("birthday"),
            "source": speaker.get("_source"),
        }
    if args.kind == "birthday_visual":
        identity_evidence["story_master"] = birthday_story_evidence(
            args.story_master.resolve(), idol_code
        )

    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kind": args.kind,
        "idol_code": idol_code,
        "raw_source": {
            "relative_path": f"RAW/{relative_bundle}",
            "bytes": match["bundle_path"].stat().st_size,
            "sha256": source_hash,
            "source_manifest_equal": bool(source_record),
        },
        "unity_object": {
            "container_path": match["container_path"],
            # Unity PathIDs commonly exceed JavaScript's safe integer range.
            # Keep the exact object identity across JSON/Node consumers.
            "path_id": str(match["object"].path_id),
            "object_type": match["object"].type.name,
            "asset_name": match["asset_name"],
            "identity_ids": match["identities"],
            "sprite_rect": {
                "x": float(texture_rect.x),
                "y": float(texture_rect.y),
                "width": float(texture_rect.width),
                "height": float(texture_rect.height),
            },
        },
        "identity_evidence": identity_evidence,
        "resolved_asset": {
            "resolution": "sprite",
            "width": image.width,
            "height": image.height,
            "bytes": candidate_path.stat().st_size,
            "sha256": sha256_file(candidate_path),
            "candidate_url": (
                f"/assets/character-candidate/{args.kind}/{idol_code}.png"
            ),
            "current_public_original_basename_matches": public_matches,
        },
    }
    manifest_path = output_dir / "candidate.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "kind": args.kind,
                "idol_code": idol_code,
                "identity_scope": args.identity_scope,
                "source_asset": match["asset_name"],
                "dimensions": [image.width, image.height],
                "master_references": identity_evidence.get(
                    "story_master", {}
                ).get("reference_count"),
                "current_public_original_basename_matches": len(public_matches),
                "candidate_url": manifest["resolved_asset"]["candidate_url"],
            },
            ensure_ascii=False,
        )
    )
    print(f"candidate: {manifest_path}")


if __name__ == "__main__":
    main()
