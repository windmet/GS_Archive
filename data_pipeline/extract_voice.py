"""
Extract all voice ACB files to flat M4A directory using vgmstream + ffmpeg.

Strategy:
  vgmstream writes WAV → ffmpeg encodes to M4A (AAC) → delete temp WAV.
  WAV intermediate is more reliable than pipe for batch processing.
  M4A offers universal browser/mobile compatibility (vs OGG's gaps on iOS/Safari).

Output:
  public/assets/voice/{cue_name}.m4a  — flat structure
  public/data/compiled/voice_index.json — cue → source mapping
"""

import subprocess
import json
import os
import sys
import tempfile

VGSTREAM = r"E:\Program Files\vgmstream-win64\vgmstream-cli.exe"
FFMPEG = r"D:\Program Files\ffmpeg\bin\ffmpeg.exe"
VOICE_ROOT = r"E:\BaiduNetdiskDownload\SideM\GS_Res\Voice"
OUTPUT_DIR = os.path.abspath(
    r"E:\Web_build\SideM_Archived\web_viewer\public\assets\voice"
)
INDEX_PATH = os.path.abspath(
    r"E:\Web_build\SideM_Archived\web_viewer\public\data\compiled\voice_index.json"
)
MAX_SUBSONGS = 200


def get_subsong_name(acb_path: str, subsong: int) -> str | None:
    try:
        result = subprocess.run(
            [VGSTREAM, "-m", "-s", str(subsong), acb_path],
            capture_output=True, text=True, timeout=15,
        )
        for line in result.stdout.splitlines():
            if "stream name:" in line:
                return line.split("stream name:")[1].strip()
    except Exception:
        pass
    return None


def extract_subsong(acb_path: str, subsong: int, out_m4a: str) -> bool:
    """vgmstream → WAV tempfile → ffmpeg → M4A (AAC)."""
    # Use tempfile for unique WAV path
    fd, tmp_wav = tempfile.mkstemp(suffix=".wav", prefix="voice_")
    os.close(fd)
    try:
        # Step 1: vgmstream → WAV
        r1 = subprocess.run(
            [VGSTREAM, "-o", tmp_wav, "-s", str(subsong), acb_path],
            capture_output=True, timeout=120,
        )
        if r1.returncode != 0:
            sys.stderr.write(f"  vgmstream err: {r1.stderr.decode('utf-8', errors='replace')[:200]}\n")
            return False
        if not os.path.exists(tmp_wav) or os.path.getsize(tmp_wav) == 0:
            sys.stderr.write("  vgmstream: no output file\n")
            return False

        # Step 2: ffmpeg → M4A (AAC — universal browser/device support)
        r2 = subprocess.run(
            [FFMPEG, "-y", "-i", tmp_wav,
             "-c:a", "aac", "-b:a", "128k", out_m4a],
            capture_output=True, timeout=120,
        )
        if r2.returncode != 0:
            sys.stderr.write(f"  ffmpeg err: {r2.stderr.decode('utf-8', errors='replace')[:200]}\n")
            return False
        return True

    except Exception as e:
        sys.stderr.write(f"  exception: {e}\n")
        if isinstance(e, FileNotFoundError):
            sys.stderr.write(f"  check paths:\n    VGSTREAM={VGSTREAM}\n    FFMPEG={FFMPEG}\n")
        return False
    finally:
        if os.path.exists(tmp_wav):
            os.remove(tmp_wav)


def process_acb(acb_path: str, index: dict, stats: dict):
    rel = os.path.relpath(acb_path, VOICE_ROOT)
    count = 0
    for subsong in range(1, MAX_SUBSONGS + 1):
        name = get_subsong_name(acb_path, subsong)
        if not name:
            break

        m4a_name = f"{name}.m4a"
        out_path = os.path.join(OUTPUT_DIR, m4a_name)

        if os.path.exists(out_path):
            index[m4a_name] = rel
            count += 1
            continue

        if count == 0:
            print(f"  {rel}")
        print(f"    [{subsong:3d}] {m4a_name}", end="")
        if extract_subsong(acb_path, subsong, out_path):
            size = os.path.getsize(out_path)
            print(f"  OK ({size/1024:.1f} KB)")
            index[m4a_name] = rel
            count += 1
        else:
            print("  FAILED")

    stats["total"] += count
    stats["files"] += 1


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    index = {}
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            index = data.get("index", data) if isinstance(data, dict) else {}

    stats = {"total": len(index), "files": 0}

    all_acbs = []
    for dirpath, _, filenames in os.walk(VOICE_ROOT):
        for fn in filenames:
            if fn.endswith(".acb"):
                all_acbs.append(os.path.join(dirpath, fn))

    print(f"Found {len(all_acbs)} ACB files. Resuming from {len(index)} existing...\n")

    for i, acb_path in enumerate(all_acbs):
        process_acb(acb_path, index, stats)

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump({"total": stats["total"], "index": index}, f, ensure_ascii=False, indent=2)

    print(f"\nDone. {stats['total']} voice files → {OUTPUT_DIR}")
    print(f"Index: {INDEX_PATH}")


if __name__ == "__main__":
    main()
