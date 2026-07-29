"""Resolve local SideM archive sources without hard-coded machine paths.

Committed configuration is an example only. The optional local configuration
is ignored by Git, and individual command-line arguments remain the final
override for tools that expose them.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_CONFIG = (
    REPO_ROOT / "web_viewer" / "config" / "archive_sources.local.json"
)
CONFIG_ENVIRONMENT_VARIABLE = "SIDEM_ARCHIVE_SOURCES_CONFIG"
MASTERDATA_INPUT_STATES = ("xor", "decoded")
MasterdataInputState = Literal["xor", "decoded"]


def portable_path(path: Path, root: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(root.resolve()).as_posix()
    except ValueError:
        return str(resolved)


def add_sources_config_argument(parser: Any) -> None:
    parser.add_argument(
        "--sources-config",
        type=Path,
        help=(
            "Archive source JSON. Defaults to SIDEM_ARCHIVE_SOURCES_CONFIG, "
            "then the ignored local config, then repository defaults."
        ),
    )


def _optional_path(
    value: Any,
    *,
    archive_root: Path,
    field: str,
) -> Path | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty path string or null")
    path = Path(value)
    return (path if path.is_absolute() else archive_root / path).resolve()


def _required_path(value: Any, *, archive_root: Path, field: str) -> Path:
    path = _optional_path(value, archive_root=archive_root, field=field)
    if path is None:
        raise ValueError(f"{field} is required")
    return path


@dataclass(frozen=True)
class ArchiveSources:
    schema_version: int
    config_path: Path | None
    archive_root: Path
    raw_root: Path
    masterdata_source_file: Path | None
    masterdata_source_sha256: str | None
    masterdata_decoded_file: Path | None
    masterdata_decoded_sha256: str | None
    legacy_root: Path | None
    inventory_root: Path
    workspace_root: Path
    derived_root: Path
    publish_root: Path
    vgmstream_file: Path | None
    ffmpeg_file: Path | None
    ffprobe_file: Path | None
    wannacri_root: Path | None
    xapk_file: Path | None

    def published_path(self, *parts: str) -> Path:
        return self.publish_root.joinpath(*parts).resolve()

    def inventory_path(self, *parts: str) -> Path:
        return self.inventory_root.joinpath(*parts).resolve()

    def tool_file(self, name: Literal["vgmstream", "ffmpeg", "ffprobe"]) -> Path:
        path = {
            "vgmstream": self.vgmstream_file,
            "ffmpeg": self.ffmpeg_file,
            "ffprobe": self.ffprobe_file,
        }[name]
        if path is None:
            raise ValueError(f"audio tool {name!r} is not configured")
        return path

    def masterdata_input(self, state: MasterdataInputState) -> Path:
        """Return the path for an explicitly declared masterdata input state."""

        if state == "xor":
            path = self.masterdata_source_file
        elif state == "decoded":
            path = self.masterdata_decoded_file
        else:
            raise ValueError(
                f"unsupported masterdata input state {state!r}; "
                f"expected one of {MASTERDATA_INPUT_STATES}"
            )
        if path is None:
            raise ValueError(f"masterdata {state!r} input is not configured")
        return path


def _built_in_sources() -> ArchiveSources:
    archive_root = REPO_ROOT.resolve()
    return ArchiveSources(
        schema_version=1,
        config_path=None,
        archive_root=archive_root,
        raw_root=(archive_root / "RAW").resolve(),
        masterdata_source_file=None,
        masterdata_source_sha256=None,
        masterdata_decoded_file=(
            archive_root
            / "web_viewer"
            / ".analysis"
            / "masterdata"
            / "client_master_data.xor_DefaultPassPhrase.pb"
        ).resolve(),
        masterdata_decoded_sha256=None,
        legacy_root=None,
        inventory_root=(
            archive_root / "web_viewer" / ".analysis" / "raw-migration"
        ).resolve(),
        workspace_root=(
            archive_root / "web_viewer" / ".analysis" / "workspace"
        ).resolve(),
        derived_root=(
            archive_root / "web_viewer" / ".analysis" / "derived"
        ).resolve(),
        publish_root=(archive_root / "web_viewer" / "public").resolve(),
        vgmstream_file=None,
        ffmpeg_file=None,
        ffprobe_file=None,
        wannacri_root=None,
        xapk_file=None,
    )


def _configured_path(explicit_path: Path | None) -> Path | None:
    if explicit_path is not None:
        resolved = explicit_path.resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)
        return resolved

    environment_value = os.environ.get(CONFIG_ENVIRONMENT_VARIABLE)
    if environment_value:
        resolved = Path(environment_value).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)
        return resolved

    return DEFAULT_LOCAL_CONFIG.resolve() if DEFAULT_LOCAL_CONFIG.is_file() else None


def load_archive_sources(config_path: Path | None = None) -> ArchiveSources:
    """Load the explicit, environment, or ignored local source configuration.

    When no configuration exists, repository-relative defaults preserve the
    historical checkout behavior. A supplied path is always strict.
    """

    resolved_config = _configured_path(config_path)
    if resolved_config is None:
        return _built_in_sources()

    payload = json.loads(resolved_config.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("archive source configuration must be a JSON object")
    if payload.get("schema_version") != 1:
        raise ValueError("archive source configuration schema_version must be 1")

    archive_value = payload.get("archive_root")
    if not isinstance(archive_value, str) or not archive_value.strip():
        raise ValueError("archive_root must be a non-empty path string")
    archive_path = Path(archive_value)
    archive_root = (
        archive_path
        if archive_path.is_absolute()
        else resolved_config.parent / archive_path
    ).resolve()

    source = _optional_path(
        payload.get("masterdata_source_file"),
        archive_root=archive_root,
        field="masterdata_source_file",
    )
    decoded = _optional_path(
        payload.get("masterdata_decoded_file"),
        archive_root=archive_root,
        field="masterdata_decoded_file",
    )
    if source is not None and decoded is not None and source == decoded:
        raise ValueError(
            "masterdata_source_file and masterdata_decoded_file must be distinct"
        )

    def optional_hash(field: str) -> str | None:
        value = payload.get(field)
        if value is None:
            return None
        if not isinstance(value, str) or len(value) != 64:
            raise ValueError(f"{field} must be a 64-character SHA-256 or null")
        try:
            int(value, 16)
        except ValueError as error:
            raise ValueError(f"{field} must contain hexadecimal characters") from error
        return value.lower()

    return ArchiveSources(
        schema_version=1,
        config_path=resolved_config,
        archive_root=archive_root,
        raw_root=_required_path(
            payload.get("raw_root"),
            archive_root=archive_root,
            field="raw_root",
        ),
        masterdata_source_file=source,
        masterdata_source_sha256=optional_hash("masterdata_source_sha256"),
        masterdata_decoded_file=decoded,
        masterdata_decoded_sha256=optional_hash("masterdata_decoded_sha256"),
        legacy_root=_optional_path(
            payload.get("legacy_root"),
            archive_root=archive_root,
            field="legacy_root",
        ),
        inventory_root=_required_path(
            payload.get("inventory_root"),
            archive_root=archive_root,
            field="inventory_root",
        ),
        workspace_root=_required_path(
            payload.get("workspace_root"),
            archive_root=archive_root,
            field="workspace_root",
        ),
        derived_root=_required_path(
            payload.get("derived_root"),
            archive_root=archive_root,
            field="derived_root",
        ),
        publish_root=_required_path(
            payload.get("publish_root"),
            archive_root=archive_root,
            field="publish_root",
        ),
        vgmstream_file=_optional_path(
            payload.get("vgmstream_file"),
            archive_root=archive_root,
            field="vgmstream_file",
        ),
        ffmpeg_file=_optional_path(
            payload.get("ffmpeg_file"),
            archive_root=archive_root,
            field="ffmpeg_file",
        ),
        ffprobe_file=_optional_path(
            payload.get("ffprobe_file"),
            archive_root=archive_root,
            field="ffprobe_file",
        ),
        wannacri_root=_optional_path(
            payload.get("wannacri_root"),
            archive_root=archive_root,
            field="wannacri_root",
        ),
        xapk_file=_optional_path(
            payload.get("xapk_file"),
            archive_root=archive_root,
            field="xapk_file",
        ),
    )
