#!/usr/bin/env python3
"""Generate a read-only audio-layer relation catalog for RAW song3 ACB files.

Each catalog song maps its ACB files to audio layers using the CRI cue names
exposed by vgmstream. The catalog never decodes, copies, or publishes media.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PIPELINE_ROOT = PROJECT_ROOT.parent / "data_pipeline"
sys.path.insert(0, str(DATA_PIPELINE_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from archive_paths import add_sources_config_argument, load_archive_sources

DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "data" / "song_audio_relation_catalog.json"
MUSIC_CATALOG = PROJECT_ROOT / "public" / "data" / "masterdata" / "music_catalog.json"

IDOL_SUFFIX_RE = re.compile(r"^\d{3}[a-z]{3}$")
UNIT_SUFFIX_RE = re.compile(r"^\d{3}[a-z0-9]{3}$")
SONG3_PREFIX = "song3_"


def run_vgmstream_meta(vgmstream: Path, acb_path: Path, selection: int | None = None):
    command = [str(vgmstream), "-m"]
    if selection is not None:
        command += ["-s", str(selection)]
    command += ["-I", str(acb_path)]
    return json.loads(
        subprocess.run(
            command, check=True, capture_output=True, text=True, encoding="utf-8"
        ).stdout
    )


def inspect_cues(vgmstream: Path, acb_path: Path) -> list[str]:
    first = run_vgmstream_meta(vgmstream, acb_path)
    total = int(first.get("streamInfo", {}).get("total") or 1)
    cues = []
    for selection in range(1, total + 1):
        info = (
            first
            if selection == 1
            else run_vgmstream_meta(vgmstream, acb_path, selection)
        )
        name = str(info.get("streamInfo", {}).get("name") or "")
        cues.append(name)
    return cues


def classify_cue(code: str, cue: str) -> str | None:
    """Classify an ACB internal cue name for a song code.

    Returns the strongest classification across the cue's semicolon-separated
    aliases (e.g. 'song3_x; song3_x_preview; song3_x_soundcheck').
    """
    names = [part.strip() for part in cue.split(";")]
    if any(name == f"{SONG3_PREFIX}{code}" for name in names):
        return "full-mix"
    if any("_preview" in name for name in names):
        return "preview"
    if any("_soundcheck" in name for name in names):
        return "soundcheck"
    for name in names:
        if not name.startswith(f"{SONG3_PREFIX}{code}_"):
            continue
        rest = name[len(f"{SONG3_PREFIX}{code}_"):]
        if UNIT_SUFFIX_RE.match(rest):
            return "unit-cue"
        if rest.startswith("oneshot_") and IDOL_SUFFIX_RE.match(rest[8:]):
            return "oneshot-cue"
    return None


def classify_file(code: str, filename: str) -> tuple[str, str]:
    """Classify a song3 ACB filename into (kind, suffix)."""
    stem = filename[: -4] if filename.endswith(".acb") else filename
    rest = stem[len(f"{SONG3_PREFIX}{code}_"):]
    if rest == "bgm":
        return "backing", ""
    if IDOL_SUFFIX_RE.match(rest):
        return "idol-vocal", rest
    return "unknown", rest


def build_catalog(
    raw_audio_root: Path, vgmstream: Path, music_catalog_path: Path
) -> dict:
    music_catalog = json.loads(music_catalog_path.read_text(encoding="utf-8"))
    catalog_songs = music_catalog["songs"]

    acb_files = sorted(
        raw_audio_root.glob(f"{SONG3_PREFIX}*.acb"), key=lambda p: p.name.lower()
    )

    songs: dict[str, dict] = {}
    layered = set()
    oneshot = set()
    idol_files: dict[str, list[str]] = defaultdict(list)
    backing_files: dict[str, list[str]] = defaultdict(list)
    test_entities = []

    for acb in acb_files:
        stem = acb.stem
        rest = stem[len(SONG3_PREFIX):]
        if not rest:
            continue
        code = rest.split("_")[0]
        suffix = rest[len(code) + 1:] if len(rest) > len(code) else ""
        if code in ("00test", "02test"):
            test_entities.append(
                {"code": code, "kind": "test", "file": acb.name}
            )
            continue
        if suffix == "":
            continue
        if IDOL_SUFFIX_RE.match(suffix):
            idol_files[code].append(acb.name)
        elif suffix == "bgm":
            backing_files[code].append(acb.name)

    for code, meta in sorted(catalog_songs.items()):
        base_acb = raw_audio_root / f"{SONG3_PREFIX}{code}.acb"
        base_name = base_acb.name if base_acb.is_file() else None
        layers = []
        if base_name:
            cues = inspect_cues(vgmstream, base_acb)
            mix = [c for c in cues if classify_cue(code, c) == "full-mix"]
            units = [
                c
                for c in cues
                if classify_cue(code, c) == "unit-cue"
            ]
            previews = [
                c for c in cues if classify_cue(code, c) == "preview"
            ]
            soundchecks = [
                c for c in cues if classify_cue(code, c) == "soundcheck"
            ]
            oneshots = [
                c for c in cues if classify_cue(code, c) == "oneshot-cue"
            ]
            if units:
                layered.add(code)
                layers.append(
                    {
                        "kind": "unit-cue",
                        "files": [base_name],
                        "cue_names": units,
                        "evidence": {
                            "source": "vgmstream ACB cue scan",
                            "note": "base ACB exposes per-unit performance cues",
                        },
                    }
                )
            if oneshots:
                oneshot.add(code)
                layers.append(
                    {
                        "kind": "oneshot-cue",
                        "files": [base_name],
                        "cue_names": oneshots,
                        "evidence": {
                            "source": "vgmstream ACB cue scan",
                            "note": "base ACB exposes per-idol oneshot vocal cues",
                        },
                    }
                )
            if mix:
                layers.append(
                    {
                        "kind": "full-mix",
                        "files": [base_name],
                        "cue_names": mix,
                        "evidence": {
                            "source": "vgmstream ACB cue scan",
                            "note": "full-mix cue shares the base ACB",
                        },
                    }
                )
            for kind, label in (("preview", "preview"), ("soundcheck", "soundcheck")):
                cues = previews if kind == "preview" else soundchecks
                if cues:
                    layers.append(
                        {
                            "kind": kind,
                            "files": [base_name],
                            "cue_names": cues,
                            "evidence": {
                                "source": "vgmstream ACB cue scan",
                                "note": f"{label} cue alias in the base ACB",
                            },
                        }
                    )
        if code in idol_files:
            layers.append(
                {
                    "kind": "idol-vocal",
                    "files": sorted(idol_files[code]),
                    "cue_names": [],
                    "evidence": {
                        "source": "RAW filename pattern song3_<code>_<idol-code>.acb",
                        "note": "per-idol vocal ACB file; id verified against speaker dictionary",
                    },
                }
            )
        if code in backing_files:
            layers.append(
                {
                    "kind": "backing",
                    "files": sorted(backing_files[code]),
                    "cue_names": [],
                    "evidence": {
                        "source": "RAW filename pattern song3_<code>_bgm.acb",
                        "note": "instrumental backing ACB file",
                    },
                }
            )
        if not layers:
            layers.append(
                {
                    "kind": "full-mix",
                    "files": [base_name] if base_name else [],
                    "cue_names": [],
                    "evidence": {
                        "source": "RAW filename pattern song3_<code>.acb",
                        "note": "single base ACB without internal cue classification",
                    },
                }
            )
        songs[code] = {
            "song_code": code,
            "title": meta.get("title"),
            "base_file": base_name,
            "audio_layers": layers,
        }

    summary = {
        "acb_file_count": len(acb_files),
        "base_file_count": sum(
            1
            for acb in acb_files
            if len(acb.stem[len(SONG3_PREFIX):].split("_")) == 1
        ),
        "idol_vocal_file_count": sum(len(v) for v in idol_files.values()),
        "bgm_backing_file_count": sum(len(v) for v in backing_files.values()),
        "catalog_song_count": len(catalog_songs),
        "layered_song_count": len(layered),
        "oneshot_song_count": len(oneshot),
        "test_entity_count": len(test_entities),
    }

    return {
        "schema_version": 1,
        "sources": {
            "raw_audio_root": "RAW/audio",
            "music_catalog": "web_viewer/public/data/masterdata/music_catalog.json",
        },
        "summary": summary,
        "songs": songs,
        "extra_entities": test_entities,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    add_sources_config_argument(parser)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    sources = load_archive_sources(args.sources_config)
    raw_audio_root = (sources.raw_root / "audio").resolve()
    vgmstream = sources.vgmstream_file
    if not raw_audio_root.is_dir():
        raise FileNotFoundError(f"Missing RAW audio root: {raw_audio_root}")
    if not vgmstream.is_file():
        raise FileNotFoundError(f"Missing vgmstream: {vgmstream}")

    catalog = build_catalog(raw_audio_root, vgmstream, MUSIC_CATALOG)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.output} "
        f"({catalog['summary']['acb_file_count']} ACB files, "
        f"{catalog['summary']['catalog_song_count']} songs)"
    )


if __name__ == "__main__":
    main()
