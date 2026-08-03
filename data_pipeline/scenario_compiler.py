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
import hashlib
import os
import re
import unicodedata
from typing import Any, Optional


class ScenarioState:
    """Cumulative scene state — reflects the 'current frame' at any point."""

    def __init__(self):
        self.bg: Optional[str] = None
        self.bg_effect: Optional[str] = None
        self.bg_transition: Optional[dict] = None
        self.bg_effects: list[dict] = []
        self.bg_profile: Optional[dict] = None
        self.bgm: Optional[str] = None
        self.bgm_volume: int = 100
        self.se: Optional[dict] = None          # Legacy last one-shot SE
        self.se_events: list[dict] = []         # All one-shot SE in this step
        self.environmental: Optional[dict] = None  # {"cue": str, "volume": str} or None
        self.spines: list[dict] = []         # [{id, model, face, anim, pos, ...}]
        self.talk_mode: bool = False          # True inside talk_start/end block
        self.phone_mode: bool = False         # True inside phone_start/end block
        # Camera zoom/pan (dolly)
        self.camera_zoom: Optional[dict] = None    # {"zoom": float, "offset_x": float, "offset_y": float, "duration": float, "delay"?: float}
        # Screen fade transition (one-shot, consumed by next step)
        self.screen_fade: Optional[dict] = None    # {"type": "in"|"out", "duration": float, "color": str}
        self.screen_slide: Optional[dict] = None   # {"type": "in"|"out", "delay": float, "duration": float, "direction": str}
        self.screen_effects: list[dict] = []       # one-shot screen/effect flashes
        # Audio extras
        self.bgm_volume: int = 100
        self.bgm_stop_fade: Optional[float] = None  # fade duration for bgm_stop
        self.environmental_volume: Optional[float] = None  # 0.0-1.0 volume for ambient
        self.environmental_duck_target: Optional[float] = None  # duck target volume
        # Visual filters (memory/flashback effects)
        self.camera_filter: Optional[str] = None   # e.g. "gray" from camera_color
        self.bg_color: Optional[str] = None        # hex color overlay e.g. "#AAAAAA"
        self.bg_dof: Optional[float] = None        # depth-of-field blur amount
        self.bg_color_transition: Optional[dict] = None
        self.bg_dof_transition: Optional[dict] = None
        self.text_disabled: bool = False            # hide text box (set by text_disable, consumed by next dialogue)
        self.image_icon: Optional[dict] = None      # scene/dialogue identity icon

    def snapshot(self) -> dict:
        snapshot = copy.deepcopy(self.__dict__)
        snapshot["spines"] = [
            s for s in snapshot["spines"]
            if s.get("visible", False)
        ]
        return snapshot

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
        existing = self.find_spine(idol_id)
        parts_visible = existing.get("parts_visible") if existing else None
        entry = {
            "id": idol_id,
            "model": model,
            "face": face,
            "anim": anim,
            "position": position,
            "visible": existing.get("visible", False) if existing else False,
        }
        if existing:
            # Preserve pos_x/pos_y already set by _idol_position command
            pos_x = existing.get("pos_x")
            pos_y = existing.get("pos_y")
            idol_priority = existing.get("idol_priority")
            existing.update(entry)
            if pos_x is not None:
                existing["pos_x"] = pos_x
            if pos_y is not None:
                existing["pos_y"] = pos_y
            if idol_priority is not None:
                existing["idol_priority"] = idol_priority
            if parts_visible is not None:
                existing["parts_visible"] = parts_visible
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
            spine.pop("anim_no_back", None)

    def update_spine_neck_anim(self, idol_id: str, anim: Optional[str]):
        spine = self.find_spine(idol_id)
        if spine:
            if anim:
                spine["neck_anim"] = anim
                spine.pop("neck_anim_stop", None)
            else:
                spine["neck_anim_stop"] = True
                spine.pop("neck_anim", None)

    def remove_spine(self, idol_id: str):
        self.spines = [s for s in self.spines if s["id"] != idol_id]

    def set_spine_visible(self, idol_id: str, visible: bool):
        spine = self.find_spine(idol_id)
        if spine:
            spine["visible"] = visible

    def set_spine_parts_visible(self, idol_id: str, visible: bool):
        spine = self.find_spine(idol_id)
        if spine:
            spine["parts_visible"] = visible

    def clear_spines(self):
        self.spines.clear()

    def clear_episode_visual_context(self):
        """Reset visual-only state at an episode boundary.

        Do not clear bg, bgm, environmental audio, or spines here. Audit data
        shows a meaningful minority of episodes intentionally carry those
        across boundaries.
        """
        self.screen_fade = None
        self.screen_slide = None
        self.screen_effects = []
        self.camera_zoom = None
        self.camera_filter = None
        self.bg_color = None
        self.bg_dof = None
        self.bg_color_transition = None
        self.bg_dof_transition = None
        self.bg_transition = None
        self.bg_effects = []
        self.se = None
        self.se_events = []
        self.bgm_stop_fade = None
        self.environmental_volume = None
        self.environmental_duck_target = None


class ScenarioCompiler:
    """
    State-machine compiler for raw SideM scenario JSON.
    Walks Command array, dispatches by Type, snapshots on dialogue.
    """

    LIPSYNC_ROOT = os.environ.get(
        "SIDEM_LIPSYNC_ROOT",
        r"E:\BaiduNetdiskDownload\SideM\scripts\lipsyncdata\adxlip",
    )
    ADV_BACKGROUND_ROOT = os.environ.get(
        "SIDEM_ADV_BACKGROUND_ROOT",
        r"E:\BaiduNetdiskDownload\SideM\scripts\advbackground\json",
    )
    AUDIO_ROOT = os.environ.get(
        "SIDEM_AUDIO_ROOT",
        r"E:\BaiduNetdiskDownload\SideM\GS_Res\Audio",
    )
    _LIPSYNC_BASENAME_INDEX: Optional[dict[str, str]] = None
    _ADV_BACKGROUND_INDEX: Optional[dict[str, dict]] = None

    TEXT_ID_VERSION = 1
    TEXT_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
    TEXT_FIELD_KINDS = frozenset({
        "dialogue",
        "narration",
        "choice_short",
        "choice_detail",
        "title",
        "synopsis",
        "time_caption",
        "mobile_message",
        "phone_message",
        "scene_icon_label",
        "system_caption",
    })

    def __init__(self, raw_data: dict, scenario_id: str = "",
                 source_part_id: Optional[str] = None,
                 source_file: Optional[str] = None):
        self.raw = raw_data
        self.scenario_id = scenario_id or self._infer_id(raw_data)
        self.text_catalog_id = self._canonical_text_token(self.scenario_id, "scenario_id")
        inferred_part = source_part_id or self.scenario_id
        self._source_part_id = self._canonical_text_token(inferred_part, "source_part_id")
        self._source_file = self._canonical_source_file(source_file or f"{inferred_part}.json")
        self._current_command_index = -1
        self._current_raw_type = ""
        self.state = ScenarioState()
        self.steps: list[dict] = []
        self.episodes: list[dict] = []
        self.step_counter = 0
        self._current_episode: Optional[dict] = None

        # Voice state
        self._voice_prefix: Optional[str] = None      # from voice_file command

        # Timeline (mid-sentence changes from delayed commands)
        self._timeline_events: list[dict] = []

        # Silent performance block tracking. Raw scripts often contain
        # sound/action/wait beats with no dialogue; those need their own
        # auto-advancing stage steps instead of being swallowed by the next
        # dialogue snapshot.
        self._stage_dirty: bool = False
        self._stage_has_performance: bool = False
        self._stage_duration_hint: float = 0.0
        self._pending_text_disable: bool = False
        self._pending_text_disable_duration: float = 0.6
        self._pending_idol_priority: dict[str, float] = {}
        self._pending_parts_visible: dict[str, bool] = {}
        self._pending_fadeout_ids: set[str] = set()
        self._pending_bg_effect_end_ids: set[str] = set()
        self._bgm_from_advbackground: bool = False
        self._environmental_from_advbackground: bool = False

        # Branching / choice state
        self._pending_selection: Optional[dict] = None  # buffered choice step
        self._pending_choice_count: int = 0
        self._jump_point_labels: list[str] = []          # pending labels from jump_point
        self._jump_point_map: dict[str, int] = {}       # label → step_id (last mapping only)
        self._jump_point_entries: list[tuple[str, int]] = []  # chronological (label, step_id) pairs

        # Synopsis dedup — skip consecutive synopsis/title steps with same content
        self._last_synopsis_key: Optional[str] = None
        self._last_title_key: Optional[str] = None

        # Lip-sync state
        self._noLipSync: bool = False          # set by voice_noLip, consumed by next text step
        self._noLipVoiceSuffix: Optional[str] = None  # voice suffix from voice_noLip command
        self._voiceBareSuffix: Optional[str] = None   # voice suffix from bare voice command
        self._lip_owner_id: Optional[str] = self._infer_lip_owner_id(self.scenario_id)
        self._lip_base_id: Optional[str] = self._infer_lip_base_id(self.scenario_id)

    # ----------------------------------------------------------------
    # Main entry
    # ----------------------------------------------------------------

    def compile(self, *, output_contract: str = "compatibility",
                source: Optional[dict] = None,
                compiler_version: str = "scenario-compiler-python-v2") -> dict:
        commands = self.raw.get("Command", [])
        for command_index, cmd in enumerate(commands):
            self._process(cmd, command_index)
        self._flush_pending_text_disable()
        result = self._output()
        if source is not None:
            result["source"] = copy.deepcopy(source)
        return self._apply_output_contract(result, output_contract, compiler_version)

    @classmethod
    def compile_group(cls, raw_data_list: list[dict], group_id: str,
                      part_ids: Optional[list[str]] = None,
                      source_files: Optional[list[str]] = None,
                      *, output_contract: str = "compatibility",
                      source: Optional[dict] = None,
                      compiler_version: str = "scenario-compiler-python-v2") -> dict:
        """
        Compile multiple raw files as a single continuous scenario.
        All commands from all files are fed through ONE state machine.
        """
        first_part_id = part_ids[0] if part_ids else group_id
        first_source_file = source_files[0] if source_files else f"{first_part_id}.json"
        compiler = cls(raw_data_list[0], group_id, first_part_id, first_source_file)
        for idx, data in enumerate(raw_data_list):
            if idx > 0:
                # Lettered scenario files are authored as episode chunks.
                # If the new chunk declares its own cast before the first text,
                # treat it as a fresh visual scene. Otherwise keep visible
                # spines for the audited carryover cases.
                if cls._declares_initial_spines(data):
                    compiler.state.clear_spines()
                    compiler._pending_idol_priority.clear()
                    compiler._pending_parts_visible.clear()
                    compiler._pending_fadeout_ids.clear()
                    compiler._pending_bg_effect_end_ids.clear()
                # Always reset transient visual context at the boundary.
                compiler.state.clear_episode_visual_context()
            source_id = part_ids[idx] if part_ids and idx < len(part_ids) else data.get("scenarioId", "")
            source_id = source_id or f"episode_{idx + 1}"
            source_file = source_files[idx] if source_files and idx < len(source_files) else f"{source_id}.json"
            compiler._set_source_context(source_id, source_file)
            compiler._begin_episode(source_id)
            for command_index, cmd in enumerate(data.get("Command", [])):
                compiler._process(cmd, command_index)
            compiler._flush_pending_text_disable()
            compiler._end_episode()
        result = compiler._output()
        if source is not None:
            result["source"] = copy.deepcopy(source)
        return cls._apply_output_contract(result, output_contract, compiler_version)

    @staticmethod
    def _apply_output_contract(result: dict, output_contract: str,
                               compiler_version: str) -> dict:
        if output_contract == "compatibility":
            return result
        if output_contract != "authoritative":
            raise ValueError(f"Unsupported ScenarioCompiler output contract: {output_contract!r}")
        from authoritative_scenario import compile_authoritative_scenario

        return compile_authoritative_scenario(result, compiler_version=compiler_version)

    @staticmethod
    def to_authoritative(result: dict,
                         compiler_version: str = "scenario-compiler-python-v2") -> dict:
        """Project an already compiled compatibility result into strict v2."""
        return ScenarioCompiler._apply_output_contract(result, "authoritative", compiler_version)

    @staticmethod
    def _declares_initial_spines(raw_data: dict) -> bool:
        """Return true when a chunk declares its cast before first dialogue."""
        dialogue_types = {"text", "talk_text", "phone_text", "text_se_off"}
        for cmd in raw_data.get("Command", []):
            ctype = cmd.get("Type", "")
            if ctype in dialogue_types:
                return False
            if ctype == "idol_model":
                vals = cmd.get("Values", [])
                return bool(len(vals) >= 2 and vals[0] and vals[1])
        return False

    # ----------------------------------------------------------------
    # Text identity and source evidence
    # ----------------------------------------------------------------

    @classmethod
    def _canonical_text_token(cls, value: Any, field_name: str) -> str:
        token = str(value or "").strip()
        if not token:
            raise ValueError(f"{field_name} is required for story text identity")
        if not cls.TEXT_TOKEN_PATTERN.fullmatch(token):
            raise ValueError(f"{field_name} contains unsupported characters: {token!r}")
        return token

    @staticmethod
    def _canonical_source_file(value: Any) -> str:
        source_file = str(value or "").replace("\\", "/").strip()
        while source_file.startswith("./"):
            source_file = source_file[2:]
        parts = source_file.split("/")
        if not source_file or any(part in ("", ".", "..") for part in parts):
            raise ValueError(f"source_file must be a canonical relative path: {value!r}")
        if re.match(r"^[A-Za-z]:", source_file) or source_file.startswith("/"):
            raise ValueError(f"source_file must not be absolute: {value!r}")
        return source_file

    @staticmethod
    def normalize_source_text(text: Any) -> str:
        value = str(text or "")
        if value.startswith("\ufeff"):
            value = value[1:]
        value = value.replace("\r\n", "\n").replace("\r", "\n")
        return unicodedata.normalize("NFC", value)

    @classmethod
    def source_text_hash(cls, text: Any) -> str:
        normalized = cls.normalize_source_text(text)
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return f"sha256:{digest}"

    def _set_source_context(self, part_id: str, source_file: str):
        self._source_part_id = self._canonical_text_token(part_id, "source_part_id")
        self._source_file = self._canonical_source_file(source_file)
        self._current_command_index = -1
        self._current_raw_type = ""

    def _text_unit_id(self, field_kind: str, field_ordinal: int = 0,
                      command_index: Optional[int] = None) -> str:
        kind = self._canonical_text_token(field_kind, "field_kind")
        if kind not in self.TEXT_FIELD_KINDS:
            raise ValueError(f"unsupported story text field_kind: {kind!r}")
        index = self._current_command_index if command_index is None else int(command_index)
        ordinal = int(field_ordinal)
        if index < 0:
            raise ValueError("command_index is required for story text identity")
        if ordinal < 0:
            raise ValueError("field_ordinal must be non-negative")
        return (
            f"story-text:v{self.TEXT_ID_VERSION}:{self.text_catalog_id}:"
            f"{self._source_part_id}:cmd-{index:06d}:{kind}:{ordinal:03d}"
        )

    def _text_ref(self, source_text: Any, field_kind: str, field_ordinal: int = 0,
                  command_index: Optional[int] = None) -> dict:
        index = self._current_command_index if command_index is None else int(command_index)
        return {
            "unit_id": self._text_unit_id(field_kind, field_ordinal, index),
            "source": {
                "scenario_id": self.text_catalog_id,
                "part_id": self._source_part_id,
                "file": self._source_file,
                "command_index": index,
                "field_kind": field_kind,
                "field_ordinal": int(field_ordinal),
            },
            "source_hash": self.source_text_hash(source_text),
        }

    @staticmethod
    def _speaker_identity(source_name: Any, chara_id: Any = None) -> dict:
        name = str(source_name or "")
        entity_id = str(chara_id or "") or None
        is_idol = bool(entity_id and re.fullmatch(r"\d{3}[A-Za-z0-9]{3}", entity_id))

        if not name:
            kind = "none"
        elif name == "<P>":
            kind = "producer"
        elif re.fullmatch(r"[？?]+", name):
            kind = "unknown"
        elif is_idol:
            kind = "idol"
        else:
            kind = "named"

        return {
            "kind": kind,
            "entity_type": "idol" if is_idol else None,
            "entity_id": entity_id,
            "source_name": name,
        }

    def _step_evidence(self, command_start: Optional[int] = None,
                       command_end: Optional[int] = None) -> dict:
        start = self._current_command_index if command_start is None else int(command_start)
        end = start if command_end is None else int(command_end)
        return {
            "source_file": self._source_file,
            "source_part_id": self._source_part_id,
            "command_start": start,
            "command_end": end,
            "raw_type": self._current_raw_type,
            "confidence": "exact",
        }

    # ----------------------------------------------------------------
    # Command dispatch
    # ----------------------------------------------------------------

    def _process(self, cmd: dict, command_index: Optional[int] = None):
        ctype = cmd.get("Type", "")
        vals = cmd.get("Values", [])
        if command_index is not None:
            self._current_command_index = int(command_index)
        self._current_raw_type = ctype

        # Flush pending selection if we're moving on to a non-select command
        if self._pending_selection and ctype not in ("text_select", "talk_select", "phone_select"):
            self._flush_selection()

        dispatch = {
            # Background / effects
            "image_bg":             self._image_bg,
            "change_bg_effect":     self._change_bg_effect,
            "screen_fadeout":       self._screen_fade,
            "screen_fadein":        self._screen_fadein,
            "screen_fadecolor":     self._screen_fadecolor,
            "screen_slidein":       self._screen_slidein,
            "screen_slideout":      self._screen_slideout,
            "image_bg_dissolve":    self._image_bg_dissolve,
            "image_bg_dof":         self._image_bg_dof,
            "image_bg_color":       self._image_bg_color,
            "image_bg_view_type":   self._image_bg_view_type,
            "effect_bgstart":       self._effect_bgstart,
            "effect_bgend":         self._effect_bgend,
            "effect_fadein":        self._effect_fadein,
            "effect_fadeout":       self._effect_fadeout,
            "effect_single":        self._effect_single,

            # Camera / visual filters
            "camera_color":         self._camera_color,
            "camera_defaultcolor":  self._camera_defaultcolor,
            "camera_zoom":          self._camera_zoom,
            "camera_resetzoom":     self._camera_resetzoom,

            # Audio
            "bgm":                  self._bgm,
            "bgm_stop":             self._bgm_stop,
            "se":                   self._se,
            "se_stop":              self._se_stop,
            "voice_file":           self._voice_file,
            "voice_noLip":          self._voice_noLip,
            "voice":                self._voice_bare,
            "text_se_off":          self._text_se_off,

            # Character (idol) management
            "idol_model":           self._idol_model,
            "idol_position":        self._idol_position,
            "idol_slide":           self._idol_slide,
            "idol_slidein":         self._idol_slide,
            "idol_slideout":        self._idol_slide,
            "idol_fadein":          self._idol_fadein,
            "idol_fadeout":         self._idol_fadeout,
            "idol_delete":          self._idol_delete,
            "idol_face":            self._idol_face,
            "idol_animation":       self._idol_animation,
            "idol_nobackanimation": self._idol_nobackanimation,
            "idol_neckanimation":   self._idol_neckanimation,
            "idol_neckanimation_stop": self._idol_neckanimation_stop,
            "idol_parts_on":        self._idol_parts_on,
            "idol_parts_off":       self._idol_parts_off,
            "idol_color":           self._idol_color,
            "idol_priority":        self._idol_priority,
            "idol_zoom":            self._idol_zoom,
            "idol_zoom_reset":      self._idol_zoom_reset,
            "image_icon":           None,  # icon for mob chars — skip

            "image_icon":           self._image_icon,
            "image_Icon":           self._image_icon,

            # Dialogue-producing
            "text":                 self._text,
            "talk_text":            self._talk_text,
            "talk_start":           self._talk_start,
            "talk_end":             None,
            "talk_stamp":           self._talk_stamp,
            "phone_text":           self._phone_text,
            "phone_start":          self._phone_start,
            "phone_end":            None,
            "text_disable":         self._text_disable,

            # Branching / choices
            "text_select":          self._select,
            "talk_select":          self._select,
            "phone_select":         self._select,
            "jump_point":           self._jump_point_cmd,
            "jump":                 None,  # skip — flow control handled by step index

            "cut_end":              self._cut_end,
            "lounge_end":           self._cut_end,

            # Meta
            "text_synopsis":        self._text_synopsis,
            "text_title":           self._text_title,
            "text_time":            self._text_time,
            "wait":                 self._wait,
            "environmental":            self._environmental,
            "environmental_stop":       self._environmental_stop,
            "environmental_volume":     self._environmental_volume,
            "environmental_ducking":    self._environmental_ducking,
        }

        handler = dispatch.get(ctype)
        if handler:
            handler(vals)
        # else: silently skip unknown / no-op commands

    # ----------------------------------------------------------------
    # Scene state commands
    # ----------------------------------------------------------------

    def _mark_stage_change(self, performance: bool = True):
        self._stage_dirty = True
        if performance:
            self._stage_has_performance = True

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _wait(self, vals: list):
        """Raw wait can be a standalone silent performance beat."""
        duration = self._safe_float(vals[0], 0.0) if vals else 0.0
        if duration <= 0:
            return
        if self._pending_text_disable:
            self._pending_text_disable_duration = max(self._pending_text_disable_duration, duration)
            # A wait after text_disable is the authored length of the hidden
            # text-box transition. Emit it now so later reset/fade-in commands
            # become their own silent stage instead of overwriting this shot.
            self._flush_pending_text_disable()
            return
        if self._stage_dirty and self._stage_has_performance:
            self._emit_stage(duration)

    def _clear_stage_buffer(self):
        self._stage_dirty = False
        self._stage_has_performance = False
        self._stage_duration_hint = 0.0

    def _extend_stage_duration(self, duration: float):
        if duration is not None and duration > 0:
            self._stage_duration_hint = max(self._stage_duration_hint, duration)

    def _extend_pending_text_disable_duration(self, *durations: float):
        if not self._pending_text_disable:
            return
        for duration in durations:
            if duration is not None and duration > 0:
                self._pending_text_disable_duration = max(self._pending_text_disable_duration, duration)

    def _extend_pending_text_disable_from_vals(self, vals: list, delay_index: int = 0, duration_index: int = 1):
        if not self._pending_text_disable:
            return
        delay = self._safe_float(vals[delay_index], 0.0) if len(vals) > delay_index else 0.0
        duration = self._safe_float(vals[duration_index], 0.0) if len(vals) > duration_index else 0.0
        self._extend_pending_text_disable_duration(delay + duration)

    def _flush_pending_text_disable(self):
        if not self._pending_text_disable:
            return
        duration = max(0.2, self._pending_text_disable_duration)
        self._pending_text_disable = False
        self._pending_text_disable_duration = 0.6
        self._emit_step("text_disable", None, None, None, None, duration=duration)

    def _emit_stage(self, duration: float):
        timeline_tail = 0.0
        if self._timeline_events:
            timeline_tail = max(self._safe_float(e.get("time"), 0.0) for e in self._timeline_events)
        self._emit_step("stage", None, None, None, None, duration=max(0.05, duration, self._stage_duration_hint, timeline_tail + 0.2))

    @classmethod
    def _load_adv_background_index(cls) -> dict[str, dict]:
        if cls._ADV_BACKGROUND_INDEX is not None:
            return cls._ADV_BACKGROUND_INDEX

        index: dict[str, dict] = {}
        root = cls.ADV_BACKGROUND_ROOT
        if os.path.isdir(root):
            for name in os.listdir(root):
                if not name.startswith("advbg_data_") or not name.endswith(".json"):
                    continue
                path = os.path.join(root, name)
                try:
                    with open(path, "r", encoding="utf-8-sig") as f:
                        data = json.load(f)
                except Exception:
                    continue
                image_id = data.get("imageId")
                if image_id:
                    index[image_id] = data

        cls._ADV_BACKGROUND_INDEX = index
        return index

    @classmethod
    def _default_audio_exists(cls, audio_type: str, cue: Optional[str]) -> bool:
        if not cue or cue in ("-", "no_bgm"):
            return False

        if audio_type == "bgm":
            return os.path.isfile(os.path.join(cls.AUDIO_ROOT, "bgm", f"{cue}.ogg"))

        if audio_type == "ambient":
            path = os.path.join(cls.AUDIO_ROOT, "ambient", f"{cue}.ogg")
            if os.path.isfile(path):
                return True
            if cue.endswith("_t"):
                return os.path.isfile(os.path.join(cls.AUDIO_ROOT, "ambient", f"{cue[:-2]}.ogg"))

        return False

    def _apply_adv_background_defaults(self, bg_id: str):
        meta = self._load_adv_background_index().get(bg_id)
        if not meta:
            self.state.bg_profile = None
            return

        self.state.bg_profile = {
            "imageId": meta.get("imageId"),
            "lightPosition": meta.get("lightPosition"),
            "lightCoordinate": meta.get("lightCoordinate"),
            "lightAlpha": meta.get("lightAlpha"),
            "colorOffSet": meta.get("colorOffSet"),
            "colorScale": meta.get("colorScale"),
            "colorSaturation": meta.get("colorSaturation"),
        }

        bgm_cue = meta.get("bgmCueName")
        if self._default_audio_exists("bgm", bgm_cue) and (not self.state.bgm or self._bgm_from_advbackground):
            self.state.set_bgm(bgm_cue)
            self._bgm_from_advbackground = True
        elif self._bgm_from_advbackground and not self._default_audio_exists("bgm", bgm_cue):
            self.state.stop_bgm()
            self._bgm_from_advbackground = False

        ambience_cue = meta.get("ambienceCueName")
        if self._default_audio_exists("ambient", ambience_cue) and (not self.state.environmental or self._environmental_from_advbackground):
            self.state.environmental = {"cue": ambience_cue}
            self._environmental_from_advbackground = True
        elif self._environmental_from_advbackground and not self._default_audio_exists("ambient", ambience_cue):
            self.state.environmental = None
            self._environmental_from_advbackground = False

    def _image_bg(self, vals: list):
        """Values: [bg_id, ...]"""
        if vals and vals[0]:
            self.state.set_bg(vals[0])
            self._apply_adv_background_defaults(vals[0])
            self._mark_stage_change()

    def _image_bg_dissolve(self, vals: list):
        """Background dissolve transition.
        Values: [bg_id, color?, delay?, duration?, ...]
        """
        if vals and vals[0]:
            delay = self._safe_float(vals[2], 0.0) if len(vals) > 2 else 0.0
            duration = self._safe_float(vals[3], 0.5) if len(vals) > 3 and vals[3] != "" else 0.5
            self.state.set_bg(vals[0])
            self.state.bg_transition = {
                "type": "dissolve",
                "color": vals[1] if len(vals) > 1 and vals[1] else "",
                "delay": delay,
                "duration": duration,
            }
            self._extend_pending_text_disable_duration(delay + duration)
            self._mark_stage_change()

    def _change_bg_effect(self, vals: list):
        if vals and vals[0]:
            self.state.bg_effect = vals[0]
            self._mark_stage_change()

    def _screen_fade(self, vals: list):
        """screen_fadeout — fade to black/color. Emits as a standalone step.
        Values: [mode?, duration?, ...]
        mode 0 = black, 1 = white
        """
        # Raw values are delay, duration, and optional color; color defaults to black.
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.5) if len(vals) > 1 and vals[1] else 0.5
        color = vals[2] if len(vals) > 2 and vals[2] else "#000000"
        self.state.screen_fade = {
            "type": "in",
            "duration": duration,
            "delay": delay,
            "color": color,
        }
        self._clear_stage_buffer()
        self._emit_step("fadeout", None, None, None, None)

    def _screen_fadein(self, vals: list):
        """screen_fadein — fade in from black/color. Emits as a standalone step.
        Values: [mode?, duration?, hex_color?, ...]
        mode 0 = black, 1 = white; hex_color overrides mode.
        """
        # Raw values are delay, duration, and optional color; color defaults to black.
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.5) if len(vals) > 1 and vals[1] else 0.5
        color = vals[2] if len(vals) > 2 and vals[2] else "#000000"
        self.state.screen_fade = {
            "type": "out",
            "duration": duration,
            "delay": delay,
            "color": color,
        }
        self._clear_stage_buffer()
        self._emit_step("fadein", None, None, None, None)

    # ── Camera zoom / pan ──

    def _screen_fadecolor(self, vals: list):
        """Color screen fade with explicit overlay alpha."""
        mode = vals[0] if len(vals) > 0 and vals[0] else "0"
        duration = self._safe_float(vals[1], 0.5) if len(vals) > 1 else 0.5
        color = vals[2] if len(vals) > 2 and vals[2] else ("#FFFFFF" if mode in ("1", "2") else "#000000")
        alpha = self._safe_float(vals[4], 1.0) if len(vals) > 4 and vals[4] != "" else 1.0
        delay = self._safe_float(vals[5], 0.0) if len(vals) > 5 else 0.0
        fade_type = "in" if mode == "1" else "out"
        self.state.screen_fade = {
            "type": fade_type,
            "duration": duration,
            "delay": delay,
            "color": color,
            "alpha": max(0.0, min(1.0, alpha)),
        }
        self._clear_stage_buffer()
        self._emit_step("fadecolor", None, None, None, None, duration=delay + duration)

    def _screen_slidein(self, vals: list):
        self._screen_slide(vals, "in")

    def _screen_slideout(self, vals: list):
        self._screen_slide(vals, "out")

    def _screen_slide(self, vals: list, slide_type: str):
        """Screen wipe transition. Values: [delay?, duration?, direction?, ...]."""
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.5) if len(vals) > 1 and vals[1] != "" else 0.5
        direction = str(vals[2]) if len(vals) > 2 and vals[2] else "6"
        self.state.screen_slide = {
            "type": slide_type,
            "delay": delay,
            "duration": duration,
            "direction": direction,
            "color": "#000000",
        }
        self._clear_stage_buffer()
        self._emit_step(f"slide{slide_type}", None, None, None, None)

    def _find_bg_effect(self, effect_id: str) -> Optional[dict]:
        for effect in self.state.bg_effects:
            if effect.get("id") == effect_id:
                return effect
        return None

    def _effect_bgstart(self, vals: list):
        """Start persistent background effect. Values: [effect_id, delay?, duration?, ...]."""
        if not vals or not vals[0]:
            return
        effect_id = vals[0]
        delay = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        duration = self._safe_float(vals[2], 0.0) if len(vals) > 2 and vals[2] != "" else 0.0
        payload = {
            "id": effect_id,
            "visible": True,
            "action": "start",
            "delay": delay,
            "duration": duration,
        }
        effect = self._find_bg_effect(effect_id)
        if effect:
            effect.update(payload)
        else:
            self.state.bg_effects.append(payload)
        self._pending_bg_effect_end_ids.discard(effect_id)
        self._extend_pending_text_disable_duration(delay + duration)
        self._mark_stage_change()

    def _effect_bgend(self, vals: list):
        """End persistent background effect. Values: [effect_id, delay?, duration?, ...]."""
        if not vals or not vals[0]:
            return
        effect_id = vals[0]
        delay = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        duration = self._safe_float(vals[2], 0.0) if len(vals) > 2 and vals[2] != "" else 0.0
        payload = {
            "id": effect_id,
            "visible": False,
            "action": "end",
            "delay": delay,
            "duration": duration,
        }
        effect = self._find_bg_effect(effect_id)
        if effect:
            effect.update(payload)
        else:
            self.state.bg_effects.append(payload)
        self._pending_bg_effect_end_ids.add(effect_id)
        self._extend_pending_text_disable_duration(delay + duration)
        self._mark_stage_change()

    def _camera_zoom(self, vals: list):
        """Camera dolly zoom/pan.
        Values: [wait_before, duration, offset_x?, offset_y?, zoom?]
        offset_x/offset_y are native game coords camera target center.
        zoom: 1.0=default, >1=zoom in, <1=zoom out
        """
        if len(vals) >= 3:
            delay = self._safe_float(vals[0], 0.0)
            duration = float(vals[1]) if vals[1] else 0
            offset_x = float(vals[2]) if len(vals) > 2 and vals[2] else 0
            offset_y = float(vals[3]) if len(vals) > 3 and vals[3] else 0
            zoom = float(vals[4]) if len(vals) > 4 and vals[4] else 1.0
            self.state.camera_zoom = {
                "zoom": zoom, "offset_x": offset_x, "offset_y": offset_y,
                "duration": duration, "delay": delay,
            }
            self._extend_pending_text_disable_from_vals(vals, 0, 1)
            self._extend_stage_duration(delay + duration)
            self._mark_stage_change()

    def _camera_resetzoom(self, vals: list):
        """Reset camera to default position and zoom."""
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        self.state.camera_zoom = {
            "zoom": 1.0,
            "offset_x": 0.0,
            "offset_y": 0.0,
            "duration": duration,
            "delay": delay,
        }
        self._extend_pending_text_disable_duration(delay + duration)
        self._extend_stage_duration(delay + duration)
        self._mark_stage_change()

    def _camera_color(self, vals: list):
        """Values: [filter_name, delay, duration, ...] — e.g. ["gray", "0", "0"]"""
        if vals and vals[0]:
            self.state.camera_filter = vals[0]
            self._extend_pending_text_disable_from_vals(vals, 1, 2)
            self._mark_stage_change()

    def _camera_defaultcolor(self, vals: list):
        """Revert camera filter/color to default."""
        self.state.camera_filter = None
        self._mark_stage_change()

    def _image_bg_dof(self, vals: list):
        """Background depth-of-field blur.
        Values: [delay, duration, blur_amount?, ...]
        blur_amount empty → clear blur.
        """
        if len(vals) >= 3 and vals[2]:
            try:
                self.state.bg_dof = float(vals[2])
            except ValueError:
                self.state.bg_dof = None
        else:
            self.state.bg_dof = None
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        self.state.bg_dof_transition = {"delay": delay, "duration": duration}
        self._extend_pending_text_disable_from_vals(vals, 0, 1)
        self._mark_stage_change()

    def _image_bg_color(self, vals: list):
        """Background color overlay.
        Values: [delay, duration, hex_color?, ...]
        hex_color empty → clear overlay; otherwise #RRGGBB.
        """
        if len(vals) >= 3 and vals[2]:
            self.state.bg_color = vals[2]
        else:
            self.state.bg_color = None
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        self.state.bg_color_transition = {"delay": delay, "duration": duration}
        self._extend_pending_text_disable_from_vals(vals, 0, 1)
        self._mark_stage_change()

    def _image_bg_view_type(self, vals: list):
        """Background display mode hint for event stills."""
        if vals:
            self.state.bg_view_type = vals[0] if vals[0] != "" else None
            self._mark_stage_change(False)

    def _effect_fadein(self, vals: list):
        self._append_screen_effect("fadein", vals)

    def _effect_fadeout(self, vals: list):
        self._append_screen_effect("fadeout", vals)

    def _append_screen_effect(self, effect_type: str, vals: list):
        delay = self._safe_float(vals[0], 0.0) if len(vals) > 0 else 0.0
        duration = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        color = vals[2] if len(vals) > 2 and vals[2] else "#FFFFFF"
        alpha = self._safe_float(vals[4], 1.0) if len(vals) > 4 and vals[4] != "" else 1.0
        self.state.screen_effects.append({
            "type": effect_type,
            "delay": delay,
            "duration": duration,
            "color": color,
            "alpha": max(0.0, min(1.0, alpha)),
        })
        self._extend_pending_text_disable_duration(delay + duration)
        self._mark_stage_change()

    def _effect_single(self, vals: list):
        if not vals or not vals[0]:
            return
        delay = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
        x = self._safe_float(vals[2], 0.0) if len(vals) > 2 else 0.0
        y = self._safe_float(vals[3], 0.0) if len(vals) > 3 else 0.0
        scale = self._safe_float(vals[4], 1.0) if len(vals) > 4 and vals[4] != "" else 1.0
        self.state.screen_effects.append({
            "type": "single",
            "id": vals[0],
            "delay": delay,
            "x": x,
            "y": y,
            "scale": scale,
            "duration": 0.35,
        })
        self._extend_pending_text_disable_duration(delay + 0.35)
        self._mark_stage_change()

    def _bgm(self, vals: list):
        """Values: [cue_id, ...] — empty vals means stop.
        'no_bgm' is a special keyword meaning no BGM should play.
        """
        if vals and vals[0] and vals[0] != 'no_bgm':
            self.state.set_bgm(vals[0])
            self._bgm_from_advbackground = False
        else:
            self.state.stop_bgm()
            self._bgm_from_advbackground = False
        self._mark_stage_change()

    def _bgm_stop(self, vals: list):
        """BGM stop with optional fade duration.
        Values: [fade_duration?, ...]
        """
        fade = float(vals[0]) if vals and vals[0] else 0
        self.state.stop_bgm()
        self._bgm_from_advbackground = False
        self.state.bgm_stop_fade = fade
        self._mark_stage_change()

    def _se(self, vals: list):
        """Sound effect — one-shot audio.
        Values: [cue_name, delay?, ...]
        """
        if vals and vals[0]:
            event = {"cue": vals[0]}
            if len(vals) > 1 and vals[1]:
                event["delay"] = self._safe_float(vals[1], 0.0)
            self.state.se = event
            self.state.se_events.append(event)
            self._mark_stage_change()

    def _se_stop(self, vals: list):
        """Stop SE playback (not commonly used, but supported)."""
        self.state.se = None
        self.state.se_events = []
        self._mark_stage_change()

    def _environmental(self, vals: list):
        """Looping ambient audio — crossfades from previous.
        Values: [main_cue, fade_cue?, ..., volume?, state?, ...]
        vals[0]=main_cue, vals[1]=crossfade_to_cue, vals[3]=volume
        """
        if vals and vals[0]:
            env = {"cue": vals[0]}
            if len(vals) > 3 and vals[3]:
                try:
                    env["volume"] = float(vals[3])
                except ValueError:
                    env["volume"] = None
            self.state.environmental = env
            self._environmental_from_advbackground = False
            self._mark_stage_change()

    def _environmental_stop(self, vals: list):
        """Stop ambient with fade.
        Values: [fade_seconds, ...]
        """
        self.state.environmental = None
        self._environmental_from_advbackground = False
        self._mark_stage_change()

    def _environmental_volume(self, vals: list):
        """Set ambient volume directly.
        Values: [volume?, ...]
        """
        if vals and vals[0]:
            try:
                vol = float(vals[0])
                if self.state.environmental:
                    self.state.environmental["volume"] = vol
                    self._mark_stage_change()
            except ValueError:
                pass

    def _environmental_ducking(self, vals: list):
        """Duck/attenuate environmental audio.
        Values: [target_volume?, ...] — 0=full duck (mute), 0.5=half volume.
        Sets environmental_duck_target on state (one-shot, consumed by next snapshot).
        """
        if vals and vals[0]:
            try:
                self.state.environmental_duck_target = float(vals[0])
                self._mark_stage_change()
            except ValueError:
                pass

    def _voice_file(self, vals: list):
        """Values: [voice_prefix, ...]"""
        if vals and vals[0]:
            self._voice_prefix = vals[0]
            self._mark_stage_change(False)

    def _voice_noLip(self, vals: list):
        """Voice-only without lip sync (内心声).
        Values: [chara_id, delay, voice_suffix, ...]
        Sets a flag consumed by the next text step.
        Stores the voice suffix so the next text step can use it.
        """
        self._noLipSync = True
        if len(vals) > 2 and vals[2]:
            self._noLipVoiceSuffix = vals[2]

    def _voice_bare(self, vals: list):
        """Bare voice command — provides audio for the next text step.
        Values: [chara_id, delay, voice_suffix, ...]
        Unlike voice_noLip, this does NOT suppress lip sync.
        The following text command's vals[4] (クチパク/off) controls lip sync.
        """
        if len(vals) > 2 and vals[2]:
            self._voiceBareSuffix = vals[2]

    def _text_se_off(self, vals: list):
        """On-screen text with sound effect, no speaker, no lip sync.
        Values: ['', text, ...]
        """
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        self._emit_step("adv", "", text, None, None, lipSync=False)

    # ----------------------------------------------------------------
    # Character (idol) commands
    # ----------------------------------------------------------------

    def _idol_model(self, vals: list):
        """Values: [chara_id, model_id, ...]"""
        if len(vals) >= 2 and vals[0] and vals[1]:
            self.state.spawn_spine(vals[0], vals[1])
            if vals[0] in self._pending_idol_priority:
                spine = self.state.find_spine(vals[0])
                if spine:
                    spine["idol_priority"] = self._pending_idol_priority[vals[0]]
            if vals[0] in self._pending_parts_visible:
                spine = self.state.find_spine(vals[0])
                if spine:
                    spine["parts_visible"] = self._pending_parts_visible[vals[0]]
            self._mark_stage_change(False)

    def _idol_position(self, vals: list):
        """Values: [chara_id, x, y?, ...]
        x,y are native game coordinates (e.g. 0,0 = center; -200,0 = left).
        Stored in spine state for frontend positioning.
        """
        if vals and vals[0]:
            pos_x = float(vals[1]) if len(vals) > 1 and vals[1] else 0.0
            pos_y = float(vals[2]) if len(vals) > 2 and vals[2] else 0.0
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["pos_x"] = pos_x
                spine["pos_y"] = pos_y
                self._mark_stage_change(False)

    def _idol_slide(self, vals: list):
        """Animate character to target position.
        Values: [chara_id, wait_before?, duration?, pos_x?, pos_y?]
        Also handles idle_slidein / idol_slideout (same format, diff semantics).
        Updates pos_x/pos_y immediately + stores slide_duration for frontend animation.
        """
        if vals and vals[0]:
            wait = float(vals[1]) if len(vals) > 1 and vals[1] else 0
            duration = float(vals[2]) if len(vals) > 2 and vals[2] else 0.3
            pos_x = float(vals[3]) if len(vals) > 3 and vals[3] else 0.0
            pos_y = float(vals[4]) if len(vals) > 4 and vals[4] else 0.0
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["pos_x"] = pos_x
                spine["pos_y"] = pos_y
                spine["slide_duration"] = duration
                self._mark_stage_change()

    def _idol_color(self, vals: list):
        """Tint character with a color (dim/emphasize).
        Values: [chara_id, delay?, duration?, hex_color?]
        hex_color: #AAAAAA (dim), #FFFFFF (normal).
        delay=0 → immediate state; delay>0 → timeline event (mid-sentence change).
        """
        if len(vals) >= 4 and vals[0] and vals[3]:
            delay = float(vals[1]) if vals[1] else 0
            duration = float(vals[2]) if len(vals) > 2 and vals[2] else 0
            color = vals[3]
            if self._pending_text_disable:
                spine = self.state.find_spine(vals[0])
                if spine:
                    spine["idol_color"] = color
                    spine["idol_color_transition"] = {"delay": delay, "duration": duration}
            elif delay > 0:
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_color",
                    "chara_id": vals[0],
                    "value": color,
                    "duration": duration,
                })
            else:
                spine = self.state.find_spine(vals[0])
                if spine:
                    spine["idol_color"] = color
            self._extend_pending_text_disable_duration(delay + duration)
            self._mark_stage_change()

    def _idol_priority(self, vals: list):
        """Render priority for multi-character scenes.
        Values: [chara_id, priority, ...]. Higher values render in front.
        """
        if len(vals) >= 2 and vals[0] and vals[1] != "":
            priority = self._safe_float(vals[1], 0.0)
            self._pending_idol_priority[vals[0]] = priority
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["idol_priority"] = priority
            self._mark_stage_change()

    # Y-offset factor applied when idol_zoom < 1.0 to compensate for
    # the visual sinking caused by root-anchored scaling. Derived from
    # the entrance scene in 1_1_013the_02 where zoom=0.8 needed +150px:
    #   150 = (1 - 0.8) * 750
    # Only applies for zoom < 1.0 (characters scaled down look "sunk"
    # because the root-anchor compresses them toward the waist). Zoom
    # > 1.0 (enlarged) naturally fills the vertical space — no lift needed.
    ZOOM_Y_OFFSET_FACTOR = 750.0

    def _idol_zoom(self, vals: list):
        """Character-specific zoom (scale multiplier).
        Values: [chara_id, wait?, duration?, ?, ?, zoom_level?]
        zoom_level: 0.8=80%, 1.2=120%, etc.
        Stores zoom multiplier in spine state. Also computes a Y
        offset (idol_zoom_y_offset) to counteract visual sinking
        when the character scales down around the root anchor.
        """
        if vals and vals[0] and len(vals) >= 6 and vals[5]:
            zoom = float(vals[5])
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["idol_zoom"] = zoom
                if zoom < 1.0 and zoom > 0:
                    spine["idol_zoom_y_offset"] = (1.0 - zoom) * self.ZOOM_Y_OFFSET_FACTOR
                else:
                    spine.pop("idol_zoom_y_offset", None)
                self._mark_stage_change()

    def _idol_zoom_reset(self, vals: list):
        """Reset character zoom to default."""
        if vals and vals[0]:
            spine = self.state.find_spine(vals[0])
            if spine:
                spine.pop("idol_zoom", None)
                spine.pop("idol_zoom_y_offset", None)
                self._mark_stage_change()

    def _idol_fadein(self, vals: list):
        """Values: [chara_id, delay, duration?, ...]"""
        if vals and vals[0]:
            delay = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
            duration = self._safe_float(vals[2], 0.2) if len(vals) > 2 and vals[2] != "" else 0.2
            self._pending_fadeout_ids.discard(vals[0])
            self.state.set_spine_visible(vals[0], True)
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["fade"] = {"type": "in", "delay": delay, "duration": duration}
            self._extend_pending_text_disable_duration(delay + duration)
            self._mark_stage_change()

    def _idol_fadeout(self, vals: list):
        """Values: [chara_id, delay, duration?, ...]"""
        if vals and vals[0]:
            delay = self._safe_float(vals[1], 0.0) if len(vals) > 1 else 0.0
            duration = self._safe_float(vals[2], 0.2) if len(vals) > 2 and vals[2] != "" else 0.2
            # Keep the spine visible for the emitted step so the frontend can
            # animate alpha to 0, then hide it from following snapshots.
            self.state.set_spine_visible(vals[0], True)
            spine = self.state.find_spine(vals[0])
            if spine:
                spine["fade"] = {"type": "out", "delay": delay, "duration": duration}
                self._pending_fadeout_ids.add(vals[0])
            self._extend_pending_text_disable_duration(delay + duration)
            self._mark_stage_change()

    def _idol_delete(self, vals: list):
        """Values: [chara_id, ...]"""
        if vals and vals[0]:
            self.state.remove_spine(vals[0])
            self._mark_stage_change()

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
            self._mark_stage_change()

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
            self._mark_stage_change()

    def _idol_nobackanimation(self, vals: list):
        """Body animation that should not auto-chain back to wait/loop."""
        if len(vals) >= 3 and vals[0] and vals[2]:
            delay = float(vals[1]) if vals[1] else 0
            if delay > 0:
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_anim",
                    "chara_id": vals[0],
                    "value": vals[2],
                    "no_back": True,
                })
            else:
                self.state.update_spine_anim(vals[0], vals[2])
                spine = self.state.find_spine(vals[0])
                if spine:
                    spine["anim_no_back"] = True
            self._mark_stage_change()

    def _idol_neckanimation(self, vals: list):
        """Neck/head animation on a separate track from body animation."""
        if len(vals) >= 3 and vals[0] and vals[2]:
            delay = float(vals[1]) if vals[1] else 0
            if delay > 0:
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_neck_anim",
                    "chara_id": vals[0],
                    "value": vals[2],
                })
            else:
                self.state.update_spine_neck_anim(vals[0], vals[2])
            self._mark_stage_change()

    def _idol_neckanimation_stop(self, vals: list):
        """Stop neck/head animation at the authored delay."""
        if len(vals) >= 1 and vals[0]:
            delay = float(vals[1]) if len(vals) > 1 and vals[1] else 0
            if delay > 0:
                self._timeline_events.append({
                    "time": delay,
                    "type": "spine_neck_stop",
                    "chara_id": vals[0],
                    "value": "",
                })
            else:
                self.state.update_spine_neck_anim(vals[0], None)
            self._mark_stage_change()

    def _idol_parts_on(self, vals: list):
        """Show optional model parts for a character."""
        if vals and vals[0]:
            self._pending_parts_visible[vals[0]] = True
            self.state.set_spine_parts_visible(vals[0], True)
            self._mark_stage_change()

    def _idol_parts_off(self, vals: list):
        """Hide optional model parts for a character."""
        if vals and vals[0]:
            self._pending_parts_visible[vals[0]] = False
            self.state.set_spine_parts_visible(vals[0], False)
            self._mark_stage_change()

    def _image_icon(self, vals: list):
        """Scene/dialogue identity icon.

        Raw values usually store [icon_id, display_id, layer?, ...]. The first
        non-empty identifier is the asset key used by image_chara_icon_*.png.
        """
        icon_id = ""
        display_id = ""
        for idx in (0, 1):
            if len(vals) > idx and vals[idx]:
                candidate = str(vals[idx]).strip()
                if candidate and not candidate.startswith("$"):
                    if not icon_id:
                        icon_id = candidate
                    if idx == 1:
                        display_id = candidate
                    break
        if not icon_id:
            return
        layer = vals[2] if len(vals) > 2 and vals[2] else ""
        self.state.image_icon = {
            "id": icon_id,
            "display_id": display_id or icon_id,
            "layer": layer,
        }
        self._mark_stage_change(False)

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

    def _text_disable(self, vals: list):
        """Hide text box immediately (standalone step — like screen_fadeout).
        The frontend sees step.type='text_disable' and hides the ADV text box,
        allowing transition effects (bg_dof, bg_color, idol_color) to play
        cleanly before the next dialogue step appears.
        """
        self._pending_text_disable = True
        self._pending_text_disable_duration = 0.6
        self._clear_stage_buffer()

    def _text(self, vals: list):
        """
        Main ADV dialogue.
        Values: [speaker_name, text, chara_id, voice_suffix, lipSync_flag?, ...]

        lipSync_flag (vals[4]):
          - "off" → inner monologue (voice plays but mouth doesn't move)
          - "クチパク" or empty → normal (lip sync enabled)
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""
        voice_suffix = vals[3] if len(vals) > 3 else ""

        # Determine lipSync state
        lipSync = None  # None = default (true)
        if len(vals) > 4 and vals[4].strip() == "off":
            lipSync = False
        elif self._noLipSync:
            lipSync = False

        # Inherit voice suffix from voice_noLip command
        if self._noLipVoiceSuffix and not voice_suffix:
            voice_suffix = self._noLipVoiceSuffix

        # Inherit voice suffix from bare voice command
        if self._voiceBareSuffix and not voice_suffix:
            voice_suffix = self._voiceBareSuffix

        # Clear inherited voice state
        self._noLipSync = False
        self._noLipVoiceSuffix = None
        self._voiceBareSuffix = None

        voice = self._build_voice_filename(voice_suffix) if voice_suffix else None
        lip = self._resolve_lip_sync(chara_id, voice_suffix, lipSync)

        self._emit_step("adv", speaker, text, voice, chara_id, lipSync, lip)

    def _talk_text(self, vals: list):
        """
        Talk/chat mode dialogue.
        Values: [speaker_name, text, chara_id, display_duration, ...]
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        text = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""

        self._emit_step("talk", speaker, text, None, chara_id)

    def _talk_stamp(self, vals: list):
        """
        Talk/chat stamp.
        Values: [speaker_name, stamp_id, chara_id, side?, ...]
        """
        speaker = vals[0] if len(vals) > 0 and vals[0] else ""
        raw_stamp = vals[1] if len(vals) > 1 and vals[1] else ""
        chara_id = vals[2] if len(vals) > 2 else ""
        side = vals[3] if len(vals) > 3 and vals[3] != "" else ""
        stamp_id = raw_stamp if raw_stamp.startswith("image_mobile_stamp_") else f"image_mobile_stamp_{raw_stamp}"

        self._emit_step("talk_stamp", speaker, "", None, chara_id, duration=1.0)
        self.steps[-1]["stamp"] = {
            "id": stamp_id,
            "raw_id": raw_stamp,
            "speaker": speaker,
            "chara_id": chara_id,
            "side": side,
        }
        self.steps[-1]["auto_advance"] = True

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
        lip = self._resolve_lip_sync(chara_id, voice_suffix, None)
        self._emit_step("call", speaker, text, voice, chara_id, None, lip)

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
            self._flush_pending_text_disable()
            self._apply_timeline()  # flush pending timeline before choice snapshot
            self._pending_selection = {
                "type": "choice",
                "state": self.state.snapshot(),
                "options": [],
                "choice_id": (
                    f"choice:v{self.TEXT_ID_VERSION}:{self.text_catalog_id}:"
                    f"{self._source_part_id}:cmd-{self._current_command_index:06d}"
                ),
                "source_file": self._source_file,
                "source_part_id": self._source_part_id,
                "command_start": self._current_command_index,
                "command_end": self._current_command_index,
                "raw_type": self._current_raw_type,
            }
        option_ordinal = len(self._pending_selection["options"])
        option = {
            "label": label,
            "text": short_text,
            "detail": long_text,
            "source_text": short_text,
            "option_id": (
                f"choice-option:v{self.TEXT_ID_VERSION}:{self.text_catalog_id}:"
                f"{self._source_part_id}:cmd-{self._current_command_index:06d}:{option_ordinal:03d}"
            ),
            "text_ref": self._text_ref(short_text, "choice_short", 0),
        }
        if long_text:
            option["detail_source_text"] = long_text
            option["detail_text_ref"] = self._text_ref(long_text, "choice_detail", 0)
        self._pending_selection["options"].append(option)
        self._pending_selection["command_end"] = self._current_command_index

    def _jump_point_cmd(self, vals: list):
        """Track jump_point labels. Consecutive labels all map to the next step."""
        label = vals[0] if vals and vals[0] else ""
        if label:
            self._jump_point_labels.append(label)

    def _cut_end(self, vals: list):
        """Scene segment boundary. Flush silent performance if one is pending."""
        if self._pending_text_disable:
            if self._stage_dirty and self._stage_has_performance:
                self._flush_pending_text_disable()
            return
        if self._stage_dirty and self._stage_has_performance:
            self._emit_stage(0.2)

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
            "choice_id": self._pending_selection["choice_id"],
            "evidence": {
                "source_file": self._pending_selection["source_file"],
                "source_part_id": self._pending_selection["source_part_id"],
                "command_start": self._pending_selection["command_start"],
                "command_end": self._pending_selection["command_end"],
                "raw_type": self._pending_selection["raw_type"],
                "confidence": "exact",
            },
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

    def _text_time(self, vals: list):
        """Time/location caption shown during transitions."""
        self._apply_timeline()
        text = vals[0] if len(vals) > 0 and vals[0] else ""
        if not text:
            return
        self._clear_stage_buffer()
        self._emit_step("text_time", None, None, None, None, duration=1.2)
        self.steps[-1]["text_time"] = {
            "text": text,
            "source_text": text,
            "text_ref": self._text_ref(text, "time_caption", 0),
        }
        self.steps[-1]["auto_advance"] = True

    # ----------------------------------------------------------------
    # Voice filename construction
    # ----------------------------------------------------------------

    def _build_voice_filename(self, suffix: str) -> str:
        """
        Construct voice filename.
        - If voice_file prefix was set: {prefix}_{suffix}.m4a
        - If scenario_id implies a lip/voice base and the suffix is numeric:
          {base}_{suffix}.m4a
        - Otherwise: {suffix}.m4a  (standalone voice ID)
        """
        if self._voice_prefix:
            part_suffix = re.match(r"^([a-z])\d+$", suffix, re.IGNORECASE)
            if part_suffix and self._voice_prefix.lower().endswith(f"_{part_suffix.group(1).lower()}"):
                # Lettered chunks commonly use prefix "..._a" with suffix
                # "a1000". The authored cue is "..._a1000", not
                # "..._a_a1000".
                return f"{self._voice_prefix[:-1]}{suffix}.m4a"
            return f"{self._voice_prefix}_{suffix}.m4a"
        if re.search(r"(?<!\d)9_2_\d{3}(?!\d)", self.scenario_id or "") and self._lip_base_id and suffix == "00":
            return f"{self._lip_base_id}.m4a"
        if self._lip_base_id and re.match(r"^\d+$", suffix):
            return f"{self._lip_base_id}_{suffix}.m4a"
        return f"{suffix}.m4a"

    @staticmethod
    def _infer_lip_owner_id(scenario_id: str) -> Optional[str]:
        """Best-effort owner directory for adxlip data.

        Most solo stories store lip data under the speaking chara id. Some
        grouped 1_2 stories store all lip data under the scenario owner id
        embedded in the compiled scenario_id, e.g. 1_x_001tom_2.
        """
        m = re.search(r"\d{3}[a-z]{3}", scenario_id or "")
        return m.group(0) if m else None

    @staticmethod
    def _infer_lip_base_id(scenario_id: str) -> Optional[str]:
        """Infer a voice/lip base id from scenario_id when raw data omits voice_file."""
        m = re.search(r"(?<!\d)(9_2_\d{3})(?!\d)", scenario_id or "")
        if m:
            return f"{m.group(1)}_00"
        m = re.search(r"(?<!\d)([1-9]_\d+_\d+_\d{2})(?!\d)", scenario_id or "")
        if m:
            return m.group(1)
        m = re.search(r"(?<!\d)([1-9]_\d+_\d{3})(?!\d)", scenario_id or "")
        return m.group(1) if m else None

    def _lip_json_info(self, rel_path: str) -> Optional[dict]:
        abs_path = os.path.join(self.LIPSYNC_ROOT, rel_path)
        if not os.path.exists(abs_path):
            return None
        info = {
            "source": "adxlip",
            "path": "adxlip/" + rel_path.replace(os.sep, "/"),
        }
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            scales = data.get("scales")
            if isinstance(scales, list):
                info["frames"] = len(scales)
        except Exception:
            pass
        return info

    @classmethod
    def _ensure_lipsync_basename_index(cls) -> dict[str, str]:
        if cls._LIPSYNC_BASENAME_INDEX is not None:
            return cls._LIPSYNC_BASENAME_INDEX

        index: dict[str, str] = {}
        if os.path.isdir(cls.LIPSYNC_ROOT):
            for root, _dirs, files in os.walk(cls.LIPSYNC_ROOT):
                for name in files:
                    if not name.endswith(".json"):
                        continue
                    rel = os.path.relpath(os.path.join(root, name), cls.LIPSYNC_ROOT)
                    index.setdefault(name, rel)
        cls._LIPSYNC_BASENAME_INDEX = index
        return index

    def _resolve_lip_sync(self, chara_id: str, voice_suffix: str,
                          lipSync: Optional[bool]) -> Optional[dict]:
        """Find original game lip-scale JSON for the current voice cue.

        Known adxlip layouts:
          1) adxlip/{chara}/{prefix}/{prefix}_{suffix}.json
          2) adxlip/{owner}/{base}/{base}_{letter}/{base}_{suffix}.json
             where voice_file is {base}_{letter} and suffix is letter+number.
          3) adxlip/{chara}/{prefix}/{suffix}.json
             for commands where suffix is already a full cue name.
          4) adxlip/main/{main}/{base}/{base}_{letter}/{base}_{suffix}.json
             for main story scenarios such as 1_4_001_00_a1009.
        """
        if lipSync is False or not voice_suffix:
            return None

        owners = []
        for value in (chara_id, self._lip_owner_id):
            if value and value not in owners:
                owners.append(value)
        if self._lip_owner_id:
            epi_owner = os.path.join("epi", self._lip_owner_id)
            if epi_owner not in owners:
                owners.append(epi_owner)

        candidates = []
        if self._lip_base_id:
            main_parts = self._lip_base_id.split("_")
            if len(main_parts) >= 3:
                main_id = "_".join(main_parts[:3])
                base = self._lip_base_id
                prefix = self._voice_prefix or ""
                if prefix.startswith(f"{base}_") and re.match(r"^\d+$", voice_suffix):
                    candidates.append(os.path.join("main", main_id, base, prefix, f"{prefix}_{voice_suffix}.json"))
                letter = voice_suffix[0] if re.match(r"^[a-z]\d+$", voice_suffix) else ""
                if letter:
                    candidates.append(os.path.join("main", main_id, base, f"{base}_{letter}", f"{base}_{voice_suffix}.json"))
                subpart = voice_suffix.split("_", 1)[0] if re.match(r"^[a-z]\d+_\d+$", voice_suffix) else ""
                if subpart:
                    candidates.append(os.path.join("main", main_id, base, f"{base}_{subpart}", f"{base}_{voice_suffix}.json"))

                # Event stories, e.g.
                # adxlip/event/1_3_10001_01/1_3_10001_01_a/1_3_10001_01_a1003.json
                letter = voice_suffix[0] if re.match(r"^[a-z]\d+$", voice_suffix) else ""
                if letter:
                    candidates.append(os.path.join("event", base, f"{base}_{letter}", f"{base}_{voice_suffix}.json"))
                if prefix.startswith(f"{base}_") and re.match(r"^\d+$", voice_suffix):
                    candidates.append(os.path.join("event", base, prefix, f"{prefix}_{voice_suffix}.json"))

                # Season stories, e.g.
                # adxlip/season/5_01_22/5_01_000_22/5_01_000_22_a1000.json
                # adxlip/season/5_00_000_22/5_00_000_22_a1000.json
                if base.startswith("5_"):
                    season_group = None
                    if len(main_parts) >= 4 and main_parts[0] == "5":
                        if main_parts[1] == "05":
                            season_group = "5_05_fes"
                        elif main_parts[1] == "00" and main_parts[2] == "000" and main_parts[3] == "22":
                            season_group = base
                        else:
                            season_group = f"{main_parts[0]}_{main_parts[1]}_{main_parts[3]}"
                    if season_group:
                        candidates.append(os.path.join("season", season_group, base, f"{base}_{voice_suffix}.json"))
                        candidates.append(os.path.join("season", season_group, base, f"{voice_suffix}.json"))
                        candidates.append(os.path.join("season", season_group, f"{base}_{voice_suffix}.json"))
                        candidates.append(os.path.join("season", season_group, f"{voice_suffix}.json"))
                        if len(main_parts) >= 4:
                            shared_base = f"{main_parts[0]}_{main_parts[1]}_999_{main_parts[3]}"
                            candidates.append(os.path.join("season", season_group, shared_base, f"{base}_{voice_suffix}.json"))
                            candidates.append(os.path.join("season", season_group, shared_base, f"{voice_suffix}.json"))
                        # Short numeric suffix: try removing the last segment of base
                        if re.match(r"^\d+$", voice_suffix) and base.count("_") >= 3:
                            short_base = "_".join(base.split("_")[:-1])
                            candidates.append(os.path.join("season", season_group, short_base, f"{base}_{voice_suffix}.json"))

        for owner in owners:
            prefix = self._voice_prefix
            if prefix:
                candidates.append(os.path.join(owner, prefix, f"{prefix}_{voice_suffix}.json"))
                # Short numeric suffix: try parent directory (one level up)
                if re.match(r"^\d+$", voice_suffix) and prefix.count("_") >= 3:
                    short_prefix = "_".join(prefix.split("_")[:-1])
                    candidates.append(os.path.join(owner, short_prefix, f"{prefix}_{voice_suffix}.json"))
                    candidates.append(os.path.join(owner, short_prefix, f"{voice_suffix}.json"))

            if prefix and voice_suffix.startswith(prefix):
                candidates.append(os.path.join(owner, prefix, f"{voice_suffix}.json"))

            m = re.match(r"^(.+)_([a-z])$", prefix or "")
            if m and voice_suffix.startswith(m.group(2)):
                base, letter = m.group(1), m.group(2)
                candidates.append(os.path.join(owner, base, f"{base}_{letter}", f"{base}_{voice_suffix}.json"))

            if not prefix and self._lip_base_id:
                letter = voice_suffix[0] if re.match(r"^[a-z]\d+$", voice_suffix) else ""
                if letter:
                    base = self._lip_base_id
                    candidates.append(os.path.join(owner, base, f"{base}_{letter}", f"{base}_{voice_suffix}.json"))
                if re.match(r"^\d+$", voice_suffix):
                    base = self._lip_base_id
                    candidates.append(os.path.join(owner, base, f"{base}_{voice_suffix}.json"))
                    candidates.append(os.path.join(owner, base, f"{voice_suffix}.json"))

        seen = set()
        for rel in candidates:
            if rel in seen:
                continue
            seen.add(rel)
            info = self._lip_json_info(rel)
            if info:
                return info

        # Exact filename fallback. This catches cross-owner / cross-prefix
        # official lip data such as 5_01_038_23_b1000.json and the 9_2
        # profile files that live outside the normal owner tree.
        basename_candidates = []
        if self._voice_prefix:
            basename_candidates.append(f"{self._voice_prefix}_{voice_suffix}.json")
        if self._lip_base_id:
            basename_candidates.append(f"{self._lip_base_id}_{voice_suffix}.json")
            basename_candidates.append(f"{self._lip_base_id}.json")
        basename_candidates.append(f"{voice_suffix}.json")

        basename_index = self._ensure_lipsync_basename_index()
        for name in basename_candidates:
            rel = basename_index.get(name)
            if not rel:
                continue
            info = self._lip_json_info(rel)
            if info:
                return info
        return None

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
                if event.get("no_back"):
                    spine = self.state.find_spine(event["chara_id"])
                    if spine:
                        spine["anim_no_back"] = True
            elif event["type"] in ("spine_neck_anim", "spine_neck_stop"):
                # Neck commands are one-shot overlay events. Runtime owns the
                # live Track 3 pose until an authored stop/replacement clears it;
                # cumulative state must not restart the clip on later steps.
                continue
            elif event["type"] == "spine_color":
                spine = self.state.find_spine(event["chara_id"])
                if spine:
                    spine["idol_color"] = event["value"]
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
        # Preserve one canonical insertion order. A set here made emitted JSON
        # hashes depend on Python's per-process hash seed even though the
        # compiled semantics were identical, which breaks publication
        # candidate determinism.
        FLAG_KEYS = ("anim_flag", "sweat_flag", "blush_flag")

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

    @staticmethod
    def _infer_episode_part(source_id: str) -> str:
        m = re.search(r"_([a-z])$", source_id or "")
        return m.group(1) if m else ""

    def _begin_episode(self, source_id: str):
        part = self._infer_episode_part(source_id)
        self._current_episode = {
            "episode_index": len(self.episodes),
            "episode_no": len(self.episodes) + 1,
            "part": part,
            "source_scenario_id": source_id,
            "start_step_index": len(self.steps),
            "start_step_id": self.step_counter + 1,
        }

    def _end_episode(self):
        if not self._current_episode:
            return
        ep = self._current_episode
        start = ep["start_step_index"]
        end = len(self.steps)
        ep["end_step_index"] = end - 1 if end > start else start - 1
        ep["end_step_id"] = self.step_counter if end > start else self.step_counter
        ep["step_count"] = end - start
        for step in self.steps[start:end]:
            step["episode_index"] = ep["episode_index"]
            step["episode_part"] = ep["part"]
        self.episodes.append(ep)
        self._current_episode = None

    def _emit_step(self, step_type: str,
                   speaker: Optional[str], text: Optional[str],
                   voice: Optional[str], chara_id: Optional[str],
                   lipSync: Optional[bool] = None,
                   lip: Optional[dict] = None,
                   duration: Optional[float] = None):
        if step_type != "text_disable" and self._pending_text_disable:
            self._flush_pending_text_disable()

        self.step_counter += 1

        # Track all pending jump_point labels → this step
        if self._jump_point_labels:
            for lbl in self._jump_point_labels:
                self._jump_point_map[lbl] = self.step_counter
                self._jump_point_entries.append((lbl, self.step_counter))
            self._jump_point_labels.clear()

        step = {
            "step_id": self.step_counter,
            "type": step_type,
            # state snapshot = INITIAL state
            # (delayed commands with delay>0 are in _timeline_events, not applied yet)
            "state": self.state.snapshot(),
            "evidence": self._step_evidence(),
        }

        if step_type == "stage":
            step["duration"] = duration if duration is not None else 0.6
            step["auto_advance"] = True
            step["hide_dialogue"] = True
        elif duration is not None:
            step["duration"] = duration

        # One-shot state fields — clear after snapshot so they don't leak to next step
        self.state.se = None
        self.state.se_events = []
        self.state.screen_fade = None
        self.state.screen_slide = None
        self.state.screen_effects = []
        self.state.bg_transition = None
        self.state.bg_dof_transition = None
        self.state.bg_color_transition = None
        self.state.bgm_stop_fade = None
        self.state.environmental_duck_target = None
        self.state.text_disabled = False
        # Camera delay is an authored one-shot cue relative to this emitted
        # step. Keep the resulting zoom state, but do not replay its delay on
        # every later cumulative-state snapshot.
        if self.state.camera_zoom:
            self.state.camera_zoom.pop("delay", None)
        for effect in self.state.bg_effects:
            effect.pop("action", None)
            effect.pop("delay", None)
            effect.pop("duration", None)
        if self._pending_bg_effect_end_ids:
            self.state.bg_effects = [
                effect for effect in self.state.bg_effects
                if effect.get("id") not in self._pending_bg_effect_end_ids
            ]
            self._pending_bg_effect_end_ids.clear()
        for spine in self.state.spines:
            spine.pop("fade", None)
            # Immediate neck play/stop commands belong only to this snapshot.
            spine.pop("neck_anim", None)
            spine.pop("neck_anim_stop", None)
            spine.pop("idol_color_transition", None)
        if self._pending_fadeout_ids:
            for idol_id in list(self._pending_fadeout_ids):
                self.state.set_spine_visible(idol_id, False)
            self._pending_fadeout_ids.clear()

        # Attach timeline events to playable steps. Dialogue uses this for
        # mid-sentence changes; stage uses it for silent performance beats.
        if self._timeline_events and step_type in ("adv", "talk", "call", "stage", "text_disable"):
            step["timeline"] = self._process_timeline(list(self._timeline_events))
            self._apply_timeline()  # apply to main state for future step continuity
        elif self._timeline_events:
            # Non-dialogue step (synopsis/title): apply timeline to state directly
            self._apply_timeline()

        if chara_id:
            step["chara_id"] = chara_id

        if lipSync is not None:
            step["lipSync"] = lipSync

        if speaker is not None or text is not None:
            field_kind = {
                "adv": "dialogue",
                "talk": "mobile_message",
                "call": "phone_message",
                "synopsis": "synopsis",
                "title": "title",
            }.get(step_type, "dialogue")
            text_ordinal = 1 if step_type == "title" else 0
            dialogue = {
                "speaker": speaker or "",
                "text": text or "",               # legacy fallback
                "text_jp": text or "",             # Japanese (source)
                "text_cn": "",                     # Chinese translation (to be filled)
                "source_text": text or "",
                "speaker_identity": self._speaker_identity(
                    "" if step_type in ("synopsis", "title") else speaker,
                    None if step_type in ("synopsis", "title") else chara_id,
                ),
            }
            if text:
                dialogue["text_ref"] = self._text_ref(text, field_kind, text_ordinal)
            if step_type in ("synopsis", "title") and speaker:
                dialogue["speaker_text_ref"] = self._text_ref(speaker, "title", 0)
            if voice:
                dialogue["voice"] = voice
            if lip:
                dialogue["lip"] = lip
            step["dialogue"] = dialogue

        self.steps.append(step)
        self._clear_stage_buffer()

    # ----------------------------------------------------------------
    # Output
    # ----------------------------------------------------------------

    def _output(self) -> dict:
        # Resolve choice option labels to step IDs.
        # Jump labels can repeat across episodes (e.g. "phone_select1" used in
        # both early and late parts of the same scenario).  The flat dict
        # _jump_point_map only keeps the LAST mapping, so a choice early in the
        # timeline would resolve to the wrong (last) step_id.  Instead, scan
        # chronologically and pick the first entry after the choice step.
        for step in self.steps:
            if step.get("type") == "choice":
                for opt in step.get("options", []):
                    label = opt.get("label", "")
                    target = 0
                    for lbl, sid in self._jump_point_entries:
                        if lbl == label and sid > step["step_id"]:
                            target = sid
                            break
                    opt["step_id"] = target

        result = {
            "scenario_id": self.scenario_id,
            "text_catalog_id": self.text_catalog_id,
            "text_contract_version": self.TEXT_ID_VERSION,
            "total_steps": len(self.steps),
            "steps": self.steps,
            "jump_points": dict(self._jump_point_map),
        }
        if self.episodes:
            result["episodes"] = self.episodes
        return result

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
        part_id = basename.removeprefix("scenario_")
        compiler = cls(data, basename, part_id, os.path.basename(path))
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
