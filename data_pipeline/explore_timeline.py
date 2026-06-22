"""
explore_timeline.py — Explore raw JSON for mid-sentence timeline event patterns.

Analyzes inter-text command intervals to find delayed commands
(idol_face, idol_animation with delay > 0) that should become timeline events.
"""
import json
import os
import re
from collections import defaultdict

SCENARIO_ROOT = r"E:\BaiduNetdiskDownload\SideM\scripts\scenariodata"

TIME_CMDS = {"idol_face", "idol_animation", "idol_neckanimation", "wait"}

def explore_file(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        raw = json.load(f)
    commands = raw.get("Command", [])

    results = []
    prev_text_idx = -1
    prev_text_type = None

    for i, cmd in enumerate(commands):
        ctype = cmd.get("Type", "")
        if ctype in ("text", "talk_text", "phone_text"):
            if prev_text_idx >= 0:
                between = commands[prev_text_idx + 1:i]

                # Check for delayed commands
                delayed = []
                for b in between:
                    bt = b.get("Type", "")
                    bv = b.get("Values", [])
                    if bt in ("idol_face", "idol_animation", "idol_neckanimation"):
                        delay = float(bv[1]) if len(bv) > 1 and bv[1] else 0
                        if delay > 0:
                            delayed.append({
                                "idx": prev_text_idx + 1 + between.index(b),
                                "type": bt,
                                "delay": delay,
                                "chara": bv[0] if len(bv) > 0 else "",
                                "value": bv[2] if len(bv) > 2 else "",
                            })
                    elif bt == "wait":
                        try:
                            wait_val = float(bv[0]) if bv and bv[0] else 0
                        except (ValueError, IndexError):
                            wait_val = 0
                        delayed.append({
                            "idx": prev_text_idx + 1 + between.index(b),
                            "type": bt,
                            "delay": wait_val,
                        })

                if delayed:
                    prev_text = commands[prev_text_idx]
                    results.append({
                        "file": os.path.basename(filepath),
                        "prev_type": prev_text_type,
                        "text_before": prev_text.get("Values", ["", ""])[1][:40] if len(prev_text.get("Values", [])) > 1 else "",
                        "text_after": cmd.get("Values", ["", ""])[1][:40] if len(cmd.get("Values", [])) > 1 else "",
                        "voice_before": prev_text.get("Values", [])[3] if len(prev_text.get("Values", [])) > 3 else "",
                        "voice_after": cmd.get("Values", [])[3] if len(cmd.get("Values", [])) > 3 else "",
                        "delayed": delayed,
                    })

            prev_text_idx = i
            prev_text_type = ctype

    return results


def main():
    all_results = []
    dirs = sorted(os.listdir(SCENARIO_ROOT))

    for entry in dirs:
        full_dir = os.path.join(SCENARIO_ROOT, entry)
        if not os.path.isdir(full_dir):
            continue
        for fn in sorted(os.listdir(full_dir)):
            if not fn.endswith(".json"):
                continue
            filepath = os.path.join(full_dir, fn)
            try:
                results = explore_file(filepath)
                all_results.extend(results)
            except Exception as e:
                print(f"  !! {entry}/{fn}: {e}")

    # Summary stats
    text_cmds = sum(1 for r in all_results for _ in [1])
    total_delayed = sum(len(r["delayed"]) for r in all_results)
    files_with_timeline = len(set(r["file"] for r in all_results))

    print(f"=== Timeline Analysis ===")
    print(f"Files scanned: {sum(len([f for f in os.listdir(os.path.join(SCENARIO_ROOT, d)) if f.endswith('.json')]) for d in dirs if os.path.isdir(os.path.join(SCENARIO_ROOT, d)))}")
    print(f"Inter-text intervals with delayed commands: {len(all_results)}")
    print(f"Files affected: {files_with_timeline}")
    print(f"Total delayed commands: {total_delayed}")

    # Type breakdown
    type_counts = defaultdict(int)
    for r in all_results:
        for d in r["delayed"]:
            type_counts[d["type"]] += 1
    print(f"\n--- Command type breakdown ---")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")

    # Delay value distribution
    delays = []
    for r in all_results:
        for d in r["delayed"]:
            if "delay" in d:
                delays.append(d["delay"])
    if delays:
        print(f"\n--- Delay stats (seconds) ---")
        print(f"  Min: {min(delays):.1f}, Max: {max(delays):.1f}, Avg: {sum(delays)/len(delays):.1f}")
        print(f"  Unique delays: {sorted(set(delays))[:20]}{'...' if len(set(delays)) > 20 else ''}")

    # Print sample patterns
    print(f"\n--- Sample patterns (first 10) ---")
    for i, r in enumerate(all_results[:10]):
        print(f"\n[{i+1}] {r['file']} ({r['prev_type']})")
        print(f"  Prev voice: {r['voice_before']} → Next voice: {r['voice_after']}")
        print(f"  “{r['text_before']}”")
        print(f"  → “{r['text_after']}”")
        for d in r["delayed"]:
            if d["type"] == "wait":
                print(f"    wait {d['delay']}s")
            else:
                print(f"    +{d['delay']:.1f}s  {d['type']:20s}  {d['chara']:10s} = {d['value']}")

    print(f"\n=== End ===")


if __name__ == "__main__":
    main()
