"""Filesystem resource lookup for compilation, with explicitly scoped caches."""
import json
import os
from pathlib import Path
from typing import Optional, Protocol


class ScenarioResources(Protocol):
    def background_index(self) -> dict[str, dict]: ...
    def audio_exists(self, audio_type: str, cue: Optional[str]) -> bool: ...
    def lip_info(self, rel_path: str) -> Optional[dict]: ...
    def lip_index(self) -> dict[str, str]: ...


class LocalScenarioResources:
    @classmethod
    def from_archive_sources(cls, sources, *, environment=None):
        """Use archive_paths configuration, with per-resource environment overrides."""
        environment = os.environ if environment is None else environment
        legacy = sources.legacy_root or sources.archive_root / 'sources' / 'legacy_curated'
        def root(variable, *parts):
            return Path(environment.get(variable) or legacy.joinpath(*parts)).resolve()
        return cls(
            lipsync_root=root('SIDEM_LIPSYNC_ROOT', 'scripts', 'lipsyncdata', 'adxlip'),
            background_root=root('SIDEM_ADV_BACKGROUND_ROOT', 'scripts', 'advbackground', 'json'),
            audio_root=root('SIDEM_AUDIO_ROOT', 'GS_Res', 'Audio'),
        )

    @classmethod
    def from_compiler_defaults(cls, compiler_class):
        """Capture legacy-configured roots with fresh, job-local caches."""
        return cls(lipsync_root=compiler_class.LIPSYNC_ROOT,
                   background_root=compiler_class.ADV_BACKGROUND_ROOT,
                   audio_root=compiler_class.AUDIO_ROOT)

    def __init__(self, *, lipsync_root, background_root, audio_root):
        self.LIPSYNC_ROOT = os.fspath(lipsync_root)
        self.ADV_BACKGROUND_ROOT = os.fspath(background_root)
        self.AUDIO_ROOT = os.fspath(audio_root)
        self._ADV_BACKGROUND_INDEX = None
        self._LIPSYNC_BASENAME_INDEX = None

    def background_index(self) -> dict[str, dict]:
        if self._ADV_BACKGROUND_INDEX is not None:
            return self._ADV_BACKGROUND_INDEX

        index: dict[str, dict] = {}
        root = self.ADV_BACKGROUND_ROOT
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

        self._ADV_BACKGROUND_INDEX = index
        return index

    def audio_exists(self, audio_type: str, cue: Optional[str]) -> bool:
        if not cue or cue in ("-", "no_bgm"):
            return False

        if audio_type == "bgm":
            return os.path.isfile(os.path.join(self.AUDIO_ROOT, "bgm", f"{cue}.ogg"))

        if audio_type == "ambient":
            path = os.path.join(self.AUDIO_ROOT, "ambient", f"{cue}.ogg")
            if os.path.isfile(path):
                return True
            if cue.endswith("_t"):
                return os.path.isfile(os.path.join(self.AUDIO_ROOT, "ambient", f"{cue[:-2]}.ogg"))

        return False

    def lip_info(self, rel_path: str) -> Optional[dict]:
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

    def lip_index(self) -> dict[str, str]:
        if self._LIPSYNC_BASENAME_INDEX is not None:
            return self._LIPSYNC_BASENAME_INDEX

        index: dict[str, str] = {}
        if os.path.isdir(self.LIPSYNC_ROOT):
            for root, _dirs, files in os.walk(self.LIPSYNC_ROOT):
                for name in files:
                    if not name.endswith(".json"):
                        continue
                    rel = os.path.relpath(os.path.join(root, name), self.LIPSYNC_ROOT)
                    index.setdefault(name, rel)
        self._LIPSYNC_BASENAME_INDEX = index
        return index


class LegacyCompilerResources(LocalScenarioResources):
    """Compatibility bridge for callers setting compiler class roots/caches."""
    def __init__(self, compiler_class):
        self.owner = compiler_class

    @property
    def LIPSYNC_ROOT(self):
        return self.owner.LIPSYNC_ROOT

    @property
    def ADV_BACKGROUND_ROOT(self):
        return self.owner.ADV_BACKGROUND_ROOT

    @property
    def AUDIO_ROOT(self):
        return self.owner.AUDIO_ROOT

    @property
    def _ADV_BACKGROUND_INDEX(self):
        return self.owner._ADV_BACKGROUND_INDEX

    @_ADV_BACKGROUND_INDEX.setter
    def _ADV_BACKGROUND_INDEX(self, value):
        self.owner._ADV_BACKGROUND_INDEX = value

    @property
    def _LIPSYNC_BASENAME_INDEX(self):
        return self.owner._LIPSYNC_BASENAME_INDEX

    @_LIPSYNC_BASENAME_INDEX.setter
    def _LIPSYNC_BASENAME_INDEX(self, value):
        self.owner._LIPSYNC_BASENAME_INDEX = value

