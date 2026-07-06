#!/usr/bin/env python3
"""
Spatial Audit Script
====================
Scans compiled JSONs by category for pos_x, pos_y, idol_zoom, camera_zoom values
to determine the correct coordinate mapping and scaling rules.

Spatial issues this helps solve:
  1. Position mapping: are -200/0/200 the only game coordinates used?
  2. idol_zoom: what zoom values are used and where?
  3. camera_zoom: how does it interact with positions?
  4. Character default positions when idol_position isn't explicitly set.

Usage:
  cd web_viewer
  python tools/spatial_audit.py
"""

import json
import os
import glob
from collections import Counter, defaultdict

COMPILED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "compiled")


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def analyze_category(filepaths):
    counters = {
        "pos_x": Counter(), "pos_y": Counter(), "idol_zoom": Counter(),
        "cam_zoom": Counter(), "cam_ox": Counter(), "cam_oy": Counter(),
        "pos_xy_pair": Counter(), "position_field": Counter(),
        "idol_zoom_per_char": defaultdict(list),
    }
    stats = {
        "files": 0, "steps": 0, "spine_states": 0,
        "files_with_zoom": 0, "files_with_cam": 0,
        "pos_w_posx_no_position": 0, "pos_w_position_no_posx": 0, "pos_both": 0,
        "pos_has_position": 0,
        "steps_with_spines": 0, "steps_with_multi_spine": 0,
    }
    idol_positions = defaultdict(list)

    for fpath in filepaths:
        try:
            data = load_json(fpath)
        except Exception:
            continue
        steps = data.get("steps", [])
        if not steps:
            continue
        stats["files"] += 1
        stats["steps"] += len(steps)
        has_zoom = False
        has_cam = False

        for step in steps:
            state = step.get("state", {}) or {}
            spines = state.get("spines", [])
            if isinstance(spines, dict):
                spines = list(spines.values())
            if not spines:
                continue
            stats["steps_with_spines"] += 1
            if len([s for s in spines if isinstance(s, dict) and s.get("visible", False)]) >= 2:
                stats["steps_with_multi_spine"] += 1

            for sp in spines:
                if not isinstance(sp, dict):
                    continue
                stats["spine_states"] += 1
                px = sp.get("pos_x")
                py = sp.get("pos_y")
                zoom = sp.get("idol_zoom")
                pos = sp.get("position")
                sid = sp.get("id", sp.get("idol_id", "?"))

                if px is not None:
                    counters["pos_x"][px] += 1
                if py is not None:
                    counters["pos_y"][py] += 1
                if px is not None and py is not None:
                    counters["pos_xy_pair"][(px, py)] += 1
                if sid and px is not None:
                    idol_positions[sid].append((px, py))

                if zoom is not None:
                    counters["idol_zoom"][zoom] += 1
                    counters["idol_zoom_per_char"][sid].append(zoom)
                    has_zoom = True

                if pos is not None:
                    counters["position_field"][pos] += 1
                    stats["pos_has_position"] += 1
                if pos is not None and px is None:
                    stats["pos_w_position_no_posx"] += 1
                elif pos is None and px is not None:
                    stats["pos_w_posx_no_position"] += 1
                elif pos is not None and px is not None:
                    stats["pos_both"] += 1

            cam = state.get("camera_zoom")
            if cam:
                counters["cam_zoom"][cam.get("zoom", 1.0)] += 1
                counters["cam_ox"][cam.get("offset_x", 0)] += 1
                counters["cam_oy"][cam.get("offset_y", 0)] += 1
                has_cam = True

        if has_zoom:
            stats["files_with_zoom"] += 1
        if has_cam:
            stats["files_with_cam"] += 1

    return counters, stats, idol_positions


def print_report(category, counters, stats, idol_positions):
    print(f"\n{'=' * 70}")
    print(f"  {category}")
    print(f"{'=' * 70}")
    print(f"  Files: {stats['files']}, Steps: {stats['steps']}, "
          f"Steps w/ spines: {stats['steps_with_spines']}, "
          f"Multi-spine: {stats['steps_with_multi_spine']}")
    print(f"  Spine states: {stats['spine_states']}")
    print(f"  Files w/ idol_zoom: {stats['files_with_zoom']}, w/ camera_zoom: {stats['files_with_cam']}")
    print()

    if counters["pos_x"]:
        total = sum(counters["pos_x"].values())
        print(f"  pos_x ({total} total):")
        for v, c in sorted(counters["pos_x"].items(), key=lambda x: -x[1]):
            print(f"    {v:>8}  → {c:>6} ({c/total*100:5.1f}%)")
    if counters["pos_y"]:
        total = sum(counters["pos_y"].values())
        print(f"  pos_y ({total} total):")
        for v, c in sorted(counters["pos_y"].items(), key=lambda x: -x[1]):
            print(f"    {v:>8}  → {c:>6} ({c/total*100:5.1f}%)")
    if counters["pos_xy_pair"]:
        print(f"  Common (pos_x, pos_y) pairs:")
        for (px, py), c in sorted(counters["pos_xy_pair"].items(), key=lambda x: -x[1])[:15]:
            tag = ""
            if px == 0 and py == 0: tag = "  ← center"
            elif px == -200 and py == 0: tag = "  ← dual-left"
            elif px == 200 and py == 0: tag = "  ← dual-right"
            elif px in (-350, -300) and py == 0: tag = "  ← multi-left"
            elif px in (350, 300) and py == 0: tag = "  ← multi-right"
            elif py in (-40, -50, -60, -80, -100, -150):
                tag = f"  ← up {py}"
            print(f"    ({px:>5},{py:>5}) x{c} {tag}")

    if counters["idol_zoom"]:
        total = sum(counters["idol_zoom"].values())
        print(f"\n  idol_zoom ({total} total):")
        for v, c in sorted(counters["idol_zoom"].items(), key=lambda x: -x[1]):
            eff = ""
            if v < 0.5: eff = " ← FAR OUT"
            elif v < 0.8: eff = " ← zoom out"
            elif v > 1.5: eff = " ← zoom IN"
            elif v > 1.2: eff = " ← zoom in"
            print(f"    {v:>8}  → {c:>6} ({c/total*100:5.1f}%){eff}")
        # Per-character zoom
        for sid, zooms in sorted(counters["idol_zoom_per_char"].items()):
            print(f"    {sid}: avg_zoom={sum(zooms)/len(zooms):.3f} n={len(zooms)} range=[{min(zooms):.2f},{max(zooms):.2f}]")

    if counters["cam_zoom"]:
        total = sum(counters["cam_zoom"].values())
        print(f"\n  camera_zoom ({total} total):")
        for v, c in sorted(counters["cam_zoom"].items(), key=lambda x: -x[1]):
            print(f"    zoom={v:>5} → {c:>6} ({c/total*100:5.1f}%)")
        total_ox = sum(counters["cam_ox"].values())
        print(f"  camera offset_x:")
        for v, c in sorted(counters["cam_ox"].items(), key=lambda x: -x[1]):
            print(f"    {v:>8} → {c:>6} ({c/total_ox*100:5.1f}%)")
        total_oy = sum(counters["cam_oy"].values())
        print(f"  camera offset_y:")
        for v, c in sorted(counters["cam_oy"].items(), key=lambda x: -x[1]):
            print(f"    {v:>8} → {c:>6} ({c/total_oy*100:5.1f}%)")

    print()
    pos_w_posx = stats["pos_w_posx_no_position"]
    pos_w_position = stats["pos_w_position_no_posx"]
    pos_both = stats["pos_both"]
    print(f"  position field stats:")
    print(f"    position without pos_x: {stats['pos_w_position_no_posx']}")
    print(f"    pos_x without position: {stats['pos_w_posx_no_position']}")
    print(f"    both set: {stats['pos_both']}")
    if counters["position_field"]:
        print(f"    position field values:")
        for v, c in sorted(counters["position_field"].items(), key=lambda x: -x[1]):
            print(f"      pos={v} → {c}")

    # Per-idol position profile (only for this category)
    if idol_positions:
        print(f"\n  Per-idol position profile (10+ samples):")
        for sid in sorted(idol_positions.keys()):
            positions = idol_positions[sid]
            if len(positions) < 10:
                continue
            avg_x = sum(p[0] for p in positions) / len(positions)
            avg_y = sum(p[1] for p in positions) / len(positions)
            xs = sorted(set(p[0] for p in positions))
            ys = sorted(set(p[1] for p in positions))
            print(f"    {sid}: n={len(positions):>3} avg=({avg_x:6.1f},{avg_y:6.1f}) "
                  f"x={xs[:5]}{'...' if len(xs)>5 else ''} "
                  f"y={ys[:4]}{'...' if len(ys)>4 else ''}")


def main():
    all_jsons = [f for f in glob.glob(os.path.join(COMPILED_DIR, "*.json"))
                 if os.path.basename(f) not in ("index.json", "voice_index.json")]

    categories = [
        ("1_1_ ep-zero", [f for f in all_jsons if os.path.basename(f).startswith("1_1_")]),
        ("1_2_ idol", [f for f in all_jsons if os.path.basename(f).startswith("1_2_")]),
        ("1_3_ event", [f for f in all_jsons if os.path.basename(f).startswith("1_3_")]),
        ("1_4_ main", [f for f in all_jsons if os.path.basename(f).startswith("1_4_")]),
        ("5_01 comu", [f for f in all_jsons if os.path.basename(f).startswith("5_01_")]),
        ("5_02 gift", [f for f in all_jsons if os.path.basename(f).startswith("5_02_")]),
        ("5_03 other", [f for f in all_jsons if os.path.basename(f).startswith("5_03_")]),
    ]

    # Also analyze THE (1_1_013the) specifically for multi-char positioning
    the_files = [f for f in all_jsons if "013the" in os.path.basename(f)]

    print("Category file counts:")
    for name, files in categories:
        print(f"  {name}: {len(files)}")
    print(f"  013the specific: {len(the_files)}")
    print()

    # Global aggregators
    global_counters = {
        "pos_x": Counter(), "pos_y": Counter(), "idol_zoom": Counter(),
        "cam_zoom": Counter(), "cam_ox": Counter(), "cam_oy": Counter(),
        "pos_xy_pair": Counter(),
    }
    all_idol_positions = defaultdict(list)

    for name, files in categories:
        if not files:
            continue
        counters, stats, idol_positions = analyze_category(files)
        print_report(name, counters, stats, idol_positions)
        # Merge into global
        for k in ("pos_x", "pos_y", "idol_zoom", "cam_zoom", "cam_ox", "cam_oy", "pos_xy_pair"):
            global_counters[k] += counters[k]
        for k, v in idol_positions.items():
            all_idol_positions[k].extend(v)

    # Global summary
    print(f"\n{'=' * 70}")
    print(f"  GLOBAL SUMMARY (all categories)")
    print(f"{'=' * 70}")
    for key in ("pos_x", "pos_y", "idol_zoom", "cam_zoom"):
        c = global_counters[key]
        if c:
            total = sum(c.values())
            print(f"\n  {key} ({total} total):")
            for v, cnt in sorted(c.items(), key=lambda x: -x[1]):
                print(f"    {v:>8}  → {cnt:>6} ({cnt/total*100:5.1f}%)")

    # Global idol position profile
    print(f"\n  Per-idol global position profile (50+ samples):")
    for sid in sorted(all_idol_positions.keys()):
        positions = all_idol_positions[sid]
        if len(positions) < 50:
            continue
        avg_x = sum(p[0] for p in positions) / len(positions)
        avg_y = sum(p[1] for p in positions) / len(positions)
        xs = sorted(set(p[0] for p in positions))
        ys = sorted(set(p[1] for p in positions))
        print(f"    {sid}: n={len(positions):>4} avg=({avg_x:7.1f},{avg_y:7.1f}) "
              f"x_range={xs[0]}..{xs[-1]} y_range={ys[0]}..{ys[-1]}")

    print("\nDone.")


if __name__ == "__main__":
    main()
