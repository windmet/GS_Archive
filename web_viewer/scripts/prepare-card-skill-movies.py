#!/usr/bin/env python3
"""Decrypt the 124 card skill-cut-in USMs and publish web H.264 copies.

Each RAW/movie/skill_movie_<resource>.usm (CRI USM, 1200x640, no audio) is
demuxed with WannaCRI and re-encoded to a faststart MP4 plus a JPEG poster
under public/assets/card-skill-movies/ (ignored; media goes to R2). The
tracked index public/data/card_skill_movies.json pins every output to its
source hash so the read model can bind cards to it.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("backmonitor", PROJECT_ROOT / "scripts" / "prepare-live-chibi-backmonitor.py")
backmonitor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backmonitor)

OUTPUT_ROOT = PROJECT_ROOT / "public" / "assets" / "card-skill-movies"
INDEX_PATH = PROJECT_ROOT / "public" / "data" / "card_skill_movies.json"
RELATIONS_PATH = PROJECT_ROOT / "public" / "data" / "usm_relation_catalog.json"
# Full resolution keeps the illustration sharp; CRF 26 lands near 1.3 MB per 3-4 s clip.
CRF = "26"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def run(command: list[str], label: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise RuntimeError(f"{label} failed: {result.stderr[-2000:]}")


def encode(ffmpeg: str, source: Path, video: Path, poster: Path) -> None:
    temporary = video.with_name(f"{video.stem}.tmp.mp4")
    run([ffmpeg, "-y", "-v", "error", "-i", str(source), "-map", "0:v:0", "-an", "-c:v", "libx264",
         "-preset", "slow", "-crf", CRF, "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temporary)], f"encode {source.name}")
    temporary.replace(video)
    # The cut-in settles on the finished illustration; a late frame is the representative still.
    run([ffmpeg, "-y", "-v", "error", "-sseof", "-0.4", "-i", str(video), "-frames:v", "1", "-q:v", "5", str(poster)], f"poster {source.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    backmonitor.add_sources_config_argument(parser)
    parser.add_argument("--movie-root", type=Path)
    parser.add_argument("--wannacri-root", type=Path)
    parser.add_argument("--cri-key", default=backmonitor.DEFAULT_CRI_KEY)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", help="comma-separated resource ids, for trials")
    args = parser.parse_args()
    sources = backmonitor.load_archive_sources(args.sources_config)
    movie_root = (args.movie_root or sources.raw_root / "movie").resolve()
    ffmpeg = shutil.which(str(sources.ffmpeg_file) if sources.ffmpeg_file else "ffmpeg")
    ffprobe = shutil.which(str(sources.ffprobe_file) if sources.ffprobe_file else "ffprobe")
    if not ffmpeg or not ffprobe:
        raise SystemExit("ffmpeg and ffprobe are required")
    wannacri_root = backmonitor.locate_wannacri(args.wannacri_root, sources.wannacri_root)
    if wannacri_root == Path():
        raise SystemExit("WannaCRI is not importable; pass --wannacri-root or set SIDEM_WANNACRI_ROOT")

    relations = json.loads(RELATIONS_PATH.read_text(encoding="utf-8"))
    entries = [entry for entry in relations["entries"] if entry.get("family") == "skill-movie"]
    only = set(args.only.split(",")) if args.only else None
    previous = json.loads(INDEX_PATH.read_text(encoding="utf-8")).get("movies", {}) if INDEX_PATH.exists() else {}
    movies = {}
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for entry in sorted(entries, key=lambda item: item["id"]):
        relation = entry["mapping"]["masterdata_relation"]
        resource = relation["resource_id"]
        if only and resource not in only:
            if resource in previous:
                movies[resource] = previous[resource]
            continue
        source = movie_root / entry["raw"]["filename"]
        source_hash = sha256(source)
        if source_hash != entry["raw"]["sha256"]:
            raise SystemExit(f"{source.name}: RAW bytes differ from usm_relation_catalog")
        video, poster = OUTPUT_ROOT / f"{resource}.mp4", OUTPUT_ROOT / f"{resource}.jpg"
        cached = previous.get(resource)
        if args.force or not (cached and cached["source_sha256"] == source_hash and video.exists() and poster.exists()
                              and sha256(video) == cached["sha256"]):
            with tempfile.TemporaryDirectory(prefix="skill-usm-") as work:
                backmonitor.demux_usm(source, Path(work), args.cri_key, wannacri_root)
                encode(ffmpeg, backmonitor.demuxed_stream(Path(work), "videos"), video, poster)
        probe = backmonitor.probe_video(ffprobe, video)
        movies[resource] = {
            "url": f"/assets/card-skill-movies/{resource}.mp4",
            "poster": f"/assets/card-skill-movies/{resource}.jpg",
            "bytes": video.stat().st_size,
            "sha256": sha256(video),
            "poster_sha256": sha256(poster),
            "width": probe["width"], "height": probe["height"],
            "duration_ms": probe["duration"],
            "card_ids": relation["card_ids"],
            "source": entry["raw"]["relative_path"],
            "source_sha256": source_hash,
        }
        print(f"{resource}: {movies[resource]['bytes'] / 1e6:.2f} MB, {movies[resource]['duration_ms']} ms")
    index = {
        "schema_version": 1,
        "encoding": f"libx264 crf {CRF} preset slow, source resolution, no audio, faststart; poster = frame 0.4 s before the end",
        "summary": {"movies": len(movies), "bytes": sum(movie["bytes"] for movie in movies.values())},
        "movies": movies,
    }
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(movies)} movies, {index['summary']['bytes'] / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
