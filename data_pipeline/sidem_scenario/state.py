"""Cumulative scene state and snapshot rules; no filesystem access."""
import copy
from typing import Optional


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


