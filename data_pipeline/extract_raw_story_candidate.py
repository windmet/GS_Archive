"""Extract and compile one story from SideM RAW without touching public data."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

import UnityPy

from scenario_compiler import ScenarioCompiler


PART_PATTERN = re.compile(r"^scenario_(?P<part>.+_[a-z])$")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_asset_bytes(data: Any) -> bytes:
    script = data.m_Script
    return script.encode("utf-8") if isinstance(script, str) else bytes(script)


def extract_text_assets(bundle: Path) -> list[tuple[str, bytes]]:
    environment = UnityPy.load(str(bundle))
    records = []
    for obj in environment.objects:
        if obj.type.name != "TextAsset":
            continue
        data = obj.read()
        records.append((str(data.m_Name), text_asset_bytes(data)))
    return sorted(records)


def inspect_acb_cues(vgmstream: Path | None, acb: Path) -> list[str]:
    if vgmstream is None:
        return []
    cues = []
    for selection in range(1, 201):
        result = subprocess.run(
            [str(vgmstream), "-m", "-s", str(selection), str(acb)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        name = None
        for line in result.stdout.splitlines():
            if "stream name:" in line:
                name = line.split("stream name:", 1)[1].strip()
                break
        if not name:
            break
        cues.append(name)
    return cues


def relink_voices_from_raw_cues(
    scenario: dict[str, Any],
    audio_records: list[dict[str, Any]],
) -> dict[str, int]:
    cues_by_part = {
        str(record["part_id"]): set(record.get("cues") or [])
        for record in audio_records
    }
    all_cues = set().union(*cues_by_part.values()) if cues_by_part else set()
    stats = {"references": 0, "resolved": 0, "unresolved": 0, "ambiguous": 0}
    for step in scenario.get("steps") or []:
        dialogue = step.get("dialogue")
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        if not voice:
            continue
        stats["references"] += 1
        evidence = step.get("evidence") if isinstance(step.get("evidence"), dict) else {}
        part_id = str(evidence.get("source_part_id") or "")
        part_cues = cues_by_part.get(part_id, set())
        stem = str(voice)
        if stem.lower().endswith(".m4a"):
            stem = stem[:-4]

        candidates = []
        if stem in all_cues:
            candidates = [stem]
        else:
            candidates = sorted(cue for cue in part_cues if cue.endswith(stem))
        if not candidates:
            tail = re.search(r"([a-z]\d+)$", stem, flags=re.IGNORECASE)
            if tail:
                candidates = sorted(
                    cue for cue in part_cues if cue.endswith(tail.group(1))
                )

        if len(candidates) == 1:
            dialogue["voice"] = f"{candidates[0]}.m4a"
            stats["resolved"] += 1
        elif len(candidates) > 1:
            stats["ambiguous"] += 1
        else:
            stats["unresolved"] += 1
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--vgmstream", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_root = args.raw_root.resolve()
    output_dir = args.output_dir.resolve()
    scenario_bundle = raw_root / "asset" / f"scenario_{args.scenario_id}.unity3d"
    if not scenario_bundle.is_file():
        raise FileNotFoundError(scenario_bundle)
    if args.vgmstream and not args.vgmstream.is_file():
        raise FileNotFoundError(args.vgmstream)

    scenario_dir = output_dir / "extracted" / "scenarios" / args.scenario_id
    lipsync_root = output_dir / "extracted" / "lipsync"
    compatibility_dir = output_dir / "compiled" / "compatibility"
    authoritative_dir = output_dir / "compiled" / "authoritative"
    scenario_dir.mkdir(parents=True, exist_ok=True)
    lipsync_root.mkdir(parents=True, exist_ok=True)
    compatibility_dir.mkdir(parents=True, exist_ok=True)
    authoritative_dir.mkdir(parents=True, exist_ok=True)

    scenario_records = []
    raw_data = []
    part_ids = []
    source_files = []

    for name, payload in extract_text_assets(scenario_bundle):
        match = PART_PATTERN.match(name)
        if not match:
            continue
        part_id = match.group("part")
        destination = scenario_dir / f"{name}.json"
        destination.write_bytes(payload)
        parsed = json.loads(payload.decode("utf-8-sig"))
        raw_data.append(parsed)
        part_ids.append(part_id)
        source_files.append(
            f"RAW/asset/{scenario_bundle.name}#{name}"
        )
        scenario_records.append(
            {
                "part_id": part_id,
                "text_asset": name,
                "output": str(destination),
                "size": len(payload),
                "sha256": sha256_bytes(payload),
            }
        )

    if not raw_data:
        raise RuntimeError(f"No scenario TextAssets found in {scenario_bundle}")

    lipsync_records = []
    audio_records = []
    for part_id in part_ids:
        lipsync_bundle = raw_root / "asset" / f"lipsync_{part_id}.unity3d"
        if lipsync_bundle.is_file():
            part_output = lipsync_root / part_id
            part_output.mkdir(parents=True, exist_ok=True)
            assets = extract_text_assets(lipsync_bundle)
            for name, payload in assets:
                (part_output / f"{name}.json").write_bytes(payload)
            lipsync_records.append(
                {
                    "part_id": part_id,
                    "container": str(lipsync_bundle),
                    "container_sha256": sha256_file(lipsync_bundle),
                    "text_asset_count": len(assets),
                    "text_assets": [name for name, _ in assets],
                }
            )

        acb = raw_root / "audio" / f"{part_id}.acb"
        if acb.is_file():
            audio_records.append(
                {
                    "part_id": part_id,
                    "container": str(acb),
                    "container_sha256": sha256_file(acb),
                    "cues": inspect_acb_cues(args.vgmstream, acb),
                }
            )

    compiled = ScenarioCompiler.compile_group(
        raw_data,
        args.scenario_id,
        part_ids,
        source_files,
    )
    auxiliary_ids = set()
    auxiliary_pattern = re.compile(
        rf"^({re.escape(args.scenario_id)}_t\d+)_\d+(?:\.m4a)?$",
        flags=re.IGNORECASE,
    )
    for step in compiled.get("steps") or []:
        dialogue = step.get("dialogue")
        voice = dialogue.get("voice") if isinstance(dialogue, dict) else None
        match = auxiliary_pattern.match(str(voice or ""))
        if match:
            auxiliary_ids.add(match.group(1))

    known_audio = {str(record["part_id"]) for record in audio_records}
    known_lipsync = {str(record["part_id"]) for record in lipsync_records}
    for auxiliary_id in sorted(auxiliary_ids):
        lipsync_bundle = raw_root / "asset" / f"lipsync_{auxiliary_id}.unity3d"
        if auxiliary_id not in known_lipsync and lipsync_bundle.is_file():
            part_output = lipsync_root / auxiliary_id
            part_output.mkdir(parents=True, exist_ok=True)
            assets = extract_text_assets(lipsync_bundle)
            for name, payload in assets:
                (part_output / f"{name}.json").write_bytes(payload)
            lipsync_records.append(
                {
                    "part_id": auxiliary_id,
                    "container": str(lipsync_bundle),
                    "container_sha256": sha256_file(lipsync_bundle),
                    "text_asset_count": len(assets),
                    "text_assets": [name for name, _ in assets],
                }
            )

        acb = raw_root / "audio" / f"{auxiliary_id}.acb"
        if auxiliary_id not in known_audio and acb.is_file():
            audio_records.append(
                {
                    "part_id": auxiliary_id,
                    "container": str(acb),
                    "container_sha256": sha256_file(acb),
                    "cues": inspect_acb_cues(args.vgmstream, acb),
                }
            )

    compiled["source"] = {
        "raw_path": f"RAW/asset/{scenario_bundle.name}",
        "raw_hash": f"sha256:{sha256_file(scenario_bundle)}",
        "raw_hash_format": "sha256-unity3d-container-v1",
        "raw_files": [
            {
                "path": record["text_asset"],
                "raw_hash": f"sha256:{record['sha256']}",
            }
            for record in scenario_records
        ],
    }
    voice_relink = relink_voices_from_raw_cues(compiled, audio_records)
    compatibility_path = compatibility_dir / f"{args.scenario_id}.json"
    ScenarioCompiler.save_json(compiled, str(compatibility_path))
    authoritative = ScenarioCompiler.to_authoritative(
        compiled,
        compiler_version="raw-source-candidate-v1",
    )
    authoritative_path = authoritative_dir / f"{args.scenario_id}.json"
    ScenarioCompiler.save_json(authoritative, str(authoritative_path))

    manifest = {
        "schema_version": 1,
        "scenario_id": args.scenario_id,
        "raw_root": str(raw_root),
        "scenario_container": {
            "path": str(scenario_bundle),
            "sha256": sha256_file(scenario_bundle),
        },
        "scenario_parts": scenario_records,
        "lipsync": lipsync_records,
        "audio": audio_records,
        "voice_relink": voice_relink,
        "compiled_compatibility": {
            "path": str(compatibility_path),
            "sha256": sha256_file(compatibility_path),
            "total_steps": compiled.get("total_steps"),
            "episode_count": len(compiled.get("episodes") or []),
        },
        "compiled_authoritative": {
            "path": str(authoritative_path),
            "sha256": sha256_file(authoritative_path),
            "step_count": len(authoritative.get("steps") or []),
            "episode_count": len(authoritative.get("episodes") or []),
        },
    }
    manifest_path = output_dir / "candidate_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
