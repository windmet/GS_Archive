"""Pure story text identity rules; no compiler state or resource access."""
import hashlib
import re
import unicodedata
from typing import Any


def canonical_text_token(value: Any, field_name: str, pattern) -> str:
    token = str(value or "").strip()
    if not token:
        raise ValueError(f"{field_name} is required for story text identity")
    if not pattern.fullmatch(token):
        raise ValueError(f"{field_name} contains unsupported characters: {token!r}")
    return token


def canonical_source_file(value: Any) -> str:
    source_file = str(value or "").replace("\\", "/").strip()
    while source_file.startswith("./"):
        source_file = source_file[2:]
    parts = source_file.split("/")
    if not source_file or any(part in ("", ".", "..") for part in parts):
        raise ValueError(f"source_file must be a canonical relative path: {value!r}")
    if re.match(r"^[A-Za-z]:", source_file) or source_file.startswith("/"):
        raise ValueError(f"source_file must not be absolute: {value!r}")
    return source_file


def normalize_source_text(text: Any) -> str:
    value = str(text or "")
    if value.startswith("\ufeff"):
        value = value[1:]
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    return unicodedata.normalize("NFC", value)


def source_text_hash(text: Any, normalize=normalize_source_text) -> str:
    normalized = normalize(text)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def speaker_identity(source_name: Any, chara_id: Any = None) -> dict:
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
