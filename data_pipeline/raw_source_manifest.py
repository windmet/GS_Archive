"""Build a reproducible manifest for an extracted SideM RAW archive.

The source directory is treated as read-only. Outputs are written elsewhere so
the extracted archive remains byte-for-byte comparable with RAW.7z.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


EXPECTED_SECTIONS = {"asset", "audio", "movie"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument(
        "--archive-volume",
        type=Path,
        action="append",
        default=[],
        help="Optional RAW.7z volume to hash; repeat for every volume.",
    )
    parser.add_argument("--source-id", default="sidem-growing-stars-raw")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_root = args.raw_root.resolve()
    if not raw_root.is_dir():
        raise FileNotFoundError(raw_root)

    files = sorted(
        (path for path in raw_root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(raw_root).as_posix(),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)

    section_counts: Counter[str] = Counter()
    extension_counts: Counter[str] = Counter()
    total_size = 0

    with args.output.open("w", encoding="utf-8", newline="\n") as target:
        for path in files:
            relative = path.relative_to(raw_root).as_posix()
            parts = Path(relative).parts
            section = parts[0] if len(parts) > 1 and parts[0] in EXPECTED_SECTIONS else "root"
            stat = path.stat()
            record = {
                "source_id": args.source_id,
                "relative_path": relative,
                "section": section,
                "extension": path.suffix.lower(),
                "size": stat.st_size,
                "mtime_utc": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
                "sha256": sha256_file(path),
            }
            target.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
            section_counts[section] += 1
            extension_counts[path.suffix.lower() or "<none>"] += 1
            total_size += stat.st_size

    archive_volumes = []
    for volume in args.archive_volume:
        resolved = volume.resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)
        archive_volumes.append(
            {
                "path": str(resolved),
                "size": resolved.stat().st_size,
                "sha256": sha256_file(resolved),
            }
        )

    summary = {
        "schema_version": 1,
        "source_id": args.source_id,
        "raw_root": str(raw_root),
        "file_count": len(files),
        "total_size": total_size,
        "section_counts": dict(sorted(section_counts.items())),
        "extension_counts": dict(sorted(extension_counts.items())),
        "archive_volumes": archive_volumes,
        "manifest": str(args.output.resolve()),
    }
    args.summary.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
