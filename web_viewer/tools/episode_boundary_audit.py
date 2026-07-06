#!/usr/bin/env python3
"""
Episode Boundary Audit Script
==============================
Batch-scans all compiled scenario JSONs that have episodes[] metadata,
and reports for each episode boundary:
  - What state (bg, bgm, spines, camera, fade) exists at the first N steps
  - Whether state is explicitly set or carried from the previous episode
  - Patterns to inform "soft reset" rules at episode boundaries

Usage:
  cd web_viewer
  python tools/episode_boundary_audit.py [--head N] [--output report.md]
"""

import json
import os
import sys
import glob
from collections import defaultdict

COMPILED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "compiled")
HEAD_STEPS = 5  # How many steps to inspect at each episode start


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_visible_spines(spines):
    """Extract (idol_id, model) tuples for visible spines from state.spines list."""
    result = []
    if isinstance(spines, list):
        for sp in spines:
            if sp.get("visible", False):
                idol_id = sp.get("id", sp.get("idol_id", "?"))
                model = sp.get("model", "?")
                pos_x = sp.get("pos_x")
                pos_y = sp.get("pos_y")
                result.append((idol_id, model, pos_x, pos_y))
    elif isinstance(spines, dict):
        # Old format: dict of idol_id -> spine_state
        for k, v in spines.items():
            if isinstance(v, dict) and v.get("visible", False):
                result.append((k, v.get("model", "?"), v.get("pos_x"), v.get("pos_y")))
    return result


def summarize_step(step):
    """Return a compact dict summarizing the relevant state of one step."""
    state = step.get("state", {}) or {}
    sf = state.get("screen_fade")
    spines = get_visible_spines(state.get("spines", []))
    return {
        "step_id": step.get("step_id", step.get("index", "?")),
        "type": step.get("type", "?"),
        "bg": state.get("bg"),
        "bgm": state.get("bgm"),
        "bgm_volume": state.get("bgm_volume"),
        "fade": f"{sf['type']}({sf['duration']}s,{sf.get('color','#000')})" if sf else None,
        "visible_spines": [(s[0], s[1]) for s in spines],
        "spine_positions": {s[0]: (s[2], s[3]) for s in spines if s[2] is not None},
        "camera_zoom": state.get("camera_zoom"),
        "camera_filter": state.get("camera_filter"),
        "bg_color": state.get("bg_color"),
        "bg_dof": state.get("bg_dof"),
        "bgm_stop_fade": state.get("bgm_stop_fade"),
        "environmental": state.get("environmental"),
    }


def analyze_scenario(filepath):
    """Analyze one compiled scenario file and return episode boundary data."""
    data = load_json(filepath)
    if "episodes" not in data or not data["episodes"]:
        return None

    scenario_id = data.get("scenario_id", os.path.basename(filepath))
    steps = data.get("steps", [])
    episodes = data["episodes"]
    total_steps = data.get("total_steps", len(steps))

    results = {
        "scenario_id": scenario_id,
        "file": os.path.basename(filepath),
        "total_steps": total_steps,
        "num_episodes": len(episodes),
        "episodes": [],
        "summary": {},
    }

    boundary_leak_counts = defaultdict(int)
    explicit_set_counts = defaultdict(int)

    for ep_idx, ep in enumerate(episodes):
        start = ep["start_step_index"]
        end = ep["end_step_index"]
        ep_no = ep.get("episode_no", ep_idx + 1)
        part = ep.get("part", "?")
        source = ep.get("source_scenario_id", "?")

        # Collect first N steps
        head_steps_raw = []
        for i in range(start, min(start + HEAD_STEPS, end + 1, len(steps))):
            head_steps_raw.append(summarize_step(steps[i]))

        # Collect last step of previous episode (if any)
        prev_ep_last_step = None
        if ep_idx > 0:
            prev_end = episodes[ep_idx - 1]["end_step_index"]
            if 0 <= prev_end < len(steps):
                prev_ep_last_step = summarize_step(steps[prev_end])

        # Analyze: does this episode explicitly set bg/bgm at or near the start?
        first_adv = None
        for hs in head_steps_raw:
            if hs["type"] in ("adv", "talk", "call", "title", "synopsis"):
                first_adv = hs
                break
        explicit_bg = None
        explicit_bgm = None
        for hs in head_steps_raw:
            if hs["bg"] is not None:
                explicit_bg = hs["bg"]
            if hs["bgm"] is not None:
                explicit_bgm = hs["bgm"]

        # Is there a fadein within the head?
        has_fadein = any(hs["fade"] and "in" in hs["fade"] for hs in head_steps_raw)
        has_fadeout = any(hs["fade"] and "out" in hs["fade"] for hs in head_steps_raw)

        # Does initial visible spines look like carry-over from previous episode?
        first_step_visible = head_steps_raw[0]["visible_spines"] if head_steps_raw else []
        # Check if any spines are visible without a fadein in the head -> likely carryover
        has_idol_fadein_in_head = any(
            s["type"] in ("fadein",) for s in head_steps_raw[:3]
        )

        # Check bgm_stop at or near boundary
        has_bgm_stop = any(hs["bgm_stop_fade"] is not None for hs in head_steps_raw)

        ep_data = {
            "episode_no": ep_no,
            "part": part,
            "source": source,
            "step_range": (start, end),
            "step_count": end - start + 1,
            "head_steps": head_steps_raw,
            "prev_ep_last_step": prev_ep_last_step,
            "explicit_bg": explicit_bg,
            "explicit_bgm": explicit_bgm,
            "has_fadein": has_fadein,
            "has_fadeout": has_fadeout,
            "first_step_visible_spines": first_step_visible,
            "has_idol_fadein_in_head": has_idol_fadein_in_head,
            "has_bgm_stop": has_bgm_stop,
        }
        results["episodes"].append(ep_data)

        # Accumulate summary stats
        if prev_ep_last_step:
            prev_bg = prev_ep_last_step["bg"]
            if explicit_bg and explicit_bg != prev_bg:
                explicit_set_counts["bg_changed"] += 1
            elif explicit_bg == prev_bg:
                explicit_set_counts["bg_same"] += 1

        if explicit_bg:
            explicit_set_counts["bg_explicit"] += 1
        if explicit_bgm:
            explicit_set_counts["bgm_explicit"] += 1

        if has_fadein:
            explicit_set_counts["has_fadein"] += 1
        if has_fadeout:
            explicit_set_counts["has_fadeout"] += 1

        if first_step_visible:
            # Spines visible at episode start without clear initialization
            if not has_idol_fadein_in_head:
                boundary_leak_counts["spines_visible_no_fadein"] += 1
            boundary_leak_counts["spines_visible_total"] += 1

    results["summary"]["boundary_leak"] = dict(boundary_leak_counts)
    results["summary"]["explicit_sets"] = dict(explicit_set_counts)
    results["summary"]["total_eps_analyzed"] = len(episodes)

    # Classify boundary types
    for ep in results["episodes"]:
        prev = ep["prev_ep_last_step"]
        curr_first = ep["head_steps"][0] if ep["head_steps"] else None

        if ep["episode_no"] == 1 or not prev or not curr_first:
            ep["boundary_type"] = "first_ep"
            ep["boundary_changes"] = []
            continue

        # Determine what changed across boundary
        changes = []
        prev_ids = set(s[0] for s in prev.get("visible_spines", []))
        curr_ids = set(s[0] for s in curr_first.get("visible_spines", []))

        # Spine change
        if prev_ids and not curr_ids:
            changes.append("spines_cleared")
        elif not prev_ids and curr_ids:
            changes.append("spines_new")
        elif prev_ids != curr_ids:
            added = curr_ids - prev_ids
            removed = prev_ids - curr_ids
            if added:
                changes.append(f"spines+{','.join(sorted(added))}")
            if removed:
                changes.append(f"spines-{','.join(sorted(removed))}")
        elif prev_ids and curr_ids and prev_ids == curr_ids:
            changes.append("spines_same")

        # BG change
        if prev.get("bg") != curr_first.get("bg"):
            changes.append("bg_changed")

        # BGM change
        prev_bgm = prev.get("bgm")
        curr_bgm = curr_first.get("bgm")
        if prev_bgm != curr_bgm:
            if prev_bgm and not curr_bgm:
                changes.append("bgm_stopped")
            elif not prev_bgm and curr_bgm:
                changes.append("bgm_started")
            elif prev_bgm and curr_bgm:
                changes.append("bgm_switched")

        ep["boundary_changes"] = changes
        # Classify boundary type
        if curr_ids and not any(c.startswith("spines-") or c == "spines_cleared" for c in changes):
            ep["boundary_type"] = "carryover_full"
        elif curr_ids and any(c.startswith("spines-") or c == "spines_cleared" for c in changes):
            ep["boundary_type"] = "carryover_partial"
        elif not curr_ids:
            ep["boundary_type"] = "clean"
        else:
            ep["boundary_type"] = "unknown"

    return results


def format_report(all_results):
    """Format analysis results as a markdown report."""
    lines = []
    lines.append("# Episode Boundary Audit Report\n")
    lines.append(f"Scanned {len(all_results)} scenarios with episodes[] metadata.\n")

    # Global summary
    total_eps = sum(r["summary"]["total_eps_analyzed"] for r in all_results)
    total_scenes = len(all_results)

    # Aggregate stats
    bg_explicit = sum(r["summary"]["explicit_sets"].get("bg_explicit", 0) for r in all_results)
    bgm_explicit = sum(r["summary"]["explicit_sets"].get("bgm_explicit", 0) for r in all_results)
    has_fadein = sum(r["summary"]["explicit_sets"].get("has_fadein", 0) for r in all_results)
    has_fadeout = sum(r["summary"]["explicit_sets"].get("has_fadeout", 0) for r in all_results)
    bg_changed = sum(r["summary"]["explicit_sets"].get("bg_changed", 0) for r in all_results)
    bg_same = sum(r["summary"]["explicit_sets"].get("bg_same", 0) for r in all_results)
    spines_visible_total = sum(r["summary"]["boundary_leak"].get("spines_visible_total", 0) for r in all_results)
    spines_no_fadein = sum(r["summary"]["boundary_leak"].get("spines_visible_no_fadein", 0) for r in all_results)

    lines.append("## Global Summary\n")
    lines.append(f"- Scenarios with episodes: **{total_scenes}**")
    lines.append(f"- Total episodes analyzed: **{total_eps}**\n")
    lines.append("### State at Episode Starts")
    lines.append(f"- Explicit `bg` set in first {HEAD_STEPS} steps: **{bg_explicit}/{total_eps}** ({bg_explicit/total_eps*100:.1f}%)")
    lines.append(f"- Explicit `bgm` set in first {HEAD_STEPS} steps: **{bgm_explicit}/{total_eps}** ({bgm_explicit/total_eps*100:.1f}%)")
    lines.append(f"- Has `fadeout` in first {HEAD_STEPS} steps: **{has_fadeout}/{total_eps}** ({has_fadeout/total_eps*100:.1f}%)")
    lines.append(f"- Has `fadein` in first {HEAD_STEPS} steps: **{has_fadein}/{total_eps}** ({has_fadein/total_eps*100:.1f}%)")
    lines.append(f"- BG changed from previous episode: **{bg_changed}**")
    lines.append(f"- BG same as previous episode: **{bg_same}**")
    lines.append(f"- Visible spines at episode start: **{spines_visible_total}/{total_eps}** ({spines_visible_total/total_eps*100:.1f}%)")
    lines.append(f"-  - Without explicit fadein: **{spines_no_fadein}/{spines_visible_total}** ({spines_no_fadein/spines_visible_total*100:.1f}%)")
    lines.append("")

    # Boundary type classification (exclude first episode of each scenario)
    boundary_types = defaultdict(int)
    carryover_full_same = 0
    carryover_full_added = 0
    for r in all_results:
        for ep in r["episodes"]:
            bt = ep.get("boundary_type", "unknown")
            boundary_types[bt] += 1
            if bt == "carryover_full":
                for c in ep.get("boundary_changes", []):
                    if c == "spines_same":
                        carryover_full_same += 1
                    elif c.startswith("spines+"):
                        carryover_full_added += 1
    lines.append("### Episode Boundary Type Classification\n")
    lines.append("| Type | Count | % of Non-First Episodes | Description |")
    lines.append("|------|-------|------------------------|-------------|")
    non_first = sum(v for k, v in boundary_types.items() if k != "first_ep")
    for bt in ["clean", "carryover_full", "carryover_partial", "unknown"]:
        cnt = boundary_types.get(bt, 0)
        pct = cnt / non_first * 100 if non_first else 0
        desc = {"clean": "No visible spines at start", "carryover_full": "All prev spines persist (no removal)", "carryover_partial": "Some spines removed/added at boundary", "unknown": "Cannot classify"}.get(bt, "")
        lines.append(f"| {bt} | {cnt} | {pct:.1f}% | {desc} |")
    lines.append(f"| **Total (non-first)** | **{non_first}** | **100%** | |")
    lines.append("")
    lines.append("### Carryover Details\n")
    lines.append(f"- Same characters persist unchanged: **{carryover_full_same}**")
    lines.append(f"- Characters added (prev chars + new): **{carryover_full_added}**")
    lines.append("")

    # Key insight: spine leak pattern
    lines.append("## Spine Leak Analysis\n")
    lines.append("Episodes where visible spines exist at step 0 without fadein in first 3 steps\n")
    lines.append("(suggesting carryover from previous episode that may need explicit reset):\n")

    spine_leak_cases = []
    for r in all_results:
        for ep in r["episodes"]:
            if ep["first_step_visible_spines"] and not ep["has_idol_fadein_in_head"]:
                spine_leak_cases.append((r["scenario_id"], ep))
    spine_leak_cases.sort(key=lambda x: (x[1]["episode_no"], x[1]["step_range"][0]))

    if spine_leak_cases:
        for sid, ep in spine_leak_cases[:30]:
            spines_str = ", ".join(f"{s[0]}({s[1]})" for s in ep["first_step_visible_spines"])
            lines.append(f"- **{sid}** EP{ep['episode_no']} (part {ep['part']}) step {ep['step_range'][0]}: {spines_str}")
        if len(spine_leak_cases) > 30:
            lines.append(f"- ... and {len(spine_leak_cases) - 30} more cases\n")
    else:
        lines.append("- (none found)\n")
    lines.append("")

    # Per-scenario detailed reports
    lines.append("## Per-Scenario Detail\n")
    lines.append("---\n")

    for r in all_results:
        sid = r["scenario_id"]
        lines.append(f"### {sid}\n")
        lines.append(f"File: `{r['file']}`, Steps: {r['total_steps']}, Episodes: {r['num_episodes']}\n")

        for ep in r["episodes"]:
            ep_no = ep["episode_no"]
            part = ep["part"]
            start, end = ep["step_range"]
            lines.append(f"#### EP{ep_no} (part {part}) — steps {start}–{end} ({ep['step_count']} steps)\n")
            lines.append(f"- Source: `{ep['source']}`")
            bt = ep.get("boundary_type", "?")
            bc = ep.get("boundary_changes", [])
            lines.append(f"- Boundary type: **{bt}**")
            if bc:
                lines.append(f"- Changes: {', '.join(bc)}")
            lines.append(f"- Bg: {ep['explicit_bg'] or '(none in first {HEAD_STEPS} steps)'}")
            lines.append(f"- Bgm: {ep['explicit_bgm'] or '(none in first {HEAD_STEPS} steps)'}")
            lines.append(f"- Has fadeout: {ep['has_fadeout']}, Has fadein: {ep['has_fadein']}")
            lines.append(f"- Visible spines at step 0: {ep['first_step_visible_spines'] or '[]'}")
            lines.append(f"- Bgm stop at boundary: {ep['has_bgm_stop']}")

            # Show previous episode last step for comparison
            if ep["prev_ep_last_step"]:
                ps = ep["prev_ep_last_step"]
                lines.append(f"- **Previous EP last step**: type={ps['type']} bg={ps['bg']} bgm={ps['bgm']} visible={ps['visible_spines'] or '[]'}")

            lines.append("")
            lines.append("| Step | Type | BG | BGM | Fade | Visible Spines | Camera | Notes |")
            lines.append("|------|------|----|-----|------|----------------|--------|-------|")

            for hs in ep["head_steps"]:
                bg_str = hs["bg"] or "—"
                bgm_str = hs["bgm"] or "—"
                fade_str = hs["fade"] or "—"
                spine_str = ", ".join(f"{s[0]}({s[1]})" for s in hs["visible_spines"]) if hs["visible_spines"] else "—"
                cam_str = "yes" if hs["camera_zoom"] else "—"
                notes = []
                if hs["camera_filter"]:
                    notes.append(f"filter={hs['camera_filter']}")
                if hs["bg_color"]:
                    notes.append(f"bg_color={hs['bg_color']}")
                if hs["bg_dof"]:
                    notes.append(f"dof={hs['bg_dof']}")
                if hs["bgm_stop_fade"]:
                    notes.append(f"bgm_stop={hs['bgm_stop_fade']}")
                if hs["environmental"]:
                    notes.append(f"ambient={hs['environmental'].get('cue','?')}")
                note_str = "; ".join(notes) if notes else "—"
                lines.append(f"| {hs['step_id']} | {hs['type']} | {bg_str} | {bgm_str} | {fade_str} | {spine_str} | {cam_str} | {note_str} |")

            lines.append("")

    return "\n".join(lines)


def main():
    # Find all compiled JSONs
    json_files = glob.glob(os.path.join(COMPILED_DIR, "*.json"))
    index_files = {"index.json", "voice_index.json"}
    json_files = [f for f in json_files if os.path.basename(f) not in index_files]

    print(f"Scanning {len(json_files)} compiled JSON files for episodes[] metadata...")

    all_results = []
    skipped = 0
    errors = 0
    for fpath in sorted(json_files):
        try:
            result = analyze_scenario(fpath)
            if result:
                all_results.append(result)
                sid = result["scenario_id"]
                n_eps = result["num_episodes"]
                print(f"  OK {sid}: {n_eps} episodes, {result['total_steps']} steps")
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            print(f"  ERR {os.path.basename(fpath)}: {e}")

    print(f"\nDone. {len(all_results)} scenarios with episodes, {skipped} skipped (no episodes), {errors} errors.")

    if all_results:
        report = format_report(all_results)
        # Print a compact summary to stdout
        total_eps = sum(r["summary"]["total_eps_analyzed"] for r in all_results)
        bg_ex = sum(r["summary"]["explicit_sets"].get("bg_explicit", 0) for r in all_results)
        bgm_ex = sum(r["summary"]["explicit_sets"].get("bgm_explicit", 0) for r in all_results)
        fo = sum(r["summary"]["explicit_sets"].get("has_fadeout", 0) for r in all_results)
        fi = sum(r["summary"]["explicit_sets"].get("has_fadein", 0) for r in all_results)
        sp = sum(r["summary"]["boundary_leak"].get("spines_visible_total", 0) for r in all_results)

        print(f"\n{'='*60}")
        print(f"SUMMARY: {total_eps} episodes across {len(all_results)} scenarios")
        print(f"  Explicit bg in first {HEAD_STEPS} steps: {bg_ex}/{total_eps} ({bg_ex/total_eps*100:.1f}%)")
        print(f"  Explicit bgm in first {HEAD_STEPS} steps: {bgm_ex}/{total_eps} ({bgm_ex/total_eps*100:.1f}%)")
        print(f"  Fadeout at start: {fo}/{total_eps} ({fo/total_eps*100:.1f}%)")
        print(f"  Fadein at start:  {fi}/{total_eps} ({fi/total_eps*100:.1f}%)")
        print(f"  Visible spines at boundary: {sp}/{total_eps} ({sp/total_eps*100:.1f}%)")
        print(f"{'='*60}")

        # Write report file
        report_path = os.path.join(os.path.dirname(__file__), "episode_boundary_report.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\nFull report written to: {report_path}")
    else:
        print("No episodes found in any compiled files.")


if __name__ == "__main__":
    main()
