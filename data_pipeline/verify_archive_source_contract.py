"""Source-only fixture for archive path and input-state contracts."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from archive_paths import load_archive_sources
from masterdata_extract import decode_masterdata_input, xor_decode


SCRIPT = Path(__file__).resolve().parent / "raw_source_manifest.py"


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="sidem-archive-source-contract-") as temp:
        root = Path(temp)
        configured_raw = root / "configured" / "RAW"
        override_raw = root / "override" / "RAW"
        for raw_root, marker in (
            (configured_raw, b"configured"),
            (override_raw, b"override"),
        ):
            write(raw_root / "asset" / "fixture.unity3d", marker + b"-asset")
            write(raw_root / "audio" / "fixture.acb", marker + b"-audio")
            write(raw_root / "movie" / "fixture.usm", marker + b"-movie")
            write(raw_root / "asset_url.txt", marker + b"-metadata")

        source_bytes = b"fixture masterdata source"
        decoded_bytes = xor_decode(source_bytes)
        source_path = root / "masterdata" / "client_master_data"
        decoded_path = root / "work" / "client_master_data.decoded.pb"
        vgmstream_path = root / "tools" / "vgmstream-cli.exe"
        ffmpeg_path = root / "tools" / "ffmpeg.exe"
        ffprobe_path = root / "tools" / "ffprobe.exe"
        wannacri_root = root / "tools" / "wannacri-runtime"
        write(source_path, source_bytes)
        write(decoded_path, decoded_bytes)
        for tool_path in (vgmstream_path, ffmpeg_path, ffprobe_path):
            write(tool_path, b"fixture executable")
        write(wannacri_root / "wannacri" / "__init__.py", b"fixture package")

        sha = lambda value: hashlib.sha256(value).hexdigest()
        config_path = root / "archive_sources.json"
        config_path.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "archive_root": str(root),
                    "raw_root": str(configured_raw.relative_to(root)),
                    "masterdata_source_file": str(source_path.relative_to(root)),
                    "masterdata_source_sha256": sha(source_bytes),
                    "masterdata_decoded_file": str(decoded_path.relative_to(root)),
                    "masterdata_decoded_sha256": sha(decoded_bytes),
                    "legacy_root": None,
                    "inventory_root": "inventory",
                    "workspace_root": "work",
                    "derived_root": "derived",
                    "publish_root": "publish",
                    "vgmstream_file": str(vgmstream_path.relative_to(root)),
                    "ffmpeg_file": str(ffmpeg_path.relative_to(root)),
                    "ffprobe_file": str(ffprobe_path.relative_to(root)),
                    "wannacri_root": str(wannacri_root.relative_to(root)),
                }
            )
            + "\n",
            encoding="utf-8",
        )

        sources = load_archive_sources(config_path)
        assert sources.raw_root == configured_raw.resolve()
        assert sources.masterdata_input("xor") == source_path.resolve()
        assert sources.masterdata_input("decoded") == decoded_path.resolve()
        assert sources.tool_file("vgmstream") == vgmstream_path.resolve()
        assert sources.tool_file("ffmpeg") == ffmpeg_path.resolve()
        assert sources.tool_file("ffprobe") == ffprobe_path.resolve()
        assert sources.wannacri_root == wannacri_root.resolve()
        assert sources.published_path("data", "masterdata", "card_index.json") == (
            root / "publish" / "data" / "masterdata" / "card_index.json"
        ).resolve()
        assert sources.inventory_path("background", "coverage.json") == (
            root / "inventory" / "background" / "coverage.json"
        ).resolve()
        assert sources.inventory_path(
            "character-image-candidate", "event_story_visual", "002sht"
        ) == (
            root
            / "inventory"
            / "character-image-candidate"
            / "event_story_visual"
            / "002sht"
        ).resolve()
        assert (
            decode_masterdata_input(source_bytes, "xor")
            == decoded_bytes
        )
        assert (
            decode_masterdata_input(decoded_bytes, "decoded")
            == decoded_bytes
        )
        assert decode_masterdata_input(decoded_bytes, "decoded") != xor_decode(
            decoded_bytes
        )

        output = root / "result" / "files.jsonl"
        summary = root / "result" / "summary.json"
        subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--sources-config",
                str(config_path),
                "--raw-root",
                str(override_raw),
                "--output",
                str(output),
                "--summary",
                str(summary),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        report = json.loads(summary.read_text(encoding="utf-8"))
        records = [
            json.loads(line)
            for line in output.read_text(encoding="utf-8").splitlines()
        ]
        assert Path(report["raw_root"]) == override_raw.resolve()
        assert report["file_count"] == 4
        assert report["section_counts"] == {
            "asset": 1,
            "audio": 1,
            "movie": 1,
            "root": 1,
        }
        assert report["case_insensitive_duplicate_paths"] == []
        assert report["unexpected_files"] == []
        assert report["masterdata"]["xor"]["hash_matches_config"] is True
        assert report["masterdata"]["decoded"]["hash_matches_config"] is True
        assert {record["source_status"] for record in records} == {
            "archive-metadata",
            "raw-authoritative",
        }
        assert all(record["schema_version"] == 1 for record in records)

        forbidden_output = override_raw / "generated" / "files.jsonl"
        failed = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--sources-config",
                str(config_path),
                "--raw-root",
                str(override_raw),
                "--output",
                str(forbidden_output),
                "--summary",
                str(root / "result" / "forbidden-summary.json"),
            ],
            capture_output=True,
            text=True,
        )
        assert failed.returncode != 0
        assert "outside the read-only RAW root" in failed.stderr

        write(source_path, b"tampered source")
        mismatch = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--sources-config",
                str(config_path),
                "--raw-root",
                str(override_raw),
                "--output",
                str(root / "result" / "mismatch-files.jsonl"),
                "--summary",
                str(root / "result" / "mismatch-summary.json"),
            ],
            capture_output=True,
            text=True,
        )
        assert mismatch.returncode != 0
        assert "masterdata xor SHA-256 mismatch" in mismatch.stderr
        assert not (root / "result" / "mismatch-files.jsonl").exists()
        assert not (root / "result" / "mismatch-summary.json").exists()

    print("Archive source contract fixture passed.")


if __name__ == "__main__":
    main()
