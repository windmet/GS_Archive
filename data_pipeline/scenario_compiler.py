"""
Scenario Compiler — State-machine based raw scenario JSON to Step JSON converter.

Architecture:
  Raw scenario JSON has flat "Command" array with "Type" + "Values" fields.
  Commands like image_bg, idol_model, idol_face, etc. modify cumulative state.
  ONLY when hitting dialogue commands (text/talk_text) do we snapshot state
  and emit a self-contained Step.

Output:
  Standardized Step JSON. Frontend never interpolates between steps.
"""

import json
import copy
import os
from typing import Any, Optional


class ScenarioState:
    """Cumulative scene state — reflects the 'current frame' at any point."""

    def __init__(self):
        self.bg: Optional[str] = None
        self.bg_effect: Optional[str] = None
        self.bgm: Optional[str] = None
        self.bgm_volume: int = 100
        self.spines: list[dict] = []         # [{id, model, face, anim, pos, ...}]
        self.talk_mode: bool = False          # True inside talk_start/end block
        self.phone_mode: bool = False         # True inside phone_start/end block

    def snapshot(self) -> dict:
        return copy.deepcopy(self.__dict__)

    def set_bg(self, bg_id: str):
        self.bg = bg_id

    def set_bgm(self, bgm_id: str):
        self.bgm = bgm_id

    def stop_bgm(self):
        self.bgm = None
        self.bgm_volume = 0

    def find_spine(self, idol_id: str) -> Optional[dict]:
        for s in self.spines:
            if s["id"] == idol_id:
                return s
        return None

    def spawn_spine(self, idol_id: str, model: str,
                    face: str = "face_default",
                    anim: str = "wait_loop",
                    position: int = 0):
        entry = {
            "id": idol_id,
            "model": model,
            "face": face,
            "anim": anim,
            "position": position,
        }
        existing = self.find_spine(idol_id)
        if existing:
            existing.update(entry)
        else:
            self.spines.append(entry)

    def update_spine_face(self, idol_id: str, face: str, face_flags: dict = None):
        spine = self.find_spine(idol_id)
        if spine:
            spine["face"] = face
            if face_flags:
                if face_flags.get("anim_flag", ""):
                    spine["anim_flag"] = face_flags["anim_flag"]
                spine["blush_flag"] = face_flags.get("blush_flag", "")
                spine["sweat_flag"] = face_flags.get("sweat_flag", "")

    def update_spine_anim(self, idol_id: str, anim: str):
        spine = self.find_spine(idol_id)
        if spine:
            spine["anim"] = anim

    def remove_spine(self, idol_id: str):
        self.spines = [s for s in self.spines if s["id"] != idol_id]

    def clear_spines(self):
        self.spines.clear()


class ScenarioCompiler:
    """
    State-machine compiler for raw SideM scenario JSON.
    Walks Command array, dispatches by Type, snapshots on dialogue.
    """

    def __init__(self, raw_data: dict, scenario_id: str = ""):
        self.raw = raw_data
        self.scenario_id = scenario_id or self._infer_id(raw_data)
        self.state = ScenarioState()
        self.steps: list[dict] = []
        self.step_counter = 0

        # Voice state
        self._voice_prefix: Optional[str] = None      # from voice_file command

        # Timeline (mid-sentence changes from delayed commands)
        self._timeline_events: list[dict] = []

        # Branching / choice state
        self._pending_selection: Optional[dict] = None  # buffered choice step
        self._pending_choice_count: int = 0
        self._jump_point_labels: list[str] = []          # pending labels from jump_point
        self._jump_point_map: dict[str, int] = {}       # label → step_id

        # Synopsis dedup — skip consecutive synopsis/title steps with same content
        self._last_synopsis_key: Optional[str] = None
        self._last_title_key: Optional[str] = None

    # ----------------------------------------------------------------
    # Main entry
    # ----------------------------------------------------------------

    def compile(self) -> dict:
        commands = self.raw.get("Command", [])
        for cmd in commands:
            self._process(cmd)
        return self._output()

    @classmethod
    def compile_group(cls, raw_data_list: list[dict], group_id: str) -> dict:
        """
        Compile multiple raw files as a single continuous scenario.
        All commands from all files are fed through ONE state machine.
        """
        compiler = cls(raw_data_list[0], group_id)
        for data in raw_data_list:
            for cmd in data.get("Command", []):
                compiler._process(cmd)
        return compiler._output()

    # ----------------------------------------------------------------
    # Command dispatch
    # ----------------------------------------------------------------

    def _process(self, cmd: dict):
        ctype = cmd.get("Type", "")
        vals = cmd.get("Values", [])

        # Flush pending selection if we're moving on to a non-select command
        if self._pending_selection and ctype not in ("text_select", "talk_select", "phone_select"):
            self._flush_selection()

        dispatch = {
            # Background / effects
            "image_bg":             self._image_bg,
            "change_bg_effect":     self._change_bg_effect,
            "screen_fadeout":       self._screen_fade,
            "screen_fadein":        self._screen_fadein,

            # Audio
            "bgm":                  self._bgm,
            "se":                   None,  # silently skip
            "voice_file":           self._voice_file,

            # Character (idol) management
            "idol_model":           self._idol_model,
            "idol_position":        self._idol_position,
            "idol_fadein":          self._idol_fadein,
            "idol_fadeout":         self._idol_fadeout,
            "idol_face":            self._idol_face,
            "idol_animation":       self._idol_animation,
            "idol_neckanimation":   self._idol_animation,  # neck anims (neck_question, etc.) → same as body anim
            "image_icon":           None,  # icon for mob chars — skip

            # Dialogue-producing
            "text":                 self._text,
            "talk_text":            self._talk_text,
            "talk_start":           self._talk_start,
            "talk_end":             None,
            "phone_text":           self._phone_text,
            "phone_start":          self._phone_start,
            "phone_end":            None,

            # Branching / choices
            "text_select":          self._select,
            "talk_select":          self._select,
            "phone_select":         self._select,
            "jump_point":           self._jump_point_cmd,
            "jump":                 None,  # skip — flow control handled by step index

            # Meta
            "text_synopsis":        self._text_synopsis,
            "text_title":           self._text_title,
            "wait":                 None,  # timing — no visual change
            "environmental":        None,
        }

        handler = dispatch.get(ctype)
        if handler:
            handler(vals)
        # else: silently skip unknown / no-op commands

    # ----------------------------------------------------------------
    # Scene state commands
    # ----------------------------------------------------------------

    def _image_bg(self, vals: list):
        """Values: [bg_id, ...]"""
        if vals and vals[0]:
            self.state.set_bg(vals[0])

    def _change_bg_effect(self, vals: list):
        if vals and vals[0]:
            self.state.bg_effect = vals[0]

    def _screen_fade(self, vals: list):
        """screen_fadeout — purely visual transition (no state change)."""
        pass

    def _screen_fadein(self, vals: list):
        """screen_fadein — new scene begins. State is already clean."""
        pass

    def _bgm(self, vals: list):
        """Values: [cue_id, ...] — empty vals means stop."""
        if vals and vals[0]:
            self.state.set_bgm(vals[0])
        else:
            self.state.stop_bgm()

    def _voice_file(self, vals: list):
        """Values: [voice_prefix, ...]"""
        if vals and vals[0]:
            self._voice_prefix = vals[0]

    # ----------------------------------------------------------------
    # Character (idol) commands
    # ----------------------------------------------------------------

    def _idol_model(self, vals: list):
        """Values: [chara_id, model_id, ...]"""
        if len(vals) >= 2 and vals[0] and vals[1]:
            self.state.spawn_spine(vals[0], vals[1])

    def _idol_position(self, vals: list):
        """Values: [chara_id, x, y?, ...]"""
        # x=0 usually means center; position slot concept TBD
        pass

    def _idol_fadein(self, vals: list):
        """Values: [chara_id, delay, duration?, ...]"""
        # Anime show — handled by frontend tween; state is already set
        pass

    def _idol_fadeout(self, vals: list):
        """Values: [chara_id, delay, duration?, ...]"""
        if vals and vals[0]:
            self.state.remove_spine(vals[0])

    def _idol_face(self, vals: list):
        """
        Character facial expression with original game engine flags.

        Raw values (8 fields):
          [chara_id, delay, face_name, anim_flag, sweat_flag, blush_flag, '', '']

        - anim_flag (vals[3]):  '目'=眼睑遮盖过渡 (blink cover),  'off'=瞬时切换
        - sweat_flag (vals[4]): '汗'=强制汗滴显示,  'off'=强制隐藏汗滴
        - blush_flag (vals[5]): 'チーク'=强制脸红显示,  'off'=强制隐藏脸红

        delay=0   → immediate state update (initial state for next step)
        delay>0   → mid-sentence timeline event

        原版引擎调度模式（延迟 0.1s 的成对命令）：
          T:      off   → 表情瞬时切换，不做眨眼
          T+0.1:  目    → 闭眼遮盖 150ms，掩盖切换痕迹
        """
        if len(vals) >= 3 and vals[0] and vals[2]:
            delay = float(vals[1]) if vals[1] else 0
            face_flags = {
                "anim_flag": vals[3] if len(vals) > 3 else "",
                "sweat_flag": vals[4] if len(vals) > 4 else "",
                "blush_flag": vals[5] if len(vals) > 5 else "",
            }
            if delay > 0:
                # Non-zero delay → timeline event (mid-sentence face change)
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_face",
                    "chara_id": vals[0],
                    "value": vals[2],
                    **face_flags,
                })
            else:
                # delay=0 → immediate state update
                self.state.update_spine_face(vals[0], vals[2], face_flags)

    def _idol_animation(self, vals: list):
        """
        Values: [chara_id, delay, anim_name, ...]
        delay=0 → immediate state update
        delay>0 → mid-sentence timeline event
        """
        if len(vals) >= 3 and vals[0] and vals[2]:
            delay = float(vals[1]) if vals[1] else 0
            if delay > 0:
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_anim",
                    "chara_id": vals[0],
                    "value": vals[2],
                })
            else:
                self.state.update_spine_anim(vals[0], vals[2])

    # ----------------------------------------------------------------
    # Talk mode
    # ----------------------------------------------------------------

    def _talk_start(self, vals: list):
        self.state.talk_mode = True

    def _phone_start(self, vals: list):
        """Values: [?, ?, voice_prefix?, ...]"""
        self.state.phone_mode = True
        # Third value may be a voice prefix
        if len(vals) >= 3 and vals[2]:
            self._voice_prefix = vals[2]

    # ----------------------------------------------------------------
    # Dialogue commands — Step emission
    # ----------------------------------------------------------------

    def _text(self, vals: list):
        """
        Main ADV dialogue.
        Values: [speaker_name, text, chara_id, voice_suffix, ...]
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""
        voice_suffix = vals[3] if len(vals) > 3 else ""

        voice = self._build_voice_filename(voice_suffix) if voice_suffix else None

        self._emit_step("adv", speaker, text, voice, chara_id)

    def _talk_text(self, vals: list):
        """
        Talk/chat mode dialogue.
        Values: [speaker_name, text, chara_id, display_duration, ...]
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""

        self._emit_step("talk", speaker, text, None, chara_id)

    def _phone_text(self, vals: list):
        """
        Phone call dialogue.
        Values: [speaker_name, text, chara_id, voice_suffix, ...]
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""
        voice_suffix = vals[3] if len(vals) > 3 else ""
        voice = self._build_voice_filename(voice_suffix) if voice_suffix else None
        self._emit_step("call", speaker, text, voice, chara_id)

    # ----------------------------------------------------------------
    # Branching / choice handling
    # ----------------------------------------------------------------

    def _select(self, vals: list):
        """
        Choice point. Collects options into pending selection step.
        Values: [jump_label, short_text, long_text?, ...]
        """
        label = vals[0] if len(vals) > 0 else ""
        short_text = vals[1] if len(vals) > 1 and vals[1] else ""
        long_text = vals[2] if len(vals) > 2 and vals[2] else ""

        if self._pending_selection is None:
            self._apply_timeline()  # flush pending timeline before choice snapshot
            self._pending_selection = {
                "type": "choice",
                "state": self.state.snapshot(),
                "options": [],
            }
        self._pending_selection["options"].append({
            "label": label,
            "text": short_text,
            "detail": long_text,
        })

    def _jump_point_cmd(self, vals: list):
        """Track jump_point labels. Consecutive labels all map to the next step."""
        label = vals[0] if vals and vals[0] else ""
        if label:
            self._jump_point_labels.append(label)

    def _flush_selection(self):
        """Emit the buffered selection as a step."""
        if self._pending_selection is None:
            return
        self.step_counter += 1
        step = {
            "step_id": self.step_counter,
            "type": "choice",
            "state": self._pending_selection["state"],
            "options": self._pending_selection["options"],
        }
        self.steps.append(step)
        self._pending_selection = None
        self._pending_choice_count += 1

    # ----------------------------------------------------------------
    # Meta steps
    # ----------------------------------------------------------------

    def _text_synopsis(self, vals: list):
        """Episode synopsis — emits a metadata step."""
        self._apply_timeline()  # flush any pending timeline into state
        title = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        key = f"{title}|{text}"
        if key == self._last_synopsis_key:
            return  # skip duplicate synopsis (e.g. across merged sub-files)
        self._last_synopsis_key = key
        self._emit_step("synopsis", title, text, None, None)

    def _text_title(self, vals: list):
        """Episode title card — emits a metadata step."""
        self._apply_timeline()  # flush any pending timeline into state
        chapter = vals[0] if len(vals) > 0 and vals[0] else ""
        title = vals[1] if len(vals) > 1 and vals[1] else ""
        key = f"{chapter}|{title}"
        if key == self._last_title_key:
            return  # skip duplicate title
        self._last_title_key = key
        self._emit_step("title", chapter, title, None, None)

    # ----------------------------------------------------------------
    # Voice filename construction
    # ----------------------------------------------------------------

    def _build_voice_filename(self, suffix: str) -> str:
        """
        Construct voice filename.
        - If voice_file prefix was set: {prefix}_{suffix}.m4a
        - Otherwise: {suffix}.m4a  (standalone voice ID)
        """
        if self._voice_prefix:
            return f"{self._voice_prefix}_{suffix}.m4a"
        return f"{suffix}.m4a"

    # ----------------------------------------------------------------
    # Timeline / mid-sentence change handling
    # ----------------------------------------------------------------

    def _apply_timeline(self):
        """Apply all pending timeline events to main state for continuity."""
        if not self._timeline_events:
            return
        for event in self._timeline_events:
            if event["type"] == "spine_face":
                self.state.update_spine_face(event["chara_id"], event["value"], event)
            elif event["type"] == "spine_anim":
                self.state.update_spine_anim(event["chara_id"], event["value"])
        self._timeline_events.clear()

    @staticmethod
    def _process_timeline(events: list[dict]) -> list[dict]:
        """
        Sort timeline events by time, merge near-simultaneous events
        into the same timestamp, and deduplicate redundant entries.

        Merge window (0.08s): events within 80ms of each other snap to
        the earliest time of the cluster. This prevents multiple near-
        simultaneous setAnimation calls from fighting over crossfades.

        Dedup rule: for the same (type, chara_id), if a later event would
        immediately overwrite an earlier event with the same value, keep only
        the earliest occurrence of each distinct value change.

        e.g.:
          +1.0 face_sad, +1.1 face_sad, +2.0 face_sad
          → +1.0 face_sad (1.1 and 2.0 set same value → redundant)

          +4.0 face_shy, +4.0 hello, +4.1 face_shy
          → merge 4.1 into 4.0 → +4.0 face_shy, +4.0 hello (4.1 face_shy = same as 4.0 → redundant)
        """
        if not events:
            return []

        # Sort by time
        sorted_events = sorted(events, key=lambda e: e["time"])

        # Merge window: snap events within 0.08s to the cluster's earliest time
        merged = []
        cluster_start = sorted_events[0]["time"]
        cluster = [sorted_events[0]]

        for e in sorted_events[1:]:
            if e["time"] - cluster_start <= 0.08:
                # Part of current cluster → snap time
                e["time"] = cluster_start
                cluster.append(e)
            else:
                # New cluster
                merged.extend(cluster)
                cluster_start = e["time"]
                cluster = [e]
        merged.extend(cluster)

        # Forward dedup: track current value per (type, chara_id)
        result = []
        current = {}  # (type, chara_id) → value
        FLAG_KEYS = {"anim_flag", "sweat_flag", "blush_flag"}

        for e in merged:
            key = (e["type"], e["chara_id"])
            val = e["value"]
            if key in current and current[key] == val:
                # Same value as last → redundant for value, but may carry updated flags
                # (e.g. T=0: off, T+0.1: 目 with same face_name)
                flags = {k: e[k] for k in FLAG_KEYS if e.get(k)}
                if flags:
                    result[-1].update(flags)
                continue
            current[key] = val
            result.append(e)

        return result

    # ----------------------------------------------------------------
    # Step emission
    # ----------------------------------------------------------------

    def _emit_step(self, step_type: str,
                   speaker: Optional[str], text: Optional[str],
                   voice: Optional[str], chara_id: Optional[str]):
        self.step_counter += 1

        # Track all pending jump_point labels → this step
        if self._jump_point_labels:
            for lbl in self._jump_point_labels:
                self._jump_point_map[lbl] = self.step_counter
            self._jump_point_labels.clear()

        step = {
            "step_id": self.step_counter,
            "type": step_type,
            # state snapshot = INITIAL state
            # (delayed commands with delay>0 are in _timeline_events, not applied yet)
            "state": self.state.snapshot(),
        }

        # Attach timeline events (mid-sentence changes) to dialogue steps
        if self._timeline_events and step_type in ("adv", "talk", "call"):
            step["timeline"] = self._process_timeline(list(self._timeline_events))
            self._apply_timeline()  # apply to main state for future step continuity
        elif self._timeline_events:
            # Non-dialogue step (synopsis/title): apply timeline to state directly
            self._apply_timeline()

        if chara_id:
            step["chara_id"] = chara_id

        if speaker is not None or text is not None:
            dialogue = {
                "speaker": speaker or "",
                "text": text or "",               # legacy fallback
                "text_jp": text or "",             # Japanese (source)
                "text_cn": "",                     # Chinese translation (to be filled)
            }
            if voice:
                dialogue["voice"] = voice
            step["dialogue"] = dialogue

        self.steps.append(step)

    # ----------------------------------------------------------------
    # Output
    # ----------------------------------------------------------------

    def _output(self) -> dict:
        # Resolve choice option labels to step IDs
        for step in self.steps:
            if step.get("type") == "choice":
                for opt in step.get("options", []):
                    label = opt.get("label", "")
                    opt["step_id"] = self._jump_point_map.get(label, 0)

        return {
            "scenario_id": self.scenario_id,
            "total_steps": len(self.steps),
            "steps": self.steps,
            "jump_points": dict(self._jump_point_map),
        }

    @staticmethod
    def _infer_id(raw_data: dict) -> str:
        return raw_data.get("scenarioId", "unknown")

    # ----------------------------------------------------------------
    # File I/O convenience
    # ----------------------------------------------------------------

    @staticmethod
    def load_json(path: str) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def save_json(data: dict, path: str, indent: int = 2):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)

    @classmethod
    def compile_file(cls, path: str, output_dir: Optional[str] = None) -> dict:
        """Load, compile, optionally save."""
        data = cls.load_json(path)
        basename = os.path.splitext(os.path.basename(path))[0]
        compiler = cls(data, basename)
        result = compiler.compile()
        if output_dir:
            out_path = os.path.join(output_dir, f"{basename}_compiled.json")
            cls.save_json(result, out_path)
            print(f"  → {out_path}  ({result['total_steps']} steps)")
        return result


# ----------------------------------------------------------------
# Batch compilation
# ----------------------------------------------------------------

def compile_directory(scenario_root: str, output_root: str):
    """Compile all scenario JSON files under a directory tree."""
    count = 0
    for dirpath, _, filenames in os.walk(scenario_root):
        for fn in filenames:
            if not fn.endswith(".json"):
                continue
            in_path = os.path.join(dirpath, fn)
            rel = os.path.relpath(dirpath, scenario_root)
            out_dir = os.path.join(output_root, rel)
            try:
                ScenarioCompiler.compile_file(in_path, out_dir)
                count += 1
            except Exception as e:
                print(f"  ✗ {in_path}: {e}")
    print(f"\nDone. Compiled {count} files.")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single file:  python scenario_compiler.py <input.json> [output.json]")
        print("  Batch:        python scenario_compiler.py --batch <input_dir> <output_dir>")
        sys.exit(1)

    if sys.argv[1] == "--batch":
        if len(sys.argv) < 4:
            print("Usage: python scenario_compiler.py --batch <input_dir> <output_dir>")
            sys.exit(1)
        compile_directory(sys.argv[2], sys.argv[3])
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        result = ScenarioCompiler.compile_file(input_path, output_path)
        if not output_path:
            print(json.dumps(result, ensure_ascii=False, indent=2))
