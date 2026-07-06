"""
Asset Migrator — copies UI assets and Spine models from source trees
into Vite public/assets/. Frontend never reads raw source directories.
"""

import os
import shutil
import glob

# ── Source paths ──────────────────────────────────────────────────
GS_ROOT = r"E:\BaiduNetdiskDownload\SideM\GS_Res\ALL_PHOTOS\assets\resources"
COMU_ROOT = r"E:\BaiduNetdiskDownload\SideM\story_viewer\extract_output\comu_costumes"
ASSETS_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..",
    "web_viewer", "public", "assets"
))

SOURCES = {
    "icons": {
        "src": os.path.join(GS_ROOT, "image", "image_chara", "image_chara_icon"),
        "dst": os.path.join(ASSETS_DIR, "idols", "icons"),
        "glob": "*.png",
    },
    "mobile_bg": {
        "src": os.path.join(GS_ROOT, "image", "image_chara", "image_chara_mobile_background"),
        "dst": os.path.join(ASSETS_DIR, "idols", "mobile_bg"),
        "glob": "*.png",
    },
    "event_logos": {
        "src": os.path.join(GS_ROOT, "event"),
        "dst": os.path.join(ASSETS_DIR, "events", "logos"),
        "glob": "**/image_event_logo_*.png",
    },
    "mobile_icons": {
        "src": os.path.join(GS_ROOT, "image", "image_chara", "image_chara_mobile_icon"),
        "dst": os.path.join(ASSETS_DIR, "idols", "mobile_icons"),
        "glob": "*.png",
    },
    "unit_mobile_bg": {
        "src": os.path.join(GS_ROOT, "image", "image_unit", "image_unit_mobile_background"),
        "dst": os.path.join(ASSETS_DIR, "units", "mobile_bg"),
        "glob": "*.png",
    },
    "emojis": {
        "src": os.path.join(GS_ROOT, "spriteatlas", "image_emoji"),
        "dst": os.path.join(ASSETS_DIR, "emojis"),
        "glob": "*.png",
    },
    "stamps": {
        "src": os.path.join(GS_ROOT, "image", "image_mobile_stamp"),
        "dst": os.path.join(ASSETS_DIR, "stamps"),
        "glob": "*.png",
    },
}


def copy_flat(src_dir: str, dst_dir: str, pattern: str) -> int:
    os.makedirs(dst_dir, exist_ok=True)
    if pattern.startswith("**/"):
        files = glob.glob(os.path.join(src_dir, pattern), recursive=True)
    else:
        files = glob.glob(os.path.join(src_dir, pattern))
    count = 0
    for fpath in sorted(files):
        name = os.path.basename(fpath)
        dst = os.path.join(dst_dir, name)
        shutil.copy2(fpath, dst)
        count += 1
    return count


# ── Spine copy ──────────────────────────────────────────────────

SPINE_ASSETS_DIR = os.path.join(ASSETS_DIR, "spines")

def copy_spine_models() -> int:
    """
    Copy each comu_costume model directory into public/assets/spines/{model_id}/.
    Each source directory contains:
      comu.atlas, comu.png, comu.skel, faces/*.png
    """
    os.makedirs(SPINE_ASSETS_DIR, exist_ok=True)
    count = 0

    entries = sorted(os.listdir(COMU_ROOT))
    for entry in entries:
        src_dir = os.path.join(COMU_ROOT, entry)
        if not os.path.isdir(src_dir):
            continue

        dst_dir = os.path.join(SPINE_ASSETS_DIR, entry)

        # Skip if already fully copied (all 3 core files present)
        if os.path.isdir(dst_dir) and all(
            os.path.isfile(os.path.join(dst_dir, f))
            for f in ("comu.skel", "comu.atlas", "comu.png")
        ):
            continue

        os.makedirs(dst_dir, exist_ok=True)

        # Copy core spine files
        for fn in ("comu.atlas", "comu.png", "comu.skel"):
            src_file = os.path.join(src_dir, fn)
            if os.path.isfile(src_file):
                shutil.copy2(src_file, os.path.join(dst_dir, fn))

        # Copy faces directory
        src_faces = os.path.join(src_dir, "faces")
        dst_faces = os.path.join(dst_dir, "faces")
        if os.path.isdir(src_faces):
            os.makedirs(dst_faces, exist_ok=True)
            for face_fn in os.listdir(src_faces):
                if face_fn.lower().endswith(".png"):
                    shutil.copy2(
                        os.path.join(src_faces, face_fn),
                        os.path.join(dst_faces, face_fn)
                    )

        count += 1

    return count


def main():
    print("=== Asset Migrator ===\n")

    for key, cfg in SOURCES.items():
        n = copy_flat(cfg["src"], cfg["dst"], cfg["glob"])
        print(f"  {key:15s}: {n:4d} files → {cfg['dst']}")

    print(f"\n  {'spines':15s}: copying from {COMU_ROOT} → {SPINE_ASSETS_DIR}")
    n = copy_spine_models()
    print(f"  {'spines':15s}: {n:4d} models → {SPINE_ASSETS_DIR}")

    print("\nDone.")


if __name__ == "__main__":
    main()
