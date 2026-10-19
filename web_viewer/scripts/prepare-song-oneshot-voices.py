#!/usr/bin/env python3
"""Decode the per-idol "oneshot" lines that some songs leave a vocal gap for.

FLASH LIGHT and precious love ship 49 cues each (song3_<code>_oneshot_<idol>) in
the song ACB. The song's live-effect CSV has a Unit_serif row: at that time the
game plays value2 + the idol code of the deck card at slot value1.

Client evidence (libil2cpp, Ghidra read-only):
  Unit_serifLiveEffectTypeExecuter.PlayEffect          RVA 0x19C6B28
    deckLiveCards.ToList().ElementAtOrDefault(value1 - 1).idolData
    -> CueSheetNamePair(song cue sheet, value2 + idol code) -> SoundManager.PlayVoice
  LiveDeckData.get_deckLiveCards                       RVA 0x1D69030  (liveDeckSlots in order)
  UserDeckData.get_centerUserCardData                  RVA 0x276F798  (FirstOrDefault slot)
So value1 = 1 is the deck's center card. Stage position and the singers are not consulted.

The clips go to public/assets/live-chibi/oneshot/<song>/<idol>.m4a (ignored media);
the tracked manifest public/data/song_oneshot_voices.json records triggers and sources.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT.parent / "data_pipeline"))
from archive_paths import add_sources_config_argument, load_archive_sources  # noqa: E402

CATALOG = PROJECT_ROOT / "public" / "data" / "song_catalog.json"
MANIFEST = PROJECT_ROOT / "public" / "data" / "song_oneshot_voices.json"
OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "live-chibi" / "oneshot"
URL_ROOT = "/assets/live-chibi/oneshot"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stream_names(vgmstream: Path, acb: Path) -> dict[str, dict]:
    first = json.loads(subprocess.run([str(vgmstream), "-m", "-I", str(acb)], check=True, capture_output=True, text=True, encoding="utf-8").stdout)
    total = first["streamInfo"]["total"]
    streams = {}
    for index in range(1, total + 1):
        info = json.loads(subprocess.run([str(vgmstream), "-m", "-I", "-s", str(index), str(acb)], check=True, capture_output=True, text=True, encoding="utf-8").stdout)
        for name in (info["streamInfo"].get("name") or "").split("; "):
            streams[name] = {"index": index, "samples": info["numberOfSamples"], "sample_rate": info["sampleRate"], "channels": info["channels"]}
    return streams


def decode(vgmstream: Path, ffmpeg: str, acb: Path, index: int, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    decoder = subprocess.Popen([str(vgmstream), "-s", str(index), "-p", str(acb)], stdout=subprocess.PIPE)
    assert decoder.stdout is not None
    encoder = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "wav", "-i", "pipe:0", "-vn", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(destination)],
        stdin=decoder.stdout,
    )
    decoder.stdout.close()
    if decoder.wait() != 0 or encoder.returncode != 0:
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"decode failed: {acb} #{index}")


def serif_triggers(bundle: Path) -> list[dict]:
    import UnityPy

    triggers = {}
    for obj in UnityPy.load(str(bundle)).objects:
        if obj.type.name != "TextAsset":
            continue
        asset = obj.read()
        if "_live_effect" not in asset.m_Name:
            continue
        script = asset.m_Script if isinstance(asset.m_Script, str) else asset.m_Script.decode("utf-8")
        for row in csv.reader(io.StringIO(script)):
            if len(row) > 3 and row[0].strip() == "Unit_serif":
                key = (int(float(row[1])), int(row[2]), row[3].strip())
                # The precious love CSV repeats its row; the game would start the same cue twice at once.
                triggers.setdefault(key, {"time_ms": key[0], "deck_slot": key[1], "cue_prefix": key[2], "source_csv": f"{asset.m_Name}.csv", "rows": 0})["rows"] += 1
    return sorted(triggers.values(), key=lambda t: t["time_ms"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    add_sources_config_argument(parser)
    parser.add_argument("--force", action="store_true", help="re-encode clips that already exist")
    args = parser.parse_args()
    sources = load_archive_sources(args.sources_config)
    vgmstream = sources.vgmstream_file
    ffmpeg = os.environ.get("FFMPEG") or (str(sources.ffmpeg_file) if sources.ffmpeg_file else "ffmpeg")
    if not vgmstream or not vgmstream.is_file() or not shutil.which(ffmpeg):
        raise FileNotFoundError("vgmstream / ffmpeg not found; check config/archive_sources.local.json")

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    songs = {}
    for code, song in sorted(catalog["songs"].items()):
        idols = song.get("audio", {}).get("oneshot_idol_codes") or []
        if not idols:
            continue
        acb = sources.raw_root / "audio" / f"song3_{code}.acb"
        bundle = sources.raw_root / "asset" / f"song_{code}.unity3d"
        triggers = serif_triggers(bundle)
        if not triggers:
            raise ValueError(f"{code}: oneshot cues but no Unit_serif row")
        streams = stream_names(vgmstream, acb)
        clips = {}
        for trigger in triggers:
            for idol in idols:
                cue = f"{trigger['cue_prefix']}{idol}"
                stream = streams.get(cue)
                if not stream:
                    raise ValueError(f"{code}: ACB has no {cue}")
                destination = OUTPUT_ROOT / code / f"{idol}.m4a"
                if args.force or not destination.is_file():
                    decode(vgmstream, ffmpeg, acb, stream["index"], destination)
                clips[idol] = {
                    "cue": cue,
                    "url": f"{URL_ROOT}/{code}/{idol}.m4a",
                    "subsong": stream["index"],
                    "duration_seconds": round(stream["samples"] / stream["sample_rate"], 6),
                    "bytes": destination.stat().st_size,
                    "sha256": sha256(destination),
                }
        songs[code] = {
            "title": song["title"],
            "source": {"acb": f"RAW/audio/{acb.name}", "acb_sha256": sha256(acb), "bundle": f"RAW/asset/{bundle.name}", "bundle_sha256": sha256(bundle)},
            "triggers": triggers,
            "clips": clips,
        }
        print(f"{code}: {len(triggers)} trigger(s) at {[t['time_ms'] for t in triggers]} ms, {len(clips)} clips")

    manifest = {
        "schema_version": 1,
        "status": "experimental",
        "rule": {
            "selector": "deck_slot",
            "summary": "Unit_serif 事件时间点播放编成第 value1 槽（1 = center 卡）偶像的 oneshot；与舞台站位和演唱成员无关。",
            "evidence": [
                "Unit_serifLiveEffectTypeExecuter.PlayEffect RVA 0x19C6B28",
                "LiveDeckData.get_deckLiveCards RVA 0x1D69030",
                "UserDeckData.get_centerUserCardData RVA 0x276F798",
            ],
        },
        "songs": songs,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
